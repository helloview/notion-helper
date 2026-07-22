import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/app/_components/workspace-shell";
import { isBootstrapSuperAdminEmail } from "@/lib/access-control";
import { getSessionUser } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const canManageAccess = session.user.email
    ? isBootstrapSuperAdminEmail(session.user.email)
    : false;

  return (
    <WorkspaceShell
      currentUser={session.user}
      currentRole={session.role}
      canManageAccess={canManageAccess}
    >
      {children}
    </WorkspaceShell>
  );
}
