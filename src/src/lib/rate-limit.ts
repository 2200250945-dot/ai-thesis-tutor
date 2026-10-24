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

function getClientIp(request: Request): string {
  // On Vercel, x-real-ip is set by the platform. The forwarded header is a fallback.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 100);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 100) : "unknown";
}
