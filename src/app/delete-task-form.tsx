"use client";

import { Trash2 } from "lucide-react";
import { PendingSubmitButton } from "./pending-submit-button";

type DeleteTaskFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  taskId: string;
  hasNotionPage: boolean;
};

export function DeleteTaskForm({
  action,
  taskId,
  hasNotionPage,
}: DeleteTaskFormProps) {
  return (
    <form
      action={action}
      className="min-w-0"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          hasNotionPage
            ? "确认删除这个大任务？本地任务会删除，协作页面会移到回收站。"
            : "确认删除这个本地大任务？",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <PendingSubmitButton
        pendingText="正在删除"
        title={
          hasNotionPage
            ? "删除数据库任务并将协作页面移到回收站"
            : "删除本地任务"
        }
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-[#fecaca] bg-white px-3 text-sm font-bold text-[#ef4444] transition hover:border-[#ef4444]/50 hover:bg-[#fef2f2] active:translate-y-0.5 lg:size-10 lg:px-0"
      >
        <Trash2 className="size-3.5" aria-hidden />
        <span className="lg:sr-only">删除</span>
      </PendingSubmitButton>
    </form>
  );
}
