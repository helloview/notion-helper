"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Assignee } from "@/lib/types";
import { Sidebar } from "./sidebar";

type WorkspaceShellProps = {
  children: ReactNode;
  currentUser: Assignee;
  currentRole: "admin" | "member";
  canManageAccess: boolean;
};

export function WorkspaceShell({
  children,
  currentUser,
  currentRole,
  canManageAccess,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const activeTab = pathname.startsWith("/tarot-quiz")
    ? "tarot-quiz"
    : pathname.startsWith("/admin/access")
      ? "access"
      : "tasks";

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] pb-[60px] text-slate-950 md:pb-0">
      <Sidebar
        currentUser={currentUser}
        currentRole={currentRole}
        canManageAccess={canManageAccess}
        activeTab={activeTab}
      />
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
