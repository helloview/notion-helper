"use client";

import { Check, ClipboardList, Flag, Layers3, Plus, Send, UserRound, X } from "lucide-react";
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
        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6ff2a] px-6 text-sm font-bold text-[#101600] shadow-[0_10px_20px_rgba(92,120,0,0.16)] transition hover:bg-[#c6ee18] hover:shadow-[0_12px_24px_rgba(92,120,0,0.2)] active:translate-y-0.5 active:shadow-[0_6px_14px_rgba(92,120,0,0.16)]"
      >
        <Plus className="size-4" aria-hidden />
        新建任务
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#151a18]/50 px-3 py-4 backdrop-blur-lg sm:px-5 sm:py-8"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="新建创作任务"
                className="animate-pop relative flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/80 bg-[#f5f4ee] shadow-[0_30px_90px_rgba(26,28,31,0.32)]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 z-20 inline-flex size-10 items-center justify-center rounded-full border border-[#dddfd2] bg-white/88 text-[#747b70] shadow-[0_10px_24px_rgba(26,28,31,0.08)] transition hover:border-[#4e6700]/35 hover:text-[#4e6700] active:translate-y-0.5"
                  aria-label="关闭"
                >
                  <X className="size-5" aria-hidden />
                </button>

                <section className="flex min-h-0 flex-col">
                  <div className="border-b border-[#dddfd2] bg-white/80 px-5 py-5 pr-16 backdrop-blur sm:px-6">
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-[#4e6700]">
                      创作任务
                    </p>
                    <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold tracking-[-0.01em] text-[#151a18] sm:text-3xl">
                      新建创作任务
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[#747b70]">
                      填写核心信息即可发布，子任务会按视频生产流程自动生成。
                    </p>
                  </div>

                  <form
                    id="publish-task-form"
                    action={publishTaskAction}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <div className="space-y-5 p-5 sm:p-6">
                        <input type="hidden" name="kind" value="video" />

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

                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
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

                          <FormBlock icon={Flag} title="发布平台">
                            <PlatformChecks selected={["小红书", "抖音"]} />
                          </FormBlock>
                        </div>

                        <FormBlock icon={Layers3} title="子任务流程">
                          <div className="flex flex-wrap gap-2">
                            {videoProductionTemplate.map((step, index) => (
                              <span
                                key={step.title}
                                className="inline-flex h-8 items-center gap-2 rounded-full border border-[#dddfd2] bg-[#ebeae1] px-3 text-xs font-semibold text-[#3e4942]"
                              >
                                <span className="font-mono text-[#4e6700]">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                {step.title}
                              </span>
                            ))}
                          </div>
                          <details className="rounded-2xl border border-[#dddfd2] bg-[#ebeae1]">
                            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-[#4e6700]">
                              需要时编辑流程
                            </summary>
                            <div className="border-t border-[#dddfd2] p-3">
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

                    <div className="flex flex-col gap-3 border-t border-[#dddfd2] bg-white/88 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
    <section className="rounded-[1.25rem] border border-[#dddfd2] bg-white p-4 shadow-[0_12px_28px_rgba(26,28,31,0.055)] sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f2ffd6] text-[#4e6700]">
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="font-[var(--font-display)] text-base font-bold text-[#151a18]">
            {title}
          </h3>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PlatformChecks({ selected }: { selected: string[] }) {
  return (
    <div className="grid gap-2">
      {platformOptions.map((platform) => (
        <label
          key={platform}
          className="group flex h-11 cursor-pointer items-center justify-between rounded-2xl border border-[#dddfd2] bg-white px-3 text-sm font-semibold text-[#3e4942] shadow-[0_8px_18px_rgba(26,28,31,0.035)] transition hover:border-[#4e6700]/45 hover:text-[#4e6700]"
        >
          <span>{displayPlatform(platform)}</span>
          <span className="relative inline-flex size-5 items-center justify-center rounded-md border border-[#b7c0ad] bg-[#f5f4ee] text-[#101600] transition group-has-[:checked]:border-[#d6ff2a] group-has-[:checked]:bg-[#d6ff2a]">
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
    <div className="grid gap-2 rounded-2xl border border-[#dddfd2] bg-[#f5f4ee] p-2 shadow-[inset_3px_3px_8px_rgba(26,28,31,0.06),inset_-3px_-3px_8px_rgba(255,255,255,0.92)]">
      {assignees.map((assignee) => (
        <label
          key={assignee.id}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#3e4942] transition hover:bg-white hover:text-[#4e6700]"
        >
          <input
            name={name}
            type="checkbox"
            value={assignee.id}
            defaultChecked={selected.includes(assignee.id)}
            className="size-4 rounded accent-[#d6ff2a]"
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
      <span className="mb-1.5 block text-xs font-semibold text-[#747b70]">
        {label}
      </span>
      {children}
    </label>
  );
}

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#d6ff2a] px-6 text-sm font-bold text-[#101600] shadow-[0_12px_24px_rgba(92,120,0,0.18)] transition hover:bg-[#c6ee18] hover:shadow-[0_14px_28px_rgba(92,120,0,0.24)] active:translate-y-0.5 active:shadow-[0_7px_16px_rgba(92,120,0,0.18)]";

const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-full border border-[#b7c0ad] bg-white px-5 text-sm font-semibold text-[#3e4942] shadow-[0_8px_18px_rgba(26,28,31,0.06)] transition hover:border-[#4e6700] hover:text-[#4e6700] active:translate-y-0.5";

const inputClass =
  "h-11 w-full rounded-2xl border border-[#dddfd2] bg-[#f5f4ee] px-3 text-sm text-[#151a18] shadow-[inset_3px_3px_8px_rgba(26,28,31,0.06),inset_-3px_-3px_8px_rgba(255,255,255,0.92)] outline-none transition placeholder:text-[#747b70]/60 focus:border-[#4e6700]/50 focus:ring-2 focus:ring-[#d6ff2a]/35";

const textareaClass =
  "min-h-24 w-full resize-y rounded-2xl border border-[#dddfd2] bg-[#f5f4ee] px-3 py-2 text-sm leading-6 text-[#151a18] shadow-[inset_3px_3px_8px_rgba(26,28,31,0.06),inset_-3px_-3px_8px_rgba(255,255,255,0.92)] outline-none transition placeholder:text-[#747b70]/60 focus:border-[#4e6700]/50 focus:ring-2 focus:ring-[#d6ff2a]/35";
