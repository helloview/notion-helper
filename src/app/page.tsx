import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  Clock3,
  ClipboardCheck,
  ExternalLink,
  Film,
  Flag,
  Gauge,
  Layers3,
  ListChecks,
  MonitorPlay,
  PenLine,
  Play,
  RadioTower,
  Scissors,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { defaultAssigneeId, getFallbackAssignee } from "@/lib/assignees";
import { getTasks } from "@/lib/local-store";
import { getAvailableAssignees } from "@/lib/notion";
import type { Assignee, Priority, StepStatus, Task, TaskStatus } from "@/lib/types";
import { DeleteTaskForm } from "./delete-task-form";
import {
  deleteTaskAction,
  updateStepAction,
  updateTaskDetailsAction,
} from "./actions";
import { PublishTaskModal } from "./publish-task-modal";
import { StatusBanner } from "./status-banner";

export const dynamic = "force-dynamic";

const statusLabels: Record<TaskStatus, string> = {
  draft: "草稿",
  active: "进行中",
  blocked: "阻塞",
  done: "完成",
};

const priorityLabels: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const stepStatusLabels: Record<StepStatus, string> = {
  todo: "待开始",
  in_progress: "进行中",
  blocked: "阻塞",
  done: "完成",
};

const platformOptions = ["小红书", "抖音", "B站", "YouTube"];

function completion(task: Task) {
  if (task.steps.length === 0) return 0;
  return Math.round(
    (task.steps.filter((step) => step.completed || step.status === "done").length /
      task.steps.length) *
      100,
  );
}

function badgeClass(status: TaskStatus | StepStatus) {
  if (status === "done") return "border-[#b6ff4a] bg-[#eaffc8] text-[#1c3b00]";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "draft" || status === "todo") return "border-zinc-200 bg-zinc-100 text-zinc-600";
  return "border-zinc-900 bg-zinc-950 text-white";
}

function priorityClass(priority: Priority) {
  if (priority === "high") return "border-[#b6ff4a] bg-[#b6ff4a] text-zinc-950";
  if (priority === "low") return "border-zinc-200 bg-white text-zinc-600";
  return "border-zinc-800 bg-zinc-900 text-white";
}

function notionPageUrl(pageId?: string) {
  return pageId ? `https://www.notion.so/${pageId.replaceAll("-", "")}` : "";
}

