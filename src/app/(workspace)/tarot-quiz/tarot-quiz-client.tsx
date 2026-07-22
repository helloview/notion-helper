"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  BookOpenText,
  BrainCircuit,
  ChevronDown,
  Copy,
  Database,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Square,
  Type,
  Wand2,
} from "lucide-react";
import type { Assignee } from "@/lib/types";
import {
  TAROT_QUIZ_SERIES,
  TAROT_QUIZ_TASK_PRESET,
  assembleTarotQuizSystemPrompt,
  buildTarotQuizUserPrompt,
  sortSkillsForAssembly,
  type TarotQuizPromptInput,
} from "@/lib/tarot-quiz-template";
import { ToastContainer, type ToastMessage } from "@/app/_components/toast";
import { Badge, Button, Modal, ui } from "@/app/_components/ui";
import { Markdown } from "@/app/_components/markdown";

type SkillItem = {
  id: string;
  name: string;
  description: string;
  body: string;
  updatedAt: string;
};

type SettingsData = {
  usedMaterials: string;
  model: string;
  reasoningEffort: string;
  updatedAt: string;
  updatedBy?: string;
};

const DEFAULT_MODEL = "deepseek-ai/deepseek-v4-pro";

const modelSuggestions = [
  "deepseek-ai/deepseek-v4-pro",
  "deepseek-ai/deepseek-r1",
  "moonshotai/kimi-k2-instruct",
];

const effortOptions = [
  { value: "low", label: "快速（思考最少，出稿最快）" },
  { value: "medium", label: "标准" },
  { value: "high", label: "深度（默认）" },
  { value: "max", label: "极限（思考最久）" },
];

type EpisodeSummary = {
  id: string;
  title: string;
  targetId: string;
  input: TarotQuizPromptInput;
  createdAt: string;
  createdBy?: string;
  resultLength: number;
};

type Props = {
  currentUser: Assignee;
  currentRole: "admin" | "member";
  defaultAssigneeId: string;
  skills: SkillItem[];
  initialSettings: SettingsData;
  initialEpisodes: EpisodeSummary[];
};

const EPISODE_SKILL_ID = "tarot-quiz-episode";

const skillLabels: Record<string, string> = {
  "tarot-quiz-episode": "整期组装",
  "tarot-quiz-hook": "开场钩子",
  "tarot-quiz-q1-clue-guess": "题一 · 听线索猜牌",
  "tarot-quiz-q2-flash-memory": "题二 · 三秒记忆",
  "tarot-quiz-q3-fake-card": "题三 · 找出假牌",
  "tarot-quiz-q4-card-meaning": "题四 · 读牌义",
  "tarot-quiz-q5-open-question": "题五 · 开放题",
  "tarot-quiz-ending": "结尾 CTA",
};

function skillLabel(skill: Pick<SkillItem, "id" | "name">) {
  return skillLabels[skill.id] ?? skill.name;
}

function targetLabel(targetId: string) {
  return skillLabels[targetId] ?? targetId;
}

const FALLBACK_USED_MATERIALS =
  "首发期已用，月亮线索题、太阳记忆题、假牌预言家、恋爱暧昧母题。本期请全部避开。";

type Field = {
  key: keyof TarotQuizPromptInput;
  label: string;
  rows?: number;
  placeholder?: string;
};

const fields: Field[] = [
  { key: "episodeTitle", label: "本期标题" },
  { key: "platforms", label: "发布平台" },
  { key: "duration", label: "目标时长" },
  { key: "fanLetter", label: "粉丝来信", rows: 3, placeholder: "留空则走虚构模式" },
  { key: "emotionalTheme", label: "第五题方向", rows: 2 },
  { key: "hotTopic", label: "热点方向", rows: 2, placeholder: "留空则不绑定热点" },
  { key: "productionNotes", label: "制作要求", rows: 3 },
];

let toastCount = 0;

