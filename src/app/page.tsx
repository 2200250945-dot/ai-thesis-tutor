
"use client";

import { useEffect, useRef, useState } from "react";

type TrainingMode = "standard" | "strict" | "basic";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<TrainingMode>("standard");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState("");
const [loading, setLoading] = useState(false);

const [defenseStarted, setDefenseStarted] = useState(false);
const [currentQuestion, setCurrentQuestion] = useState("");
const [answer, setAnswer] = useState("");
const [history, setHistory] = useState<
  {
    question: string;
    answer: string;
    feedback?: string;
    score?: number;
  }[]
>([]);
const [questionNumber, setQuestionNumber] = useState(1);
const [questionCount, setQuestionCount] = useState(10);
const maxQuestions = questionCount;
const [feedback, setFeedback] = useState("");
const [suggestedAnswer, setSuggestedAnswer] = useState("");
const [defenseFinished, setDefenseFinished] = useState(false);
const [summary, setSummary] = useState("");
const [defenseLoading, setDefenseLoading] = useState(false);
const [defensePaperText, setDefensePaperText] = useState("");
const [stateRestored, setStateRestored] = useState(false);
const [defenseRecords, setDefenseRecords] = useState<any[]>([]);
const [showHistory, setShowHistory] = useState(false);
const [legalPanel, setLegalPanel] = useState<"privacy" | "terms" | null>(null);
const [selectedRecord, setSelectedRecord] = useState<any>(null);
const [checkedPrepItems, setCheckedPrepItems] = useState<string[]>([]);
const [prepChecklistRestored, setPrepChecklistRestored] = useState(false);

const prepChecklist = [
  { id: "core", title: "能用 1 分钟讲清论文核心", detail: "研究问题、方法、结论分别是什么" },
  { id: "method", title: "能解释研究方法与选择依据", detail: "为什么采用这种方法，而不是其他方法" },
  { id: "evidence", title: "能指出关键数据或论据来源", detail: "结论对应哪些数据、案例或文献" },
  { id: "limits", title: "能说明研究局限与后续方向", detail: "哪些问题尚未解决，原因是什么" },
];

