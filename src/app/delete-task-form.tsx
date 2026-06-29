"use client";

import { Trash2 } from "lucide-react";

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
            ? "确认删除这个大任务？本地任务会删除，Notion 页面会移到回收站。"
            : "确认删除这个本地大任务？",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <button
        type="submit"
        title={
          hasNotionPage
            ? "删除本地任务并将 Notion 页面移到回收站"
            : "删除本地任务"
        }
        className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-100"
      >
        <Trash2 className="size-4" aria-hidden />
        删除
      </button>
    </form>
  );
}
