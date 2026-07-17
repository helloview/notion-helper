import { getTasks } from "@/lib/local-store";
import { getAvailableAssignees } from "@/lib/notion";
import { getSessionUser } from "@/lib/auth";
import { isBootstrapSuperAdminEmail } from "@/lib/access-control";
import { redirect } from "next/navigation";
import { ClientApp } from "./client-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Check session first
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const [tasks, assignees] = await Promise.all([
    getTasks(),
    getAvailableAssignees(),
  ]);

  const sortedTasks = tasks.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return (
    <ClientApp 
      initialTasks={sortedTasks} 
      assignees={assignees} 
      currentUser={session.user}
      currentRole={session.role}
      canManageAccess={session.user.email ? isBootstrapSuperAdminEmail(session.user.email) : false}
    />
  );
}
