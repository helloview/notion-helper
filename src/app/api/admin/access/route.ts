import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteAccessUser,
  getAccessUsers,
  getBootstrapSuperAdminEmails,
  getManagedNotionGuestIds,
  isBootstrapSuperAdminEmail,
  upsertAccessUser,
  type AccessRole,
} from "@/lib/access-control";
import { getAvailableAssignees, invalidateAssigneesCache } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roles = new Set<AccessRole>(["admin", "member", "super_admin"]);

function apiError(scope: string, error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown API error";

  console.error(`[api/admin/access:${scope}]`, message);

  return NextResponse.json(
    {
      error: "Access control operation failed",
      detail: message,
    },
    { status },
  );
}

async function requireBootstrapSuperAdmin() {
  const session = await getSessionUser();

  if (!session?.user.email) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!isBootstrapSuperAdminEmail(session.user.email)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    actorEmail: session.user.email,
  };
}

async function accessPayload({ includeNotionUsers = false } = {}) {
  const [users, assignees, managedGuestIds] = await Promise.all([
    getAccessUsers(),
    includeNotionUsers ? getAvailableAssignees() : Promise.resolve([]),
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

  return {
    users,
    bootstrapEmails: getBootstrapSuperAdminEmails(),
    managedGuestIds,
    notionUsers,
  };
}

export async function GET(request: Request) {
  try {
    const guard = await requireBootstrapSuperAdmin();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const includeNotionUsers = searchParams.get("includeNotion") === "1";

    return NextResponse.json(await accessPayload({ includeNotionUsers }));
  } catch (error) {
    return apiError("GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireBootstrapSuperAdmin();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const role = roles.has(body.role) ? (body.role as AccessRole) : "member";

    await upsertAccessUser(
      {
        email: String(body.email ?? ""),
        name: body.name ? String(body.name) : undefined,
        role,
        notionUserId: body.notionUserId ? String(body.notionUserId) : undefined,
        active: body.active === undefined ? true : Boolean(body.active),
      },
      guard.actorEmail,
    );
    invalidateAssigneesCache();

    return NextResponse.json(await accessPayload());
  } catch (error) {
    return apiError("POST", error);
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireBootstrapSuperAdmin();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    await deleteAccessUser(email);
    invalidateAssigneesCache();

    return NextResponse.json(await accessPayload());
  } catch (error) {
    return apiError("DELETE", error);
  }
}
