import { NextResponse } from "next/server";
import { getAvailableAssignees } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const assignees = await getAvailableAssignees();

  return NextResponse.json({
    assignees: assignees.map((assignee) => ({
      id: assignee.id,
      name: assignee.name,
      role: assignee.role,
      source: assignee.source,
      origin: assignee.origin,
      notionUserId: assignee.notionUserId,
      avatarUrl: assignee.avatarUrl,
    })),
  });
}
