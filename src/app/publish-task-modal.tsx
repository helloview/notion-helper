"use client";

import {
  ArrowRight,
  CheckCircle2,
  Film,
  ListChecks,
  Plus,
  Send,
  UploadCloud,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { createPortal } from "react-dom";
import { videoProductionTemplate } from "@/lib/task-templates";
import type { Assignee } from "@/lib/types";
import { publishTaskAction } from "./actions";

const platformOptions = ["小红书", "抖音", "B站", "YouTube"];

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
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#b6ff4a] px-3 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(182,255,74,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#d5ff86]"
      >
        <Plus className="size-4" aria-hidden />
        新建任务
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-zinc-950/55 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-8">
              <div className="flex min-h-full w-full items-center justify-center">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="发布新任务"
                  className="animate-pop relative z-[101] flex h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-[#fbfcf8] text-zinc-950 shadow-[0_30px_100px_rgba(10,15,12,0.35)] sm:h-[calc(100vh-4rem)]"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-3 text-xl font-semibold">
                        <span className="inline-flex size-10 items-center justify-center rounded-md bg-[#b6ff4a] text-zinc-950 shadow-[0_10px_24px_rgba(119,190,0,0.2)]">
                          <Send className="size-5" aria-hidden />
                        </span>
                        发布新任务
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        创建主任务，并生成脚本、素材、剪辑、发布与复盘子任务。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:border-zinc-950 hover:bg-zinc-950 hover:text-white"
                      aria-label="关闭"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="modal-scrollbar min-h-0 flex-1 overflow-y-auto">
                    <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                      <form
                        id="publish-task-form"
                        action={publishTaskAction}
                        className="min-w-0 space-y-4"
                      >
                        <input type="hidden" name="kind" value="video" />

                        <FormSection icon={Film} title="内容信息">
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
                        </FormSection>

                        <FormSection icon={UserRound} title="负责人和排期">
                          <div className="grid gap-3 md:grid-cols-4">
                            <Field label="主负责人">
                              <AssigneeSelect
                                assignees={assignees}
                                name="assigneeId"
                                defaultValue={defaultAssigneeId}
                                showOrigin
                              />
                            </Field>
                            <Field label="子任务负责人">
                              <AssigneeSelect
                                assignees={assignees}
                                name="stepAssigneeId"
                                defaultValue={defaultAssigneeId}
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
                              <input name="dueDate" type="date" className={inputClass} />
                            </Field>
                          </div>
                        </FormSection>

                        <FormSection icon={UploadCloud} title="发布平台">
                          <PlatformChecks selected={["小红书", "抖音"]} />
                        </FormSection>

                        <FormSection icon={ListChecks} title="子任务流程">
                          <textarea
                            name="steps"
                            className={`${textareaClass} min-h-36 font-mono`}
                            defaultValue={videoProductionTemplate
                              .map((step) => step.title)
                              .join("\n")}
                            required
                          />
                        </FormSection>
                      </form>

                      <aside className="hidden lg:block">
                        <div className="sticky top-0 space-y-3">
                          <div className="relative h-48 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                            <Image
                              src="/modal-creation-studio.png"
                              alt=""
                              fill
                              sizes="260px"
                              className="object-cover object-[44%_36%]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5da700]">
                              Production template
                            </div>
                            <p className="mt-2 text-sm leading-6 text-zinc-600">
                              默认会拆成脚本、音频、素材、剪辑、发布和数据追踪任务。
                            </p>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition duration-200 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      form="publish-task-form"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#b6ff4a] px-5 text-sm font-semibold text-zinc-950 shadow-[0_10px_24px_rgba(119,190,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#d5ff86] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8df000]"
                    >
                      <ArrowRight className="size-4" aria-hidden />
                      发布到 Notion
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-[#eaffc8] text-[#4f9000]">
          <Icon className="size-4" aria-hidden />
        </span>
        <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function PlatformChecks({ selected }: { selected: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {platformOptions.map((platform) => (
        <label
          key={platform}
          className="flex h-11 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 transition hover:border-[#95e500] hover:bg-[#f2ffd9]"
        >
          <input
            name="platforms"
            type="checkbox"
            value={platform}
            defaultChecked={selected.includes(platform)}
            className="size-4 accent-[#7bd800]"
          />
          {platform}
        </label>
      ))}
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
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-700">
        <CheckCircle2 className="size-3.5 text-[#65b800]" aria-hidden />
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[#7bd800] focus:ring-2 focus:ring-[#b6ff4a]/30";

const textareaClass =
  "min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-[#7bd800] focus:ring-2 focus:ring-[#b6ff4a]/30";
