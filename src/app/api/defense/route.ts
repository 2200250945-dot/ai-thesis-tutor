
import OpenAI from "openai";
import mammoth from "mammoth";
import pdf from "pdf-parse";

const ai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export const maxDuration = 60;

type HistoryItem = {
  question: string;
  answer: string;
  feedback?: string;
  score?: number;
};

async function extractPaper(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("论文文件不能超过 15 MB。");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (name.endsWith(".pdf")) {
  const result = await pdf(buffer);
  return result.text.trim();
}

  throw new Error("目前仅支持 PDF 和 DOCX 文件。");
}

export async function POST(request: Request) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json(
        { error: "服务器尚未配置 DeepSeek API Key。" },
        { status: 500 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let mode: string;
    let paperText: string;
    let history: HistoryItem[] = [];
    let currentQuestion = "";
    let userAnswer = "";
    let questionNumber = 1;
    let maxQuestions = 10;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");

const requestedQuestionCount = Number(form.get("questionCount"));

if (Number.isFinite(requestedQuestionCount) && requestedQuestionCount >= 1) {
  maxQuestions = Math.min(20, Math.max(1, Math.floor(requestedQuestionCount)));
}

      if (!(file instanceof File)) {
        return Response.json(
          { error: "请先上传论文文件。" },
          { status: 400 }
        );
      }

      mode = "start";
      paperText = await extractPaper(file);
    } else {
      const body = await request.json();

      mode = body.mode;
      paperText = body.paperText;
      history = Array.isArray(body.history) ? body.history : [];
      currentQuestion = body.currentQuestion || "";
      userAnswer = body.userAnswer || "";
      questionNumber = Number(body.questionNumber) || 1;
      maxQuestions = Math.min(
        10,
        Math.max(1, Number(body.maxQuestions) || 10)
      );

      if (typeof paperText !== "string" || !paperText.trim()) {
        return Response.json(
          { error: "缺少论文正文，请重新上传论文。" },
          { status: 400 }
        );
      }
    }

    if (!paperText.trim()) {
      return Response.json(
        { error: "没有提取到论文正文，请检查文件内容。" },
        { status: 400 }
      );
    }

    if (mode !== "start" && mode !== "answer") {
      return Response.json(
        { error: "不支持的操作类型。" },
        { status: 400 }
      );
    }

    if (mode === "answer" && (!currentQuestion || !userAnswer.trim())) {
      return Response.json(
        { error: "请提供当前问题和你的回答。" },
        { status: 400 }
      );
    }

    const paper = paperText.slice(0, 30000);

    const systemPrompt = `你是一位严谨、友善的中国高校本科毕业论文答辩导师。
你必须以提供的论文为依据提问，不得编造论文内容。
学生可能回答不完整，也可能承认自己不知道，请根据实际回答进行评价。
每次只提出一道问题，避免一次提出多个问题。
使用中文，评价具体、客观、有建设性。

你必须只返回合法 JSON，不要使用 Markdown 代码块。
开始答辩时，JSON 格式为：
{"question":"第一道问题","questionNumber":1,"finished":false}

评价回答时，JSON 格式为：
{
  "feedback":"对回答的具体评价，指出优点和不足",
  "score":7,
  "suggestedAnswer":"一个更完整的回答示例",
  "nextQuestion":"下一道问题；如果结束则为空字符串",
  "questionNumber":2,
  "finished":false,
  "summary":"仅在结束时提供总体评价，否则为空字符串"
}

score 为 0 到 10 的整数。
如果学生回答不充分，可以在下一道题中追问。

当已完成题数达到指定上限时，finished 必须为 true，
nextQuestion 为空字符串。summary 必须生成一份有实际指导价值的本科毕业论文答辩总结报告，使用中文，并包含以下部分：

一、整体答辩表现：根据历史问答和评分，评价学生对论文研究目标、研究方法、核心内容和结论的掌握程度。不得编造学生没有表达过的观点。

二、主要薄弱点：指出学生回答中暴露出的具体问题，例如概念理解不清、论证不足、研究方法解释不充分或结论缺少依据。没有证据的问题不得臆测。

三、论文修改建议：结合论文正文，提出至少3条具体、可执行的修改建议。每条建议应尽量说明对应的章节、现有问题、修改方向和修改目的。章节或原文无法确认时，必须明确说明，不得虚构章节、数据或原文。

四、修改优先级：将建议分为高、中、低三个优先级，优先指出可能影响论文逻辑、研究可信度和答辩表现的问题。

五、后续准备计划：给出学生下一步最值得完成的3项任务。

最终报告必须使用以下固定结构输出，每个部分单独换行，内容简洁具体，不得将整份报告写成一个大段落：

【一、答辩总体评价】
用2至3句话总结学生的整体表现。

【二、答辩成绩与薄弱点】
概括学生掌握较好的内容、主要薄弱知识点，以及答辩中暴露的问题。

【三、论文修改清单】
使用编号列表逐条列出建议，每条严格采用以下格式：
- 优先级：高/中/低
- 对应章节：明确章节名称；无法确认时写“待核实”
- 当前问题：说明具体问题及依据
- 修改建议：给出可执行的修改方法
- 修改目的：说明修改后要解决什么问题

至少提供3条有实际价值的建议；若现有材料不足以支持3条具体建议，必须明确说明证据不足，不得为了凑数编造问题。

【四、下一步准备计划】
列出学生接下来最值得完成的3项任务，按照先后顺序排列。

不要重复同一条建议，不要编造论文原文、章节、实验数据或评分依据。

必须区分论文正文中已经确认的问题与基于现有信息提出的改进建议。若论文缺少摘要、研究数据或其他必要内容，应明确指出证据不足，不得把推测写成事实。

questionNumber 表示下一道题的编号。`;

    const userPrompt =
      mode === "start"
        ? `请阅读以下本科毕业论文，提出第一道有针对性的答辩问题。
题目应能考查学生对研究内容的真实理解。

计划题数：${maxQuestions}

论文正文：
${paper}`
        : `请评价学生对当前答辩问题的回答，并决定是否提出下一道问题。

计划总题数：${maxQuestions}
当前题号：${questionNumber}

已有问答记录：
${JSON.stringify(history)}

当前问题：
${currentQuestion}

学生回答：
${userAnswer}

论文正文：
${paper}

如果当前题是最后一道题，请结束答辩并生成总体评价。`;

    const completion = await ai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.4,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AI 暂时没有返回内容，请重试。");
    }

    let result;

    try {
      result = JSON.parse(content);
    } catch {
      throw new Error("AI 返回的数据格式异常，请重试。");
    }

    if (mode === "start") {
      if (
        typeof result.question !== "string" ||
        !result.question.trim()
      ) {
        throw new Error("AI 没有生成有效的答辩问题，请重试。");
      }

      return Response.json({
        success: true,
        mode: "start",
        paperText,
        question: result.question,
        questionNumber: 1,
        maxQuestions,
        finished: false,
      });
    }

    if (
      typeof result.feedback !== "string" ||
      typeof result.score !== "number"
    ) {
      throw new Error("AI 返回的回答评价不完整，请重试。");
    }

    return Response.json({
      success: true,
      mode: "answer",
      feedback: result.feedback,
      score: Math.max(0, Math.min(10, result.score)),
      suggestedAnswer: result.suggestedAnswer || "",
nextQuestion:
  questionNumber >= maxQuestions
    ? ""
    : result.nextQuestion ||
      "请进一步说明你的研究结论与论文中的证据是如何对应的？",
questionNumber:
  questionNumber >= maxQuestions
    ? questionNumber
    : questionNumber + 1,
finished: questionNumber >= maxQuestions,
summary:
  questionNumber >= maxQuestions
    ? result.summary || "本次答辩已完成，请结合各题反馈进一步完善论文。"
    : "",
    });
  } catch (error) {
    console.error("答辩接口错误：", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "答辩请求失败，请检查服务器日志。",
      },
      { status: 500 }
    );
  }
}