function assigneeName(
  assigneeById: Map<string, Assignee>,
  assigneeId: string | undefined,
) {
  if (!assigneeId) return "未分配";
  return assigneeById.get(assigneeId)?.name ?? getFallbackAssignee(assigneeId).name;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    delete?: string;
    error?: string;
    notion?: string;
    stepUpdate?: string;
    update?: string;
  }>;
}) {
  const [tasks, params, assignees] = await Promise.all([
    getTasks(),
    searchParams,
    getAvailableAssignees(),
  ]);
  const selectedDefaultAssignee =
    assignees.find(
      (assignee) =>
        assignee.id === process.env.DEFAULT_ASSIGNEE_ID ||
        assignee.notionUserId === process.env.DEFAULT_ASSIGNEE_ID,
    ) ??
    assignees.find((assignee) => assignee.id === defaultAssigneeId) ??
    assignees[0];
  const assigneeById = new Map(
    assignees.flatMap((assignee) => [
      [assignee.id, assignee] as const,
      ...(assignee.notionUserId ? ([[assignee.notionUserId, assignee]] as const) : []),
    ]),
  );
  const activeCount = tasks.filter((task) => task.status === "active").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const stepCount = tasks.reduce((sum, task) => sum + task.steps.length, 0);
  const averageProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + completion(task), 0) / tasks.length)
    : 0;

  return (
    <main className="min-h-screen bg-[#ececea] text-zinc-950">
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="absolute left-0 top-28 h-px w-72 -rotate-12 bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
        <div className="absolute right-0 top-44 h-px w-80 rotate-12 bg-gradient-to-r from-transparent via-[#b6ff4a]/60 to-transparent" />
        <div className="relative mx-auto flex w-full max-w-[1480px] flex-col gap-7 px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pb-10">
          <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-[#b6ff4a] text-zinc-950 shadow-[0_0_32px_rgba(182,255,74,0.35)]">
                <Clapperboard className="size-5" aria-hidden />
              </span>
              <div>
                <div className="text-sm font-semibold tracking-wide">TaskOps</div>
                <div className="text-xs text-zinc-400">Creative Production Command</div>
              </div>
            </div>
            <div className="flex items-center">
              <PublishTaskModal
                assignees={assignees}
                defaultAssigneeId={selectedDefaultAssignee?.id ?? defaultAssigneeId}
              />
            </div>
          </div>

          <div className="grid gap-8 py-4 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:py-10">
            <div className="animate-rise max-w-3xl">
              <div className="mb-5 inline-flex h-9 items-center gap-2 rounded-md border border-[#b6ff4a]/40 bg-[#b6ff4a]/10 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#d8ff9a]">
                <MonitorPlay className="size-4" aria-hidden />
                Creator pipeline
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">
                让视频创作像产线一样推进
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
                选题、脚本、录制、剪辑、发布和复盘集中推进。界面只留下会影响交付的动作和状态。
              </p>
              <div className="mt-7 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                <CreativeStat icon={Clapperboard} label="项目" value={tasks.length} />
                <CreativeStat icon={Scissors} label="步骤" value={stepCount} />
                <CreativeStat icon={RadioTower} label="发布中" value={activeCount} />
                <CreativeStat icon={Gauge} label="进度" value={`${averageProgress}%`} />
              </div>
            </div>

            <div className="animate-rise relative min-h-[330px] overflow-hidden rounded-lg border border-white/10 bg-black shadow-2xl shadow-black/40 [animation-delay:120ms] sm:min-h-[430px]">
              <Image
                src="/creative-ops-hero.png"
                alt="视频创作流程视觉图，包含镜头、剪辑时间线、画面卡片和发布面板"
                fill
                priority
                sizes="(min-width: 1024px) 760px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/10" />
              <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/10 bg-black/60 p-4 backdrop-blur-md sm:left-5 sm:right-auto sm:w-80">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">
                      Live board
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {blockedCount > 0 ? `${blockedCount} 个阻塞待处理` : "流程清爽，无阻塞"}
                    </p>
                  </div>
                  <span className="inline-flex size-11 items-center justify-center rounded-md bg-[#b6ff4a] text-zinc-950">
                    <Play className="size-5 fill-current" aria-hidden />
                  </span>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>完成度</span>
                    <span className="font-mono text-[#b6ff4a]">{averageProgress}%</span>
                  </div>
                  <ProgressBar progress={averageProgress} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="min-w-0 space-y-5">
          <StatusMessages params={params} />

          <div className="animate-rise flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                <SlidersHorizontal className="size-4 text-zinc-500" aria-hidden />
                生产队列
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                展开项目即可编辑主任务和子任务；移动端保持纵向操作，不再横向滚动。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <QueuePill icon={Layers3} label="主任务" value={tasks.length} />
              <QueuePill icon={ClipboardCheck} label="子任务" value={stepCount} />
              <QueuePill icon={Activity} label="进行中" value={activeCount} />
              <QueuePill icon={Flag} label="完成" value={doneCount} />
            </div>
          </div>

          {tasks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  assignees={assignees}
                  assigneeById={assigneeById}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CreativeStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#b6ff4a]/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <Icon className="size-4 text-[#b6ff4a]" aria-hidden />
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function QueuePill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <span className="inline-flex h-10 min-w-28 items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
      <span className="inline-flex items-center gap-2">
        <Icon className="size-4 text-zinc-500" aria-hidden />
        {label}
      </span>
      <span className="font-mono font-semibold text-zinc-950">{value}</span>
    </span>
  );
}

function StatusMessages({
  params,
}: {
  params: {
    created?: string;
    delete?: string;
    error?: string;
    notion?: string;
    stepUpdate?: string;
    update?: string;
  };
}) {
  const message =
    params.created === "notion"
      ? { tone: "success", text: "任务已发布到 Notion，并保存到本地。" }
      : params.created === "local"
        ? {
            tone: "warn",
            text: `任务已保存到本地，但 Notion 状态为 ${params.notion ?? "unknown"}。`,
          }
        : params.error
          ? { tone: "danger", text: "标题、摘要和步骤不能为空。" }
          : params.delete === "deleted_remote_and_local"
            ? { tone: "success", text: "任务已从本地删除，Notion 页面已移到回收站。" }
            : params.delete === "deleted_local_remote_failed"
              ? {
                  tone: "warn",
                  text: "本地任务已删除，但远程 Notion 页面没有成功移到回收站。",
                }
              : params.delete === "failed"
                ? { tone: "danger", text: "删除失败，远程 Notion 页面没有成功处理。" }
                : params.update?.includes("updated")
                  ? { tone: "success", text: "主任务已同步更新。" }
                  : params.update === "failed" || params.update === "invalid"
                    ? { tone: "danger", text: "主任务更新失败。" }
                    : params.stepUpdate?.includes("updated")
                      ? { tone: "success", text: "子任务已同步更新。" }
                      : params.stepUpdate === "failed" || params.stepUpdate === "invalid"
                        ? { tone: "danger", text: "子任务更新失败。" }
                        : null;

  if (!message) return null;

  const className =
    message.tone === "success"
      ? "border-[#b6ff4a] bg-[#ecffd5] text-[#1b3600]"
      : message.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800";

  return <StatusBanner className={className} text={message.text} />;
}

function TaskCard({
  task,
  assignees,
  assigneeById,
  index,
}: {
  task: Task;
  assignees: Assignee[];
  assigneeById: Map<string, Assignee>;
  index: number;
}) {
  const progress = completion(task);
  const taskUrl = notionPageUrl(task.notion.pageId);

  return (
    <article
      className="animate-rise overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-950/5"
      style={{ animationDelay: `${Math.min(index * 70, 280)}ms` }}
    >
      <div className="grid gap-5 border-b border-zinc-200 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className={badgeClass(task.status)}>{statusLabels[task.status]}</Badge>
            <Badge className={priorityClass(task.priority)}>
              <Flag className="size-3" aria-hidden />
              {priorityLabels[task.priority]}
            </Badge>
            {task.kind === "video" ? (
              <Badge className="border-zinc-200 bg-zinc-50 text-zinc-600">
                <Film className="size-3" aria-hidden />
                视频
              </Badge>
            ) : null}
            {task.contentSeries ? (
              <Badge className="border-zinc-200 bg-white text-zinc-600">
                {task.contentSeries}
              </Badge>
            ) : null}
          </div>
          <h3 className="text-xl font-semibold leading-tight text-zinc-950">
            {task.title}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">
            {task.summary}
          </p>
          <div className="mt-4 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2 xl:grid-cols-4">
            <InfoPill icon={UserRound} label={assigneeName(assigneeById, task.assigneeId)} />
            <InfoPill icon={CalendarDays} label={task.dueDate || "未设截止"} />
            <InfoPill icon={Clock3} label={task.targetPublishDate || "未设发布"} />
            <InfoPill icon={Layers3} label={task.platforms?.length ? task.platforms.join(" / ") : "未选平台"} />
          </div>
        </div>

        <div className="space-y-3 xl:justify-self-end xl:w-[310px]">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>完成度</span>
              <span className="font-mono text-zinc-950">{progress}%</span>
            </div>
            <ProgressBar progress={progress} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
            {taskUrl ? (
              <a
                href={taskUrl}
                target="_blank"
                rel="noreferrer"
                className={secondaryButtonClass}
              >
                <ExternalLink className="size-4" aria-hidden />
                Notion
              </a>
            ) : (
              <span className="inline-flex h-10 min-w-0 items-center justify-center rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-400">
                Local
              </span>
            )}
            <DeleteTaskForm
              action={deleteTaskAction}
              taskId={task.id}
              hasNotionPage={Boolean(task.notion.pageId)}
            />
          </div>
        </div>
      </div>

      <details className="group border-b border-zinc-200">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 sm:px-5">
          <span className="flex min-w-0 items-center gap-2">
            <PenLine className="size-4 text-zinc-500" aria-hidden />
            <span className="truncate">编辑主任务</span>
          </span>
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 transition group-open:rotate-45 group-open:bg-zinc-950 group-open:text-white">
            <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </summary>
        <form action={updateTaskDetailsAction} className="grid gap-4 border-t border-zinc-200 bg-zinc-50 p-4 sm:p-5 xl:grid-cols-4">
          <input type="hidden" name="taskId" value={task.id} />
          <Field label="标题">
            <input name="title" defaultValue={task.title} className={inputClass} required />
          </Field>
          <Field label="状态">
            <select name="status" defaultValue={task.status} className={inputClass}>
              <option value="draft">草稿</option>
              <option value="active">进行中</option>
              <option value="blocked">阻塞</option>
              <option value="done">完成</option>
            </select>
          </Field>
          <Field label="优先级">
            <select name="priority" defaultValue={task.priority} className={inputClass}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </Field>
          <Field label="负责人">
            <AssigneeSelect assignees={assignees} name="assigneeId" defaultValue={task.assigneeId} />
          </Field>
          <Field label="视频系列">
            <input name="contentSeries" defaultValue={task.contentSeries} className={inputClass} />
          </Field>
          <Field label="周期">
            <input name="weekLabel" defaultValue={task.weekLabel} className={inputClass} />
          </Field>
          <Field label="整体截止">
            <input name="dueDate" type="date" defaultValue={task.dueDate} className={inputClass} />
          </Field>
          <Field label="目标发布">
            <input name="targetPublishDate" type="date" defaultValue={task.targetPublishDate} className={inputClass} />
          </Field>
          <div className="xl:col-span-2">
            <PlatformChecks selected={task.platforms ?? []} />
          </div>
          <div className="xl:col-span-3">
            <Field label="摘要">
              <textarea name="summary" defaultValue={task.summary} className={textareaClass} required />
            </Field>
          </div>
          <div className="flex items-end">
            <button type="submit" className={primaryButtonClass}>
              <CheckCircle2 className="size-4" aria-hidden />
              保存主任务
            </button>
          </div>
        </form>
      </details>

      <div>
        <div className="hidden grid-cols-[110px_1.4fr_128px_160px_126px_110px] border-b border-zinc-200 bg-zinc-950 px-5 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400 lg:grid">
          <div>阶段</div>
          <div>子任务</div>
          <div>状态</div>
          <div>负责人</div>
          <div>截止日期</div>
          <div>操作</div>
        </div>
        <div>
          {task.steps.map((step) => (
            <StepRow
              key={step.id}
              task={task}
              step={step}
              assignees={assignees}
              assigneeById={assigneeById}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function StepRow({
  task,
  step,
  assignees,
  assigneeById,
}: {
  task: Task;
  step: Task["steps"][number];
  assignees: Assignee[];
  assigneeById: Map<string, Assignee>;
}) {
  const status = step.status ?? (step.completed ? "done" : "todo");
  const stepUrl = notionPageUrl(step.notion?.pageId);

  return (
    <details className="group border-b border-zinc-100 last:border-b-0">
      <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 text-sm transition hover:bg-zinc-50 sm:px-5 lg:grid-cols-[110px_1.4fr_128px_160px_126px_110px] lg:items-center">
        <div className="flex items-center justify-between gap-3 lg:block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 lg:hidden">阶段</span>
          <span className="truncate text-zinc-600">{step.phase ?? "执行"}</span>
        </div>
        <div className="min-w-0">
          <div className="font-medium text-zinc-950 lg:truncate">{step.title}</div>
          <div className="mt-1 text-xs leading-5 text-zinc-500 lg:truncate">{step.description}</div>
        </div>
        <div className="flex items-center justify-between gap-3 lg:block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 lg:hidden">状态</span>
          <Badge className={badgeClass(status)}>{stepStatusLabels[status]}</Badge>
        </div>
        <div className="flex items-center justify-between gap-3 text-zinc-600 lg:block lg:truncate">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 lg:hidden">负责人</span>
          <span>{assigneeName(assigneeById, step.assigneeId ?? task.assigneeId)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-zinc-500 lg:block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 lg:hidden">截止</span>
          <span>{step.dueDate || "未设置"}</span>
        </div>
        <div className="flex items-center gap-2">
          {stepUrl ? (
            <a
              href={stepUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-zinc-950 hover:bg-zinc-950 hover:text-white"
              title="打开 Notion 子任务"
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : null}
          <span className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition group-open:rotate-45 group-open:border-zinc-950 group-open:bg-zinc-950 group-open:text-white">
            <PenLine className="size-4" aria-hidden />
          </span>
        </div>
      </summary>
      <form action={updateStepAction} className="grid gap-4 border-t border-zinc-100 bg-zinc-50 px-4 py-4 sm:px-5 xl:grid-cols-5">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="stepId" value={step.id} />
        <Field label="阶段">
          <input name="phase" defaultValue={step.phase} className={inputClass} />
        </Field>
        <Field label="标题">
          <input name="title" defaultValue={step.title} className={inputClass} required />
        </Field>
        <Field label="状态">
          <select name="status" defaultValue={status} className={inputClass}>
            <option value="todo">待开始</option>
            <option value="in_progress">进行中</option>
            <option value="blocked">阻塞</option>
            <option value="done">完成</option>
          </select>
        </Field>
        <Field label="负责人">
          <AssigneeSelect
            assignees={assignees}
            name="assigneeId"
            defaultValue={step.assigneeId ?? task.assigneeId}
          />
        </Field>
        <Field label="截止日期">
          <input name="dueDate" type="date" defaultValue={step.dueDate} className={inputClass} />
        </Field>
        <div className="xl:col-span-4">
          <Field label="子任务说明">
            <textarea name="description" defaultValue={step.description} className={textareaClass} />
          </Field>
        </div>
        <div className="flex items-end">
          <button type="submit" className={primaryButtonClass}>
            <CheckCircle2 className="size-4" aria-hidden />
            保存子任务
          </button>
        </div>
      </form>
      {step.audioSegments?.length ? (
        <AudioSegmentPanel segments={step.audioSegments} />
      ) : null}
    </details>
  );
}

function AudioSegmentPanel({
  segments,
}: {
  segments: NonNullable<Task["steps"][number]["audioSegments"]>;
}) {
  return (
    <div className="border-t border-zinc-100 bg-white px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">Notion 音频分段</div>
          <div className="mt-1 text-xs text-zinc-500">
            每个 Segment 都是独立 Notion 子任务，音频在对应页面上传区处理。
          </div>
        </div>
        <Badge className="border-[#b6ff4a] bg-[#eaffc8] text-[#1c3b00]">
          {segments.length} 段
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {segments.map((segment) => {
          const url = notionPageUrl(segment.notion?.pageId);

          return (
            <a
              key={segment.id}
              href={url || undefined}
              target={url ? "_blank" : undefined}
              rel={url ? "noreferrer" : undefined}
              className="group rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm transition hover:border-zinc-950 hover:bg-white"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-zinc-500">
                  SEG {String(segment.index).padStart(2, "0")}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500 group-hover:text-zinc-950">
                  Notion 上传
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </span>
              </div>
              <p className="line-clamp-3 leading-6 text-zinc-700">{segment.text}</p>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
      <div
        className="h-full rounded-full bg-[#b6ff4a] transition-[width] duration-700 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function InfoPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex h-9 min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3">
      <Icon className="size-4 shrink-0 text-zinc-400" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="animate-rise rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center shadow-sm">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-md bg-zinc-950 text-[#b6ff4a]">
        <ListChecks className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-zinc-950">暂无任务</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
        新建任务后，这里会显示主任务、生产步骤、负责人和 Notion 状态。
      </p>
    </div>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function PlatformChecks({ selected }: { selected: string[] }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">发布平台</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {platformOptions.map((platform) => (
          <label
            key={platform}
            className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 transition hover:border-zinc-400"
          >
            <input
              name="platforms"
              type="checkbox"
              value={platform}
              defaultChecked={selected.includes(platform)}
              className="size-4 accent-[#6fd600]"
            />
            {platform}
          </label>
        ))}
      </div>
    </div>
  );
}

function AssigneeSelect({
  assignees,
  name,
  defaultValue,
  showOrigin = false,
}: {
  assignees: Assignee[];
  name: string;
  defaultValue?: string;
  showOrigin?: boolean;
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={inputClass}>
      {assignees.map((assignee) => (
        <option key={assignee.id} value={assignee.id}>
          {assignee.name}
          {showOrigin && assignee.origin === "workspace_user" ? " · Member" : ""}
          {showOrigin && assignee.origin === "database_people" ? " · Guest" : ""}
          {showOrigin && assignee.origin === "manual_guest" ? " · Guest" : ""}
          {showOrigin && assignee.source === "local" ? " · Local" : ""}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

const primaryButtonClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8df000]";

const secondaryButtonClass =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition duration-200 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white";

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-[#b6ff4a]/60";

const textareaClass =
  "min-h-24 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-[#b6ff4a]/60";
