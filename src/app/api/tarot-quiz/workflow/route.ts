import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  appendToUsedMaterials,
  deleteTarotQuizEpisode,
  getTarotQuizEpisode,
  getTarotQuizSettings,
  listTarotQuizEpisodes,
  saveTarotQuizEpisode,
  saveTarotQuizSettings,
} from "@/lib/tarot-quiz-store";
import type { TarotQuizSettingsPatch } from "@/lib/tarot-quiz-store";
import type { TarotQuizPromptInput } from "@/lib/tarot-quiz-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function apiError(scope: string, error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown API error";

  console.error(`[api/tarot-quiz/workflow:${scope}]`, message);

  return NextResponse.json(
    { error: "Tarot quiz workflow operation failed", detail: message },
    { status },
  );
}

async function requireSession() {
  const session = await getSessionUser();

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true as const, session };
}

// GET → { settings, episodes }；GET ?id=xxx → 单条完整归档（含 result）。
export async function GET(request: Request) {
  try {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const episode = await getTarotQuizEpisode(id);

      if (!episode) {
        return NextResponse.json({ error: "Episode not found" }, { status: 404 });
      }

      return NextResponse.json({ episode });
    }

    const [settings, episodes] = await Promise.all([
      getTarotQuizSettings(),
      listTarotQuizEpisodes(),
    ]);

    return NextResponse.json({ settings, episodes });
  } catch (error) {
    return apiError("GET", error);
  }
}

// PUT → 保存共享设置（查重库 / 模型 / 思考深度，传哪个改哪个）。
export async function PUT(request: Request) {
  try {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const patch: TarotQuizSettingsPatch = {};

    if (typeof body.usedMaterials === "string") patch.usedMaterials = body.usedMaterials;
    if (typeof body.model === "string") patch.model = body.model;
    if (typeof body.reasoningEffort === "string") {
      patch.reasoningEffort = body.reasoningEffort;
    }

    const settings = await saveTarotQuizSettings(patch, guard.session.user.name);

    return NextResponse.json({ settings });
  } catch (error) {
    return apiError("PUT", error);
  }
}

// POST → 归档一期（可选把素材记录追加进查重库）。
export async function POST(request: Request) {
  try {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const result = String(body.result ?? "");

    if (!result.trim()) {
      return NextResponse.json(
        { error: "Empty result", detail: "没有可归档的生成结果。" },
        { status: 400 },
      );
    }

    const episode = await saveTarotQuizEpisode({
      title: String(body.title ?? ""),
      targetId: String(body.targetId ?? ""),
      input: (body.input ?? {}) as TarotQuizPromptInput,
      result,
      createdBy: guard.session.user.name,
    });

    // 以归档时编辑框里的查重内容为基准，避免丢掉未保存的本地修改。
    if (typeof body.baseUsedMaterials === "string") {
      await saveTarotQuizSettings(
        { usedMaterials: body.baseUsedMaterials },
        guard.session.user.name,
      );
    }

    const dedupeNote = String(body.dedupeNote ?? "").trim();
    const settings = dedupeNote
      ? await appendToUsedMaterials(dedupeNote, guard.session.user.name)
      : await getTarotQuizSettings();

    const episodes = await listTarotQuizEpisodes();

    return NextResponse.json({ episode, episodes, settings });
  } catch (error) {
    return apiError("POST", error);
  }
}

// DELETE ?id=xxx → 删除归档。
export async function DELETE(request: Request) {
  try {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    if (guard.session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteTarotQuizEpisode(id);
    const episodes = await listTarotQuizEpisodes();

    return NextResponse.json({ episodes });
  } catch (error) {
    return apiError("DELETE", error);
  }
}
