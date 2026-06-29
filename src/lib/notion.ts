import { Client } from "@notionhq/client";
import type {
  Assignee,
  AudioSegment,
  Task,
  UpdateStepInput,
  UpdateTaskInput,
} from "./types";
import { fallbackAssignees, getFallbackAssignee } from "./assignees";

type PublishResult =
  | { state: "not_configured" }
  | { state: "published"; pageId: string; stepPageIds: Record<string, string> }
  | { state: "failed"; error: string };

type DeleteResult =
  | { state: "not_configured" }
  | { state: "deleted" }
  | { state: "failed"; error: string };

type UpdateResult =
  | { state: "not_configured" }
  | { state: "updated" }
  | { state: "failed"; error: string };

type StepPublishResult =
  | { state: "not_configured" }
  | { state: "published"; stepPageIds: Record<string, string> }
  | { state: "failed"; error: string };

type AudioSegmentPublishResult =
  | { state: "not_configured" }
  | { state: "published"; segmentPageIds: Record<string, string> }
  | { state: "failed"; error: string };

type NotionUserLike = {
  object?: string;
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  type?: string;
};

type DataSourceSchema = {
  dataSourceId: string;
  properties: Record<string, { type: string; options?: string[] }>;
};

type NotionTaskType = "main" | "subtask";

let notionClient: Client | null = null;

function getNotionClient() {
  if (!process.env.NOTION_TOKEN) {
    return null;
  }

  if (!notionClient) {
    notionClient = new Client({ auth: process.env.NOTION_TOKEN });
  }

  return notionClient;
}

function richText(content: string) {
  return {
    rich_text: [
      {
        text: {
          content: content.slice(0, 2000),
        },
      },
    ],
  };
}

function linkedRichText(content: string, url: string) {
  return [
    {
      text: {
        content: content.slice(0, 2000),
        link: { url },
      },
    },
  ];
}

function plainText(
  richTextItems: Array<{ plain_text?: string }> | undefined,
) {
  return richTextItems
    ?.map((item) => item.plain_text ?? "")
    .join("")
    .trim() ?? "";
}

function richTextPropertyText(property: unknown) {
  if (
    property &&
    typeof property === "object" &&
    "type" in property &&
    property.type === "rich_text" &&
    "rich_text" in property &&
    Array.isArray(property.rich_text)
  ) {
    return plainText(property.rich_text);
  }

  return "";
}

function checkboxPropertyValue(property: unknown) {
  if (
    property &&
    typeof property === "object" &&
    "type" in property &&
    property.type === "checkbox" &&
    "checkbox" in property
  ) {
    return Boolean(property.checkbox);
  }

  return false;
}

function blockText(block: unknown) {
  if (!block || typeof block !== "object" || !("type" in block)) return "";

  const typedBlock = block as {
    type: string;
    paragraph?: { rich_text?: Array<{ plain_text?: string }> };
    bulleted_list_item?: { rich_text?: Array<{ plain_text?: string }> };
    numbered_list_item?: { rich_text?: Array<{ plain_text?: string }> };
    to_do?: { rich_text?: Array<{ plain_text?: string }> };
    heading_1?: { rich_text?: Array<{ plain_text?: string }> };
    heading_2?: { rich_text?: Array<{ plain_text?: string }> };
    heading_3?: { rich_text?: Array<{ plain_text?: string }> };
    quote?: { rich_text?: Array<{ plain_text?: string }> };
    callout?: { rich_text?: Array<{ plain_text?: string }> };
  };
  const richTextItems =
    typedBlock.paragraph?.rich_text ??
    typedBlock.bulleted_list_item?.rich_text ??
    typedBlock.numbered_list_item?.rich_text ??
    typedBlock.to_do?.rich_text ??
    typedBlock.heading_1?.rich_text ??
    typedBlock.heading_2?.rich_text ??
    typedBlock.heading_3?.rich_text ??
    typedBlock.quote?.rich_text ??
    typedBlock.callout?.rich_text;

  return plainText(richTextItems);
}

function isManagedStepText(text: string) {
  return (
    text === "子任务说明" ||
    text.startsWith("阶段：") ||
    text.startsWith("状态：") ||
    text.startsWith("负责人：") ||
    text.startsWith("截止日期：") ||
    text.startsWith("归属大任务：") ||
    text.startsWith("父任务 Notion page id：")
  );
}

