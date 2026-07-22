import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSkills } from "@/lib/skills";
import { getTarotQuizSettings, listTarotQuizEpisodes } from "@/lib/tarot-quiz-store";
import { TarotQuizClient } from "./tarot-quiz-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TarotQuizPage() {
  const [session, skills, settings, episodes] = await Promise.all([
    getSessionUser(),
    getSkills(),
    getTarotQuizSettings().catch(() => ({
      usedMaterials: "",
      model: "",
      reasoningEffort: "" as const,
      updatedAt: "",
    })),
    listTarotQuizEpisodes().catch(() => []),
  ]);

  if (!session) {
    redirect("/login");
  }

  return (
    <TarotQuizClient
      currentUser={session.user}
      currentRole={session.role}
      defaultAssigneeId={session.user.id}
      skills={skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        body: skill.body,
        updatedAt: skill.updatedAt,
      }))}
      initialSettings={settings}
      initialEpisodes={episodes}
    />
  );
}
