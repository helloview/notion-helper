import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  getAccessUsers,
  getBootstrapSuperAdminEmails,
  getManagedNotionGuestIds,
  isBootstrapSuperAdminEmail,
} from "@/lib/access-control";
import { getAvailableAssignees } from "@/lib/notion";
import { AccessAdminClient } from "./access-admin-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccessAdminPage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const canManageAccess = session.user.email
    ? isBootstrapSuperAdminEmail(session.user.email)
    : false;

  if (!canManageAccess) {
    redirect("/");
  }

  const [users, assignees, managedGuestIds] = await Promise.all([
    getAccessUsers(),
    getAvailableAssignees(),
    getManagedNotionGuestIds(),
  ]);
  const notionUsers = [
    ...new Map(
      assignees
        .filter((assignee) => assignee.notionUserId)
        .map((assignee) => [
          assignee.notionUserId as string,
          {
            id: assignee.id,
            name: assignee.name,
            email: assignee.email,
            role: assignee.role,
            notionUserId: assignee.notionUserId,
            origin: assignee.origin,
            avatarUrl: assignee.avatarUrl,
          },
        ]),
    ).values(),
  ].sort((first, second) => first.name.localeCompare(second.name));

  return (
    <AccessAdminClient
      currentEmail={session.user.email ?? ""}
      initialPayload={{
        users,
        bootstrapEmails: getBootstrapSuperAdminEmails(),
        managedGuestIds,
        notionUsers,
      }}
    />
  );
}