function notionPageUrl(pageId: string) {
  return `https://www.notion.so/${pageId.replaceAll("-", "")}`;
}

function stepDisplayTitle(step: Task["steps"][number]) {
  return `${step.phase ? `${step.phase} - ` : ""}${step.title}`;
}

function stepInputDisplayTitle(step: UpdateStepInput) {
  return `${step.phase ? `${step.phase} - ` : ""}${step.title}`;
}

function toAssignee(
  user: NotionUserLike,
  origin: NonNullable<Assignee["origin"]>,
): Assignee | null {
  if (user.object && user.object !== "user") return null;
  if (user.type && user.type !== "person") return null;

  return {
    id: user.id,
    name: user.name ?? "Unnamed Notion user",
    role: origin === "workspace_user" ? "Workspace member" : "Guest",
    notionUserId: user.id,
    avatarUrl: user.avatar_url ?? undefined,
    source: "notion",
    origin,
  };
}

function configuredGuestUserIds() {
  return (process.env.NOTION_GUEST_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function getDataSourceSchema(
  notion: Client,
  databaseId: string,
): Promise<DataSourceSchema | null> {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const dataSourceId =
    "data_sources" in database ? database.data_sources[0]?.id : undefined;

  if (!dataSourceId) return null;

  const dataSource = await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  });

  return {
    dataSourceId,
    properties:
      "properties" in dataSource
        ? Object.fromEntries(
            Object.entries(dataSource.properties).map(([name, property]) => [
              name,
              {
                type: property.type,
                options:
                  property.type === "status"
                    ? property.status.options.map((option) => option.name)
                    : property.type === "select"
                      ? property.select.options.map((option) => option.name)
                    : undefined,
              },
            ]),
          )
        : {},
  };
}

function findProperty(
  schema: DataSourceSchema,
  preferredName: string,
  expectedType: string,
) {
  if (schema.properties[preferredName]?.type === expectedType) {
    return preferredName;
  }

  return Object.entries(schema.properties).find(
    ([, property]) => property.type === expectedType,
  )?.[0];
}

function mapStatusForNotion(
  localStatus: Task["status"],
  statusOptions: string[] = [],
) {
  const preferred: Record<Task["status"], string[]> = {
    draft: ["Not started", "Todo", "Backlog", "草稿"],
    active: ["In progress", "Doing", "进行中"],
    blocked: ["Blocked", "In progress", "阻塞"],
    done: ["Done", "Complete", "完成"],
  };

  return (
    preferred[localStatus].find((status) => statusOptions.includes(status)) ??
    statusOptions[0] ??
    localStatus
  );
}

function mapTaskTypeForNotion(
  taskType: NotionTaskType | undefined,
  taskTypeOptions: string[] = [],
) {
  if (!taskType) return undefined;

  const preferred: Record<NotionTaskType, string[]> = {
    main: ["主任务", "Main task", "Parent task"],
    subtask: ["子任务", "Subtask", "Child task"],
  };

  return preferred[taskType].find((option) =>
    taskTypeOptions.includes(option),
  );
}

function taskStatusFromStepStatus(status: NonNullable<Task["steps"][number]["status"]>) {
  if (status === "done") return "done";
  if (status === "blocked") return "blocked";
  if (status === "in_progress") return "active";
  return "draft";
}

