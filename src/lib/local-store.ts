import { randomUUID } from "node:crypto";
import type { Collection, WithId } from "mongodb";
import { defaultAssigneeId } from "./assignees";
import { getMongoDb } from "./mongodb";
import {
  deleteTaskFromNotion,
  getAvailableAssignees,
  getScriptApprovalFromNotion,
  publishAudioSegmentsToNotion,
  publishTaskStepsToNotion,
  publishTaskToNotion,
  syncParentTaskIndexToNotion,
  updateStepInNotion,
  updateTaskInNotion,
  updateTaskStatusInNotion,
} from "./notion";
import { buildAudioSegments, hashScript, normalizeScript } from "./script-workflow";
import { videoProductionTemplate } from "./task-templates";
import type {
  AudioSegment,
  CreateTaskInput,
  StepStatus,
  Task,
  TaskKind,
  TaskStatus,
  UpdateStepInput,
  UpdateTaskInput,
} from "./types";

type TaskDocument = Task & { _id?: unknown };

const tasksCollectionName = "tasks";
const webhookEventsCollectionName = "notion_webhook_events";

const audioStepTitle = "按照文案分段进行音频录制/AI语音生成";

const seedTasks: Task[] = [
  {
    id: "task-local-demo",
    kind: "video",
    title: "每周塔罗牌新手挑战题视频",
    summary: "本周视频任务，从文案到发布追踪完整推进。",
    status: "active",
    priority: "high",
    assigneeId: defaultAssigneeId,
    dueDate: "",
    contentSeries: "塔罗牌新手挑战题",
    weekLabel: "本周",
    platforms: ["小红书", "抖音"],
    targetPublishDate: "",
    steps: videoProductionTemplate.map((step, index) => ({
      id: `step-demo-${index + 1}`,
      title: step.title,
      phase: step.phase,
      description: step.description,
      assigneeId: defaultAssigneeId,
      completed: index === 0,
      status: index === 0 ? "done" : "todo",
    })),
    notion: {
      state: "not_configured",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let indexesReady = false;

async function getTasksCollection(): Promise<Collection<TaskDocument>> {
  const db = await getMongoDb();
  const collection = db.collection<TaskDocument>(tasksCollectionName);

  if (!indexesReady) {
    await Promise.all([
      collection.createIndex({ id: 1 }, { unique: true }),
      collection.createIndex({ updatedAt: -1 }),
      collection.createIndex({ "steps.notion.pageId": 1 }),
      db.collection(webhookEventsCollectionName).createIndex(
        { eventId: 1 },
        {
          unique: true,
          partialFilterExpression: { eventId: { $type: "string" } },
        },
      ),
    ]);
    indexesReady = true;
  }

  return collection;
}

function stripMongoId(document: WithId<TaskDocument> | TaskDocument): Task {
  const { _id, ...task } = document;
  void _id;
  return normalizeTask(task as Task);
}

async function ensureSeedTask(collection: Collection<TaskDocument>) {
  const count = await collection.estimatedDocumentCount();

  if (count === 0) {
    await collection.insertMany(seedTasks);
  }
}

export async function getTasks() {
  const collection = await getTasksCollection();
  await ensureSeedTask(collection);
  const tasks = await collection.find({}).sort({ updatedAt: -1 }).toArray();
  return tasks.map(stripMongoId);
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    kind: task.kind ?? "general",
    platforms: task.platforms ?? [],
    steps: task.steps.map((step) => ({
      ...step,
      audioSegments: step.audioSegments?.map((segment) => ({
        ...segment,
        status: segment.status ?? "pending",
      })),
      status: step.status ?? (step.completed ? "done" : "todo"),
      assigneeId: step.assigneeId ?? task.assigneeId,
    })),
  };
}

function buildSteps(
  kind: TaskKind,
  rawSteps: string[],
  assigneeId: string,
) {
  const fallbackTemplate =
    kind === "video"
      ? videoProductionTemplate
      : rawSteps.map((title) => ({ title, phase: "执行", description: "" }));
  const titles = rawSteps.length > 0 ? rawSteps : fallbackTemplate.map((step) => step.title);

  return titles.map((title, index) => {
    const template = fallbackTemplate[index];

    return {
      id: randomUUID(),
      title,
      phase: template?.phase ?? "执行",
      description: template?.description ?? "",
      assigneeId,
      completed: false,
      status: "todo" as StepStatus,
    };
  });
}

export async function createTask(input: CreateTaskInput) {
  const now = new Date().toISOString();
  const assignees = await getAvailableAssignees();
  const assigneeId = assignees.some((assignee) => assignee.id === input.assigneeId)
    ? input.assigneeId
    : assignees[0]?.id ?? defaultAssigneeId;
  const task: Task = {
    id: randomUUID(),
    kind: input.kind ?? "general",
    title: input.title.trim(),
    summary: input.summary.trim(),
    status: "active",
    priority: input.priority,
    assigneeId,
    dueDate: input.dueDate,
    contentSeries: input.contentSeries?.trim(),
    weekLabel: input.weekLabel?.trim(),
    platforms: input.platforms,
    targetPublishDate: input.targetPublishDate,
    steps: buildSteps(
      input.kind ?? "general",
      input.steps.map((step) => step.trim()).filter(Boolean),
      input.stepAssigneeId ?? assigneeId,
    ),
    notion: {
      state: "pending",
    },
    createdAt: now,
    updatedAt: now,
  };

  const publishResult = await publishTaskToNotion(task);
  task.notion =
    publishResult.state === "published"
      ? { state: "published", pageId: publishResult.pageId }
      : publishResult.state === "failed"
        ? { state: "failed", error: publishResult.error }
        : { state: "not_configured" };
  task.steps =
    publishResult.state === "published"
      ? task.steps.map((step) => ({
          ...step,
          notion: {
            state: "published",
            pageId: publishResult.stepPageIds[step.id],
          },
        }))
      : task.steps;

  const collection = await getTasksCollection();
  await collection.insertOne(task);

  return task;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const collection = await getTasksCollection();
  const task = await findTaskById(collection, taskId);

  if (!task) {
    return { state: "not_found" as const };
  }

  const remoteUpdateResult = await updateTaskStatusInNotion(
    task.notion.pageId,
    status,
  );

  if (remoteUpdateResult.state === "failed") {
    return remoteUpdateResult;
  }

  await collection.updateOne(
    { id: taskId },
    {
      $set: {
        status,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return {
    state:
      remoteUpdateResult.state === "updated"
        ? ("updated_remote_and_local" as const)
        : ("updated_local" as const),
  };
}

export async function updateTaskDetails(taskId: string, input: UpdateTaskInput) {
  const collection = await getTasksCollection();
  const task = await findTaskById(collection, taskId);

  if (!task) {
    return { state: "not_found" as const };
  }

  const normalizedTask: UpdateTaskInput = {
    ...input,
    title: input.title.trim(),
    summary: input.summary.trim(),
    contentSeries: input.contentSeries?.trim(),
    weekLabel: input.weekLabel?.trim(),
    platforms: input.platforms?.filter(Boolean),
  };

  if (!normalizedTask.title || !normalizedTask.summary) {
    return { state: "invalid" as const };
  }

  const remoteUpdateResult = await updateTaskInNotion({
    pageId: task.notion.pageId,
    task: normalizedTask,
  });

  if (remoteUpdateResult.state === "failed") {
    return remoteUpdateResult;
  }

  const updatedTask: Task = {
    ...task,
    ...normalizedTask,
    updatedAt: new Date().toISOString(),
  };

  await syncParentTaskIndexToNotion(updatedTask);
  await collection.replaceOne({ id: taskId }, updatedTask);

  return {
    state:
      remoteUpdateResult.state === "updated"
        ? ("updated_remote_and_local" as const)
        : ("updated_local" as const),
  };
}

export async function deleteTask(taskId: string) {
  const collection = await getTasksCollection();
  const task = await findTaskById(collection, taskId);

  if (!task) {
    return { state: "not_found" as const };
  }

  const remotePageIds = [
    task.notion.pageId,
    ...task.steps.map((step) => step.notion?.pageId),
    ...task.steps.flatMap((step) =>
      step.audioSegments?.map((segment) => segment.notion?.pageId) ?? [],
    ),
  ].filter((pageId): pageId is string => Boolean(pageId));
  let remoteDeleteFailed = false;

  for (const pageId of remotePageIds) {
    const remoteDeleteResult = await deleteTaskFromNotion(pageId);

    if (remoteDeleteResult.state === "failed") {
      remoteDeleteFailed = true;
    }
  }

  await collection.deleteOne({ id: taskId });

  return {
    state: remoteDeleteFailed
      ? ("deleted_local_remote_failed" as const)
      : remotePageIds.length
        ? ("deleted_remote_and_local" as const)
        : ("deleted_local" as const),
  };
}

export async function publishMissingTaskSteps(taskId: string) {
  const collection = await getTasksCollection();
  const task = await findTaskById(collection, taskId);

  if (!task) {
    return { state: "not_found" as const };
  }

  if (!task.notion.pageId) {
    return { state: "not_configured" as const };
  }

  const missingSteps = task.steps.filter((step) => !step.notion?.pageId);

  if (missingSteps.length === 0) {
    return { state: "already_published" as const };
  }

  const result = await publishTaskStepsToNotion({
    ...task,
    steps: missingSteps,
  });

  if (result.state === "failed" || result.state === "not_configured") {
    return result;
  }

  const updatedTask: Task = {
    ...task,
    steps: task.steps.map((step) =>
      result.stepPageIds[step.id]
        ? {
            ...step,
            notion: {
              state: "published" as const,
              pageId: result.stepPageIds[step.id],
            },
          }
        : step,
    ),
    updatedAt: new Date().toISOString(),
  };

  await syncParentTaskIndexToNotion(updatedTask);
  await collection.replaceOne({ id: taskId }, updatedTask);

  return { state: "published_steps" as const };
}

export async function updateStep(
  taskId: string,
  stepId: string,
  input: UpdateStepInput,
) {
  const collection = await getTasksCollection();
  const task = await findTaskById(collection, taskId);
  const step = task?.steps.find((item) => item.id === stepId);

  if (!task || !step) {
    return { state: "not_found" as const };
  }

  const normalizedStep: UpdateStepInput = {
    ...input,
    title: input.title.trim(),
    phase: input.phase?.trim(),
    description: input.description?.trim(),
  };

  if (!normalizedStep.title) {
    return { state: "invalid" as const };
  }

  const remoteUpdateResult = await updateStepInNotion({
    pageId: step.notion?.pageId,
    parentTitle: task.title,
    step: normalizedStep,
  });

  if (remoteUpdateResult.state === "failed") {
    return remoteUpdateResult;
  }

  const updatedTask: Task = {
    ...task,
    steps: task.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            ...normalizedStep,
            completed: normalizedStep.status === "done",
          }
        : step,
    ),
    updatedAt: new Date().toISOString(),
  };

  await syncParentTaskIndexToNotion(updatedTask);
  await collection.replaceOne({ id: taskId }, updatedTask);

  return {
    state:
      remoteUpdateResult.state === "updated"
        ? ("updated_remote_and_local" as const)
        : ("updated_local" as const),
  };
}

export async function setStepCompleted(
  taskId: string,
  stepId: string,
  completed: boolean,
) {
  const collection = await getTasksCollection();
  const task = await findTaskById(collection, taskId);

  if (!task) return;

  const updatedTask: Task = {
    ...task,
    steps: task.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            completed,
            status: completed ? "done" : "todo",
          }
        : step,
    ),
    updatedAt: new Date().toISOString(),
  };

  await collection.replaceOne({ id: taskId }, updatedTask);
}

export async function generateAudioSegmentsFromScriptStep({
  taskId,
  scriptStepId,
  scriptText,
  approvedBy,
}: {
  taskId: string;
  scriptStepId: string;
  scriptText: string;
  approvedBy?: string;
}) {
  const collection = await getTasksCollection();
  const task = await findTaskById(collection, taskId);
  const sourceStep = task?.steps.find((step) => step.id === scriptStepId);
  const targetStep = task?.steps.find((step) => step.title === audioStepTitle);

  if (!task || !sourceStep) {
    return { state: "not_found" as const };
  }

  if (!targetStep) {
    return { state: "missing_audio_step" as const };
  }

  const normalizedScript = normalizeScript(scriptText || sourceStep.scriptText || "");

  if (!normalizedScript) {
    return { state: "empty_script" as const };
  }

  const sourceScriptHash = hashScript(normalizedScript);
  const existingSegments = targetStep.audioSegments ?? [];

  if (
    targetStep.sourceScriptHash === sourceScriptHash &&
    existingSegments.length > 0
  ) {
    return { state: "already_current" as const, segments: existingSegments };
  }

  const segments = buildAudioSegments(normalizedScript);

  if (segments.length === 0) {
    return { state: "empty_script" as const };
  }

  const publishResult = await publishAudioSegmentsToNotion({
    task,
    sourceStep,
    targetStep,
    segments,
  });

  const segmentsWithNotion: AudioSegment[] = segments.map((segment) => {
    const pageId =
      publishResult.state === "published"
        ? publishResult.segmentPageIds[segment.id]
        : undefined;

    return {
      ...segment,
      notion:
        publishResult.state === "published" && pageId
          ? { state: "published", pageId }
          : publishResult.state === "failed"
            ? { state: "failed", error: publishResult.error }
            : { state: "not_configured" },
    };
  });

  const now = new Date().toISOString();
  const updatedTask: Task = {
    ...task,
    steps: task.steps.map((step) => {
      if (step.id === sourceStep.id) {
        return {
          ...step,
          scriptText: normalizedScript,
          scriptApprovedAt: now,
          scriptApprovedBy: approvedBy,
          sourceScriptHash,
          completed: true,
          status: "done",
        };
      }

      if (step.id === targetStep.id) {
        return {
          ...step,
          description: `已根据文案生成 ${segmentsWithNotion.length} 个音频分段；音频文件请在 Notion 对应分段任务中上传。`,
          generatedFromStepId: sourceStep.id,
          sourceScriptHash,
          audioSegments: segmentsWithNotion,
          completed: false,
          status: "in_progress",
        };
      }

      return step;
    }),
    updatedAt: now,
  };

  await syncParentTaskIndexToNotion(updatedTask);
  await collection.replaceOne({ id: taskId }, updatedTask);

  return {
    state:
      publishResult.state === "published"
        ? ("generated_remote_and_local" as const)
        : ("generated_local" as const),
    segments: segmentsWithNotion,
  };
}

export async function processNotionConfirmedScriptPage(
  pageId: string,
  eventId?: string,
) {
  const db = await getMongoDb();
  const events = db.collection(webhookEventsCollectionName);

  if (eventId) {
    try {
      await events.insertOne({
        eventId,
        pageId,
        state: "processing",
        createdAt: new Date().toISOString(),
      });
    } catch {
      return { state: "duplicate_event" as const };
    }
  }

  const collection = await getTasksCollection();
  const taskDocument = await collection.findOne({ "steps.notion.pageId": pageId });

  if (!taskDocument) {
    await markWebhookEvent(eventId, "ignored");
    return { state: "task_not_found" as const };
  }

  const task = stripMongoId(taskDocument);
  const sourceStep = task.steps.find((step) => step.notion?.pageId === pageId);

  if (!sourceStep || sourceStep.title !== "文案生成") {
    await markWebhookEvent(eventId, "ignored");
    return { state: "not_script_step" as const };
  }

  const approval = await getScriptApprovalFromNotion(pageId);

  if (approval.state === "failed") {
    await markWebhookEvent(eventId, "failed", approval.error);
    return approval;
  }

  if (!approval.approved) {
    await markWebhookEvent(eventId, "ignored");
    return { state: "script_not_approved" as const };
  }

  const result = await generateAudioSegmentsFromScriptStep({
    taskId: task.id,
    scriptStepId: sourceStep.id,
    scriptText: approval.scriptText,
    approvedBy: "notion",
  });

  await markWebhookEvent(
    eventId,
    result.state === "generated_local" ||
      result.state === "generated_remote_and_local" ||
      result.state === "already_current"
      ? "processed"
      : "failed",
    "error" in result ? String(result.error) : undefined,
  );

  return result;
}

async function findTaskById(
  collection: Collection<TaskDocument>,
  taskId: string,
) {
  const task = await collection.findOne({ id: taskId });
  return task ? stripMongoId(task) : null;
}

async function markWebhookEvent(
  eventId: string | undefined,
  state: string,
  error?: string,
) {
  if (!eventId) return;

  const db = await getMongoDb();
  await db.collection(webhookEventsCollectionName).updateOne(
    { eventId },
    {
      $set: {
        state,
        error,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}
