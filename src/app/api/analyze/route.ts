
import OpenAI from "openai";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { checkRateLimit, checkDailyGlobalLimit } from "@/lib/rate-limit";


export async function POST(request: Request) {


  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: "服务器尚未配置 DeepSeek API Key。" },
        { status: 500 }
      );
    }

    const rateLimit = await checkRateLimit(request, "analyze", 3, 60_000);
    if (rateLimit.status === "unconfigured") {
      return Response.json(
        { error: "服务暂时不可用，请稍后重试。" },
        { status: 503 }
      );
    }
    if (rateLimit.status === "limited") {
      return Response.json(
        { error: "请求太频繁，请稍后再试。" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const ai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "请先上传论文文件。" },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return Response.json(
        { error: "文件不能超过 15 MB。" },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let paperText = "";

if (name.endsWith(".pdf")) {
  const result = await pdf(buffer);
  paperText = result.text;

    } else if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      paperText = result.value;
    } else {
      return Response.json(
        { error: "目前仅支持 PDF 和 DOCX 文件。" },
        { status: 400 }
      );
    }

    if (!paperText.trim()) {
      return Response.json(
        {
          error:
            "没有提取到论文正文。请检查文件是否有效，PDF 是否为扫描图片。",
        },
        { status: 400 }
      );
    }

    // MVP：限制输入长度，控制单次调用的成本。
    const text = paperText.slice(0, 50000);

    const dailyLimit = await checkDailyGlobalLimit();
    if (dailyLimit.status === "unconfigured") {
      return Response.json(
        { error: "服务保护暂时不可用，请稍后重试。" },
        { status: 503 }
      );
    }
    if (dailyLimit.status === "limited") {
      return Response.json(
        { error: "今日免费试用额度已用完，请明天再试。" },
        { status: 429, headers: { "Retry-After": String(dailyLimit.retryAfterSeconds) } }
      );
    }

    const completion = await ai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.4,
      max_tokens: 3000,
      messages: [
        {
          role: "system",
          content: `你是一位认真、严谨的中国高校本科毕业论文导师。
请根据学生提供的论文内容，完成论文初步诊断。
不得编造论文中不存在的研究结果或事实；信息不足时明确说明。
请使用中文，按以下结构输出：

一、论文内容概述
概括研究主题、研究目标、研究方法和主要结论。

二、论文优点
指出具体优点，并说明依据。

三、需要改进的问题
按严重程度列出问题，尽可能指出对应的内容或章节。
区分明确存在的问题与需要进一步核实的疑点。

四、答辩高频问题
提出10个与论文具体内容相关的问题，覆盖研究背景、
研究方法、结果分析、创新点、局限性和结论。
每个问题说明导师为什么会问。

五、修改建议
给出具体、可执行的修改方向，按优先级排序。

六、总体评价
简要说明论文目前的主要优势、风险和答辩准备重点。`,
        },
        {
          role: "user",
          content: `请分析以下本科毕业论文正文：\n\n${text}`,
        },
      ],
    });

    const analysis = completion.choices[0]?.message?.content;

    if (!analysis) {
      return Response.json(
        { error: "AI 暂时没有返回分析结果，请稍后重试。" },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      fileName: file.name,
      extractedCharacters: paperText.length,
      truncated: paperText.length > 50000,
      analysis,
    });
  } catch (error) {
    console.error("论文分析失败：", error);

    return Response.json(
      {
        error:
          "论文分析失败。请检查文件格式、API Key、账户额度及服务器日志。",
      },
      { status: 500 }
    );

}
}