function buildPageProperties({
  schema,
  title,
  status,
  assignee,
  dueDate,
  taskType,
}: {
  schema: DataSourceSchema;
  title: string;
  status: Task["status"];
  assignee?: Assignee;
  dueDate?: string;
  taskType?: NotionTaskType;
}) {
  const titleProperty = findProperty(
    schema,
    process.env.NOTION_TITLE_PROPERTY ?? "Tasks",
    "title",
  );
  const statusProperty = findProperty(
    schema,
    process.env.NOTION_STATUS_PROPERTY ?? "Status",
    "status",
  );
  const assigneeProperty = findProperty(
    schema,
    process.env.NOTION_ASSIGNEE_PROPERTY ?? "Assignee",
    "people",
  );
  const dueDateProperty = findProperty(
    schema,
    process.env.NOTION_DUE_DATE_PROPERTY ?? "Due",
    "date",
  );
  const taskTypeProperty = findProperty(
    schema,
    process.env.NOTION_TASK_TYPE_PROPERTY ?? "任务类型",
    "select",
  );
  const taskTypeName = taskTypeProperty
    ? mapTaskTypeForNotion(
        taskType,
        schema.properties[taskTypeProperty]?.options,
      )
    : undefined;

  if (!titleProperty) {
    return null;
  }

  return {
    [titleProperty]: {
      title: [
        {
          text: {
            content: title,
          },
        },
      ],
    },
    ...(statusProperty
      ? {
          [statusProperty]: {
            status: {
              name: mapStatusForNotion(
                status,
                schema.properties[statusProperty]?.options,
              ),
            },
          },
        }
      : {}),
    ...(assignee?.notionUserId && assigneeProperty
      ? {
          [assigneeProperty]: {
            people: [
              {
                id: assignee.notionUserId,
              },
            ],
          },
        }
      : {}),
    ...(dueDate && dueDateProperty
      ? {
          [dueDateProperty]: {
            date: {
              start: dueDate,
            },
          },
        }
      : {}),
    ...(taskTypeProperty && taskTypeName
      ? {
          [taskTypeProperty]: {
            select: {
              name: taskTypeName,
            },
          },
        }
      : {}),
  };
}

async function createStepPagesForTask({
  notion,
  schema,
  assignees,
  task,
  parentPageId,
}: {
  notion: Client;
  schema: DataSourceSchema;
  assignees: Assignee[];
  task: Task;
  parentPageId: string;
}) {
  const notionDueDate = task.dueDate || task.targetPublishDate;
  const stepPageIds: Record<string, string> = {};

  for (const step of task.steps) {
    const stepAssignee =
      assignees.find((item) => item.id === step.assigneeId) ??
      assignees.find((item) => item.notionUserId === step.assigneeId) ??
      getFallbackAssignee(step.assigneeId ?? task.assigneeId);
    const stepStatus = step.status ?? (step.completed ? "done" : "todo");
    const stepProperties = buildPageProperties({
      schema,
      title: stepDisplayTitle(step),
      status: taskStatusFromStepStatus(stepStatus),
      assignee: stepAssignee,
      dueDate: step.dueDate || notionDueDate,
      taskType: "subtask",
    });

    if (!stepProperties) {
      throw new Error("No title property found for child task creation.");
    }

    const stepPage = await notion.pages.create({
      parent: {
        data_source_id: schema.dataSourceId,
      },
      properties: stepProperties,
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: richText("子任务说明").rich_text,
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: richText(step.description ?? "子任务说明待补充").rich_text,
          },
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: richText(`阶段：${step.phase || "执行"}`).rich_text,
          },
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: richText(`状态：${stepStatus}`).rich_text,
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: richText(`归属大任务：${task.title}`).rich_text,
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: richText(`父任务 Notion page id：${parentPageId}`).rich_text,
          },
        },
      ],
    });

    stepPageIds[step.id] = stepPage.id;
  }

  return stepPageIds;
}

async function archiveManagedStepBlocks(notion: Client, pageId: string) {
  let startCursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if (!("type" in block)) continue;

      const paragraphText =
        block.type === "paragraph" ? plainText(block.paragraph.rich_text) : "";
      const headingText =
        block.type === "heading_2" ? plainText(block.heading_2.rich_text) : "";
      const listText =
        block.type === "bulleted_list_item"
          ? plainText(block.bulleted_list_item.rich_text)
          : "";
      const shouldArchive =
        paragraphText.startsWith("归属大任务：") ||
        paragraphText.startsWith("父任务 Notion page id：") ||
        headingText === "子任务说明" ||
        listText.startsWith("状态：") ||
        listText.startsWith("负责人：") ||
        listText.startsWith("阶段：") ||
        listText.startsWith("截止日期：");

      if (shouldArchive) {
        await notion.blocks.update({
          block_id: block.id,
          in_trash: true,
        });
      }
    }

    startCursor = response.next_cursor ?? undefined;
  } while (startCursor);
}

