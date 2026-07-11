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

function actionError(action: string, error: unknown) {
  console.error(
    `[${action}]`,
    error instanceof Error ? error.message : "Unknown server action error",
  );
}

function mutationUrl(taskId: string, key: string, state: string) {
  const params = new URLSearchParams({ [key]: state });

  if (taskId) {
    params.set("project", taskId);
  }

  return `/?${params.toString()}`;
}

export async function publishTaskAction(formData: FormData) {
  const kindValue = String(formData.get("kind") ?? "video");
  const kind = taskKinds.has(kindValue as TaskKind)
    ? (kindValue as TaskKind)
    : "video";
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const priorityValue = String(formData.get("priority") ?? "medium");
  const assigneeId = String(formData.get("assigneeId") ?? defaultAssigneeId);
  const assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  const stepAssigneeId = String(formData.get("stepAssigneeId") ?? assigneeId);
  const stepAssigneeIds = formData
    .getAll("stepAssigneeIds")
    .map(String)
    .filter(Boolean);
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const contentSeries = String(formData.get("contentSeries") ?? "").trim();
  const weekLabel = String(formData.get("weekLabel") ?? "").trim();
  const targetPublishDate = String(formData.get("targetPublishDate") ?? "").trim();
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);
  const steps = String(formData.get("steps") ?? "")
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
  let targetUrl = "/?error=failed";

  if (!title || !summary) {
    redirect("/?error=missing-fields");
  }

  try {
    const assignees = await getAvailableAssignees();
    const knownAssigneeIds = new Set(assignees.map((assignee) => assignee.id));
    const resolvedAssigneeIds = assigneeIds.filter((id) =>
      knownAssigneeIds.has(id),
    );
    const resolvedStepAssigneeIds = stepAssigneeIds.filter((id) =>
      knownAssigneeIds.has(id),
    );
    const resolvedAssigneeId = knownAssigneeIds.has(assigneeId)
      ? assigneeId
      : resolvedAssigneeIds[0];
    const resolvedStepAssigneeId = knownAssigneeIds.has(stepAssigneeId)
      ? stepAssigneeId
      : resolvedStepAssigneeIds[0] ?? resolvedAssigneeId;

    const task = await createTask({
      kind,
      title,
      summary,
      priority: priorities.has(priorityValue as Priority)
        ? (priorityValue as Priority)
        : "medium",
      assigneeId: resolvedAssigneeId,
      assigneeIds: resolvedAssigneeIds,
      dueDate,
      contentSeries,
      weekLabel,
      platforms,
      targetPublishDate,
      stepAssigneeId: resolvedStepAssigneeId,
      stepAssigneeIds: resolvedStepAssigneeIds,
      steps: steps.length > 0 ? steps : defaultStepsForKind(kind),
    });

    revalidatePath("/");
    const createdState = task.notion.state === "published" ? "notion" : "local";
    targetUrl = `/?project=${encodeURIComponent(task.id)}&created=${createdState}&notion=${encodeURIComponent(task.notion.state)}`;
  } catch (error) {
    actionError("publishTaskAction", error);
    targetUrl = "/?error=publish-failed";
  }

  redirect(targetUrl);
}

export async function toggleStepAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  const completed = String(formData.get("completed") ?? "") === "true";

  if (taskId && stepId) {
    try {
      await setStepCompleted(taskId, stepId, completed);
    } catch (error) {
      actionError("toggleStepAction", error);
    }
  }

  revalidatePath("/");
}

export async function updateStatusAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const statusValue = String(formData.get("status") ?? "active");
  let targetUrl = mutationUrl(taskId, "update", "invalid");

  if (taskId && statuses.has(statusValue as TaskStatus)) {
    try {
      const result = await updateTaskStatus(taskId, statusValue as TaskStatus);
      revalidatePath("/");
      targetUrl = mutationUrl(taskId, "update", result.state);
    } catch (error) {
      actionError("updateStatusAction", error);
      targetUrl = mutationUrl(taskId, "update", "failed");
    }
  }

  revalidatePath("/");
  redirect(targetUrl);
}

export async function updateTaskDetailsAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const statusValue = String(formData.get("status") ?? "active");
  const priorityValue = String(formData.get("priority") ?? "medium");
  const assigneeId = String(formData.get("assigneeId") ?? defaultAssigneeId);
  const assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const contentSeries = String(formData.get("contentSeries") ?? "").trim();
  const weekLabel = String(formData.get("weekLabel") ?? "").trim();
  const targetPublishDate = String(formData.get("targetPublishDate") ?? "").trim();
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);

  if (!taskId || !title || !summary) {
    redirect("/?update=invalid");
  }

  let targetUrl = mutationUrl(taskId, "update", "failed");

  try {
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
      assigneeIds,
      dueDate,
      contentSeries,
      weekLabel,
      platforms,
      targetPublishDate,
    });

    targetUrl = mutationUrl(taskId, "update", result.state);
  } catch (error) {
    actionError("updateTaskDetailsAction", error);
  }

  revalidatePath("/");
  redirect(targetUrl);
}

export async function updateStepAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const phase = String(formData.get("phase") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const statusValue = String(formData.get("status") ?? "todo");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  let targetUrl = mutationUrl(taskId, "stepUpdate", "invalid");

  if (
    taskId &&
    stepId &&
    title &&
    stepStatuses.has(statusValue as StepStatus)
  ) {
    try {
      const result = await updateStep(
        taskId,
        stepId,
        {
          title,
          phase,
          description,
          status: statusValue as StepStatus,
          assigneeId,
          assigneeIds,
          dueDate,
        },
      );
      targetUrl = mutationUrl(taskId, "stepUpdate", result.state);
    } catch (error) {
      actionError("updateStepAction", error);
      targetUrl = mutationUrl(taskId, "stepUpdate", "failed");
    }
  }

  revalidatePath("/");
  redirect(targetUrl);
}

export async function deleteTaskAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");

  if (!taskId) {
    redirect("/?delete=missing-id");
  }

  let targetUrl = "/?delete=failed";

  try {
    const result = await deleteTask(taskId);
    targetUrl = `/?delete=${encodeURIComponent(result.state)}`;
  } catch (error) {
    actionError("deleteTaskAction", error);
  }

  revalidatePath("/");
  redirect(targetUrl);
}