// 从现有诊断报告中提取可能值得优先复核的段落；不替代 AI 正式诊断结论。
const diagnosticRiskLines = analysis
  .split(/\n+/)
  .map((line) => line.replace(/^\s*[-*#•\d.、）)]+\s*/, "").trim())
  .filter((line) => line.length >= 12 && /(不足|薄弱|问题|风险|缺乏|不清晰|不明确|未能|建议|改进|局限|证据|创新|逻辑|方法)/i.test(line))
  .slice(0, 4);

const latestRecord = defenseRecords[0];
const workspaceStage = defenseFinished ? "complete" : defenseStarted ? "training" : loading ? "analyzing" : analysis ? "diagnosed" : "initial";
const latestWeakAnswers = (latestRecord?.history || [])
  .filter((item: any) => typeof item.score === "number" && item.score <= 6)
  .sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
  .slice(0, 3);

useEffect(() => {
  try {
    const savedChecklist = localStorage.getItem("ai-thesis-tutor-prep-checklist");
    if (savedChecklist) {
      const parsed = JSON.parse(savedChecklist);
      if (Array.isArray(parsed)) {
        setCheckedPrepItems(parsed.filter((item) => typeof item === "string"));
      }
    }
  } catch (error) {
    console.error("读取答辩准备清单失败：", error);
  } finally {
    setPrepChecklistRestored(true);
  }
}, []);

useEffect(() => {
  if (!prepChecklistRestored) return;
  try {
    localStorage.setItem(
      "ai-thesis-tutor-prep-checklist",
      JSON.stringify(checkedPrepItems)
    );
  } catch (error) {
    console.error("保存答辩准备清单失败：", error);
  }
}, [checkedPrepItems, prepChecklistRestored]);
useEffect(() => {
  try {
    const saved = localStorage.getItem("ai-thesis-tutor-session");

    if (saved) {
      const data = JSON.parse(saved);

      if (typeof data.analysis === "string") {
        setAnalysis(data.analysis);
      }

      if (typeof data.mode === "string") {
        setMode(data.mode);
      }

      if (typeof data.defensePaperText === "string") {
        setDefensePaperText(data.defensePaperText);
      }

      if (typeof data.defenseStarted === "boolean") {
        setDefenseStarted(data.defenseStarted);
      }

      if (typeof data.currentQuestion === "string") {
        setCurrentQuestion(data.currentQuestion);
      }

      if (Array.isArray(data.history)) {
        setHistory(data.history);
      }

      if (typeof data.questionNumber === "number") {
        setQuestionNumber(data.questionNumber);
      }

      if (typeof data.feedback === "string") {
        setFeedback(data.feedback);
      }

      if (typeof data.suggestedAnswer === "string") {
        setSuggestedAnswer(data.suggestedAnswer);
      }

      if (typeof data.defenseFinished === "boolean") {
        setDefenseFinished(data.defenseFinished);
      }

      if (typeof data.summary === "string") {
        setSummary(data.summary);
      }
    }
  } catch (error) {
    console.error("恢复答辩记录失败：", error);
  } finally {
    setStateRestored(true);
  }
}, []);

useEffect(() => {
  try {
    const savedRecords = localStorage.getItem("ai-thesis-tutor-records");

    if (savedRecords) {
      setDefenseRecords(JSON.parse(savedRecords));
    }
  } catch (error) {
    console.error("读取历史答辩记录失败：", error);
  }
}, []);

useEffect(() => {
  if (!stateRestored) return;

  try {
    localStorage.setItem(
      "ai-thesis-tutor-session",
      JSON.stringify({
        analysis,
        mode,
        defensePaperText,
        defenseStarted,
        currentQuestion,
        history,
        questionNumber,
        feedback,
        suggestedAnswer,
        defenseFinished,
        summary,
      })
    );
  } catch (error) {
    console.error("保存答辩记录失败：", error);
    setNotice("本地保存失败，请检查浏览器存储空间。");
  }
}, [
  stateRestored,
  analysis,
  mode,
  defensePaperText,
  defenseStarted,
  currentQuestion,
  history,
  questionNumber,
  feedback,
  suggestedAnswer,
  defenseFinished,
  summary,
]);

  function exportCurrentReport() {
    const scoredItems = history.filter(
      (item) => typeof item.score === "number"
    );
    const averageScore = scoredItems.length
      ? (
          scoredItems.reduce((total, item) => total + (item.score as number), 0) /
          scoredItems.length
        ).toFixed(1)
      : "暂无评分";

    const questionDetails = history.map((item, index) => [
      `第 ${index + 1} 题`,
      `问题：${item.question || "暂无题目"}`,
      `你的回答：${item.answer || "暂无回答"}`,
      `导师反馈：${item.feedback || "暂无反馈"}`,
      `评分：${typeof item.score === "number" ? `${item.score}/10` : "暂无评分"}`,
    ].filter(Boolean).join("\n")).join("\n\n----------------------------------------\n\n");

    const reportText = [
      "答辩通｜答辩训练报告",
      `论文文件：${file?.name || latestRecord?.fileName || "未命名论文"}`,
      `导出时间：${new Date().toLocaleString("zh-CN")}`,
      `训练状态：${defenseFinished ? "已结束" : "进行中"}`,
      `已回答题目：${history.length}`,
      `答辩平均分：${averageScore}${averageScore === "暂无评分" ? "" : "/10"}`,
      "",
      "一、论文诊断报告",
      analysis || "当前没有可导出的论文诊断报告。",
      "",
      "二、本次答辩总结",
      summary || "当前没有答辩总结。",
      "",
      "三、逐题问答与反馈",
      questionDetails || "当前没有已保存的问答记录。",
      "",
      "说明：本报告用于答辩练习与自我复盘，不代表学校正式答辩成绩或学术评审结论。",
    ].join("\n");

    const blob = new Blob(["\uFEFF", reportText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (file?.name || latestRecord?.fileName || "答辩训练")
      .replace(/\.(pdf|docx?)$/i, "")
      .replace(/[\\/:*?"<>|]/g, "_");

    link.href = url;
    link.download = `${safeName}-答辩报告.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetTestEnvironment() {
    const confirmed = window.confirm(
      "确定恢复到初始状态吗？这会清除当前论文诊断、正在进行的答辩、答辩准备清单，以及本浏览器保存的全部历史答辩记录。此操作无法撤销。"
    );

    if (!confirmed) return;

    try {
      localStorage.removeItem("ai-thesis-tutor-session");
      localStorage.removeItem("ai-thesis-tutor-records");
      localStorage.removeItem("ai-thesis-tutor-prep-checklist");
    } catch (error) {
      console.error("清除本地测试数据失败：", error);
    }

    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    setMode("standard");
    setNotice("测试环境已重置，可以重新开始。");
    setDragging(false);
    setAnalysis("");
    setLoading(false);
    setDefenseStarted(false);
    setCurrentQuestion("");
    setAnswer("");
    setHistory([]);
    setQuestionNumber(1);
    setQuestionCount(10);
    setFeedback("");
    setSuggestedAnswer("");
    setDefenseFinished(false);
    setSummary("");
    setDefenseLoading(false);
    setDefensePaperText("");
    setDefenseRecords([]);
    setShowHistory(false);
    setSelectedRecord(null);
    setCheckedPrepItems([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const inputRef = useRef<HTMLInputElement>(null);

  function selectFile(selected: File | undefined) {
    if (!selected) return;

    const valid =
      /\.(pdf|docx)$/i.test(selected.name);

    if (!valid) {
      setNotice("目前仅支持 PDF 和 DOCX 格式。");
      return;
    }

    if (selected.size > 15 * 1024 * 1024) {
      setNotice("文件不能超过 15 MB，请选择较小的文件。");
      return;
    }

    setFile(selected);
    setNotice("论文已选择，请确认后开始。");
  }

 
async function startTraining() {
  if (!file) {
    setNotice("请先上传你的毕业论文。");
    return;
  }

  setLoading(true);
  setAnalysis("");
  setNotice("正在读取论文并请求 AI 分析，请稍候……");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "论文分析失败，请稍后重试。");
    }

    setAnalysis(result.analysis);
    setNotice(
      `分析完成！已读取 ${result.extractedCharacters} 个字符。${
        result.truncated ? " 本次分析只使用了论文前 50000 个字符。" : ""
      }`
    );
  } catch (error) {
    setNotice(
      error instanceof Error
        ? error.message
        : "请求失败，请检查网络和服务器状态。"
    );
  } finally {
    setLoading(false);
  }
}

async function startDefense() {
  if (!file) {
    setNotice("请先上传你的毕业论文。");
    return;
  }

  setDefenseLoading(true);
  setDefenseStarted(false);
  setDefenseFinished(false);
  setHistory([]);
  setFeedback("");
  setSuggestedAnswer("");
  setSummary("");
  setAnswer("");
  setNotice("AI 导师正在阅读论文并准备第一道问题……");

  try {

const formData = new FormData();
formData.append("file", file);
formData.append("questionCount", String(questionCount));


    const response = await fetch("/api/defense", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "生成答辩问题失败。");
    }

    setDefensePaperText(result.paperText);
    setCurrentQuestion(result.question);
    setQuestionNumber(1);
    setDefenseStarted(true);
    setNotice("第一道答辩问题已生成，请向下滚动到页面下方的答题区作答。");
  } catch (error) {
    setNotice(
      error instanceof Error
        ? error.message
        : "启动答辩失败，请检查服务器状态。"
    );
  } finally {
    setDefenseLoading(false);
  }
}

async function submitAnswer() {
  if (!answer.trim()) {
    setNotice("请先输入你的回答。");
    return;
  }

  if (!currentQuestion || defenseLoading) {
    return;
  }

  setDefenseLoading(true);
  setNotice("AI 导师正在评价你的回答……");

  try {
    const response = await fetch("/api/defense", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "answer",
        paperText: defensePaperText,
        history,
        currentQuestion,
        userAnswer: answer.trim(),
        questionNumber,
        maxQuestions,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "回答评价失败。");
    }

    const newRecord = {
      question: currentQuestion,
      answer: answer.trim(),
      feedback: result.feedback,
      score: result.score,
    };

    setHistory((previous) => [...previous, newRecord]);
    setFeedback(result.feedback);
    setSuggestedAnswer(result.suggestedAnswer || "");
    setAnswer("");

    if (result.finished) {
      
const finalSummary = result.summary || "本次答辩已结束。";

try {
  const savedRecords = localStorage.getItem("ai-thesis-tutor-records");
  const records = savedRecords ? JSON.parse(savedRecords) : [];

  records.unshift({
    id: Date.now(),
    date: new Date().toLocaleString("zh-CN"),
    fileName: file?.name || "未命名论文",
    mode,
    questionCount,
    history: [...history, newRecord],
    summary: finalSummary,
    status: "已完成",
  });

  localStorage.setItem(
    "ai-thesis-tutor-records",
    JSON.stringify(records)
  );

  setDefenseRecords(records);
} catch (error) {
  console.error("保存历史答辩记录失败：", error);
}

      setDefenseFinished(true);
setSummary(finalSummary);
      setNotice("答辩训练完成！");
    } else if (result.nextQuestion) {
      setCurrentQuestion(result.nextQuestion);
      setQuestionNumber(result.questionNumber || questionNumber + 1);
      setNotice("下一道问题已生成，请在页面下方的答题区继续作答。");
    } else {
      throw new Error("AI 没有生成下一道问题，请稍后重试。");
    }
  } catch (error) {
    setNotice(
      error instanceof Error
        ? error.message
        : "提交失败，请检查网络和服务器状态。"
    );
  } finally {
    setDefenseLoading(false);
  }
}


  return (
<main className="h-screen overflow-hidden bg-[#f7f8fa] text-[#20252d] flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-[72px] w-full max-w-[1600px] items-center justify-between px-6 xl:px-10">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#233b61] text-lg font-semibold text-white">
              答
            </div>
            <div>
              <div className="text-[17px] font-semibold tracking-tight">
                答辩通
              </div>
              <div className="text-[11px] tracking-wide text-gray-500">
                AI THESIS MENTOR
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-7 text-sm text-gray-600 sm:flex">

<a
  href="#features"
  className="transition hover:text-[#233b61]"
  onClick={(event) => {
    event.preventDefault();
    document.getElementById("features")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }}
>
  产品功能
</a>

<a
  href="#workflow"
  className="transition hover:text-[#233b61]"
  onClick={(event) => {
    event.preventDefault();
    document.getElementById("workflow")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }}
>
  使用流程
</a>

            
<button
  type="button"
  onClick={() => setShowHistory(true)}
  className="transition hover:text-[#233b61]"
>
  历史答辩
</button>

<button
  type="button"
  onClick={resetTestEnvironment}
  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
  title="清除本地测试数据并恢复初始状态"
>
  重置测试
</button>

            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
              免费测试版
            </span>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto">
<section className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-start gap-8 px-6 py-8 lg:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)] xl:gap-10 xl:px-10">
        <aside className="min-w-0 space-y-5">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dce4ef] bg-white px-3 py-1.5 text-xs text-[#456080]">
              <span className={`h-2 w-2 rounded-full ${workspaceStage === "analyzing" ? "animate-pulse bg-amber-500" : workspaceStage === "initial" ? "bg-[#7890ad]" : "bg-emerald-500"}`} />
              {workspaceStage === "initial" && "答辩准备工作台"}
              {workspaceStage === "analyzing" && "正在分析你的论文"}
              {workspaceStage === "diagnosed" && "个性化准备工作台"}
              {workspaceStage === "training" && "答辩训练进行中"}
              {workspaceStage === "complete" && "本次训练已完成"}
            </div>
            <h1 className="max-w-xl text-3xl font-semibold leading-[1.22] tracking-tight sm:text-4xl">
              {workspaceStage === "initial" && <>让每一次答辩练习<br /><span className="text-[#36577f]">都更有准备。</span></>}
              {workspaceStage === "analyzing" && <>先看清论文，<br /><span className="text-[#36577f]">再准备答辩。</span></>}
              {workspaceStage === "diagnosed" && <>你的论文已完成分析，<br /><span className="text-[#36577f]">接下来有重点地练。</span></>}
              {workspaceStage === "training" && <>把注意力放在<br /><span className="text-[#36577f]">眼前这道问题。</span></>}
              {workspaceStage === "complete" && <>练习已经结束，<br /><span className="text-[#36577f]">现在开始复盘。</span></>}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-gray-600">
              {workspaceStage === "initial" && "上传论文后，系统会先整理值得复核的内容，再通过模拟答辩帮助你发现回答中的薄弱点。"}
              {workspaceStage === "analyzing" && "诊断正在进行。分析完成前，不会预先给你的论文贴上风险标签。"}
              {workspaceStage === "diagnosed" && "以下内容基于本次诊断报告和已有训练记录，建议结合论文原文核对后再制定准备计划。"}
              {workspaceStage === "training" && "训练期间左侧只保留必要的论文重点，避免额外信息分散答题注意力。"}
              {workspaceStage === "complete" && "先找出本次回答中需要加强的部分，再把它们变成下一轮练习目标。"}
            </p>
          </div>

          {(workspaceStage === "initial" || workspaceStage === "analyzing") && <>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_4px_18px_rgba(31,48,72,0.03)]">
              <h2 className="text-sm font-semibold text-[#233b61]">论文诊断会关注什么？</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">诊断完成后，再根据报告呈现具体复核线索。</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["研究问题与目标", "研究方法与依据", "数据和论证证据", "创新点与研究局限"].map((item, i) => <div key={item} className="rounded-lg bg-[#f8fafc] p-2.5"><span className="text-[10px] font-semibold text-[#6682a4]">0{i+1}</span><p className="mt-1 text-xs font-medium text-gray-700">{item}</p></div>)}
              </div>
              {workspaceStage === "analyzing" && <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800"><span className="animate-pulse">正在分析论文内容，请稍候……</span></div>}
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#233b61]">答辩前自检</h2><p className="mt-1 text-xs text-gray-500">先检查四项基础准备</p></div><span className="rounded-full bg-[#edf2f8] px-2.5 py-1 text-xs font-medium text-[#36577f]">{checkedPrepItems.filter((id) => prepChecklist.some((item) => item.id === id)).length}/4</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#36577f] transition-all" style={{ width: `${(checkedPrepItems.filter((id) => prepChecklist.some((item) => item.id === id)).length / prepChecklist.length) * 100}%` }} /></div>
              <div className="mt-3 space-y-1">{prepChecklist.map((item) => { const checked = checkedPrepItems.includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-gray-50 ${checked ? "bg-[#f7f9fc]" : ""}`}><input type="checkbox" checked={checked} onChange={() => setCheckedPrepItems((previous) => checked ? previous.filter((id) => id !== item.id) : [...previous, item.id])} className="mt-0.5 h-4 w-4 shrink-0 accent-[#36577f]" /><span className="min-w-0"><span className={`block text-xs font-medium ${checked ? "text-gray-500 line-through" : "text-gray-800"}`}>{item.title}</span><span className="mt-1 block text-[11px] leading-4 text-gray-500">{item.detail}</span></span></label>; })}</div>
              {checkedPrepItems.length > 0 && <button type="button" onClick={() => setCheckedPrepItems([])} className="mt-2 text-xs text-gray-500 underline underline-offset-4">重置清单</button>}
            </section>
            {workspaceStage === "initial" && <section className="rounded-2xl border border-[#dce4ef] bg-[#edf3fa] p-4"><h2 className="text-sm font-semibold text-[#233b61]">一次训练会带来什么？</h2><div className="mt-3 space-y-2 text-xs leading-5 text-gray-700"><p>• 围绕论文内容生成答辩问题。</p><p>• 每次回答后获得评价与改进建议。</p><p>• 结束后保存训练记录，方便回看复盘。</p></div><button type="button" onClick={() => document.getElementById("training-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-3 text-xs font-medium text-[#36577f] hover:underline">上传论文并开始 →</button></section>}
          </>}

          {workspaceStage === "diagnosed" && <>
            <section id="features" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_4px_18px_rgba(31,48,72,0.03)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#233b61]">论文风险地图</h2><p className="mt-1 text-xs leading-5 text-gray-500">从诊断报告中提取的复核线索，不是独立验证后的风险评级。</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">报告已生成</span></div>
              {diagnosticRiskLines.length ? <div className="mt-3 space-y-2">{diagnosticRiskLines.map((line, i) => <div key={`${i}-${line}`} className="flex items-start gap-2 rounded-lg bg-[#f8fafc] p-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[11px] font-semibold text-amber-700">{i+1}</span><p className="min-w-0 break-words text-xs leading-5 text-gray-700">{line}</p></div>)}</div> : <p className="mt-3 rounded-xl bg-[#f8fafc] p-3 text-xs leading-5 text-gray-600">报告已生成，但没有自动提取到明确线索。请以完整报告和论文原文为准。</p>}
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4"><h2 className="text-sm font-semibold text-[#233b61]">个性化准备任务</h2><p className="mt-1 text-xs leading-5 text-gray-500">把报告中的问题转化为下一步行动。</p><div className="mt-3 space-y-2">{(diagnosticRiskLines.length ? diagnosticRiskLines.slice(0,3) : ["阅读完整诊断报告，标记最需要确认的建议", "回到论文原文核对关键论据和数据", "准备研究方法、核心结论和局限的口头说明"]).map((line,i)=><div key={`${i}-${line}`} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#edf2f8] text-[11px] font-semibold text-[#36577f]">{i+1}</span><div><p className="text-xs leading-5 text-gray-700">{line}</p><p className="mt-1 text-[11px] leading-4 text-gray-500">建议：核对论文原文，并准备一段简洁、有依据的口头解释。</p></div></div>)}</div></section>
            <section className="rounded-2xl border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#233b61]">高风险问题库</h2><p className="mt-1 text-xs leading-5 text-gray-500">根据真实训练评分整理待复盘问题。</p></div>{latestWeakAnswers.length > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">{latestWeakAnswers.length} 道待复盘</span>}</div>
              {latestWeakAnswers.length ? <div className="mt-3 space-y-2">{latestWeakAnswers.map((item:any,i:number)=><div key={`${i}-${item.question}`} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-amber-800">重点复盘 {i+1}</span><span className="text-xs font-semibold text-amber-800">{item.score}/10</span></div><p className="mt-2 text-xs leading-5 text-gray-700">{item.question}</p>{item.feedback && <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-gray-500">导师反馈：{item.feedback}</p>}</div>)}<button type="button" onClick={() => { setSelectedRecord(latestRecord); setShowHistory(true); }} className="text-xs font-medium text-[#36577f] hover:underline">查看完整训练记录 →</button></div> : <p className="mt-3 rounded-xl bg-[#f8fafc] p-3 text-xs leading-5 text-gray-600">完成训练后，这里会根据真实评分整理需要优先复盘的问题；目前不会凭空生成“高风险题目”。</p>}
              <button type="button" onClick={() => document.getElementById("training-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-3 text-xs font-medium text-[#36577f] hover:underline">开始针对性答辩 →</button>
            </section>
          </>}

          {(workspaceStage === "training" || workspaceStage === "complete") && <>
            <section className="rounded-2xl border border-gray-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#233b61]">{workspaceStage === "training" ? "本次训练重点" : "本次训练复盘"}</h2><p className="mt-1 break-words text-xs text-gray-500">{file?.name || latestRecord?.fileName || "当前论文"}</p></div><span className="rounded-full bg-[#edf2f8] px-2.5 py-1 text-[11px] font-medium text-[#36577f]">{history.length} 道已答</span></div>{diagnosticRiskLines.length ? <div className="mt-3 space-y-2">{diagnosticRiskLines.slice(0,3).map((line,i)=><div key={`${i}-${line}`} className="rounded-lg bg-[#f8fafc] p-3 text-xs leading-5 text-gray-700"><span className="mr-2 font-semibold text-[#6682a4]">{i+1}.</span>{line}</div>)}</div> : <p className="mt-3 rounded-xl bg-[#f8fafc] p-3 text-xs leading-5 text-gray-600">优先依据完整诊断报告和导师对每道题的反馈进行准备。</p>}</section>
            {latestWeakAnswers.length > 0 && <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4"><h2 className="text-sm font-semibold text-amber-900">建议优先复盘</h2><div className="mt-3 space-y-2">{latestWeakAnswers.map((item:any,i:number)=><div key={`${i}-${item.question}`} className="rounded-lg bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11px] text-gray-500">问题 {i+1}</span><span className="text-xs font-semibold text-amber-800">{item.score}/10</span></div><p className="mt-1 text-xs leading-5 text-gray-700">{item.question}</p></div>)}</div></section>}
            {workspaceStage === "complete" && <section className="rounded-2xl border border-gray-200 bg-white p-4"><h2 className="text-sm font-semibold text-[#233b61]">最近一次训练</h2>{latestRecord ? <button type="button" onClick={() => { setSelectedRecord(latestRecord); setShowHistory(true); }} className="mt-3 w-full rounded-xl bg-[#f8fafc] p-3 text-left hover:bg-[#f1f5fa]"><p className="break-words text-xs font-medium text-gray-800">{latestRecord.fileName || "未命名论文"}</p><p className="mt-1 text-[11px] text-gray-500">{latestRecord.date || "时间未知"} · {latestRecord.history?.length || 0} 道已答题目</p><p className="mt-2 text-xs font-medium text-[#36577f]">查看历史答辩 →</p></button> : <p className="mt-3 text-xs text-gray-600">本次记录尚未保存到历史列表，请稍后检查。</p>}<button type="button" onClick={() => document.getElementById("training-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-3 text-xs font-medium text-[#36577f] hover:underline">再练一次 →</button></section>}
          </>}

          <section className="rounded-2xl border border-[#dce4ef] bg-[#edf3fa] p-4"><h2 className="text-sm font-semibold text-[#233b61]">回答方法参考</h2><p className="mt-1 text-xs leading-5 text-gray-600">回答时可以按以下顺序组织内容；具体表述仍应以论文和真实研究证据为准。</p><div className="mt-3 grid grid-cols-2 gap-2">{[{n:"01",title:"先给结论",desc:"直接回应问题"},{n:"02",title:"说明依据",desc:"解释理由与判断"},{n:"03",title:"联系论文",desc:"用章节、数据或案例支撑"},{n:"04",title:"交代边界",desc:"承认局限，不编造事实"}].map((step)=><div key={step.n} className="rounded-lg border border-white/80 bg-white/80 p-2.5"><div className="text-[10px] font-semibold tracking-wide text-[#6682a4]">{step.n}</div><div className="mt-1 text-xs font-medium text-gray-800">{step.title}</div><div className="mt-1 text-[11px] leading-4 text-gray-500">{step.desc}</div></div>)}</div></section>
        </aside>

        <div className="min-w-0 flex flex-col gap-6">

        <div id="training-panel" className="scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_12px_50px_rgba(31,48,72,0.06)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold tracking-tight">
                开始论文答辩训练
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                上传论文，创建你的专属训练。
              </p>
            </div>
            <div className="rounded-lg bg-[#edf2f8] px-3 py-1.5 text-xs text-[#36577f]">
              第 1 步 / 3
            </div>
          </div>

          <div className="mb-3 mt-8 text-sm font-medium">
            01 <span className="ml-2">上传毕业论文</span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) =>
              selectFile(event.target.files?.[0])
            }
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragging
                ? "border-[#36577f] bg-blue-50"
                : "border-gray-300 bg-[#fafbfc]"
            }`}
          >
            {file ? (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-700">
                  ✓
                </div>
                <div className="mt-4 break-all text-sm font-medium">
                  {file.name}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setNotice("");
                    if (inputRef.current) {
                      inputRef.current.value = "";
                    }
                  }}
                  className="mt-3 text-xs text-gray-500 underline underline-offset-4 hover:text-gray-800"
                >
                  重新选择
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf0f7] text-2xl text-[#36577f]">
                  ↑
                </div>
                <div className="mt-4 text-sm font-medium">
                  将论文拖到这里
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  支持 PDF、DOCX，文件最大 15 MB
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-5 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium transition hover:border-[#36577f] hover:text-[#36577f]"
                >
                  选择论文文件
                </button>
              </>
            )}
          </div>

          <div className="mb-3 mt-7 text-sm font-medium">
            02 <span className="ml-2">选择导师风格</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {
                id: "basic" as const,
                title: "基础",
                desc: "熟悉常见问题",
              },
              {
                id: "standard" as const,
                title: "标准",
                desc: "全面模拟答辩",
              },
              {
                id: "strict" as const,
                title: "严格",
                desc: "深入追问质疑",
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  mode === item.id
                    ? "border-[#36577f] bg-[#f1f5fa] ring-1 ring-[#36577f]"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <div className="text-sm font-medium">
                  {item.title}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-gray-500">
                  {item.desc}
                </div>
              </button>
            ))}
          </div>

          <div className="mb-3 mt-7 text-sm font-medium">
            03 <span className="ml-2">训练设置</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">主问题数量</div>
              <div className="mt-1 text-xs text-gray-500">
                可在训练中逐题作答
              </div>
            </div>

<input
  type="number"
  min={1}
  max={20}
  value={questionCount}
  onChange={(e) => {
    const value = Number(e.target.value);
    if (value >= 1 && value <= 20) {
      setQuestionCount(value);
    }
  }}
  className="w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-sm font-medium"
/>

          </div>

          <button
            type="button"
            disabled={loading}
            onClick={analysis ? startDefense : startTraining}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#233b61] px-5 py-4 text-sm font-medium text-white transition hover:bg-[#304e7c]"
          >
            {loading ? "AI 正在分析论文……" : "开始模拟答辩"}
            <span aria-hidden="true">→</span>
          </button>

          {notice && (
            <div
              role="status"
              className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm leading-6 text-blue-900"
            >
              {notice}
            </div>
          )}
          
{analysis && (
<section className="mt-6 flex max-h-[min(48vh,460px)] min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-4">
      <h2 className="text-lg font-semibold text-[#233b61]">
        AI 论文诊断报告
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        报告内容可在此区域内单独滚动查看
      </p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
      <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
        {analysis}
      </div>
    </div>
  </section>
)}

{analysis && !defenseStarted && (
  <button
    type="button"
    onClick={startDefense}
    disabled={defenseLoading}
    className="mt-6 w-full rounded-xl bg-[#233b61] px-5 py-4 text-sm font-medium text-white disabled:opacity-50"
  >
    {defenseLoading ? "AI 导师正在准备问题……" : "开始正式答辩 →"}
  </button>
)}

{defenseStarted && (
  <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-[#233b61]">
        
      </h2>
      <span className="text-sm text-gray-500">
        {defenseFinished ? "训练结束" : `第 ${questionNumber} 题`}
      </span>
    </div>

    {!defenseFinished && (
      <>
        <div className="mt-5 rounded-xl bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">
            导师提问
          </p>
          <p className="mt-2 whitespace-pre-wrap leading-7 text-gray-800">
            {currentQuestion}
          </p>
        </div>

        <label
          htmlFor="defense-answer"
          className="mt-5 block text-sm font-medium text-gray-700"
        >
          你的回答
        </label>

        <textarea
          id="defense-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="请结合论文内容回答导师的问题……"
          rows={5}
          disabled={defenseLoading}
          className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm leading-6 outline-none focus:border-blue-500"
        />

        <button
          type="button"
          onClick={submitAnswer}
          disabled={defenseLoading || !answer.trim()}
          className="mt-3 w-full rounded-xl bg-[#233b61] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {defenseLoading ? "导师正在评价……" : "提交回答"}
        </button>
        
<button
  type="button"
  disabled={defenseLoading}

onClick={() => {
  const confirmed = window.confirm(
    "确定提前结束本次答辩吗？已回答的问题将保存到历史记录。"
  );

  if (!confirmed) return;

  const finalSummary =
    `本次答辩提前结束，共完成 ${history.length} 道题。`;

  try {
    const savedRecords = localStorage.getItem(
      "ai-thesis-tutor-records"
    );
    const records = savedRecords ? JSON.parse(savedRecords) : [];

    const record = {
      id: Date.now(),
      date: new Date().toLocaleString("zh-CN"),
      fileName: file?.name || "未命名论文",
      mode,
      questionCount,
      history: [...history],
      summary: finalSummary,
      status: "提前结束",
    };

    records.unshift(record);

    localStorage.setItem(
      "ai-thesis-tutor-records",
      JSON.stringify(records)
    );

    setDefenseRecords(records);
    setSummary(finalSummary);
    setDefenseFinished(true);
    setDefenseStarted(false);
    setCurrentQuestion("");
    setNotice("答辩已提前结束，记录已保存。");
  } catch (error) {
    console.error("保存提前结束记录失败：", error);
    setNotice("答辩已结束，但历史记录保存失败，请检查浏览器存储空间。");
    setSummary(finalSummary);
    setDefenseFinished(true);
    setDefenseStarted(false);
    setCurrentQuestion("");
  }
}}

  className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
>
  提前结束答辩
</button>

      </>
    )}

    {feedback && (
      <div className="mt-5 rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-[#233b61]">
          导师点评
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {feedback}
        </p>
      </div>
    )}

    {suggestedAnswer && (
      <div className="mt-4 rounded-xl bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-800">
          参考回答
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {suggestedAnswer}
        </p>
      </div>
    )}

    {history.length > 0 && (
      <div className="mt-5 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-800">已完成的问答</h3>
          <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {history.length} 题
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">左右滑动查看每一道题及导师评分</p>
        <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3">
          {history.map((item, index) => (
            <article
              key={`${index}-${item.question}`}
              className="w-[88%] min-w-[88%] snap-start rounded-xl border border-gray-200 bg-white p-4 sm:w-[72%] sm:min-w-[72%] lg:w-[60%] lg:min-w-[60%]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                  第 {index + 1} 题
                </span>
                {typeof item.score === "number" && (
                  <span className="shrink-0 text-sm font-semibold text-blue-700">
                    得分：{item.score}/10
                  </span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-gray-800">
                {item.question}
              </p>
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500">你的回答</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                  {item.answer}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    )}

    {defenseFinished && (
      <div className="mt-5 overflow-hidden rounded-xl bg-blue-50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3">
          <div>
            <h3 className="font-semibold text-blue-900">本次答辩总结</h3>
            <p className="mt-1 text-xs text-blue-700/70">总结内容较长，可在下方区域内单独滚动查看</p>
          </div>
          <button
            type="button"
            onClick={exportCurrentReport}
            className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-[#233b61] transition hover:bg-blue-100"
          >
            导出答辩报告
          </button>
        </div>
        <div className="max-h-[min(55vh,560px)] overflow-y-auto overscroll-contain p-4">
        
{history.some((item) => typeof item.score === "number") && (
  <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4">
    <p className="text-sm text-gray-500">答辩平均分</p>
    <p className="mt-1 text-3xl font-semibold text-[#233b61]">
      {(
        history.reduce(
          (total, item) =>
            total + (typeof item.score === "number" ? item.score : 0),
          0
        ) /
        history.filter((item) => typeof item.score === "number").length
      ).toFixed(1)}
      <span className="ml-1 text-sm font-normal text-gray-500">/ 10 分</span>
    </p>
    <p className="mt-2 text-sm font-medium text-gray-700">
      {(() => {
        const scores = history
          .filter((item) => typeof item.score === "number")
          .map((item) => item.score as number);

        const average =
          scores.reduce((total, score) => total + score, 0) /
          scores.length;

        if (average >= 9) return "表现等级：优秀";
        if (average >= 8) return "表现等级：良好";
        if (average >= 6) return "表现等级：合格";
        return "表现等级：需要加强";
      })()}
    </p>
    <p className="mt-1 text-xs text-gray-500">
      根据本轮已记录的 AI 单题评分计算，仅供练习参考，不代表学校正式答辩成绩。
    </p>
  </div>
)}

        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {summary}
        </p>
        <p className="mt-3 text-sm font-medium text-blue-800">
          共完成 {history.length} 道题目
        </p>
        </div>
      </div>
    )}
  </section>
)}

          <p className="mt-4 text-center text-xs leading-5 text-gray-400">
            论文内容会发送至后端及配置的 AI 服务处理
            <br />
            请勿上传包含敏感个人信息的文件
          </p>
        </div>
        </div>
      </section>

      <section
        id="workflow"
        className="border-t border-gray-200 bg-white"
      >
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="text-center text-xs font-medium tracking-[0.2em] text-gray-400">
            HOW IT WORKS
          </div>
          <h2 className="mt-3 text-center text-2xl font-semibold tracking-tight">
            三步完成一次答辩练习
          </h2>

          <div className="mt-9 grid gap-6 sm:grid-cols-3">
            {[
              {
                number: "01",
                title: "上传论文",
                desc: "提交毕业论文，准备专属训练内容。",
              },
              {
                number: "02",
                title: "回答问题",
                desc: "模拟导师提问，根据回答逐步追问。",
              },
              {
                number: "03",
                title: "查看报告",
                desc: "了解回答薄弱点，制定论文修改计划。",
              },
            ].map((item) => (
              <div
                key={item.number}
                className="rounded-xl border border-gray-200 p-6"
              >
                <div className="text-sm font-semibold text-[#6680a0]">
                  {item.number}
                </div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-gray-200 bg-[#f7f8fa]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-7 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>答辩通 · AI 论文导师</p>
            <p>帮助你更好地理解自己的论文，做好答辩准备。</p>
          </div>
          <nav aria-label="法律与隐私信息" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={() => setLegalPanel("privacy")} className="transition hover:text-[#233b61]">隐私政策</button>
            <button type="button" onClick={() => setLegalPanel("terms")} className="transition hover:text-[#233b61]">用户使用协议</button>
            <span>AI 生成内容仅供学习与答辩练习参考</span>
          </nav>
        </div>
      </footer>
      </div>
      
{showHistory && (
  <div className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-8">
    <div className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-[#233b61]">
            历史答辩记录
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            共保存 {defenseRecords.length} 次答辩
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowHistory(false);
            setSelectedRecord(null);
          }}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
        >
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {selectedRecord ? (
          <div>
            <button
              type="button"
              onClick={() => setSelectedRecord(null)}
              className="mb-5 text-sm text-[#36577f] hover:underline"
            >
              ← 返回历史记录列表
            </button>

            <h3 className="text-lg font-semibold">
              {selectedRecord.fileName}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {selectedRecord.date} · {selectedRecord.status}
            </p>

            <div className="mt-5 rounded-xl bg-blue-50 p-4">
              <h4 className="font-semibold text-[#233b61]">答辩总结</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                {selectedRecord.summary || "暂无答辩总结"}
              </p>
            </div>

            <h4 className="mt-6 font-semibold">问答与导师反馈</h4>

            {selectedRecord.history?.length ? (
              <div className="mt-3 space-y-4">
                {selectedRecord.history.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <p className="font-medium">
                      第 {index + 1} 题
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                      问题：{item.question}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                      回答：{item.answer}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                      导师反馈：{item.feedback || "暂无反馈"}
                    </p>
                    {typeof item.score === "number" && (
                      <p className="mt-2 text-sm font-medium text-[#36577f]">
                        本题评分：{item.score}/10
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                暂无问答详情。
              </p>
            )}
          </div>
        ) : defenseRecords.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-medium text-gray-700">
              暂无历史答辩记录
            </p>
            <p className="mt-2 text-sm text-gray-500">
              完成一次答辩后，记录会显示在这里。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {defenseRecords.map((record: any) => (
              <button
                type="button"
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className="w-full rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#36577f] hover:bg-gray-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800">
                    {record.fileName || "未命名论文"}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-[#36577f]">
                    {record.status || "已完成"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {record.date || "时间未知"}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  已回答 {record.history?.length || 0} 题
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                  {record.summary || "暂无总结"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}

{legalPanel && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="legal-panel-title">
    <section className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-7">
        <div>
          <p className="text-xs font-medium tracking-wide text-[#6682a4]">答辩通 · AI THESIS MENTOR</p>
          <h2 id="legal-panel-title" className="mt-1 text-xl font-semibold text-[#233b61]">
            {legalPanel === "privacy" ? "隐私政策" : "用户使用协议"}
          </h2>
        </div>
        <button type="button" onClick={() => setLegalPanel(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">关闭</button>
      </header>
      <div className="overflow-y-auto px-5 py-5 text-sm leading-7 text-gray-700 sm:px-7">
        {legalPanel === "privacy" ? (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">说明：这是当前测试版本的隐私信息说明。正式对外运营前，请根据实际部署、模型服务商及数据保留设置进行核实和完善。</p>
            <section><h3 className="font-semibold text-gray-900">一、我们处理哪些信息</h3><p>当你使用论文诊断或模拟答辩功能时，系统会处理你主动选择上传的论文文件及从论文中提取的文本，并将相关内容发送至本网站的后端接口，以生成诊断、问题、回答评价和总结。请勿上传与功能无关的资料。</p></section>
            <section><h3 className="font-semibold text-gray-900">二、AI 服务处理</h3><p>为提供 AI 分析与答辩训练，后端会将完成请求所需的论文文本、问题及回答内容发送给配置的 AI 模型服务。相关服务对数据的处理和保留，可能受其服务条款、隐私政策及账户配置约束。使用者应在上传前确认自己有权提交相关内容。</p></section>
            <section><h3 className="font-semibold text-gray-900">三、浏览器本地存储</h3><p>当前版本会在你使用的浏览器本地保存部分答辩会话、历史答辩记录和准备清单，以便刷新后恢复或查看。能够访问该浏览器用户配置文件的人，可能接触这些本地记录。清除网站数据或浏览器存储可能导致记录丢失；更换设备或浏览器通常不会自动同步这些记录。</p></section>
            <section><h3 className="font-semibold text-gray-900">四、信息安全与敏感内容</h3><p>我们会通过应用配置和访问控制尽力保护处理中的信息，但互联网传输和在线服务无法保证绝对安全。请避免上传身份证号码、联系方式、未公开的商业秘密、他人个人信息或其他不适合提交给第三方 AI 服务的内容。</p></section>
            <section><h3 className="font-semibold text-gray-900">五、数据保留与删除</h3><p>当前版本的历史记录主要保存在本地浏览器。上传内容在后端及 AI 服务侧的具体保留时间，需以实际部署和服务商配置为准；本页面不作超出已核实配置的删除时限承诺。如需清除本地记录，可使用页面中的“重置测试”功能，或清除浏览器中本网站的数据。</p></section>
            <section><h3 className="font-semibold text-gray-900">六、政策更新与联系</h3><p>测试版本的功能、数据流程或服务商配置发生变化时，本说明也应相应更新。正式运营前，请在此补充可用的运营主体名称和联系渠道，供用户提出隐私相关请求。</p></section>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">使用本网站前，请阅读以下测试版使用规则。正式上线前应结合实际运营主体及适用法律完成审核。</p>
            <section><h3 className="font-semibold text-gray-900">一、服务内容</h3><p>答辩通提供论文内容整理、AI 论文诊断、模拟答辩提问、回答反馈及训练记录等辅助功能，旨在帮助用户准备学习和答辩练习。</p></section>
            <section><h3 className="font-semibold text-gray-900">二、用户提交内容</h3><p>你应确保对上传论文及提交的回答拥有必要权利或已取得授权。不得提交违法内容、侵犯他人权益的材料，或未经许可披露的个人信息、保密信息及研究数据。</p></section>
            <section><h3 className="font-semibold text-gray-900">三、AI 结果的限制</h3><p>AI 生成的诊断、问题、评分和建议可能存在遗漏、错误或不准确之处，不构成学校、导师、评审机构的正式意见，也不保证论文通过审核或答辩。请结合论文原文、真实数据、指导教师意见及学校要求自行核验，不应将 AI 建议当作事实依据而不加检查。</p></section>
            <section><h3 className="font-semibold text-gray-900">四、学术诚信</h3><p>本服务用于学习、理解和答辩准备。用户应遵守学校的学术诚信规范，不得使用本服务伪造研究过程、数据、文献或研究成果，也不得以生成内容冒充真实研究证据。</p></section>
            <section><h3 className="font-semibold text-gray-900">五、可用性与责任</h3><p>服务可能因网络、模型服务、维护或配置问题暂时不可用。请自行保留重要论文、回答和训练结果的备份。对于 AI 输出或本地浏览器数据丢失，应结合具体情况处理；本说明不排除适用法律规定不得排除的责任。</p></section>
            <section><h3 className="font-semibold text-gray-900">六、协议更新</h3><p>功能或运营方式变化时，使用规则可能相应更新。正式运营时，应在本页面明确协议生效日期、运营主体和有效的联系渠道。</p></section>
          </div>
        )}
      </div>
      <footer className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500 sm:px-7">当前为测试版本说明。请在正式商业运营前核对实际数据流程，并完成必要的法律与隐私合规审查。</footer>
    </section>
  </div>
)}

    </main>
  );
}
