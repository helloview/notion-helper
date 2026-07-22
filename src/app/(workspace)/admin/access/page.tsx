import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  getAccessUsers,
  getBootstrapSuperAdminEmails,
  getManagedNotionGuestIds,
  isBootstrapSuperAdminEmail,
} from "@/lib/access-control";
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

  const [users, managedGuestIds] = await Promise.all([
    getAccessUsers(),
    getManagedNotionGuestIds(),
  ]);

  return (
    <AccessAdminClient
      currentEmail={session.user.email ?? ""}
      currentIdentity={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        notionUserId: session.user.notionUserId,
        avatarUrl: session.user.avatarUrl,
      }}
      initialPayload={{
        users,
        bootstrapEmails: getBootstrapSuperAdminEmails(),
        managedGuestIds,
        notionUsers: [],
      }}
    />
  );
}
