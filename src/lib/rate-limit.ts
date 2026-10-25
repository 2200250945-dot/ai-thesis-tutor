import { createHash } from "node:crypto";

type RateLimitResult =
  | { status: "allowed" }
  | { status: "limited"; retryAfterSeconds: number }
  | { status: "unconfigured" };

// In-memory fallback is only for local development. Production must use shared Redis
// so limits remain effective across serverless instances and deployments.
const localHits = new Map<string, number[]>();

export async function checkRateLimit(
  request: Request,
  route: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === "production") return { status: "unconfigured" };

    const now = Date.now();
    const ip = getClientIp(request);
    const key = `${route}:${ip}`;
    const hits = (localHits.get(key) || []).filter((time) => now - time < windowMs);
    if (hits.length >= limit) {
      localHits.set(key, hits);
      return { status: "limited", retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)) };
    }
    hits.push(now);
    localHits.set(key, hits);
    return { status: "allowed" };
  }

  const ipHash = createHash("sha256").update(getClientIp(request)).digest("hex");
  const key = `ai-thesis-tutor:rl:${route}:${ipHash}`;
  const script = [
    'local count = redis.call("INCR", KEYS[1])',
    'if count == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end',
    'return {count, redis.call("PTTL", KEYS[1])}',
  ].join("; ");

  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, "")}/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["EVAL", script, "1", key, String(windowMs)]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Redis rate-limit request failed (${response.status})`);
    const payload = (await response.json()) as { result?: [number, number]; error?: string };
    if (payload.error || !Array.isArray(payload.result)) throw new Error("Invalid rate-limit response");
    const [count, ttlMs] = payload.result;
    if (count > limit) {
      return { status: "limited", retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)) };
    }
    return { status: "allowed" };
  } catch (error) {
    // Fail closed in production: do not allow an outage to expose unlimited paid API calls.
    console.error("Rate-limit service error:", error);
    return { status: "unconfigured" };
  }
}


// Shared daily budget across ALL visitors and both AI endpoints.
// Default: 100 model requests per UTC day. Override with DAILY_AI_REQUEST_LIMIT.
export async function checkDailyGlobalLimit(
  requestedLimit = Number(process.env.DAILY_AI_REQUEST_LIMIT) || 100,
): Promise<RateLimitResult> {
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(10_000, Math.floor(requestedLimit)))
    : 100;

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const nextUtcMidnight = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate() + 1,
  );
  const retryAfterSeconds = Math.max(1, Math.ceil((nextUtcMidnight - now) / 1000));

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === "production") return { status: "unconfigured" };

    const key = `global-daily:${day}`;
    const dayStart = nextUtcMidnight - 24 * 60 * 60 * 1000;
    const hits = (localHits.get(key) || []).filter((time) => time >= dayStart);
    if (hits.length >= limit) {
      localHits.set(key, hits);
      return { status: "limited", retryAfterSeconds };
    }
    hits.push(now);
    localHits.set(key, hits);
    return { status: "allowed" };
  }

  // Atomic Redis check-and-increment: concurrent requests cannot exceed the cap.
  const key = `ai-thesis-tutor:daily:${day}`;
  const ttlSeconds = retryAfterSeconds + 60;
  const script = [
    'local count = tonumber(redis.call("GET", KEYS[1]) or "0")',
    'local limit = tonumber(ARGV[1])',
    'if count >= limit then return {0, count, redis.call("TTL", KEYS[1])} end',
    'count = redis.call("INCR", KEYS[1])',
    'if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end',
    'return {1, count, redis.call("TTL", KEYS[1])}',
  ].join("; ");

  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, "")}/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["EVAL", script, "1", key, String(limit), String(ttlSeconds)]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Redis daily-limit request failed (${response.status})`);
    const payload = (await response.json()) as { result?: [number, number, number]; error?: string };
    if (payload.error || !Array.isArray(payload.result)) {
      throw new Error("Invalid daily-limit response");
    }
    const [allowed, , ttl] = payload.result.map(Number);
    if (allowed !== 1) {
      return {
        status: "limited",
        retryAfterSeconds: Math.max(1, Number.isFinite(ttl) && ttl > 0 ? ttl : retryAfterSeconds),
      };
    }
    return { status: "allowed" };
  } catch (error) {
    // Fail closed in production so Redis failures cannot remove the daily cost guard.
    console.error("Daily global-limit service error:", error);
    return { status: "unconfigured" };
  }
}

function getClientIp(request: Request): string {
  // On Vercel, x-real-ip is set by the platform. The forwarded header is a fallback.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 100);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 100) : "unknown";
}
