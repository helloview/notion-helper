export type TaskStatus = "draft" | "active" | "blocked" | "done";

export type Priority = "low" | "medium" | "high";

export type NotionPublishState =
  | "not_configured"
  | "pending"
  | "published"
  | "failed";

export type TaskKind = "general" | "video";

export type StepStatus =
  | "todo"
  | "processing"
  | "in_progress"
  | "blocked"
  | "done";

export type AudioSegmentStatus = "pending" | "uploaded" | "needs_revision";

export type AudioSegment = {
  id: string;
  index: number;
  text: string;
  sourceScriptHash: string;
  status: AudioSegmentStatus;
  notion?: {
    pageId?: string;
    state?: NotionPublishState;
    error?: string;
  };
  shotTechnique?: string;
  shotDescription?: string;
  shotImagePath?: string;
  createdAt: string;
  updatedAt: string;
};

export type Assignee = {
  id: string;
  name: string;
  role: string;
  email?: string;
  notionUserId?: string;
  avatarUrl?: string;
  source: "notion" | "local";
  origin?: "workspace_user" | "database_people" | "manual_guest" | "managed_access";
};

export type TaskStep = {
  id: string;
  title: string;
  completed: boolean;
  phase?: string;
  description?: string;
  scriptText?: string;
  scriptApprovedAt?: string;
  scriptApprovedBy?: string;
  sourceScriptHash?: string;
  generatedFromStepId?: string;
  audioSegments?: AudioSegment[];
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: string;
  status?: StepStatus;
  notion?: {
    pageId?: string;
    state?: NotionPublishState;
    error?: string;
  };
};

export type Task = {
  id: string;
  kind?: TaskKind;
  projectCode?: string;
  notionNamingVersion?: number;
  title: string;
  summary: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: string;
  contentSeries?: string;
  weekLabel?: string;
  platforms?: string[];
  targetPublishDate?: string;
  steps: TaskStep[];
  notion: {
    state: NotionPublishState;
    pageId?: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  kind?: TaskKind;
  title: string;
  summary: string;
  priority: Priority;
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: string;
  contentSeries?: string;
  weekLabel?: string;
  platforms?: string[];
  targetPublishDate?: string;
  stepAssigneeId?: string;
  stepAssigneeIds?: string[];
  steps: string[];
};

export type UpdateTaskInput = {
  title: string;
  summary: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: string;
  contentSeries?: string;
  weekLabel?: string;
  platforms?: string[];
  targetPublishDate?: string;
};

export type UpdateStepInput = {
  title: string;
  phase?: string;
  description?: string;
  status: StepStatus;
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: string;
  audioSegments?: AudioSegment[];
};
