import "server-only";

import { randomUUID } from "node:crypto";
import { getMongoDb } from "./mongodb";
import type { TarotQuizPromptInput } from "./tarot-quiz-template";

const SETTINGS_COLLECTION = "tarot_quiz_settings";
const EPISODES_COLLECTION = "tarot_quiz_episodes";
const SETTINGS_ID = "default";

export type ReasoningEffort = "low" | "medium" | "high" | "max";

export type TarotQuizSettings = {
  /** 团队共享的往期查重库（已用过的题目和母题）。 */
  usedMaterials: string;
  /** NVIDIA 模型 ID；空字符串表示用默认模型。 */
  model: string;
  /** 思考深度；空字符串表示用默认档位。 */
  reasoningEffort: ReasoningEffort | "";
  updatedAt: string;
  updatedBy?: string;
};

export type TarotQuizSettingsPatch = Partial<
  Pick<TarotQuizSettings, "usedMaterials" | "model" | "reasoningEffort">
>;

export type TarotQuizEpisode = {
  id: string;
  title: string;
  targetId: string;
  input: TarotQuizPromptInput;
  result: string;
  createdAt: string;
  createdBy?: string;
};

/** List item without the full result payload (results can be tens of KB). */
export type TarotQuizEpisodeSummary = Omit<TarotQuizEpisode, "result"> & {
  resultLength: number;
};

type SettingsDoc = TarotQuizSettings & { _id: string };
type EpisodeDoc = TarotQuizEpisode & { _id?: unknown };

const reasoningEffortValues = new Set<string>(["low", "medium", "high", "max"]);

function normalizeReasoningEffort(value: unknown): ReasoningEffort | "" {
  return typeof value === "string" && reasoningEffortValues.has(value)
    ? (value as ReasoningEffort)
    : "";
}

export async function getTarotQuizSettings(): Promise<TarotQuizSettings> {
  const db = await getMongoDb();
  const doc = await db.collection<SettingsDoc>(SETTINGS_COLLECTION).findOne({ _id: SETTINGS_ID });

  return {
    usedMaterials: doc?.usedMaterials ?? "",
    model: doc?.model ?? "",
    reasoningEffort: normalizeReasoningEffort(doc?.reasoningEffort),
    updatedAt: doc?.updatedAt ?? "",
    updatedBy: doc?.updatedBy,
  };
}

export async function saveTarotQuizSettings(
  patch: TarotQuizSettingsPatch,
  actor?: string,
): Promise<TarotQuizSettings> {
  const current = await getTarotQuizSettings();
  const settings: TarotQuizSettings = {
    usedMaterials:
      patch.usedMaterials !== undefined ? patch.usedMaterials.trim() : current.usedMaterials,
    model: patch.model !== undefined ? patch.model.trim() : current.model,
    reasoningEffort:
      patch.reasoningEffort !== undefined
        ? normalizeReasoningEffort(patch.reasoningEffort)
        : current.reasoningEffort,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };

  const db = await getMongoDb();
  await db
    .collection<SettingsDoc>(SETTINGS_COLLECTION)
    .updateOne({ _id: SETTINGS_ID }, { $set: settings }, { upsert: true });

  return settings;
}

/** Append a note to the shared dedupe library (used when archiving an episode). */
export async function appendToUsedMaterials(note: string, actor?: string) {
  const trimmed = note.trim();
  if (!trimmed) return getTarotQuizSettings();

  const current = await getTarotQuizSettings();
  const next = current.usedMaterials ? `${current.usedMaterials}\n${trimmed}` : trimmed;
  return saveTarotQuizSettings({ usedMaterials: next }, actor);
}

export async function listTarotQuizEpisodes(limit = 30): Promise<TarotQuizEpisodeSummary[]> {
  const db = await getMongoDb();
  const docs = await db
    .collection<EpisodeDoc>(EPISODES_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map(({ result, ...rest }) => ({
    ...rest,
    resultLength: result?.length ?? 0,
  }));
}

export async function getTarotQuizEpisode(id: string): Promise<TarotQuizEpisode | null> {
  const db = await getMongoDb();
  const doc = await db
    .collection<EpisodeDoc>(EPISODES_COLLECTION)
    .findOne({ id }, { projection: { _id: 0 } });

  return doc ?? null;
}

export async function saveTarotQuizEpisode(input: {
  title: string;
  targetId: string;
  input: TarotQuizPromptInput;
  result: string;
  createdBy?: string;
}): Promise<TarotQuizEpisode> {
  const episode: TarotQuizEpisode = {
    id: randomUUID(),
    title: input.title.trim() || "未命名一期",
    targetId: input.targetId,
    input: input.input,
    result: input.result,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };

  const db = await getMongoDb();
  await db.collection<EpisodeDoc>(EPISODES_COLLECTION).insertOne({ ...episode });

  return episode;
}

export async function deleteTarotQuizEpisode(id: string) {
  const db = await getMongoDb();
  await db.collection<EpisodeDoc>(EPISODES_COLLECTION).deleteOne({ id });
}
