"use client";

import {
  Check,
  ClipboardList,
  Flag,
  Layers3,
  Plus,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { videoProductionTemplate } from "@/lib/task-templates";
import type { Assignee } from "@/lib/types";
import { publishTaskAction } from "./actions";
import {
  PendingFormStatus,
  PendingSubmitButton,
} from "./pending-submit-button";

const platformOptions = ["小红书", "抖音", "B站", "YouTube"];
const platformDisplayLabels: Record<string, string> = {
  YouTube: "油管",
};

function displayPlatform(platform: string) {
  return platformDisplayLabels[platform] ?? platform;
}

type PublishTaskModalProps = {
  assignees: Assignee[];
  defaultAssigneeId: string;
};

export function PublishTaskModal({
  assignees,
  defaultAssigneeId,
}: PublishTaskModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-12 items-center justify-center rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] text-[#57534e] shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition hover:bg-white hover:text-[#2563eb] active:scale-95"
        aria-label="新建任务"
      >
        <Plus className="size-5" aria-hidden />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-stretch justify-end overflow-hidden bg-black/30 p-2 backdrop-blur-md md:p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="新建创作任务"
                className="animate-pop relative grid h-full w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] border border-[#e7e5e4] bg-white shadow-[0_34px_96px_rgba(15,23,42,0.22)] md:grid-cols-[320px_minmax(0,1fr)]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 z-20 inline-flex size-10 items-center justify-center rounded-full border border-[#e7e5e4] bg-white text-[#a8a29e] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:border-[#bfdbfe] hover:text-[#2563eb] active:translate-y-0.5"
                  aria-label="关闭"
                >
                  <X className="size-5" aria-hidden />
                </button>

                <aside className="hidden min-h-0 flex-col justify-between border-r border-[#f1f5f9] bg-[#fafafa] p-6 text-[#292524] md:flex">
                  <div>
                    <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
                      <Plus className="size-5" aria-hidden />
                    </span>
                    <p className="mt-8 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#2563eb]">
                      新建任务
                    </p>
                    <h2 className="mt-3 font-[var(--font-display)] text-3xl font-bold leading-tight tracking-[-0.02em]">
                      从选题到发布，一次生成生产流程
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-[#78716c]">
                      填写核心信息后，系统会同步创建主任务和脚本、音频、素材、剪辑、发布步骤。
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <BriefItem icon={ClipboardList} label="内容类型" value="视频生产" />
                    <BriefItem icon={Layers3} label="默认流程" value={`${videoProductionTemplate.length} 个步骤`} />
                    <BriefItem
                      icon={Flag}
                      label="同步目标"
                      value="协作空间 + 数据库"
                    />
                  </div>
                </aside>

                <section className="flex min-h-0 flex-col">
                  <div className="border-b border-[#f1f5f9] bg-white px-5 py-5 pr-16 sm:px-7">
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#2563eb]">
                      创作任务
                    </p>
                    <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold tracking-[-0.01em] text-[#292524] sm:text-3xl">
                      新建创作任务
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[#78716c]">
                      填写核心信息即可发布，子任务会按视频生产流程自动生成。
                    </p>
                  </div>

                  <form
                    id="publish-task-form"
                    action={publishTaskAction}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px] sm:p-7">
                        <input type="hidden" name="kind" value="video" />

                        <div className="grid gap-5">
                          <FormBlock icon={ClipboardList} title="内容信息">
                            <div className="grid gap-3 md:grid-cols-3">
                              <Field label="视频系列">
                                <input
                                  name="contentSeries"
                                  className={inputClass}
                                  defaultValue="塔罗牌新手挑战题"
                                />
                              </Field>
                              <Field label="周期">
                                <input
                                  name="weekLabel"
                                  className={inputClass}
                                  placeholder="2026-W27"
                                />
                              </Field>
                              <Field label="目标发布">
                                <input
                                  name="targetPublishDate"
                                  type="date"
                                  className={inputClass}
                                />
                              </Field>
                            </div>
                            <Field label="任务标题">
                              <input
                                name="title"
                                className={inputClass}
                                defaultValue="每周塔罗牌新手挑战题视频"
                                required
                              />
                            </Field>
                            <Field label="任务摘要">
                              <textarea
                                name="summary"
                                className={textareaClass}
                                defaultValue="完成本周视频从文案、音频、素材、剪辑到平台发布和数据追踪的完整流程。"
                                required
                              />
                            </Field>
                          </FormBlock>

                          <FormBlock icon={UserRound} title="负责人和排期">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="主负责人">
                                <AssigneeChecks
                                  assignees={assignees}
                                  name="assigneeIds"
                                  selected={
                                    defaultAssigneeId ? [defaultAssigneeId] : []
                                  }
                                  showOrigin
                                />
                              </Field>
                              <Field label="子任务负责人">
                                <AssigneeChecks
                                  assignees={assignees}
                                  name="stepAssigneeIds"
                                  selected={
                                    defaultAssigneeId ? [defaultAssigneeId] : []
                                  }
                                />
                              </Field>
                              <Field label="优先级">
                                <select
                                  name="priority"
                                  defaultValue="medium"
                                  className={inputClass}
                                >
                                  <option value="low">低</option>
                                  <option value="medium">中</option>
                                  <option value="high">高</option>
                                </select>
                              </Field>
                              <Field label="整体截止">
                                <input
                                  name="dueDate"
                                  type="date"
                                  className={inputClass}
                                />
                              </Field>
                            </div>
                          </FormBlock>
                        </div>

                        <div className="grid content-start gap-5">
                          <FormBlock icon={Flag} title="发布平台">
                            <PlatformChecks selected={["小红书", "抖音"]} />
                          </FormBlock>

                          <FormBlock icon={Layers3} title="流程模板">
                            <div className="grid gap-2">
                              {videoProductionTemplate.map((step, index) => (
                                <div
                                  key={step.title}
                                  className="rounded-2xl border border-[#e7e5e4] bg-white px-3 py-2.5"
                                >
                                  <span className="font-mono text-[11px] font-bold text-[#2563eb]">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <div className="mt-1 text-sm font-bold text-[#292524]">
                                    {step.title}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#78716c]">
                                    {step.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <details className="rounded-2xl border border-[#e7e5e4] bg-[#fafafa]">
                              <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold text-[#2563eb]">
                                编辑流程名称
                              </summary>
                              <div className="border-t border-[#e7e5e4] p-3">
                                <textarea
                                  name="steps"
                                  className={`${textareaClass} min-h-28 font-mono text-xs`}
                                  defaultValue={videoProductionTemplate
                                    .map((step) => step.title)
                                    .join("\n")}
                                  required
                                />
                              </div>
                            </details>
                          </FormBlock>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-[#f1f5f9] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <PendingFormStatus
                        text="正在创建任务、同步协作空间并写入本地记录"
                        className="sm:max-w-md"
                      />
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          className={secondaryButtonClass}
                        >
                          取消
                        </button>
                        <PendingSubmitButton
                          className={primaryButtonClass}
                          pendingText="正在发布到协作空间"
                        >
                          <Send className="size-4" aria-hidden />
                          发布到协作空间
                        </PendingSubmitButton>
                      </div>
                    </div>
                  </form>
                </section>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FormBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e7e5e4] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.045)] sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="font-[var(--font-display)] text-base font-bold text-[#292524]">
            {title}
          </h3>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function BriefItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e7e5e4] bg-white p-4">
      <Icon className="size-4 text-[#2563eb]" aria-hidden />
      <div className="mt-3 text-xs font-bold text-[#a8a29e]">{label}</div>
      <div className="mt-1 text-sm font-bold text-[#292524]">{value}</div>
    </div>
  );
}

function PlatformChecks({ selected }: { selected: string[] }) {
  return (
    <div className="grid gap-2">
      {platformOptions.map((platform) => (
        <label
          key={platform}
          className="group flex h-11 cursor-pointer items-center justify-between rounded-xl border border-[#e7e5e4] bg-white px-3 text-sm font-semibold text-[#57534e] transition hover:border-[#93c5fd] hover:text-[#2563eb]"
        >
          <span>{displayPlatform(platform)}</span>
          <span className="relative inline-flex size-5 items-center justify-center rounded-md border border-[#d6d3d1] bg-white text-white transition group-has-[:checked]:border-[#3b82f6] group-has-[:checked]:bg-[#3b82f6]">
            <input
              name="platforms"
              type="checkbox"
              value={platform}
              defaultChecked={selected.includes(platform)}
              className="peer absolute inset-0 opacity-0"
            />
            <Check className="size-3 opacity-0 transition peer-checked:opacity-100" />
          </span>
        </label>
      ))}
    </div>
  );
}

function AssigneeChecks({
  assignees,
  name,
  selected,
  showOrigin = false,
}: {
  assignees: Assignee[];
  name: string;
  selected: string[];
  showOrigin?: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-2xl border border-[#e7e5e4] bg-[#fafafa] p-2">
      {assignees.map((assignee) => (
        <label
          key={assignee.id}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#57534e] transition hover:bg-white hover:text-[#2563eb]"
        >
          <input
            name={name}
            type="checkbox"
            value={assignee.id}
            defaultChecked={selected.includes(assignee.id)}
            className="size-4 rounded accent-[#3b82f6]"
          />
          {assignee.name}
          {showOrigin && assignee.origin === "workspace_user"
            ? " · 成员"
            : ""}
          {showOrigin && assignee.origin === "database_people"
            ? " · 访客"
            : ""}
          {showOrigin && assignee.origin === "manual_guest" ? " · 访客" : ""}
          {showOrigin && assignee.source === "local" ? " · 本地" : ""}
        </label>
      ))}
    </div>
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
      <span className="mb-1.5 block text-xs font-semibold text-[#78716c]">
        {label}
      </span>
      {children}
    </label>
  );
}

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3b82f6] px-6 text-sm font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.20)] transition hover:bg-[#2563eb] hover:shadow-[0_14px_28px_rgba(37,99,235,0.24)] active:translate-y-0.5 active:shadow-[0_7px_16px_rgba(37,99,235,0.20)]";

const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-xl border border-[#e7e5e4] bg-white px-5 text-sm font-semibold text-[#57534e] transition hover:border-[#93c5fd] hover:text-[#2563eb] active:translate-y-0.5";

const inputClass =
  "h-11 w-full rounded-xl border border-[#e7e5e4] bg-white px-3 text-sm text-[#292524] outline-none transition placeholder:text-[#a8a29e] focus:border-[#93c5fd] focus:ring-2 focus:ring-[#3b82f6]/20";

const textareaClass =
  "min-h-24 w-full resize-y rounded-xl border border-[#e7e5e4] bg-white px-3 py-2 text-sm leading-6 text-[#292524] outline-none transition placeholder:text-[#a8a29e] focus:border-[#93c5fd] focus:ring-2 focus:ring-[#3b82f6]/20";