async function replaceStepPageContent({
  notion,
  pageId,
  parentTitle,
  step,
  assigneeName,
}: {
  notion: Client;
  pageId: string;
  parentTitle: string;
  step: UpdateStepInput;
  assigneeName: string;
}) {
  await archiveManagedStepBlocks(notion, pageId);

  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: richText("子任务说明").rich_text,
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: richText(step.description || "子任务说明待补充").rich_text,
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: richText(`阶段：${step.phase || "执行"}`).rich_text,
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: richText(`状态：${step.status}`).rich_text,
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: richText(`负责人：${assigneeName}`).rich_text,
        },
      },
      ...(step.dueDate
        ? [
            {
              object: "block" as const,
              type: "bulleted_list_item" as const,
              bulleted_list_item: {
                rich_text: richText(`截止日期：${step.dueDate}`).rich_text,
              },
            },
          ]
        : []),
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: richText(`归属大任务：${parentTitle}`).rich_text,
        },
      },
    ],
  });
}

async function archiveManagedAudioSegmentBlocks(notion: Client, pageId: string) {
  let startCursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if (!("type" in block)) continue;

      const text = blockText(block);
      const shouldArchive =
        text === "音频分段任务" ||
        text.startsWith("已根据文案自动拆分") ||
        text.startsWith("Segment ");

      if (shouldArchive) {
        await notion.blocks.update({
          block_id: block.id,
          in_trash: true,
        });
      }
    }

    startCursor = response.next_cursor ?? undefined;
  } while (startCursor);
}

async function appendAudioSegmentIndex({
  notion,
  pageId,
  segments,
  segmentPageIds,
}: {
  notion: Client;
  pageId: string;
  segments: AudioSegment[];
  segmentPageIds: Record<string, string>;
}) {
  await archiveManagedAudioSegmentBlocks(notion, pageId);

  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: richText("音频分段任务").rich_text,
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: richText(
            `已根据文案自动拆分为 ${segments.length} 个音频段落。请进入每个 Segment 页面，在 Notion 的音频文件字段或页面附件中上传对应音频。`,
          ).rich_text,
        },
      },
      ...segments.map((segment) => {
        const pageId = segmentPageIds[segment.id];
        const label = `Segment ${String(segment.index).padStart(2, "0")} · ${segment.text.slice(0, 42)}`;

        return {
          object: "block" as const,
          type: "bulleted_list_item" as const,
          bulleted_list_item: {
            rich_text: pageId
              ? linkedRichText(label, notionPageUrl(pageId))
              : richText(label).rich_text,
          },
        };
      }),
    ],
  });
}

async function archiveManagedParentTaskBlocks(
  notion: Client,
  pageId: string,
  task?: Task,
) {
  let startCursor: string | undefined;
  const generatedStepTitles = new Set(
    task?.steps.map((step) => stepDisplayTitle(step)) ?? [],
  );

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if (!("type" in block)) continue;
      const isLegacyTodo = block.type === "to_do";
      const isManagedHeading =
        block.type === "heading_2" &&
        ["子任务", "子任务索引"].includes(plainText(block.heading_2.rich_text));
      const isManagedIntro =
        block.type === "paragraph" &&
        [
          "子任务已作为独立 Task 创建。",
          "以下每一项都是独立的 Notion Task row。点击即可打开对应子任务进行负责人、状态和截止日期管理。",
        ].includes(plainText(block.paragraph.rich_text));
      const isManagedStepLink =
        block.type === "bulleted_list_item" &&
        generatedStepTitles.has(
          plainText(block.bulleted_list_item.rich_text).split(" · ")[0],
        );

      if (
        isLegacyTodo ||
        isManagedHeading ||
        isManagedIntro ||
        isManagedStepLink
      ) {
        await notion.blocks.update({
          block_id: block.id,
          in_trash: true,
        });
      }
    }

    startCursor = response.next_cursor ?? undefined;
  } while (startCursor);
}

async function appendParentTaskIndex({
  notion,
  parentPageId,
  task,
  stepPageIds,
}: {
  notion: Client;
  parentPageId: string;
  task: Task;
  stepPageIds: Record<string, string>;
}) {
  await archiveManagedParentTaskBlocks(notion, parentPageId, task);

  const stepBlocks = task.steps
    .map((step) => {
      const pageId = stepPageIds[step.id] ?? step.notion?.pageId;

      if (!pageId) return null;

      const status = step.status ?? (step.completed ? "done" : "todo");
      const title = stepDisplayTitle(step);

      return {
        object: "block" as const,
        type: "bulleted_list_item" as const,
        bulleted_list_item: {
          rich_text: [
            ...linkedRichText(title, notionPageUrl(pageId)),
            {
              text: {
                content: ` · 状态：${status}`,
              },
            },
            ...(step.description
              ? [
                  {
                    text: {
                      content: ` · ${step.description}`,
                    },
                  },
                ]
              : []),
          ],
        },
      };
    })
    .filter((block): block is NonNullable<typeof block> => Boolean(block));

  await notion.blocks.children.append({
    block_id: parentPageId,
    children: [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: richText("子任务索引").rich_text,
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: richText(
            "以下每一项都是独立的 Notion Task row。点击即可打开对应子任务进行负责人、状态和截止日期管理。",
          ).rich_text,
        },
      },
      ...stepBlocks,
    ],
  });
}

