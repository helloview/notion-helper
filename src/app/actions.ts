"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTask,
  deleteTask,
  setStepCompleted,
  updateStep,
  updateTaskDetails,
  updateTaskStatus,
} from "@/lib/local-store";
import { defaultAssigneeId } from "@/lib/assignees";
import { getAvailableAssignees } from "@/lib/notion";
import { defaultStepsForKind } from "@/lib/task-templates";
import type { Priority, StepStatus, TaskKind, TaskStatus } from "@/lib/types";

const priorities = new Set<Priority>(["low", "medium", "high"]);
const statuses = new Set<TaskStatus>(["draft", "active", "blocked", "done"]);
const stepStatuses = new Set<StepStatus>([
  "todo",
  "processing",
  "in_progress",
  "blocked",
  "done",
]);
const taskKinds = new Set<TaskKind>(["general", "video"]);

export async function publishTaskAction(formData: FormData) {
  const kindValue = String(formData.get("kind") ?? "video");
  const kind = taskKinds.has(kindValue as TaskKind)
    ? (kindValue as TaskKind)
    : "video";
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const priorityValue = String(formData.get("priority") ?? "medium");
  const assigneeId = String(formData.get("assigneeId") ?? defaultAssigneeId);
  const stepAssigneeId = String(formData.get("stepAssigneeId") ?? assigneeId);
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const contentSeries = String(formData.get("contentSeries") ?? "").trim();
  const weekLabel = String(formData.get("weekLabel") ?? "").trim();
  const targetPublishDate = String(formData.get("targetPublishDate") ?? "").trim();
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);
  const steps = String(formData.get("steps") ?? "")
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);

  if (!title || !summary) {
    redirect("/?error=missing-fields");
  }

  const assignees = await getAvailableAssignees();
  const resolvedAssigneeId = assignees.some((assignee) => assignee.id === assigneeId)
    ? assigneeId
    : assignees[0]?.id ?? defaultAssigneeId;
  const resolvedStepAssigneeId = assignees.some(
    (assignee) => assignee.id === stepAssigneeId,
  )
    ? stepAssigneeId
    : resolvedAssigneeId;

  const task = await createTask({
    kind,
    title,
    summary,
    priority: priorities.has(priorityValue as Priority)
      ? (priorityValue as Priority)
      : "medium",
    assigneeId: resolvedAssigneeId,
    dueDate,
    contentSeries,
    weekLabel,
    platforms,
    targetPublishDate,
    stepAssigneeId: resolvedStepAssigneeId,
    steps: steps.length > 0 ? steps : defaultStepsForKind(kind),
  });

  revalidatePath("/");
  redirect(
    `/?created=${task.notion.state === "published" ? "notion" : "local"}&notion=${task.notion.state}`,
  );
}

export async function toggleStepAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  const completed = String(formData.get("completed") ?? "") === "true";

  if (taskId && stepId) {
    await setStepCompleted(taskId, stepId, completed);
  }

  revalidatePath("/");
}

export async function updateStatusAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const statusValue = String(formData.get("status") ?? "active");

  if (taskId && statuses.has(statusValue as TaskStatus)) {
    const result = await updateTaskStatus(taskId, statusValue as TaskStatus);
    revalidatePath("/");
    redirect(`/?update=${result.state}`);
  }

  revalidatePath("/");
}

export async function updateTaskDetailsAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const statusValue = String(formData.get("status") ?? "active");
  const priorityValue = String(formData.get("priority") ?? "medium");
  const assigneeId = String(formData.get("assigneeId") ?? defaultAssigneeId);
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const contentSeries = String(formData.get("contentSeries") ?? "").trim();
  const weekLabel = String(formData.get("weekLabel") ?? "").trim();
  const targetPublishDate = String(formData.get("targetPublishDate") ?? "").trim();
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);

  if (!taskId || !title || !summary) {
    redirect("/?update=invalid");
  }

  const result = await updateTaskDetails(taskId, {
    title,
    summary,
    status: statuses.has(statusValue as TaskStatus)
      ? (statusValue as TaskStatus)
      : "active",
    priority: priorities.has(priorityValue as Priority)
      ? (priorityValue as Priority)
      : "medium",
    assigneeId,
    dueDate,
    contentSeries,
    weekLabel,
    platforms,
    targetPublishDate,
  });

  revalidatePath("/");
  redirect(`/?update=${result.state}`);
}

export async function updateStepAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const phase = String(formData.get("phase") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const statusValue = String(formData.get("status") ?? "todo");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (
    taskId &&
    stepId &&
    title &&
    assigneeId &&
    stepStatuses.has(statusValue as StepStatus)
  ) {
    const result = await updateStep(
      taskId,
      stepId,
      {
        title,
        phase,
        description,
        status: statusValue as StepStatus,
        assigneeId,
        dueDate,
      },
    );
    revalidatePath("/");
    redirect(`/?stepUpdate=${result.state}`);
  }

  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");

  if (!taskId) {
    redirect("/?delete=missing-id");
  }

  const result = await deleteTask(taskId);

  revalidatePath("/");
  redirect(`/?delete=${result.state}`);
}
