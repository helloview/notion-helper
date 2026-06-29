import { createHash, randomUUID } from "node:crypto";
import type { AudioSegment } from "./types";

const maxSegmentLength = 140;
const minSegmentLength = 36;

export function hashScript(script: string) {
  return createHash("sha256").update(normalizeScript(script)).digest("hex");
}

export function normalizeScript(script: string) {
  return script
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongParagraph(paragraph: string) {
  const sentences = paragraph
    .split(/(?<=[。！？!?；;])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return [paragraph];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current}${sentence}` : sentence;

    if (next.length > maxSegmentLength && current.length >= minSegmentLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function splitScriptIntoSegments(script: string) {
  const normalized = normalizeScript(script);
  if (!normalized) return [];

  return normalized
    .split(/\n\s*\n/)
    .flatMap((paragraph) => {
      const cleanParagraph = paragraph.replace(/\n+/g, " ").trim();
      return cleanParagraph.length > maxSegmentLength
        ? splitLongParagraph(cleanParagraph)
        : [cleanParagraph];
    })
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function buildAudioSegments(script: string): AudioSegment[] {
  const now = new Date().toISOString();
  const sourceScriptHash = hashScript(script);

  return splitScriptIntoSegments(script).map((text, index) => ({
    id: randomUUID(),
    index: index + 1,
    text,
    sourceScriptHash,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  }));
}
