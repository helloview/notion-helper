import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { processNotionConfirmedScriptPage } from "@/lib/local-store";
import { getMongoDb } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function collectPageIds(value: unknown, pageIds = new Set<string>()) {
  if (!value || typeof value !== "object") return pageIds;

  if (Array.isArray(value)) {
    for (const item of value) collectPageIds(item, pageIds);
    return pageIds;
  }

  const record = value as Record<string, unknown>;

  for (const [key, raw] of Object.entries(record)) {
    if (
      typeof raw === "string" &&
      key.toLowerCase().includes("page") &&
      key.toLowerCase().includes("id")
    ) {
      pageIds.add(raw);
    }

    if (
      key === "entity" &&
      raw &&
      typeof raw === "object" &&
      "type" in raw &&
      (raw as { type?: unknown }).type === "page" &&
      "id" in raw &&
      typeof (raw as { id?: unknown }).id === "string"
    ) {
      pageIds.add((raw as { id: string }).id);
    }

    collectPageIds(raw, pageIds);
  }

  return pageIds;
}

function eventIdFromPayload(body: Record<string, unknown>) {
  const id = body.id ?? body.event_id ?? body.eventId;
  return typeof id === "string" ? id : undefined;
}

async function saveVerificationToken(token: string) {
  const db = await getMongoDb();

  await db.collection("notion_webhook_verifications").insertOne({
    token,
    createdAt: new Date().toISOString(),
  });
}

async function getLatestVerificationToken() {
  const db = await getMongoDb();

  return db
    .collection<{ token: string; createdAt: string }>("notion_webhook_verifications")
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
}

function isAuthorizedTokenRead(request: Request) {
  const adminSecret = process.env.WEBHOOK_ADMIN_SECRET;

  if (!adminSecret) return false;

  const { searchParams } = new URL(request.url);
  const providedSecret =
    request.headers.get("x-webhook-admin-secret") ??
    searchParams.get("secret");

  return providedSecret === adminSecret;
}

export async function GET(request: Request) {
  if (!isAuthorizedTokenRead(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  const latest = await getLatestVerificationToken();

  if (!latest) {
    return NextResponse.json({
      ok: true,
      message: "No Notion verification token has been received yet.",
    });
  }

  return NextResponse.json({
    ok: true,
    verification_token: latest.token,
    createdAt: latest.createdAt,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (typeof body.verification_token === "string") {
      await saveVerificationToken(body.verification_token);

      return NextResponse.json({
        ok: true,
        verification_token: body.verification_token,
      });
    }

    const pageIds = [...collectPageIds(body)];

    if (pageIds.length === 0 && typeof body.pageId === "string") {
      pageIds.push(body.pageId);
    }

    if (pageIds.length === 0) {
      return NextResponse.json({
        ok: true,
        state: "ignored",
        reason: "No page id found in webhook payload.",
      });
    }

    const eventId = eventIdFromPayload(body);
    const results = [];

    for (const pageId of pageIds) {
      const scopedEventId = eventId ? `${eventId}:${pageId}` : undefined;

      results.push({
        pageId,
        result: await processNotionConfirmedScriptPage(pageId, scopedEventId),
      });
    }

    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown webhook error";

    console.error("[api/notion/webhook:POST]", message);

    return NextResponse.json(
      {
        ok: false,
        error: "Webhook processing failed",
        detail: message,
      },
      { status: 500 },
    );
  }
}