function mergeAssignees(groups: Assignee[][]) {
  const assigneesById = new Map<string, Assignee>();

  for (const assignee of groups.flat()) {
    const existing = assigneesById.get(assignee.id);
    if (!existing) {
      assigneesById.set(assignee.id, assignee);
      continue;
    }

    if (existing.origin === "workspace_user") continue;
    if (assignee.origin === "workspace_user") {
      assigneesById.set(assignee.id, assignee);
      continue;
    }

    if (assignee.origin === "manual_guest") {
      assigneesById.set(assignee.id, assignee);
    }
  }

  return [...assigneesById.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

async function listWorkspaceUsers(notion: Client) {
  const users: Assignee[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.users.list({
      start_cursor: startCursor,
      page_size: 100,
    });

    users.push(
      ...response.results
        .map((user) => toAssignee(user, "workspace_user"))
        .filter((user): user is Assignee => Boolean(user)),
    );

    startCursor = response.next_cursor ?? undefined;
  } while (startCursor);

  return users;
}

async function retrieveConfiguredGuests(notion: Client) {
  const guestIds = configuredGuestUserIds();

  if (guestIds.length === 0) return [];

  const guests = await Promise.all(
    guestIds.map(async (userId) => {
      try {
        const user = await notion.users.retrieve({ user_id: userId });
        return toAssignee(user, "manual_guest");
      } catch {
        return null;
      }
    }),
  );

  return guests.filter((guest): guest is Assignee => Boolean(guest));
}

async function listPeopleFromDatabase(notion: Client) {
  const databaseId = process.env.NOTION_DATABASE_ID;
  const assigneeProperty = process.env.NOTION_ASSIGNEE_PROPERTY ?? "Assigned";

  if (!databaseId) return [];

  const schema = await getDataSourceSchema(notion, databaseId);
  if (!schema) return [];

  const usersById = new Map<string, Assignee>();
  let startCursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: schema.dataSourceId,
      start_cursor: startCursor,
      page_size: 100,
      result_type: "page",
    });

    for (const result of response.results) {
      if (!("properties" in result)) continue;

      const property = result.properties[assigneeProperty];
      if (!property || property.type !== "people") continue;

      const people = Array.isArray(property.people) ? property.people : [];

      for (const user of people) {
        if (user.object !== "user") continue;
        const assignee = toAssignee(user, "database_people");
        if (assignee) usersById.set(assignee.id, assignee);
      }
    }

    startCursor = response.next_cursor ?? undefined;
  } while (startCursor);

  return [...usersById.values()];
}

export function isNotionConfigured() {
  return Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID);
}

export function canReadNotionUsers() {
  return Boolean(process.env.NOTION_TOKEN);
}

export async function getAvailableAssignees(): Promise<Assignee[]> {
  const notion = getNotionClient();

  if (!notion) {
    return fallbackAssignees;
  }

  try {
    const [workspaceUsers, databasePeople, configuredGuests] = await Promise.all([
      listWorkspaceUsers(notion),
      listPeopleFromDatabase(notion),
      retrieveConfiguredGuests(notion),
    ]);
    const users = mergeAssignees([
      workspaceUsers,
      databasePeople,
      configuredGuests,
    ]);

    return users.length > 0 ? users : fallbackAssignees;
  } catch {
    return fallbackAssignees;
  }
}

export async function getAssignee(id: string): Promise<Assignee> {
  const assignees = await getAvailableAssignees();
  return (
    assignees.find((assignee) => assignee.id === id) ??
    assignees.find((assignee) => assignee.notionUserId === id) ??
    getFallbackAssignee(id)
  );
}

