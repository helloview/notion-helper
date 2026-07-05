import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ExternalLink,
  FileText,
  Film,
  Flag,
  Gauge,
  Home as HomeIcon,
  Layers3,
  ListChecks,
  PenLine,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { defaultAssigneeId, getFallbackAssignee } from "@/lib/assignees";
import { getTasks } from "@/lib/local-store";
import { getAvailableAssignees } from "@/lib/notion";
import type {
  Assignee,
  Priority,
  StepStatus,
  Task,
  TaskStatus,
} from "@/lib/types";
import { DeleteTaskForm } from "./delete-task-form";
import {
  deleteTaskAction,
  updateStepAction,
  updateTaskDetailsAction,
} from "./actions";
import { PublishTaskModal } from "./publish-task-modal";
import {
  PendingFormStatus,
  PendingSubmitButton,
} from "./pending-submit-button";
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
  processing: "处理中",
  in_progress: "进行中",
  blocked: "阻塞",
  done: "完成",
};

const platformOptions = ["小红书", "抖音", "B站", "YouTube"];
const platformDisplayLabels: Record<string, string> = {
  YouTube: "油管",
};

const queueStatusFilters = ["all", "active", "blocked", "done", "draft"] as const;
const queueSortOptions = ["updated", "progress", "priority", "due"] as const;

type QueueStatusFilter = (typeof queueStatusFilters)[number];
type QueueSort = (typeof queueSortOptions)[number];

function completion(task: Task) {
  if (task.steps.length === 0) return 0;
  return Math.round(
    (task.steps.filter((step) => step.completed || step.status === "done")
      .length /
      task.steps.length) *
      100,
  );
}

function notionPageUrl(pageId?: string) {
  return pageId ? `https://www.notion.so/${pageId.replaceAll("-", "")}` : "";
}

function assigneeName(
  assigneeById: Map<string, Assignee>,
  assigneeId: string | undefined,
) {
  if (!assigneeId) return "未分配";
  return (
    assigneeById.get(assigneeId)?.name ?? getFallbackAssignee(assigneeId).name
  );
}

function assigneeNames(
  assigneeById: Map<string, Assignee>,
  assigneeIds: string[] | undefined,
  fallbackId?: string,
) {
  const ids = assigneeIds?.length ? assigneeIds : fallbackId ? [fallbackId] : [];
  if (ids.length === 0) return "未分配";
  return ids.map((id) => assigneeName(assigneeById, id)).join(" / ");
}

function taskAssigneeIds(task: Task) {
  return task.assigneeIds?.length
    ? task.assigneeIds
    : task.assigneeId
      ? [task.assigneeId]
      : [];
}

function normalizeStatusFilter(value?: string): QueueStatusFilter {
  return queueStatusFilters.includes(value as QueueStatusFilter)
    ? (value as QueueStatusFilter)
    : "all";
}

function normalizeQueueSort(value?: string): QueueSort {
  return queueSortOptions.includes(value as QueueSort)
    ? (value as QueueSort)
    : "updated";
}

