import { randomUUID } from "node:crypto";
import type { Collection, WithId } from "mongodb";
import { defaultAssigneeId } from "./assignees";
import { getMongoDb } from "./mongodb";
import {
  cleanupSegmentStepBootstrapContent,
  deleteTaskFromNotion,
  detectExistingSegmentWorkflow,
  getAvailableAssignees,
  getScriptApprovalFromNotion,
  publishScriptSegmentsToNotion,
  publishTaskStepsToNotion,
  publishTaskToNotion,
  renameTaskPagesInNotion,
  syncParentTaskIndexToNotion,
  updateStepInNotion,
  updateStepStatusInNotion,
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
const projectCountersCollectionName = "project_counters";
const projectCodeCounterId = "task_project_code";
const taskNamingVersion = 1;

const audioStepTitle = "按照文案分段进行音频录制/AI语音生成";
const materialStepTitle = "按照文案分段进行素材收集";
const canonicalAudioStepTitle = "音频";
const canonicalMaterialStepTitle = "素材";
const canonicalScriptStepTitle = "脚本";

const seedTasks: Task[] = [
  {
    id: "task-local-demo",
    kind: "video",
    projectCode: "N10",
    notionNamingVersion: taskNamingVersion,
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
      collection.createIndex(
        { projectCode: 1 },
        {
          unique: true,
          partialFilterExpression: { projectCode: { $type: "string" } },
        },
      ),
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
  if (process.env.MONGODB_SEED_DEMO_TASKS !== "true") {
    return;
  }

  const count = await collection.estimatedDocumentCount();

  if (count === 0) {
    await collection.insertMany(seedTasks);
  }
}

function projectCodeStart() {
  const configured = Number(process.env.PROJECT_CODE_START ?? "10");
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 10;
}

async function nextProjectCode() {
  const db = await getMongoDb();
  const counters = db.collection<{ _id: string; seq: number }>(
    projectCountersCollectionName,
  );
  const start = projectCodeStart();

  await counters.updateOne(
    { _id: projectCodeCounterId },
    { $setOnInsert: { seq: start - 1 } },
    { upsert: true },
  );

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const counter = await counters.findOneAndUpdate(
      { _id: projectCodeCounterId },
      { $inc: { seq: 1 } },
      { returnDocument: "after" },
    );
    const code = `N${counter?.seq ?? start + attempt}`;
    const existing = await db.collection<TaskDocument>(tasksCollectionName).findOne({
      projectCode: code,
    });

    if (!existing) return code;
  }

  return `N${Date.now()}`;
}

function canonicalVideoStepTitle(step: Task["steps"][number]) {
  if (step.phase === "脚本" || step.title === "文案生成") return canonicalScriptStepTitle;
  if (step.phase === "音频" || step.title === audioStepTitle) return canonicalAudioStepTitle;
  if (step.phase === "素材" || step.title === materialStepTitle) {
    return canonicalMaterialStepTitle;
  }
  if (step.phase === "剪辑" || step.title === "视频剪辑") return "剪辑";
  if (step.phase === "发布" || step.title === "平台发布 + 追踪") return "发布";
  return step.title;
}

function normalizeVideoStepNaming(step: Task["steps"][number]) {
  if (!step.phase) return step;

  return {
    ...step,
    title: canonicalVideoStepTitle(step),
  };
}

function isScriptStep(step: Task["steps"][number]) {
  return step.phase === "脚本" || step.title === canonicalScriptStepTitle || step.title === "文案生成";
}

function isAudioSegmentStep(step: Task["steps"][number]) {
  return step.phase === "音频" || step.title === canonicalAudioStepTitle || step.title === audioStepTitle;
}

function isMaterialSegmentStep(step: Task["steps"][number]) {
  return (
    step.phase === "素材" ||
    step.title === canonicalMaterialStepTitle ||
    step.title === materialStepTitle
  );
}

async function ensureTaskNaming(collection: Collection<TaskDocument>) {
  const candidates = await collection
    .find({
      $or: [
        { projectCode: { $exists: false } },
        { notionNamingVersion: { $ne: taskNamingVersion } },
      ],
    })
    .toArray();

  for (const candidate of candidates) {
    const task = stripMongoId(candidate);
    const projectCode = task.projectCode ?? (await nextProjectCode());
    const updatedTask: Task = {
      ...task,
      projectCode,
      notionNamingVersion: taskNamingVersion,
      steps:
        task.kind === "video"
          ? task.steps.map((step) => normalizeVideoStepNaming(step))
          : task.steps,
      updatedAt: new Date().toISOString(),
    };

    await renameTaskPagesInNotion(updatedTask);
    await collection.replaceOne({ id: task.id }, updatedTask);
  }
}

export async function getTasks() {
  const collection = await getTasksCollection();
  await ensureSeedTask(collection);
  await ensureTaskNaming(collection);
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
    projectCode: await nextProjectCode(),
    notionNamingVersion: taskNamingVersion,
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
    projectCode: task.projectCode,
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
    parentTitle: `${task.projectCode ? `[${task.projectCode}] ` : ""}${task.title}`,
    projectCode: task.projectCode,
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
  const audioStep = task?.steps.find((step) => isAudioSegmentStep(step));
  const materialStep = task?.steps.find((step) => isMaterialSegmentStep(step));

  if (!task || !sourceStep) {
    return { state: "not_found" as const };
  }

  if (!audioStep && !materialStep) {
    return { state: "missing_segment_steps" as const };
  }

  const normalizedScript = normalizeScript(scriptText || sourceStep.scriptText || "");

  if (!normalizedScript) {
    return { state: "empty_script" as const };
  }

  const sourceScriptHash = hashScript(normalizedScript);
  const existingSegments = audioStep?.audioSegments ?? materialStep?.audioSegments ?? [];
  const segments = buildAudioSegments(normalizedScript);

  if (segments.length === 0) {
    return { state: "empty_script" as const };
  }

  const isAudioCurrent = !audioStep || audioStep.sourceScriptHash === sourceScriptHash;
  const isMaterialCurrent =
    !materialStep || materialStep.sourceScriptHash === sourceScriptHash;
  const existingSegmentsMatch = existingSegments.length === segments.length &&
    existingSegments.every((segment, index) => segment.text === segments[index]?.text);

  if (
    isAudioCurrent &&
    isMaterialCurrent &&
    existingSegments.length > 0 &&
    existingSegmentsMatch
  ) {
    const now = new Date().toISOString();
    const updatedTask: Task = {
      ...task,
      steps: task.steps.map((step) => {
        if (step.id === sourceStep.id) {
          return {
            ...step,
            scriptText: normalizedScript,
            scriptApprovedAt: step.scriptApprovedAt ?? now,
            scriptApprovedBy: step.scriptApprovedBy ?? approvedBy,
            sourceScriptHash,
            completed: true,
            status: "done",
          };
        }

        if ((audioStep && step.id === audioStep.id) || (materialStep && step.id === materialStep.id)) {
          return {
            ...step,
            sourceScriptHash,
            completed: false,
            status: "processing",
          };
        }

        return step;
      }),
      updatedAt: now,
    };

    await Promise.all(
      [audioStep, materialStep]
        .filter((step): step is NonNullable<typeof step> => Boolean(step))
        .map((step) => updateStepStatusInNotion(step.notion?.pageId, "processing")),
    );
    await syncParentTaskIndexToNotion(updatedTask);
    await collection.replaceOne({ id: taskId }, updatedTask);

    return { state: "already_current" as const, segments: existingSegments };
  }

  const existingWorkflow = await detectExistingSegmentWorkflow({
    audioStep,
    materialStep,
  });

  if (existingWorkflow.state === "exists" || existingWorkflow.state === "failed") {
    return {
      state: "skipped_existing_workflow" as const,
      segments: existingSegments,
      error:
        existingWorkflow.state === "failed"
          ? existingWorkflow.error
          : "Audio or material page already contains a generated segment workflow.",
    };
  }

  await cleanupSegmentStepBootstrapContent({
    audioStep,
    materialStep,
  });

  const publishResult = await publishScriptSegmentsToNotion({
    audioStep,
    materialStep,
    segments,
  });

  const segmentsWithNotion: AudioSegment[] = segments.map((segment) => {
    return {
      ...segment,
      notion:
        publishResult.state === "published"
          ? { state: "published" }
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

      if (audioStep && step.id === audioStep.id) {
        return {
          ...step,
          description: `已根据文案生成 ${segmentsWithNotion.length} 个音频分段；音频请在本 Notion 页面内按段落上传。`,
          generatedFromStepId: sourceStep.id,
          sourceScriptHash,
          audioSegments: segmentsWithNotion,
          completed: false,
          status: "processing",
        };
      }

      if (materialStep && step.id === materialStep.id) {
        return {
          ...step,
          description: `已根据文案生成 ${segmentsWithNotion.length} 个素材分段；素材请在本 Notion 页面内按段落收集。`,
          generatedFromStepId: sourceStep.id,
          sourceScriptHash,
          audioSegments: segmentsWithNotion,
          completed: false,
          status: "processing",
        };
      }

      return step;
    }),
    updatedAt: now,
  };

  const segmentStepStatusUpdates = await Promise.all(
    [audioStep, materialStep]
      .filter((step): step is NonNullable<typeof step> => Boolean(step))
      .map((step) => updateStepStatusInNotion(step.notion?.pageId, "processing")),
  );

  await syncParentTaskIndexToNotion(updatedTask);
  await collection.replaceOne({ id: taskId }, updatedTask);

  const statusUpdateFailed = segmentStepStatusUpdates.some(
    (result) => result.state === "failed",
  );

  return {
    state:
      publishResult.state === "published" && !statusUpdateFailed
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

  if (!sourceStep || !isScriptStep(sourceStep)) {
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
      result.state === "already_current" ||
      result.state === "skipped_existing_workflow"
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
