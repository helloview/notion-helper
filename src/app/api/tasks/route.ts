import { NextResponse } from "next/server";
import {
  createTask,
  deleteTask,
  getTasks,
  publishMissingTaskSteps,
  updateStep,
  updateTaskDetails,
  updateTaskStatus,
} from "@/lib/local-store";
import { defaultAssigneeId } from "@/lib/assignees";
import { defaultStepsForKind } from "@/lib/task-templates";
import type { Priority, StepStatus, TaskKind, TaskStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const priorities = new Set<Priority>(["low", "medium", "high"]);
const taskKinds = new Set<TaskKind>(["general", "video"]);
const statuses = new Set<TaskStatus>(["draft", "active", "blocked", "done"]);
const stepStatuses = new Set<StepStatus>([
  "todo",
  "in_progress",
  "blocked",
  "done",
]);

export async function GET() {
  return NextResponse.json({ tasks: await getTasks() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const priority = String(body.priority ?? "medium");
  const kind = String(body.kind ?? "video");
  const steps = Array.isArray(body.steps) ? body.steps.map(String) : [];

  if (!title || !summary) {
    return NextResponse.json(
      { error: "title and summary are required" },
      { status: 400 },
    );
  }

  const resolvedKind = taskKinds.has(kind as TaskKind) ? (kind as TaskKind) : "video";

  const task = await createTask({
    kind: resolvedKind,
    title,
    summary,
    priority: priorities.has(priority as Priority) ? (priority as Priority) : "medium",
    assigneeId: String(body.assigneeId ?? defaultAssigneeId),
    stepAssigneeId: body.stepAssigneeId ? String(body.stepAssigneeId) : undefined,
    dueDate: body.dueDate ? String(body.dueDate) : "",
    contentSeries: body.contentSeries ? String(body.contentSeries) : "",
    weekLabel: body.weekLabel ? String(body.weekLabel) : "",
    platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : [],
    targetPublishDate: body.targetPublishDate ? String(body.targetPublishDate) : "",
    steps: steps.length > 0 ? steps : defaultStepsForKind(resolvedKind),
  });

  return NextResponse.json({ task }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("id");

  if (!taskId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const result = await deleteTask(taskId);

  if (result.state === "not_found") {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const taskId = String(body.id ?? "");
  const status = String(body.status ?? "");
  const action = body.action ? String(body.action) : "";
  const stepId = body.stepId ? String(body.stepId) : "";
  const assigneeId = body.assigneeId ? String(body.assigneeId) : "";

  if (action === "publishSteps") {
    if (!taskId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const result = await publishMissingTaskSteps(taskId);

    if (result.state === "not_found") {
      return NextResponse.json({ error: "task not found" }, { status: 404 });
    }

    if (result.state === "failed") {
      return NextResponse.json(
        { error: result.error, state: result.state },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  }

  if (stepId) {
    if (!taskId || !assigneeId || !stepStatuses.has(status as StepStatus)) {
      return NextResponse.json(
        { error: "id, stepId, assigneeId, and a valid step status are required" },
        { status: 400 },
      );
    }

    const result = await updateStep(
      taskId,
      stepId,
      {
        title: String(body.title ?? ""),
        phase: body.phase ? String(body.phase) : "",
        description: body.description ? String(body.description) : "",
        status: status as StepStatus,
        assigneeId,
        dueDate: body.dueDate ? String(body.dueDate) : "",
      },
    );

    if (result.state === "not_found") {
      return NextResponse.json({ error: "task or step not found" }, { status: 404 });
    }

    if (result.state === "failed") {
      return NextResponse.json(
        { error: result.error, state: result.state },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  }

  if (action === "updateTask") {
    if (
      !taskId ||
      !String(body.title ?? "").trim() ||
      !String(body.summary ?? "").trim()
    ) {
      return NextResponse.json(
        { error: "id, title, and summary are required" },
        { status: 400 },
      );
    }

    const priority = String(body.priority ?? "medium");
    const result = await updateTaskDetails(taskId, {
      title: String(body.title),
      summary: String(body.summary),
      status: statuses.has(status as TaskStatus) ? (status as TaskStatus) : "active",
      priority: priorities.has(priority as Priority) ? (priority as Priority) : "medium",
      assigneeId: String(body.assigneeId ?? defaultAssigneeId),
      dueDate: body.dueDate ? String(body.dueDate) : "",
      contentSeries: body.contentSeries ? String(body.contentSeries) : "",
      weekLabel: body.weekLabel ? String(body.weekLabel) : "",
      platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : [],
      targetPublishDate: body.targetPublishDate ? String(body.targetPublishDate) : "",
    });

    if (result.state === "not_found") {
      return NextResponse.json({ error: "task not found" }, { status: 404 });
    }

    if (result.state === "failed") {
      return NextResponse.json(
        { error: result.error, state: result.state },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  }

  if (!taskId || !statuses.has(status as TaskStatus)) {
    return NextResponse.json(
      { error: "id and a valid status are required" },
      { status: 400 },
    );
  }

  const result = await updateTaskStatus(taskId, status as TaskStatus);

  if (result.state === "not_found") {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  if (result.state === "failed") {
    return NextResponse.json(
      { error: result.error, state: result.state },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