function readError(data: unknown) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return String(record.detail || record.error || "请求失败");
  }

  return "请求失败";
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TarotQuizClient({
  currentRole,
  defaultAssigneeId,
  skills,
  initialSettings,
  initialEpisodes,
}: Props) {
  const router = useRouter();
  const orderedSkills = useMemo(() => sortSkillsForAssembly(skills), [skills]);

  const [input, setInput] = useState<TarotQuizPromptInput>(() => ({
    episodeTitle: "塔罗五题挑战，本期测测你是不是真懂牌",
    usedMaterials: initialSettings.usedMaterials || FALLBACK_USED_MATERIALS,
    fanLetter: "",
    emotionalTheme: "优先从职场抉择、友情裂痕、家庭关系、自我焦虑、金钱人情、人生岔路中选一个。",
    hotTopic: "",
    productionNotes:
      "输出要能直接复制进 Notion 脚本页。请保证纯口播块适合语音合成，分题画面表适合剪辑执行。",
    platforms: "抖音、小红书",
    duration: "约一分五十秒到两分钟",
  }));
  const [targetId, setTargetId] = useState(
    () => orderedSkills.find((skill) => skill.id === EPISODE_SKILL_ID)?.id ?? orderedSkills[0]?.id ?? "",
  );
  const [activeTab, setActiveTab] = useState<"prompt" | "result" | "history" | "skills">("prompt");
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Generation stream state.
  const [result, setResult] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Render result as Markdown by default; raw text is the escape hatch.
  const [resultView, setResultView] = useState<"markdown" | "text">("markdown");
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const reasoningRef = useRef<HTMLPreElement | null>(null);

  // Workflow state (shared dedupe library + model config + archived episodes).
  const [settings, setSettings] = useState<SettingsData>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [modelDraft, setModelDraft] = useState(initialSettings.model);
  const [savingModelConfig, setSavingModelConfig] = useState(false);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>(initialEpisodes);
  const [episodeResults, setEpisodeResults] = useState<Record<string, string>>({});
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(null);
  const [loadingEpisodeId, setLoadingEpisodeId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingEpisodeId, setDeletingEpisodeId] = useState<string | null>(null);

  // Archive dialog.
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [archiveNote, setArchiveNote] = useState("");
  const [archiving, setArchiving] = useState(false);

  const [creatingTask, setCreatingTask] = useState(false);

  const canCreateTask = currentRole === "admin";
  const target = orderedSkills.find((skill) => skill.id === targetId);
  const includedSkills = useMemo(() => {
    if (!target) return [];
    return target.id === EPISODE_SKILL_ID ? orderedSkills : [target];
  }, [orderedSkills, target]);

  const fullPrompt = useMemo(() => {
    if (!target) return "";
    return `${assembleTarotQuizSystemPrompt(includedSkills)}\n\n━━━━━ 本期输入 ━━━━━\n\n${buildTarotQuizUserPrompt(input, target)}`;
  }, [includedSkills, input, target]);

  const usedMaterialsDirty = (input.usedMaterials ?? "").trim() !== settings.usedMaterials.trim();

  // Follow stream output while generating.
  useEffect(() => {
    if (generating && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [generating, result]);

  useEffect(() => {
    if (generating && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [generating, reasoning]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const showToast = (message: string, type = "default", duration = 3000) => {
    const id = ++toastCount;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    }

    return id;
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const updateInput = (key: keyof TarotQuizPromptInput, value: string) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label}已复制。`, "success");
    } catch {
      showToast("复制失败，请手动选择内容复制。", "error");
    }
  };

  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  const generate = async () => {
    if (generating) return;

    setGenerating(true);
    setGenerateError(null);
    setResult("");
    setReasoning("");
    setReasoningOpen(true);
    setStreamStatus(null);
    setElapsedSeconds(0);
    setActiveTab("result");

    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      const response = await fetch("/api/ai/tarot-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, target: targetId }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(readError(data));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let contentText = "";
      let reasoningText = "";
      let streamError: string | null = null;

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let event: { type?: string; text?: string; message?: string };
        try {
          event = JSON.parse(trimmed);
        } catch {
          return;
        }

        if (event.type === "reasoning" && event.text) {
          reasoningText += event.text;
          setReasoning(reasoningText);
        } else if (event.type === "content" && event.text) {
          if (!contentText) setReasoningOpen(false);
          contentText += event.text;
          setResult(contentText);
        } else if (event.type === "status" && event.message) {
          setStreamStatus(event.message);
        } else if (event.type === "error") {
          streamError = event.message || "生成中断，请重试。";
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      }

      buffer += decoder.decode();
      for (const line of buffer.split("\n")) handleLine(line);

      if (streamError) {
        setGenerateError(streamError);
      } else if (contentText.trim()) {
        showToast("脚本草稿已生成，可以归档本期。", "success");
      } else {
        setGenerateError("模型没有返回正文内容，请重试，或复制提示词手动生成。");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        showToast("已停止生成。", "default");
      } else {
        setGenerateError(
          error instanceof Error ? error.message : "生成失败，请复制提示词手动生成。",
        );
      }
    } finally {
      window.clearInterval(timer);
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const putSettings = async (patch: Record<string, string>) => {
    const response = await fetch("/api/tarot-quiz/workflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(readError(data));
    }

    const next = data.settings as SettingsData;
    setSettings(next);
    return next;
  };

  const saveUsedMaterials = async () => {
    if (savingSettings) return;
    setSavingSettings(true);

    try {
      await putSettings({ usedMaterials: input.usedMaterials ?? "" });
      showToast("查重库已保存，团队共享。", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败。", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const saveModelConfig = async (patch: { model?: string; reasoningEffort?: string }) => {
    if (savingModelConfig) return;
    setSavingModelConfig(true);

    try {
      const next = await putSettings(patch);
      setModelDraft(next.model);
      showToast("模型设置已保存，团队共享。", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败。", "error");
    } finally {
      setSavingModelConfig(false);
    }
  };

  const openArchive = () => {
    const title = input.episodeTitle?.trim() || "未命名一期";
    setArchiveTitle(title);
    setArchiveNote(`【${new Date().toLocaleDateString("zh-CN")}】${title}：`);
    setArchiveOpen(true);
  };

  const submitArchive = async () => {
    if (archiving || !result.trim()) return;
    setArchiving(true);

    try {
      const response = await fetch("/api/tarot-quiz/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: archiveTitle,
          targetId,
          input,
          result,
          baseUsedMaterials: input.usedMaterials ?? "",
          dedupeNote: archiveNote.trim().endsWith("：") ? "" : archiveNote,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setEpisodes(data.episodes as EpisodeSummary[]);
      const nextSettings = data.settings as SettingsData;
      setSettings(nextSettings);
      if (nextSettings.usedMaterials) {
        setInput((current) => ({ ...current, usedMaterials: nextSettings.usedMaterials }));
      }
      setArchiveOpen(false);
      showToast("本期已归档到历史。", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "归档失败。", "error");
    } finally {
      setArchiving(false);
    }
  };

  const toggleEpisode = async (episode: EpisodeSummary) => {
    if (expandedEpisodeId === episode.id) {
      setExpandedEpisodeId(null);
      return;
    }

    setExpandedEpisodeId(episode.id);

    if (episodeResults[episode.id] !== undefined) return;

    setLoadingEpisodeId(episode.id);
    try {
      const response = await fetch(
        `/api/tarot-quiz/workflow?id=${encodeURIComponent(episode.id)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setEpisodeResults((current) => ({
        ...current,
        [episode.id]: String(data.episode?.result ?? ""),
      }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "加载归档失败。", "error");
      setExpandedEpisodeId(null);
    } finally {
      setLoadingEpisodeId(null);
    }
  };

  const loadEpisodeInput = (episode: EpisodeSummary) => {
    setInput((current) => ({
      ...current,
      ...episode.input,
      // 查重库始终以团队共享版本为准，不被历史参数覆盖。
      usedMaterials: current.usedMaterials,
    }));
    if (orderedSkills.some((skill) => skill.id === episode.targetId)) {
      setTargetId(episode.targetId);
    }
    showToast("已载入该期参数（查重库保持当前版本）。", "success");
  };

  const deleteEpisode = async (id: string) => {
    if (deletingEpisodeId) return;
    setDeletingEpisodeId(id);

    try {
      const response = await fetch(`/api/tarot-quiz/workflow?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setEpisodes(data.episodes as EpisodeSummary[]);
      if (expandedEpisodeId === id) setExpandedEpisodeId(null);
      showToast("归档已删除。", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败。", "error");
    } finally {
      setDeletingEpisodeId(null);
      setDeleteConfirmId(null);
    }
  };

  const createProductionTask = async () => {
    if (!canCreateTask || creatingTask) return;

    setCreatingTask(true);
    const toastId = showToast("正在创建栏目任务。", "loading", 0);

    try {
      const title = input.episodeTitle?.trim() || TAROT_QUIZ_TASK_PRESET.title;
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...TAROT_QUIZ_TASK_PRESET,
          title,
          assigneeId: defaultAssigneeId,
          assigneeIds: [defaultAssigneeId],
          stepAssigneeId: defaultAssigneeId,
          stepAssigneeIds: [defaultAssigneeId],
        }),
      });
      const data = await response.json().catch(() => null);

      removeToast(toastId);
      if (!response.ok) {
        throw new Error(readError(data));
      }

      showToast("栏目任务已创建。", "success");
      window.setTimeout(() => {
        router.push(`/?project=${encodeURIComponent(data.task.id)}`);
        router.refresh();
      }, 350);
    } catch (error) {
      removeToast(toastId);
      showToast(error instanceof Error ? error.message : "创建任务失败。", "error");
    } finally {
      setCreatingTask(false);
    }
  };

  const tabs = [
    { id: "prompt" as const, label: "提示词" },
    { id: "result" as const, label: "生成结果" },
    { id: "history" as const, label: `历史 ${episodes.length}` },
    { id: "skills" as const, label: `技能库 ${orderedSkills.length}` },
  ];

  return (
    <>
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 text-slate-900">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">塔罗五题工作台</h1>
            <Badge tone="slate">{TAROT_QUIZ_SERIES}</Badge>
            {target && target.id !== EPISODE_SKILL_ID && (
              <Badge tone="blue">仅生成：{skillLabel(target)}</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canCreateTask && (
              <Button onClick={createProductionTask} disabled={creatingTask}>
                {creatingTask ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                创建任务
              </Button>
            )}
            {generating ? (
              <Button variant="dark" onClick={stopGenerating}>
                <Square size={12} />
                停止生成
              </Button>
            ) : (
              <Button variant="primary" onClick={generate} disabled={!target}>
                <Sparkles size={14} />
                智能生成
              </Button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white px-4 py-3 lg:border-b-0 lg:border-r">
            <label className="block">
              <span className={ui.label}>生成目标</span>
              <div className="relative">
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  className={`${ui.input} h-8 appearance-none pr-8`}
                >
                  {orderedSkills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skillLabel(skill)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
              {target && (
                <span className={`${ui.hint} line-clamp-3`}>
                  {target.id === EPISODE_SKILL_ID
                    ? `按 ${orderedSkills.length} 个技能组装一整期脚本（钩子 → 题一到题五 → 结尾）。`
                    : target.description}
                </span>
              )}
            </label>

            <div className="my-3 h-px bg-slate-100" />

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">模型设置（团队共享）</span>
                {savingModelConfig && (
                  <Loader2 className="animate-spin text-slate-400" size={11} />
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <input
                    list="nvidia-model-options"
                    value={modelDraft}
                    onChange={(event) => setModelDraft(event.target.value)}
                    onBlur={() => {
                      if (modelDraft.trim() !== settings.model) {
                        void saveModelConfig({ model: modelDraft });
                      }
                    }}
                    placeholder={`${DEFAULT_MODEL}（默认）`}
                    className={`${ui.input} h-8 font-mono text-xs`}
                  />
                  <datalist id="nvidia-model-options">
                    {modelSuggestions.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </div>
                <div className="relative">
                  <select
                    value={settings.reasoningEffort || "high"}
                    onChange={(event) => void saveModelConfig({ reasoningEffort: event.target.value })}
                    className={`${ui.input} h-8 appearance-none pr-8`}
                  >
                    {effortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        思考深度：{option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>
              <span className={ui.hint}>
                模型排队严重或想提速时，可换模型 ID 或调低思考深度，改动即存即生效。
              </span>
            </div>

            <div className="my-3 h-px bg-slate-100" />

            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                  <Database size={11} className="text-slate-400" />
                  往期查重库（团队共享）
                </span>
                <button
                  type="button"
                  onClick={saveUsedMaterials}
                  disabled={savingSettings || !usedMaterialsDirty}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-500 disabled:cursor-default disabled:text-slate-300"
                >
                  {savingSettings && <Loader2 className="animate-spin" size={11} />}
                  {savingSettings ? "保存中" : usedMaterialsDirty ? "保存到数据库" : "已同步"}
                </button>
              </div>
              <textarea
                value={input.usedMaterials ?? ""}
                onChange={(event) => updateInput("usedMaterials", event.target.value)}
                rows={4}
                className={`${ui.input} resize-y py-1.5 leading-5`}
              />
              <span className={ui.hint}>
                {settings.updatedAt
                  ? `上次更新 ${formatDateTime(settings.updatedAt)}${settings.updatedBy ? ` · ${settings.updatedBy}` : ""}，归档本期时可自动追加。`
                  : "保存后团队所有人生成时共用这份查重记录。"}
              </span>
            </label>

            <div className="my-3 h-px bg-slate-100" />

            <div className="space-y-3">
              {fields.map((field) => (
                <label key={field.key} className="block">
                  <span className={ui.label}>{field.label}</span>
                  {field.rows ? (
                    <textarea
                      value={input[field.key] ?? ""}
                      onChange={(event) => updateInput(field.key, event.target.value)}
                      rows={field.rows}
                      placeholder={field.placeholder}
                      className={`${ui.input} resize-y py-1.5 leading-5`}
                    />
                  ) : (
                    <input
                      value={input[field.key] ?? ""}
                      onChange={(event) => updateInput(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className={`${ui.input} h-8`}
                    />
                  )}
                </label>
              ))}
              <p className={ui.hint}>所有字段可留空，留空时按技能默认策略生成。</p>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4">
              <div className="flex rounded-lg bg-slate-100 p-0.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${
                      activeTab === tab.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                    {tab.id === "result" && generating && (
                      <Loader2 className="ml-1 inline animate-spin" size={11} />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {activeTab === "prompt" && (
                  <>
                    <span className="hidden text-xs text-slate-400 sm:inline">
                      {includedSkills.length} 个技能已组装
                    </span>
                    <Button className="h-7 px-2.5 text-xs" onClick={() => copyText(fullPrompt, "完整提示词")}>
                      <Copy size={12} />
                      复制提示词
                    </Button>
                  </>
                )}
                {activeTab === "result" && result && (
                  <>
                    <div className="flex rounded-lg bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setResultView("markdown")}
                        title="渲染视图"
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                          resultView === "markdown"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <FileText size={12} />
                        渲染
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultView("text")}
                        title="纯文本"
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                          resultView === "text"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <Type size={12} />
                        源码
                      </button>
                    </div>
                    <Button className="h-7 px-2.5 text-xs" onClick={() => copyText(result, "纯文本")}>
                      <Copy size={12} />
                      复制文本
                    </Button>
                    {!generating && (
                      <Button variant="primary" className="h-7 px-2.5 text-xs" onClick={openArchive}>
                        <Archive size={12} />
                        归档本期
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {activeTab === "prompt" && (
              <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-white px-4 py-3 text-[13px] leading-6 text-slate-700">
                {fullPrompt || "skills/ 目录为空，请把栏目技能（SKILL.md）放进项目的 skills/ 目录。"}
              </pre>
            )}

            {activeTab === "result" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                {generateError && (
                  <div className="mx-4 mt-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                    {generateError}
                  </div>
                )}

                {reasoning && (
                  <div className="mx-4 mt-3 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setReasoningOpen((open) => !open)}
                      className="flex w-full items-center justify-between bg-slate-50 px-3 py-1.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <BrainCircuit size={12} className="text-slate-400" />
                        {generating && !result ? `模型思考中 · ${elapsedSeconds}s` : "思考过程"}
                        {generating && !result && (
                          <Loader2 className="animate-spin text-slate-400" size={11} />
                        )}
                      </span>
                      <ChevronDown
                        size={13}
                        className={`text-slate-400 transition-transform ${reasoningOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {reasoningOpen && (
                      <pre
                        ref={reasoningRef}
                        className="max-h-[200px] overflow-auto whitespace-pre-wrap border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-xs leading-5 text-slate-500"
                      >
                        {reasoning}
                      </pre>
                    )}
                  </div>
                )}

                {result || generating ? (
                  <div ref={resultRef} className="min-h-0 flex-1 overflow-auto px-4 py-3">
                    {result && resultView === "markdown" && !generating ? (
                      <Markdown source={result} />
                    ) : (
                      <pre className="whitespace-pre-wrap text-[13px] leading-6 text-slate-700">
                        {result ||
                          (reasoning
                            ? "思考完成后正文会出现在这里…"
                            : `${streamStatus ?? "正在连接模型…"}（已等待 ${elapsedSeconds} 秒，思考过程会实时显示）`)}
                        {generating && result && (
                          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-blue-500 align-text-bottom" />
                        )}
                      </pre>
                    )}
                  </div>
                ) : (
                  !generateError && (
                    <div className="flex flex-1 items-center justify-center p-6">
                      <div className="max-w-sm text-center">
                        <Wand2 className="mx-auto text-slate-300" size={28} />
                        <p className="mt-2.5 text-sm font-medium text-slate-600">还没有生成结果</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          点击右上角「智能生成」按当前技能实时生成；生成完成后可以归档本期并回填查重库。
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="min-h-0 flex-1 overflow-y-auto bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  <Archive size={13} className="shrink-0 text-slate-400" />
                  每次归档都会存入数据库；「载入参数」可以基于往期快速起一期新的。
                </div>
                <div className="divide-y divide-slate-100">
                  {episodes.map((episode) => {
                    const expanded = expandedEpisodeId === episode.id;
                    const episodeResult = episodeResults[episode.id];
                    return (
                      <div key={episode.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => toggleEpisode(episode)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="truncate text-[13px] font-medium text-slate-900">
                              {episode.title}
                            </span>
                            <Badge tone={episode.targetId === EPISODE_SKILL_ID ? "blue" : "slate"}>
                              {targetLabel(episode.targetId)}
                            </Badge>
                            <span className="shrink-0 text-[11px] text-slate-400">
                              {formatDateTime(episode.createdAt)}
                              {episode.createdBy ? ` · ${episode.createdBy}` : ""}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => loadEpisodeInput(episode)}
                            >
                              载入参数
                            </Button>
                            {currentRole === "admin" &&
                              (deleteConfirmId === episode.id ? (
                                <Button
                                  variant="danger"
                                  className="h-7 px-2 text-xs"
                                  disabled={deletingEpisodeId === episode.id}
                                  onClick={() => deleteEpisode(episode.id)}
                                >
                                  {deletingEpisodeId === episode.id ? (
                                    <Loader2 className="animate-spin" size={11} />
                                  ) : (
                                    "确认删除"
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  onClick={() => setDeleteConfirmId(episode.id)}
                                >
                                  删除
                                </Button>
                              ))}
                            <ChevronDown
                              size={13}
                              className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>

                        {expanded && (
                          <div className="mt-2">
                            {loadingEpisodeId === episode.id ? (
                              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                <Loader2 className="animate-spin" size={12} />
                                正在加载归档内容…
                              </div>
                            ) : (
                              <>
                                <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  {episodeResult ? (
                                    <Markdown source={episodeResult} />
                                  ) : (
                                    <p className="text-xs text-slate-400">（空）</p>
                                  )}
                                </div>
                                {episodeResult && (
                                  <div className="mt-1.5">
                                    <Button
                                      className="h-7 px-2.5 text-xs"
                                      onClick={() => copyText(episodeResult, "纯文本")}
                                    >
                                      <Copy size={12} />
                                      复制文本
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {episodes.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">
                      还没有归档记录。生成完成后点「归档本期」即可存入历史。
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "skills" && (
              <div className="min-h-0 flex-1 overflow-y-auto bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  <BookOpenText size={13} className="shrink-0 text-slate-400" />
                  技能是项目里的文件（skills/&lt;名称&gt;/SKILL.md）。替换或编辑文件后刷新页面即可生效，无需改代码。
                </div>
                <div className="divide-y divide-slate-100">
                  {orderedSkills.map((skill) => {
                    const expanded = expandedSkillId === skill.id;
                    return (
                      <div key={skill.id} className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedSkillId(expanded ? null : skill.id)}
                          className="flex w-full items-center justify-between gap-3 text-left"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-[13px] font-medium text-slate-900">
                              {skillLabel(skill)}
                            </span>
                            <span className="truncate font-mono text-[11px] text-slate-400">
                              {skill.id}
                            </span>
                            {skill.id === targetId && <Badge tone="blue">当前目标</Badge>}
                          </div>
                          <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                            {formatDay(skill.updatedAt)} 更新
                            <ChevronDown
                              size={13}
                              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </span>
                        </button>
                        <p className={`mt-1 text-xs leading-5 text-slate-500 ${expanded ? "" : "line-clamp-2"}`}>
                          {skill.description}
                        </p>
                        {expanded && (
                          <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                            {skill.body}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                  {orderedSkills.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">
                      还没有加载到任何技能，请把 SKILL.md 放进项目的 skills/ 目录。
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <Modal
        open={archiveOpen}
        onClose={() => {
          if (!archiving) setArchiveOpen(false);
        }}
        title="归档本期"
        subtitle="结果存入历史；素材记录会追加进团队共享的查重库，下期生成自动避开。"
      >
        <div className="space-y-3">
          <label className="block">
            <span className={ui.label}>归档标题</span>
            <input
              value={archiveTitle}
              onChange={(event) => setArchiveTitle(event.target.value)}
              className={`${ui.input} h-8`}
            />
          </label>

          <label className="block">
            <span className={ui.label}>追加到查重库（本期用掉的题目、牌、母题）</span>
            <textarea
              value={archiveNote}
              onChange={(event) => setArchiveNote(event.target.value)}
              rows={3}
              placeholder="例：【日期】本期标题：题一月亮、题三假牌XX、第五题职场母题"
              className={`${ui.input} resize-y py-1.5 leading-5`}
            />
            <span className={ui.hint}>只写冒号前缀或留空则不追加，可稍后手动维护查重库。</span>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button disabled={archiving} onClick={() => setArchiveOpen(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={archiving} onClick={submitArchive}>
            {archiving && <Loader2 className="animate-spin" size={13} />}
            {archiving ? "归档中" : "确认归档"}
          </Button>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} />
    </>
  );
}