export async function getScriptApprovalFromNotion(pageId: string): Promise<
  | { state: "not_configured"; approved: false; scriptText: "" }
  | { state: "ready"; approved: boolean; scriptText: string }
  | { state: "failed"; error: string }
> {
  const notion = getNotionClient();

  if (!notion) {
    return { state: "not_configured", approved: false, scriptText: "" };
  }

  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const properties =
      "properties" in page
        ? (page.properties as Record<string, unknown>)
        : {};
    const approvedPropertyName =
      process.env.NOTION_SCRIPT_APPROVED_PROPERTY ?? "文案已确认";
    const scriptPropertyName =
      process.env.NOTION_SCRIPT_TEXT_PROPERTY ?? "文案正文";
    const approved = checkboxPropertyValue(properties[approvedPropertyName]);
    const scriptPropertyText = richTextPropertyText(properties[scriptPropertyName]);
    const blockTexts: string[] = [];
    let startCursor: string | undefined;

    do {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const block of response.results) {
        const text = blockText(block);

        if (text && !isManagedStepText(text)) {
          blockTexts.push(text);
        }
      }

      startCursor = response.next_cursor ?? undefined;
    } while (startCursor);

    return {
      state: "ready",
      approved,
      scriptText: scriptPropertyText || blockTexts.join("\n\n").trim(),
    };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function publishAudioSegmentsToNotion({
  task,
  sourceStep,
  targetStep,
  segments,
}: {
  task: Task;
  sourceStep: Task["steps"][number];
  targetStep: Task["steps"][number];
  segments: AudioSegment[];
}): Promise<AudioSegmentPublishResult> {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId || !targetStep.notion?.pageId) {
    return { state: "not_configured" };
  }

  try {
    const [schema, assignees] = await Promise.all([
      getDataSourceSchema(notion, databaseId),
      getAvailableAssignees(),
    ]);

    if (!schema) {
      return {
        state: "failed",
        error: "No data source found for the configured Notion database.",
      };
    }

    const assignee =
      assignees.find((item) => item.id === targetStep.assigneeId) ??
      assignees.find((item) => item.notionUserId === targetStep.assigneeId) ??
      getFallbackAssignee(targetStep.assigneeId ?? task.assigneeId);
    const segmentPageIds: Record<string, string> = {};
    const filesProperty = findProperty(
      schema,
      process.env.NOTION_AUDIO_FILES_PROPERTY ?? "音频文件",
      "files",
    );

    for (const segment of segments) {
      const segmentProperties = buildPageProperties({
        schema,
        title: `音频 ${String(segment.index).padStart(2, "0")}｜${task.title}`,
        status: "draft",
        assignee,
        dueDate: targetStep.dueDate || task.dueDate || task.targetPublishDate,
        taskType: "subtask",
      });

      if (!segmentProperties) {
        throw new Error("No title property found for audio segment creation.");
      }

      const page = await notion.pages.create({
        parent: {
          data_source_id: schema.dataSourceId,
        },
        properties: {
          ...segmentProperties,
          ...(filesProperty
            ? {
                [filesProperty]: {
                  files: [],
                },
              }
            : {}),
        },
        children: [
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: richText(`Segment ${String(segment.index).padStart(2, "0")}`).rich_text,
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: richText(segment.text).rich_text,
            },
          },
          {
            object: "block",
            type: "to_do",
            to_do: {
              checked: false,
              rich_text: richText("上传本段音频到 Notion 的音频文件字段或本页附件。").rich_text,
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: richText(`来源步骤：${sourceStep.title}`).rich_text,
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: richText(`归属大任务：${task.title}`).rich_text,
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: richText(`父任务 Notion page id：${task.notion.pageId ?? ""}`).rich_text,
            },
          },
        ],
      });

      segmentPageIds[segment.id] = page.id;
    }

    await appendAudioSegmentIndex({
      notion,
      pageId: targetStep.notion.pageId,
      segments,
      segmentPageIds,
    });

    return { state: "published", segmentPageIds };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function publishTaskToNotion(task: Task): Promise<PublishResult> {
  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return { state: "not_configured" };
  }

  const assignees = await getAvailableAssignees();
  const assignee =
    assignees.find((item) => item.id === task.assigneeId) ??
    assignees.find((item) => item.notionUserId === task.assigneeId) ??
    getFallbackAssignee(task.assigneeId);
  const schema = await getDataSourceSchema(notion, databaseId);

  if (!schema) {
    return {
      state: "failed",
      error: "No data source found for the configured Notion database.",
    };
  }

  const notionDueDate = task.dueDate || task.targetPublishDate;
  const parentProperties = buildPageProperties({
    schema,
    title: task.title,
    status: task.status,
    assignee,
    dueDate: notionDueDate,
    taskType: "main",
  });

  if (!parentProperties) {
    return {
      state: "failed",
      error: "No title property found in the configured Notion database.",
    };
  }

  const metadataLines = [
    task.kind === "video" ? "类型：视频项目" : "类型：普通任务",
    task.contentSeries ? `系列：${task.contentSeries}` : "",
    task.weekLabel ? `周期：${task.weekLabel}` : "",
    task.targetPublishDate ? `目标发布：${task.targetPublishDate}` : "",
    task.platforms?.length ? `平台：${task.platforms.join(" / ")}` : "",
  ].filter(Boolean);

  try {
    const page = await notion.pages.create({
      parent: {
        data_source_id: schema.dataSourceId,
      },
      properties: parentProperties,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: richText(task.summary).rich_text,
          },
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: richText(metadataLines.join(" | ") || "任务元信息待补充")
              .rich_text,
          },
        },
      ],
    });

    const stepPageIds = await createStepPagesForTask({
      notion,
      schema,
      assignees,
      task,
      parentPageId: page.id,
    });
    await appendParentTaskIndex({
      notion,
      parentPageId: page.id,
      task,
      stepPageIds,
    });

    return { state: "published", pageId: page.id, stepPageIds };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function publishTaskStepsToNotion(task: Task): Promise<StepPublishResult> {
  if (!task.notion.pageId) {
    return { state: "not_configured" };
  }

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return { state: "not_configured" };
  }

  try {
    const [schema, assignees] = await Promise.all([
      getDataSourceSchema(notion, databaseId),
      getAvailableAssignees(),
    ]);

    if (!schema) {
      return {
        state: "failed",
        error: "No data source found for the configured Notion database.",
      };
    }

    const stepPageIds = await createStepPagesForTask({
      notion,
      schema,
      assignees,
      task,
      parentPageId: task.notion.pageId,
    });

    return { state: "published", stepPageIds };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function syncParentTaskIndexToNotion(
  task: Task,
): Promise<UpdateResult> {
  const notion = getNotionClient();

  if (!notion || !task.notion.pageId) {
    return { state: "not_configured" };
  }

  const stepPageIds = Object.fromEntries(
    task.steps
      .map((step) => [step.id, step.notion?.pageId])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  if (Object.keys(stepPageIds).length === 0) {
    return { state: "not_configured" };
  }

  try {
    await appendParentTaskIndex({
      notion,
      parentPageId: task.notion.pageId,
      task,
      stepPageIds,
    });

    return { state: "updated" };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function deleteTaskFromNotion(pageId?: string): Promise<DeleteResult> {
  if (!pageId) {
    return { state: "not_configured" };
  }

  const notion = getNotionClient();

  if (!notion) {
    return { state: "not_configured" };
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      in_trash: true,
    });

    return { state: "deleted" };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function updateTaskStatusInNotion(
  pageId: string | undefined,
  status: Task["status"],
): Promise<UpdateResult> {
  if (!pageId) {
    return { state: "not_configured" };
  }

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return { state: "not_configured" };
  }

  try {
    const schema = await getDataSourceSchema(notion, databaseId);

    if (!schema) {
      return {
        state: "failed",
        error: "No data source found for the configured Notion database.",
      };
    }

    const statusProperty = findProperty(
      schema,
      process.env.NOTION_STATUS_PROPERTY ?? "Status",
      "status",
    );

    if (!statusProperty) {
      return { state: "not_configured" };
    }

    await notion.pages.update({
      page_id: pageId,
      properties: {
        [statusProperty]: {
          status: {
            name: mapStatusForNotion(
              status,
              schema.properties[statusProperty]?.options,
            ),
          },
        },
      },
    });

    return { state: "updated" };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function updateTaskInNotion({
  pageId,
  task,
}: {
  pageId?: string;
  task: UpdateTaskInput;
}): Promise<UpdateResult> {
  if (!pageId) {
    return { state: "not_configured" };
  }

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return { state: "not_configured" };
  }

  try {
    const [schema, assignees] = await Promise.all([
      getDataSourceSchema(notion, databaseId),
      getAvailableAssignees(),
    ]);

    if (!schema) {
      return {
        state: "failed",
        error: "No data source found for the configured Notion database.",
      };
    }

    const assignee =
      assignees.find((item) => item.id === task.assigneeId) ??
      assignees.find((item) => item.notionUserId === task.assigneeId) ??
      getFallbackAssignee(task.assigneeId);
    const properties = buildPageProperties({
      schema,
      title: task.title,
      status: task.status,
      assignee,
      dueDate: task.dueDate || task.targetPublishDate,
      taskType: "main",
    });

    if (!properties) {
      return {
        state: "failed",
        error: "No title property found in the configured Notion database.",
      };
    }

    await notion.pages.update({
      page_id: pageId,
      properties,
    });

    return { state: "updated" };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}

export async function updateStepInNotion({
  pageId,
  parentTitle,
  step,
}: {
  pageId?: string;
  parentTitle: string;
  step: UpdateStepInput;
}): Promise<UpdateResult> {
  if (!pageId) {
    return { state: "not_configured" };
  }

  const notion = getNotionClient();
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notion || !databaseId) {
    return { state: "not_configured" };
  }

  try {
    const [schema, assignees] = await Promise.all([
      getDataSourceSchema(notion, databaseId),
      getAvailableAssignees(),
    ]);

    if (!schema) {
      return {
        state: "failed",
        error: "No data source found for the configured Notion database.",
      };
    }

    const statusProperty = findProperty(
      schema,
      process.env.NOTION_STATUS_PROPERTY ?? "Status",
      "status",
    );
    const assigneeProperty = findProperty(
      schema,
      process.env.NOTION_ASSIGNEE_PROPERTY ?? "Assignee",
      "people",
    );
    const dueDateProperty = findProperty(
      schema,
      process.env.NOTION_DUE_DATE_PROPERTY ?? "Due",
      "date",
    );
    const titleProperty = findProperty(
      schema,
      process.env.NOTION_TITLE_PROPERTY ?? "Tasks",
      "title",
    );
    const taskTypeProperty = findProperty(
      schema,
      process.env.NOTION_TASK_TYPE_PROPERTY ?? "任务类型",
      "select",
    );
    const taskTypeName = taskTypeProperty
      ? mapTaskTypeForNotion(
          "subtask",
          schema.properties[taskTypeProperty]?.options,
        )
      : undefined;
    const assignee =
      assignees.find((item) => item.id === step.assigneeId) ??
      assignees.find((item) => item.notionUserId === step.assigneeId) ??
      getFallbackAssignee(step.assigneeId);

    if (!titleProperty) {
      return {
        state: "failed",
        error: "No title property found in the configured Notion database.",
      };
    }

    await notion.pages.update({
      page_id: pageId,
      properties: {
        [titleProperty]: {
          title: [
            {
              text: {
                content: stepInputDisplayTitle(step),
              },
            },
          ],
        },
        ...(statusProperty
          ? {
              [statusProperty]: {
                status: {
                  name: mapStatusForNotion(
                    taskStatusFromStepStatus(step.status),
                    schema.properties[statusProperty]?.options,
                  ),
                },
              },
            }
          : {}),
        ...(assignee.notionUserId && assigneeProperty
          ? {
              [assigneeProperty]: {
                people: [
                  {
                    id: assignee.notionUserId,
                  },
                ],
              },
            }
          : {}),
        ...(dueDateProperty
          ? {
              [dueDateProperty]: {
                date: step.dueDate
                  ? {
                      start: step.dueDate,
                    }
                  : null,
              },
            }
          : {}),
        ...(taskTypeProperty && taskTypeName
          ? {
              [taskTypeProperty]: {
                select: {
                  name: taskTypeName,
                },
              },
            }
          : {}),
      },
    });

    await replaceStepPageContent({
      notion,
      pageId,
      parentTitle,
      step,
      assigneeName: assignee.name,
    });

    return { state: "updated" };
  } catch (error) {
    return {
      state: "failed",
      error: error instanceof Error ? error.message : "Unknown Notion error",
    };
  }
}
