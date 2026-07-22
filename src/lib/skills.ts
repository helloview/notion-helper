import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export type SkillDefinition = {
  /** Directory name, used as the stable id (e.g. "tarot-quiz-hook"). */
  id: string;
  name: string;
  description: string;
  /** Markdown body without the frontmatter block. */
  body: string;
  updatedAt: string;
};

const SKILLS_DIR = path.join(process.cwd(), "skills");
const CACHE_TTL_MS = 5_000;

let skillsCache: { expiresAt: number; promise: Promise<SkillDefinition[]> } | null = null;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) meta[key] = value;
  }

  return { meta, body: raw.slice(match[0].length).trim() };
}

async function loadSkills(): Promise<SkillDefinition[]> {
  let entries;

  try {
    entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const filePath = path.join(SKILLS_DIR, entry.name, "SKILL.md");

        try {
          const [raw, stat] = await Promise.all([
            fs.readFile(filePath, "utf-8"),
            fs.stat(filePath),
          ]);
          const { meta, body } = parseFrontmatter(raw);

          return {
            id: entry.name,
            name: meta.name || entry.name,
            description: meta.description ?? "",
            body,
            updatedAt: stat.mtime.toISOString(),
          } satisfies SkillDefinition;
        } catch {
          return null;
        }
      }),
  );

  return skills
    .filter((skill): skill is SkillDefinition => skill !== null)
    .sort((first, second) => first.id.localeCompare(second.id));
}

// Skills live as editable files in skills/<name>/SKILL.md; swap or edit a file
// and every page/API pick it up on the next request. The short TTL only
// deduplicates bursts of reads within one navigation.
export function getSkills(): Promise<SkillDefinition[]> {
  const now = Date.now();

  if (skillsCache && skillsCache.expiresAt > now) {
    return skillsCache.promise;
  }

  const promise = loadSkills().catch((error) => {
    skillsCache = null;
    throw error;
  });
  skillsCache = { expiresAt: now + CACHE_TTL_MS, promise };
  return promise;
}

export async function getSkill(id: string): Promise<SkillDefinition | null> {
  const skills = await getSkills();
  return skills.find((skill) => skill.id === id || skill.name === id) ?? null;
}
