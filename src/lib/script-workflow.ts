import { createHash, randomUUID } from "node:crypto";
import type { AudioSegment } from "./types";

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

function isSectionHeading(paragraph: string) {
  return /^【[\s\S]+】$/.test(paragraph.trim());
}

export function splitScriptIntoSegments(script: string) {
  const normalized = normalizeScript(script);
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!paragraphs.some(isSectionHeading)) {
    return paragraphs;
  }

  const sections: string[] = [];
  let currentSection = "";

  for (const paragraph of paragraphs) {
    if (isSectionHeading(paragraph)) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = paragraph;
      continue;
    }

    if (!currentSection) {
      currentSection = paragraph;
      continue;
    }

    currentSection = `${currentSection}\n\n${paragraph}`;
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
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
