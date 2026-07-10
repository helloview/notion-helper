import type { Assignee } from "./types";

export const fallbackAssignees: Assignee[] = [
  {
    id: "owner",
    name: "Yuxuan",
    role: "Owner",
    email: "yuxuan@company.com",
    source: "local",
    origin: "workspace_user",
  },
  {
    id: "ops",
    name: "Ops",
    role: "Operations",
    email: "ops@company.com",
    source: "local",
    origin: "workspace_user",
  },
  {
    id: "creative",
    name: "Creative",
    role: "Creative",
    email: "creative@company.com",
    source: "local",
    origin: "workspace_user",
  },
];

export const defaultAssigneeId =
  process.env.DEFAULT_ASSIGNEE_ID &&
  fallbackAssignees.some(
    (assignee) => assignee.id === process.env.DEFAULT_ASSIGNEE_ID,
  )
    ? process.env.DEFAULT_ASSIGNEE_ID
    : fallbackAssignees[0].id;

export function getFallbackAssignee(id: string) {
  return (
    fallbackAssignees.find((assignee) => assignee.id === id) ??
    fallbackAssignees[0]
  );
}