function priorityWeight(priority: Priority) {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

function dueTimestamp(task: Task) {
  const value = task.targetPublishDate || task.dueDate;
  return value ? Date.parse(value) : Number.POSITIVE_INFINITY;
}

function displayPlatform(platform: string) {
  return platformDisplayLabels[platform] ?? platform;
}

function displayPlatforms(platforms: string[] | undefined) {
  return platforms?.length ? platforms.map(displayPlatform).join(" / ") : "未选平台";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    delete?: string;
    error?: string;
    notion?: string;
    owner?: string;
    project?: string;
    q?: string;
    sort?: string;
    stepUpdate?: string;
    status?: string;
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
      ...(assignee.notionUserId
        ? ([[assignee.notionUserId, assignee]] as const)
        : []),
    ]),
  );
  const activeCount = tasks.filter((task) => task.status === "active").length;
  const blockedCount = tasks.filter(
    (task) => task.status === "blocked",
  ).length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const stepCount = tasks.reduce((sum, task) => sum + task.steps.length, 0);
  const averageProgress = tasks.length
    ? Math.round(
        tasks.reduce((sum, task) => sum + completion(task), 0) / tasks.length,
      )
    : 0;
  const queueQuery = String(params.q ?? "").trim();
  const normalizedQuery = queueQuery.toLowerCase();
  const statusFilter = normalizeStatusFilter(params.status);
  const ownerFilter = String(params.owner ?? "all");
  const queueSort = normalizeQueueSort(params.sort);
  const hasActiveQueueFilters =
    Boolean(queueQuery) ||
    statusFilter !== "all" ||
    ownerFilter !== "all" ||
    queueSort !== "updated";
  const filteredTasks = tasks
    .filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      const ownerIds = taskAssigneeIds(task);
      if (ownerFilter === "unassigned" && ownerIds.length > 0) {
        return false;
      }
      if (
        ownerFilter !== "all" &&
        ownerFilter !== "unassigned" &&
        !ownerIds.includes(ownerFilter)
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const searchable = [
        task.projectCode,
        task.title,
        task.summary,
        task.contentSeries,
        task.weekLabel,
        displayPlatforms(task.platforms),
        statusLabels[task.status],
        priorityLabels[task.priority],
        assigneeNames(assigneeById, task.assigneeIds, task.assigneeId),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (queueSort === "progress") return completion(a) - completion(b);
      if (queueSort === "priority") {
        return priorityWeight(a.priority) - priorityWeight(b.priority);
      }
      if (queueSort === "due") return dueTimestamp(a) - dueTimestamp(b);
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  const selectedTask =
    filteredTasks.find((task) => task.id === params.project) ??
    filteredTasks[0];

  return (
    <main className="app-canvas min-h-screen text-[#151a18]">
      <div className="app-dots fixed inset-0 -z-10" />
      <div className="grid min-h-screen w-full lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#dddfd2] bg-[#ebeae1]/72 px-4 py-5 backdrop-blur-xl lg:block">
          <div className="flex items-center gap-3 px-2">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#d6ff2a] text-[#101600] shadow-[0_0_18px_rgba(214,255,42,0.30)]">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <div className="font-[var(--font-display)] text-sm font-bold">
                内容创作者
              </div>
              <div className="text-xs text-[#747b70]">高级用户</div>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            <NavItem icon={HomeIcon} label="创作看板" />
            <NavItem icon={ListChecks} label="内容选题" active />
            <NavItem icon={BarChart3} label="数据分析" />
            <NavItem icon={Settings} label="账号设置" />
          </nav>

          <div className="absolute bottom-6 left-6 font-mono text-[11px] text-[#747b70]">
            v1.2.0
          </div>
        </aside>

        <section className="min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-[1680px]">
          <header className="mb-4 rounded-[1.5rem] border border-white/80 bg-[#fffefa]/88 p-4 shadow-[0_18px_42px_rgba(21,26,24,0.07)] backdrop-blur-xl lg:p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-center">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-[#4e6700]">
                内容生产
              </p>
              <h1 className="mt-1 font-[var(--font-display)] text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-[#151a18] sm:text-5xl xl:text-6xl">
                创作控制台
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#3e4942]">
                管理内容产出与追踪进度，让脚本、音频、素材和发布状态保持同步。
              </p>
            </div>

            <div className="grid gap-3">
              <div className="hidden grid-cols-4 gap-2 md:grid">
                <OverviewTile label="总进度" value={`${averageProgress}%`} tone="accent" />
                <OverviewTile label="项目" value={tasks.length} />
                <OverviewTile label="进行中" value={activeCount} />
                <OverviewTile label="阻塞" value={blockedCount} tone={blockedCount > 0 ? "danger" : undefined} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="hidden items-center -space-x-2 sm:flex">
                  {assignees.slice(0, 3).map((assignee) => (
                    <span
                      key={assignee.id}
                      className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#dfded2] text-xs font-bold text-[#4e6700]"
                      title={assignee.name}
                    >
                      {assignee.name.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                  {assignees.length > 3 ? (
                    <span className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#171d1a] font-mono text-[10px] text-white">
                      +{assignees.length - 3}
                    </span>
                  ) : null}
                </div>
                <PublishTaskModal
                  assignees={assignees}
                  defaultAssigneeId={
                    selectedDefaultAssignee?.id ?? defaultAssigneeId
                  }
                />
              </div>
            </div>
            </div>
          </header>

          <section className="mb-4 grid gap-2 sm:hidden">
            <div className="studio-dark overflow-hidden rounded-2xl p-4 text-white shadow-[0_16px_34px_rgba(21,26,24,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] font-semibold text-white/45">
                    生产概况
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="font-mono text-5xl font-bold leading-none">
                      {averageProgress}
                    </span>
                    <span className="pb-1 font-mono text-base font-bold text-[#d6ff2a]">
                      %
                    </span>
                  </div>
                </div>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#d6ff2a] text-[#101600] shadow-[0_0_18px_rgba(214,255,42,0.34)]">
                  <TrendingUp className="size-5" aria-hidden />
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-[#d6ff2a] shadow-[0_0_14px_rgba(214,255,42,0.48)] transition-[width] duration-700"
                  style={{ width: `${averageProgress}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-white/55">
                {activeCount} 个项目推进中，
                {blockedCount > 0 ? `${blockedCount} 个阻塞。` : "暂无阻塞。"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MobileMetric label="项目" value={tasks.length} />
              <MobileMetric label="步骤" value={stepCount} />
              <MobileMetric label="进行中" value={activeCount} />
              <MobileMetric label="阻塞" value={blockedCount} />
              <MobileMetric label="完成" value={doneCount} tone="accent" />
              <MobileMetric label="总进度" value={`${averageProgress}%`} />
            </div>
          </section>

          <StatusMessages params={params} />

          <section className="rounded-[1.5rem] border border-white/80 bg-[#fffefa]/86 p-3 shadow-[0_18px_42px_rgba(21,26,24,0.07)] backdrop-blur-xl">
            <form
              action="/"
              className="mb-2 grid gap-1.5 rounded-xl border border-[#dddfd2] bg-[#ebeae1] p-1.5 shadow-[inset_2px_2px_7px_rgba(26,28,31,0.04),inset_-2px_-2px_7px_rgba(255,255,255,0.75)] lg:grid-cols-[auto_minmax(220px,1fr)_132px_160px_140px_auto_auto_auto] lg:items-center"
            >
              <div className="hidden h-9 items-center gap-2 whitespace-nowrap px-2 font-[var(--font-display)] text-sm font-bold text-[#151a18] lg:flex">
                <ListChecks className="size-4 text-[#4e6700]" aria-hidden />
                项目队列
              </div>

              <label className="relative block">
                <span className="sr-only">搜索项目</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#747b70]"
                  aria-hidden
                />
                <input
                  name="q"
                  defaultValue={queueQuery}
                  placeholder="搜索编号、标题、系列、平台..."
                  className="h-9 w-full rounded-lg border border-[#c8ccbf] bg-white pl-9 pr-3 text-sm text-[#151a18] outline-none transition placeholder:text-[#87907f] focus:border-[#4e6700] focus:ring-2 focus:ring-[#d6ff2a]/40"
                />
              </label>

              <details className="group/filter lg:contents">
                <summary className="flex h-9 cursor-pointer list-none items-center justify-between rounded-lg border border-[#c8ccbf] bg-white px-3 text-sm font-bold text-[#3e4942] lg:hidden">
                  <span className="flex items-center gap-2">
                    <Search className="size-4 text-[#4e6700]" aria-hidden />
                    筛选条件
                  </span>
                  <ChevronDown className="size-4 transition group-open/filter:rotate-180" />
                </summary>
                <div className="mt-1 grid gap-1.5 lg:contents">
                  <label className="block">
                <span className="sr-only">状态</span>
                <select
                  name="status"
                  defaultValue={statusFilter}
                  className="h-9 w-full rounded-lg border border-[#c8ccbf] bg-white px-3 text-sm font-semibold text-[#3e4942] outline-none transition focus:border-[#4e6700] focus:ring-2 focus:ring-[#d6ff2a]/40"
                >
                  <option value="all">全部状态</option>
                  <option value="active">进行中</option>
                  <option value="blocked">阻塞</option>
                  <option value="done">完成</option>
                  <option value="draft">草稿</option>
                </select>
                  </label>

                  <label className="block">
                <span className="sr-only">负责人</span>
                <select
                  name="owner"
                  defaultValue={ownerFilter}
                  className="h-9 w-full rounded-lg border border-[#c8ccbf] bg-white px-3 text-sm font-semibold text-[#3e4942] outline-none transition focus:border-[#4e6700] focus:ring-2 focus:ring-[#d6ff2a]/40"
                >
                  <option value="all">全部负责人</option>
                  <option value="unassigned">未分配</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.name}
                    </option>
                  ))}
                </select>
                  </label>

                  <label className="block">
                <span className="sr-only">排序</span>
                <select
                  name="sort"
                  defaultValue={queueSort}
                  className="h-9 w-full rounded-lg border border-[#c8ccbf] bg-white px-3 text-sm font-semibold text-[#3e4942] outline-none transition focus:border-[#4e6700] focus:ring-2 focus:ring-[#d6ff2a]/40"
                >
                  <option value="updated">最近更新</option>
                  <option value="progress">进度最低</option>
                  <option value="priority">优先级最高</option>
                  <option value="due">截止最近</option>
                </select>
                  </label>
                </div>
              </details>

              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#d6ff2a] px-3 text-sm font-bold text-[#101600] shadow-[0_8px_18px_rgba(92,120,0,0.16)] transition hover:bg-[#c6ee18] active:translate-y-0.5"
              >
                <Search className="size-4" aria-hidden />
                筛选
              </button>

              {hasActiveQueueFilters ? (
                <Link
                  href="/"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#c8ccbf] bg-white px-3 text-sm font-bold text-[#3e4942] transition hover:border-[#b7c0ad] hover:bg-[#f2ffd6]"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  清空
                </Link>
              ) : null}

              <div className="flex h-9 items-center justify-end gap-1.5 lg:col-auto">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#b7c0ad] bg-white px-2 font-mono text-[11px] text-[#3e4942]">
                  <CircleDot className="size-3.5 text-[#4e6700]" aria-hidden />
                  总进度 {averageProgress}%
                </span>
                <span className="inline-flex h-8 items-center rounded-lg bg-[#171d1a] px-2 font-mono text-[11px] text-white">
                  项目 {filteredTasks.length}/{tasks.length}
                </span>
              </div>
            </form>

            {tasks.length === 0 ? (
              <EmptyState />
            ) : filteredTasks.length === 0 ? (
              <FilteredEmptyState />
            ) : (
              <>
              <div className="grid gap-2 xl:hidden">
                {filteredTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    assignees={assignees}
                    assigneeById={assigneeById}
                    index={index}
                  />
                ))}
              </div>
              <DesktopProjectWorkspace
                assigneeById={assigneeById}
                assignees={assignees}
                currentParams={{
                  owner: ownerFilter,
                  q: queueQuery,
                  sort: queueSort,
                  status: statusFilter,
                }}
                selectedTask={selectedTask}
                tasks={filteredTasks}
              />
              </>
            )}
          </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href="#"
      className={`relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
        active
          ? "bg-[#f2ffd6] text-[#4e6700]"
          : "text-[#5b655e] hover:bg-white hover:text-[#4e6700]"
      }`}
    >
      {active ? (
        <span className="absolute left-0 top-2 h-6 w-1 rounded-full bg-[#4e6700]" />
      ) : null}
      <Icon className="size-4" aria-hidden />
      {label}
    </a>
  );
}

function OverviewTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "accent" | "danger";
}) {
  return (
    <div
      className={`rounded-2xl border p-3 shadow-[inset_2px_2px_7px_rgba(26,28,31,0.04),inset_-2px_-2px_7px_rgba(255,255,255,0.8)] ${
        tone === "accent"
          ? "border-[#d6ff2a]/70 bg-[#f2ffd6]"
          : tone === "danger"
            ? "border-[#ffdad6] bg-[#fff1ef]"
            : "border-[#dddfd2] bg-[#f5f4ee]"
      }`}
    >
      <div
        className={`font-mono text-2xl font-bold leading-none ${
          tone === "danger" ? "text-[#93000a]" : "text-[#151a18]"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-[#747b70]">
        {label}
      </div>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "accent";
}) {
  return (
    <div
      className={`rounded-2xl border p-3 shadow-[0_8px_20px_rgba(26,28,31,0.04)] ${
        tone === "accent"
          ? "border-[#d6ff2a]/70 bg-[#f2ffd6]"
          : "border-[#dddfd2] bg-white"
      }`}
    >
      <div className="font-mono text-2xl font-bold leading-none text-[#151a18]">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-[#747b70]">
        {label}
      </div>
    </div>
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
      ? { tone: "success", text: "任务已发布到协作空间，并保存到本地。" }
      : params.created === "local"
        ? {
            tone: "warn",
            text: "任务已保存到本地，但协作空间同步状态未知。",
          }
        : params.error
          ? { tone: "danger", text: "标题、摘要和步骤不能为空。" }
          : params.delete === "deleted_remote_and_local"
            ? {
                tone: "success",
                text: "任务已从本地删除，协作页面已移到回收站。",
              }
            : params.delete === "deleted_local_remote_failed"
              ? {
                  tone: "warn",
                  text: "本地任务已删除，但远程协作页面没有成功移到回收站。",
                }
              : params.delete === "failed"
                ? {
                    tone: "danger",
                    text: "删除失败，远程协作页面没有成功处理。",
                  }
                : params.update === "updated_local_remote_failed"
                  ? {
                      tone: "warn",
                      text: "主任务已保存到数据库，但协作空间同步失败。",
                    }
                  : params.update?.includes("updated")
                  ? { tone: "success", text: "主任务已同步更新。" }
                  : params.update === "failed" || params.update === "invalid"
                    ? { tone: "danger", text: "主任务更新失败。" }
                    : params.stepUpdate === "updated_local_remote_failed"
                      ? {
                          tone: "warn",
                          text: "子任务已保存到数据库，但协作空间同步失败。",
                        }
                    : params.stepUpdate?.includes("updated")
                      ? { tone: "success", text: "子任务已同步更新。" }
                      : params.stepUpdate === "failed" ||
                          params.stepUpdate === "invalid"
                        ? { tone: "danger", text: "子任务更新失败。" }
                        : null;

  if (!message) return null;

  const className =
    message.tone === "success"
      ? "mb-4 border-[#4e6700]/25 bg-[#d6ff2a]/20 text-[#405236]"
      : message.tone === "warn"
        ? "mb-4 border-amber-300 bg-amber-50 text-amber-800"
        : "mb-4 border-[#ba1a1a]/25 bg-[#ffdad6] text-[#93000a]";

  return <StatusBanner className={className} text={message.text} />;
}

type QueueViewParams = {
  owner: string;
  q: string;
  sort: QueueSort;
  status: QueueStatusFilter;
};

function projectQueueHref(params: QueueViewParams, projectId: string) {
  const nextParams = new URLSearchParams();
  if (params.q) nextParams.set("q", params.q);
  if (params.status !== "all") nextParams.set("status", params.status);
  if (params.owner !== "all") nextParams.set("owner", params.owner);
  if (params.sort !== "updated") nextParams.set("sort", params.sort);
  nextParams.set("project", projectId);
  return `/?${nextParams.toString()}`;
}

function DesktopProjectWorkspace({
  tasks,
  selectedTask,
  assignees,
  assigneeById,
  currentParams,
}: {
  tasks: Task[];
  selectedTask: Task;
  assignees: Assignee[];
  assigneeById: Map<string, Assignee>;
  currentParams: QueueViewParams;
}) {
  return (
    <div className="hidden gap-3 xl:grid xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-2xl border border-[#dddfd2] bg-[#f4f3ed]">
        <div className="flex items-center justify-between border-b border-[#dddfd2] px-3 py-3">
          <div>
            <div className="font-[var(--font-display)] text-sm font-bold text-[#151a18]">
              项目列表
            </div>
            <div className="mt-0.5 text-xs text-[#747b70]">
              选择项目查看流程与交付状态
            </div>
          </div>
          <span className="rounded-full bg-[#171d1a] px-2.5 py-1 font-mono text-[11px] text-white">
            {tasks.length}
          </span>
        </div>
        <div className="max-h-[680px] space-y-1.5 overflow-y-auto p-2">
          {tasks.map((task) => (
            <DesktopProjectListItem
              href={projectQueueHref(currentParams, task.id)}
              key={task.id}
              selected={task.id === selectedTask.id}
              task={task}
            />
          ))}
        </div>
      </aside>

      <DesktopProjectDetail
        assigneeById={assigneeById}
        assignees={assignees}
        task={selectedTask}
      />
    </div>
  );
}

function DesktopProjectListItem({
  task,
  href,
  selected,
}: {
  task: Task;
  href: string;
  selected: boolean;
}) {
  const progress = completion(task);
  const doneSteps = task.steps.filter(
    (step) => step.completed || step.status === "done",
  ).length;

  return (
    <Link
      href={href}
      className={`block rounded-xl border p-3 transition ${
        selected
          ? "border-[#b7c0ad] bg-[#fffefa] shadow-[0_12px_26px_rgba(26,28,31,0.08)] ring-1 ring-[#d6ff2a]/45"
          : "border-transparent bg-transparent hover:border-[#c8ccbf] hover:bg-[#fffefa]"
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {task.projectCode ? (
          <span className="rounded-md bg-[#d6ff2a] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#101600]">
            [{task.projectCode}]
          </span>
        ) : null}
        <StatusBadgeUI status={task.status}>
          {statusLabels[task.status]}
        </StatusBadgeUI>
        <PriorityBadge priority={task.priority}>
          {priorityLabels[task.priority]}
        </PriorityBadge>
      </div>
      <div className="truncate font-[var(--font-display)] text-sm font-bold text-[#151a18]">
        {task.title}
      </div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#747b70]">
        {task.summary}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold text-[#747b70]">
          {doneSteps}/{task.steps.length} 完成
        </span>
        <span className="font-mono text-xs font-bold text-[#4e6700]">
          {progress}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#dddfd2]">
        <div
          className="h-full rounded-full bg-[#d6ff2a] transition-[width] duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </Link>
  );
}

function DesktopProjectDetail({
  task,
  assignees,
  assigneeById,
}: {
  task: Task;
  assignees: Assignee[];
  assigneeById: Map<string, Assignee>;
}) {
  const progress = completion(task);
  const taskUrl = notionPageUrl(task.notion.pageId);
  const doneSteps = task.steps.filter(
    (step) => step.completed || step.status === "done",
  ).length;
  const activeSteps = task.steps.filter(
    (step) => step.status === "processing" || step.status === "in_progress",
  ).length;
  const dueLabel = task.targetPublishDate || task.dueDate || "未设日期";

  return (
    <article className="overflow-hidden rounded-2xl border border-[#c8ccbf] bg-[#fffefa] shadow-[0_14px_34px_rgba(26,28,31,0.06)]">
      <div className="studio-dark grid gap-5 p-5 text-white 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {task.projectCode ? (
              <span className="rounded-lg bg-[#d6ff2a] px-2 py-1 font-mono text-[11px] font-bold text-[#101600] shadow-[0_0_14px_rgba(214,255,42,0.35)]">
                [{task.projectCode}]
              </span>
            ) : null}
            <span className="rounded-full border border-white/12 bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/72">
              {statusLabels[task.status]}
            </span>
            <span className="rounded-full border border-white/12 bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/72">
              {priorityLabels[task.priority]}优先级
            </span>
            {task.kind === "video" ? (
              <span className="rounded-full border border-white/12 bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/72">
                视频
              </span>
            ) : null}
          </div>
          <h2 className="font-[var(--font-display)] text-3xl font-bold leading-tight tracking-[-0.02em]">
            {task.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
            {task.summary}
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <DarkInfoItem label="负责人">
              {assigneeNames(assigneeById, task.assigneeIds, task.assigneeId)}
            </DarkInfoItem>
            <DarkInfoItem label="截止">
              {dueLabel}
            </DarkInfoItem>
            <DarkInfoItem label="平台">
              {displayPlatforms(task.platforms)}
            </DarkInfoItem>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.08),0_18px_34px_rgba(0,0,0,0.16)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] font-semibold text-white/42">
                项目进度
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-mono text-5xl font-bold leading-none text-white">
                  {progress}
                </span>
                <span className="pb-1 font-mono text-base font-bold text-[#d6ff2a]">
                  %
                </span>
              </div>
            </div>
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#d6ff2a] text-[#101600] shadow-[0_0_18px_rgba(214,255,42,0.28)]">
              <Gauge className="size-5" aria-hidden />
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full bg-[#d6ff2a] shadow-[0_0_14px_rgba(214,255,42,0.42)] transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <DarkStat label="完成" value={`${doneSteps}/${task.steps.length}`} />
            <DarkStat label="处理中" value={activeSteps} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {taskUrl ? (
              <a
                href={taskUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-[#151a18] transition hover:bg-[#f2ffd6]"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                打开页面
              </a>
            ) : null}
            <DeleteTaskForm
              action={deleteTaskAction}
              taskId={task.id}
              hasNotionPage={Boolean(task.notion.pageId)}
            />
          </div>
        </div>
      </div>

      <DesktopWorkflowPanel
        assigneeById={assigneeById}
        assignees={assignees}
        task={task}
      />
    </article>
  );
}

function DarkInfoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <div className="text-[11px] font-semibold text-white/35">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-white/78">
        {children}
      </div>
    </div>
  );
}

function DarkStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/[0.07] p-3">
      <div className="font-mono text-xl font-bold leading-none text-white">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-white/36">
        {label}
      </div>
    </div>
  );
}

function DesktopWorkflowPanel({
  task,
  assignees,
  assigneeById,
}: {
  task: Task;
  assignees: Assignee[];
  assigneeById: Map<string, Assignee>;
}) {
  return (
    <div className="bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-[var(--font-display)] text-base font-bold text-[#151a18]">
            流程轨道
          </div>
          <div className="mt-0.5 text-xs text-[#747b70]">
            展开步骤可直接编辑负责人、状态和截止时间。
          </div>
        </div>
        <span className="inline-flex h-8 items-center rounded-full bg-[#f2ffd6] px-3 font-mono text-[11px] font-bold text-[#4e6700]">
          {task.steps.length} 个步骤
        </span>
      </div>
      <div className="grid gap-2">
        {task.steps.map((step) => (
          <StepWorkflowCard
            key={step.id}
            task={task}
            step={step}
            assignees={assignees}
            assigneeById={assigneeById}
          />
        ))}
      </div>
      <details className="group/edit mt-4 overflow-hidden rounded-2xl border border-[#dddfd2] bg-[#fffefa]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-[#747b70] transition hover:bg-[#ebeae1] hover:text-[#4e6700]">
          <span className="flex items-center gap-2">
            <PenLine className="size-3.5" aria-hidden />
            编辑主任务
          </span>
          <ChevronDown className="size-4 transition group-open/edit:rotate-180" />
        </summary>
        <TaskEditForm assignees={assignees} task={task} />
      </details>
    </div>
  );
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
  const doneSteps = task.steps.filter(
    (step) => step.completed || step.status === "done",
  ).length;
  const activeSteps = task.steps.filter(
    (step) => step.status === "processing" || step.status === "in_progress",
  ).length;
  const dueLabel = task.targetPublishDate || task.dueDate || "未设日期";
  const platformLabel = displayPlatforms(task.platforms);

  return (
    <article
      className="animate-rise overflow-hidden rounded-xl border border-[#c8ccbf] bg-white shadow-[0_8px_24px_rgba(26,28,31,0.04)] transition hover:border-[#b7c0ad] hover:shadow-[0_14px_34px_rgba(26,28,31,0.07)]"
      style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}
    >
      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(320px,1fr)_220px_220px_auto] xl:items-center">
        <div className="min-w-0 xl:border-r xl:border-[#e7e5db] xl:pr-4">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {task.projectCode ? (
              <span className="inline-flex h-6 items-center rounded-lg bg-[#d6ff2a] px-2 font-mono text-[11px] font-bold text-[#101600] shadow-[0_0_10px_rgba(214,255,42,0.26)]">
                [{task.projectCode}]
              </span>
            ) : null}
            <StatusBadgeUI status={task.status}>
              {statusLabels[task.status]}
            </StatusBadgeUI>
            <PriorityBadge priority={task.priority}>
              {priorityLabels[task.priority]}
            </PriorityBadge>
            {task.kind === "video" ? (
              <span className="inline-flex h-5 items-center gap-1 rounded-full border border-[#c8ccbf] bg-[#ebeae1] px-1.5 text-[10px] font-semibold text-[#5b655e]">
                <Film className="size-3" aria-hidden />
                视频
              </span>
            ) : null}
            {task.contentSeries ? (
              <span className="inline-flex h-5 items-center rounded-full border border-[#c8ccbf] bg-[#ebeae1] px-1.5 text-[10px] font-semibold text-[#5b655e]">
                {task.contentSeries}
              </span>
            ) : null}
          </div>

          <h3 className="truncate font-[var(--font-display)] text-lg font-bold leading-tight text-[#151a18]">
            {task.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-sm leading-6 text-[#747b70]">
            {task.summary}
          </p>
        </div>

        <div className="rounded-xl border border-[#e7e5db] bg-[#f5f4ee] p-3">
          <QueueProgress
            activeSteps={activeSteps}
            doneSteps={doneSteps}
            progress={progress}
            totalSteps={task.steps.length}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <MetaItem icon={UserRound}>
            {assigneeNames(assigneeById, task.assigneeIds, task.assigneeId)}
          </MetaItem>
          <MetaItem icon={CalendarDays}>{dueLabel}</MetaItem>
        </div>

        <div className="flex items-center justify-between gap-3 xl:justify-end">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[#747b70] xl:hidden">
            <Layers3 className="size-3.5 shrink-0 text-[#4e6700]" aria-hidden />
            <span className="truncate">{platformLabel}</span>
          </span>
          <div className="flex items-center gap-1.5">
            {taskUrl ? (
              <a
                href={taskUrl}
                target="_blank"
                rel="noreferrer"
                className={secondaryButtonClass}
                title="打开协作页面"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="xl:sr-only">打开页面</span>
              </a>
            ) : (
              <span
                className="inline-flex h-8 items-center justify-center rounded-lg border border-[#c8ccbf] bg-[#ebeae1] px-2 text-xs font-semibold text-[#747b70] xl:size-8 xl:px-0"
                title="本地记录"
              >
                <span className="xl:sr-only">本地记录</span>
                <FileText className="hidden size-3.5 xl:block" aria-hidden />
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

      <div className="border-t border-[#e7e5db] bg-[#fffefa]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="hidden min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[#747b70] xl:flex">
            <Layers3 className="size-3.5 shrink-0 text-[#4e6700]" aria-hidden />
            <span className="truncate">{platformLabel}</span>
          </span>
          <details className="group w-full xl:w-auto xl:flex-1">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1 text-xs font-bold text-[#4e6700] transition hover:bg-[#f2ffd6]">
              <span className="flex items-center gap-2">
                <ListChecks className="size-3.5" aria-hidden />
                展开项目管理
                <span className="rounded-full bg-[#f2ffd6] px-2 py-0.5 font-mono text-[10px] text-[#747b70]">
                  流程 {task.steps.length} 步
                </span>
              </span>
              <ChevronDown className="size-4 transition group-open:rotate-180" />
            </summary>
            <TaskDetailsPanel
              assigneeById={assigneeById}
              assignees={assignees}
              task={task}
            />
          </details>
        </div>
      </div>
    </article>
  );
}

function TaskDetailsPanel({
  task,
  assignees,
  assigneeById,
}: {
  task: Task;
  assignees: Assignee[];
  assigneeById: Map<string, Assignee>;
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-[#dddfd2] bg-white shadow-[0_10px_24px_rgba(26,28,31,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7e5db] bg-[#f5f4ee] px-4 py-3">
        <div>
          <div className="font-[var(--font-display)] text-sm font-bold text-[#151a18]">
            流程轨道
          </div>
          <div className="mt-0.5 text-xs text-[#747b70]">
            按脚本、音频、素材、剪辑、发布顺序推进。
          </div>
        </div>
        <span className="inline-flex h-7 items-center rounded-full bg-[#f2ffd6] px-2.5 font-mono text-[11px] font-bold text-[#4e6700]">
          {task.steps.length} 个步骤
        </span>
      </div>
      <div className="grid gap-2 p-3">
        {task.steps.map((step) => (
          <StepWorkflowCard
            key={step.id}
            task={task}
            step={step}
            assignees={assignees}
            assigneeById={assigneeById}
          />
        ))}
      </div>
      <details className="group/edit border-t border-[#e7e5db] bg-[#fffefa]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-[#747b70] transition hover:bg-[#ebeae1] hover:text-[#4e6700]">
          <span className="flex items-center gap-2">
            <PenLine className="size-3.5" aria-hidden />
            编辑主任务
          </span>
          <ChevronDown className="size-4 transition group-open/edit:rotate-180" />
        </summary>
        <TaskEditForm assignees={assignees} task={task} />
      </details>
    </div>
  );
}

function TaskEditForm({
  task,
  assignees,
}: {
  task: Task;
  assignees: Assignee[];
}) {
  return (
    <form
      action={updateTaskDetailsAction}
      className="border-t border-[#e7e5db] bg-[#f5f4ee] p-4 sm:p-5"
    >
      <input type="hidden" name="taskId" value={task.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="标题">
          <input
            name="title"
            defaultValue={task.title}
            className={inputClass}
            required
          />
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
          <select
            name="priority"
            defaultValue={task.priority}
            className={inputClass}
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </Field>
        <Field label="负责人">
          <AssigneeChecks
            assignees={assignees}
            name="assigneeIds"
            selected={task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : [])}
          />
        </Field>
        <Field label="视频系列">
          <input
            name="contentSeries"
            defaultValue={task.contentSeries}
            className={inputClass}
          />
        </Field>
        <Field label="周期">
          <input
            name="weekLabel"
            defaultValue={task.weekLabel}
            className={inputClass}
          />
        </Field>
        <Field label="整体截止">
          <input
            name="dueDate"
            type="date"
            defaultValue={task.dueDate}
            className={inputClass}
          />
        </Field>
        <Field label="目标发布">
          <input
            name="targetPublishDate"
            type="date"
            defaultValue={task.targetPublishDate}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="mt-3">
        <PlatformChecks selected={task.platforms ?? []} />
      </div>
      <div className="mt-3">
        <Field label="摘要">
          <textarea
            name="summary"
            defaultValue={task.summary}
            className={textareaClass}
            required
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PendingFormStatus text="正在同步主任务" className="sm:max-w-xs" />
        <PendingSubmitButton
          className={primaryButtonClass}
          pendingText="正在保存主任务"
        >
          <CheckCircle2 className="size-3.5" aria-hidden />
          保存主任务
        </PendingSubmitButton>
      </div>
    </form>
  );
}

function QueueProgress({
  activeSteps,
  doneSteps,
  progress,
  totalSteps,
}: {
  activeSteps: number;
  doneSteps: number;
  progress: number;
  totalSteps: number;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="truncate text-xs font-semibold text-[#747b70]">
          已完成 {doneSteps}/{totalSteps}
          <span className="mx-1.5 text-[#b7c0ad]">·</span>
          处理中 {activeSteps}
        </div>
        <div className="font-mono text-sm font-bold text-[#4e6700]">
          {progress}%
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#dddfd2]">
        <div
          className="h-full rounded-full bg-[#d6ff2a] shadow-[0_0_10px_rgba(214,255,42,0.42)] transition-[width] duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function StepWorkflowCard({
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
    <details className="group/flow overflow-hidden rounded-xl border border-[#dddfd2] bg-white shadow-[0_8px_18px_rgba(26,28,31,0.03)] transition open:border-[#b7c0ad] open:shadow-[0_12px_26px_rgba(26,28,31,0.06)]">
      <summary className="grid cursor-pointer list-none gap-3 p-3 transition hover:bg-[#fffefa] sm:grid-cols-[86px_minmax(0,1fr)_120px_150px_110px_auto] sm:items-center">
        <span className="w-fit rounded-full bg-[#f2ffd6] px-2 py-0.5 font-mono text-[10px] font-bold text-[#4e6700]">
          {step.phase ?? "执行"}
        </span>

        <div className="min-w-0">
          <div className="truncate font-[var(--font-display)] text-base font-bold leading-snug text-[#151a18]">
            {step.title}
          </div>
          {step.description ? (
            <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#747b70]">
              {step.description}
            </p>
          ) : null}
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#747b70]">
          <StatusDot status={status} />
          {stepStatusLabels[status]}
        </span>

        <span className="min-w-0 truncate text-xs font-semibold text-[#747b70]">
          {assigneeNames(
            assigneeById,
            step.assigneeIds,
            step.assigneeId ?? task.assigneeId,
          )}
        </span>

        <span className="text-xs font-semibold text-[#747b70]">
          {step.dueDate || "未设截止"}
        </span>

        <div className="flex items-center gap-1.5 sm:justify-end">
          {stepUrl ? (
            <a
              href={stepUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-lg text-[#747b70] transition hover:bg-[#f2ffd6] hover:text-[#4e6700]"
              title="打开子任务页面"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
          <ChevronDown className="size-4 text-[#747b70] transition group-open/flow:rotate-180" />
        </div>
      </summary>

      <form
        action={updateStepAction}
        className="border-t border-[#e7e5db] bg-[#f5f4ee] p-4 sm:p-5"
      >
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="stepId" value={step.id} />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-[var(--font-display)] text-sm font-bold text-[#151a18]">
              编辑步骤
            </div>
            <div className="mt-0.5 text-xs text-[#747b70]">
              调整状态、负责人和交付说明。
            </div>
          </div>
          <span className="rounded-full bg-[#f2ffd6] px-2.5 py-1 font-mono text-[10px] font-bold text-[#4e6700]">
            {step.phase ?? "执行"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="阶段">
            <input
              name="phase"
              defaultValue={step.phase}
              className={inputClass}
            />
          </Field>
          <Field label="标题" className="sm:col-span-2">
            <input
              name="title"
              defaultValue={step.title}
              className={inputClass}
              required
            />
          </Field>
          <Field label="状态">
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="todo">待开始</option>
              <option value="processing">处理中</option>
              <option value="in_progress">进行中</option>
              <option value="blocked">阻塞</option>
              <option value="done">完成</option>
            </select>
          </Field>
          <Field label="负责人" className="sm:col-span-2">
            <AssigneeChecks
              assignees={assignees}
              name="assigneeIds"
              selected={
                step.assigneeIds ??
                (step.assigneeId ?? task.assigneeId
                  ? [step.assigneeId ?? task.assigneeId].filter(
                      (id): id is string => Boolean(id),
                    )
                  : [])
              }
            />
          </Field>
          <Field label="截止日期">
            <input
              name="dueDate"
              type="date"
              defaultValue={step.dueDate}
              className={inputClass}
            />
          </Field>
          <Field label="子任务说明" className="sm:col-span-2 xl:col-span-3">
            <textarea
              name="description"
              defaultValue={step.description}
              className={textareaClass}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PendingFormStatus text="正在同步子任务" />
          <PendingSubmitButton
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#d6ff2a] px-5 text-xs font-bold text-[#101600] shadow-[0_10px_20px_rgba(92,120,0,0.16)] transition hover:bg-[#c6ee18] active:translate-y-0.5"
            pendingText="正在保存子任务"
          >
            <CheckCircle2 className="size-3.5" aria-hidden />
            保存子任务
          </PendingSubmitButton>
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
    <div className="border-t border-[#e7e5db] bg-white px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#151a18]">
            音频分段
          </div>
          <div className="mt-0.5 text-xs text-[#747b70]">
            分段会写入现有协作页面。
          </div>
        </div>
        <span className="inline-flex h-6 items-center rounded-full bg-[#d6ff2a] px-2 font-mono text-[11px] font-semibold text-[#101600]">
          {segments.length} 段
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {segments.map((segment) => (
          <div
            key={segment.id}
            className="rounded-xl border border-[#dddfd2] bg-[#f5f4ee] p-3"
          >
            <span className="mb-1.5 block font-mono text-[10px] font-bold text-[#4e6700]">
              段落 {String(segment.index).padStart(2, "0")}
            </span>
            <p className="line-clamp-3 text-xs leading-5 text-[#5b655e]">
              {segment.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: StepStatus | TaskStatus }) {
  const color =
    status === "done"
      ? "bg-[#d6ff2a] shadow-[#d6ff2a]/60"
      : status === "active" ||
          status === "in_progress" ||
          status === "processing"
        ? "bg-[#a6ce1c] shadow-[#a6ce1c]/60"
        : status === "blocked"
          ? "bg-[#ba1a1a] shadow-[#ba1a1a]/50"
          : "bg-white/24 shadow-white/20";
  return (
    <span
      className={`inline-block size-2 rounded-full shadow-[0_0_8px] ${color}`}
    />
  );
}

function StatusBadgeUI({
  status,
  children,
}: {
  status: TaskStatus;
  children: React.ReactNode;
}) {
  const cls =
    status === "done"
      ? "border-[#4e6700]/25 bg-[#f2ffd6] text-[#4e6700]"
      : status === "active"
        ? "border-[#4e6700]/25 bg-[#d6ff2a]/20 text-[#4e6700]"
        : status === "blocked"
          ? "border-[#ba1a1a]/25 bg-[#ffdad6] text-[#93000a]"
          : "border-[#c8ccbf] bg-[#ebeae1] text-[#5b655e]";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function PriorityBadge({
  priority,
  children,
}: {
  priority: Priority;
  children: React.ReactNode;
}) {
  const cls =
    priority === "high"
      ? "border-[#4e6700]/25 bg-[#d6ff2a]/24 text-[#4e6700]"
      : priority === "low"
        ? "border-[#c8ccbf] bg-[#ebeae1] text-[#747b70]"
        : "border-[#c8ccbf] bg-white text-[#5b655e]";
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold ${cls}`}
    >
      <Flag className="size-3" aria-hidden />
      {children}
    </span>
  );
}

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-[#dddfd2] bg-[#f5f4ee] px-3 py-2 text-xs font-semibold text-[#747b70]">
      <Icon className="size-3.5 shrink-0 text-[#4e6700]" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="animate-rise rounded-2xl border border-dashed border-[#b7c0ad] bg-white px-6 py-16 text-center shadow-[inset_5px_5px_14px_rgba(26,28,31,0.06),inset_-5px_-5px_14px_rgba(255,255,255,0.9)]">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-[#d6ff2a] text-[#101600]">
        <ListChecks className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 font-[var(--font-display)] text-base font-semibold">
        暂无任务
      </h3>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-[#747b70]">
        点击右上角「新建任务」开始创建。
      </p>
    </div>
  );
}

function FilteredEmptyState() {
  return (
    <div className="animate-rise rounded-2xl border border-dashed border-[#b7c0ad] bg-[#f5f4ee] px-6 py-12 text-center">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-[#f2ffd6] text-[#4e6700]">
        <Search className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 font-[var(--font-display)] text-base font-semibold">
        没有匹配的项目
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-[#747b70]">
        当前筛选条件下没有结果。可以换关键词、负责人或状态继续查找。
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#b7c0ad] bg-white px-4 text-sm font-bold text-[#3e4942] transition hover:bg-[#f2ffd6]"
      >
        <RotateCcw className="size-4" aria-hidden />
        清空筛选
      </Link>
    </div>
  );
}

function PlatformChecks({ selected }: { selected: string[] }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-[#747b70]">
        发布平台
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {platformOptions.map((platform) => (
          <label
            key={platform}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#c8ccbf] bg-white px-3 text-sm font-semibold text-[#5b655e] transition hover:border-[#4e6700] hover:bg-[#f2ffd6]"
          >
            <input
              name="platforms"
              type="checkbox"
              value={platform}
              defaultChecked={selected.includes(platform)}
              className="size-4 rounded accent-[#d6ff2a]"
            />
            {displayPlatform(platform)}
          </label>
        ))}
      </div>
    </div>
  );
}

function AssigneeChecks({
  assignees,
  name,
  selected,
}: {
  assignees: Assignee[];
  name: string;
  selected: string[];
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-[#c8ccbf] bg-white p-2 shadow-[inset_2px_2px_6px_rgba(26,28,31,0.04)] sm:grid-cols-2">
      {assignees.map((assignee) => (
        <label
          key={assignee.id}
          className="flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[#5b655e] transition hover:bg-[#f2ffd6] hover:text-[#4e6700]"
        >
          <input
            name={name}
            type="checkbox"
            value={assignee.id}
            defaultChecked={selected.includes(assignee.id)}
            className="size-4 shrink-0 rounded accent-[#d6ff2a]"
          />
          <span className="min-w-0 truncate">{assignee.name}</span>
        </label>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-[#747b70]">
        {label}
      </span>
      {children}
    </label>
  );
}

const primaryButtonClass =
  "inline-flex h-10 items-center gap-2 rounded-full bg-[#d6ff2a] px-5 text-sm font-bold text-[#101600] shadow-[0_10px_20px_rgba(92,120,0,0.16)] transition hover:bg-[#c6ee18] hover:shadow-[0_12px_24px_rgba(92,120,0,0.2)] active:translate-y-0.5 active:shadow-[0_6px_14px_rgba(92,120,0,0.16)]";

const secondaryButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#c8ccbf] bg-white px-2 text-xs font-bold text-[#5b655e] shadow-[inset_0_1px_rgba(255,255,255,0.8)] transition hover:border-[#4e6700] hover:bg-[#f2ffd6] hover:text-[#4e6700] active:translate-y-0.5 xl:size-8 xl:px-0";

const inputClass =
  "h-10 w-full rounded-xl border border-[#c8ccbf] bg-white px-3 text-sm text-[#151a18] shadow-[inset_2px_2px_6px_rgba(26,28,31,0.04),inset_-2px_-2px_6px_rgba(255,255,255,0.75)] outline-none transition placeholder:text-[#87907f] focus:border-[#4e6700] focus:ring-2 focus:ring-[#d6ff2a]/32";

const textareaClass =
  "min-h-24 w-full resize-y rounded-xl border border-[#c8ccbf] bg-white px-3 py-2 text-sm leading-6 text-[#151a18] shadow-[inset_2px_2px_6px_rgba(26,28,31,0.04),inset_-2px_-2px_6px_rgba(255,255,255,0.75)] outline-none transition placeholder:text-[#87907f] focus:border-[#4e6700] focus:ring-2 focus:ring-[#d6ff2a]/32";
