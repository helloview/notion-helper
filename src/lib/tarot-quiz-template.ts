export const TAROT_QUIZ_SERIES = "塔罗牌5题挑战视频";

export const TAROT_QUIZ_WORKFLOW_STEPS = ["脚本", "音频", "素材", "剪辑", "发布"];

export const TAROT_QUIZ_TASK_PRESET = {
  kind: "video",
  title: "塔罗牌五题挑战视频",
  summary:
    "根据塔罗五题挑战栏目技能库，生成开场钩子、四道互动题、一道评论区开放题、结尾CTA、分题画面表、答案速查和史实核查清单。",
  priority: "medium",
  contentSeries: TAROT_QUIZ_SERIES,
  platforms: ["抖音", "小红书"],
  steps: TAROT_QUIZ_WORKFLOW_STEPS,
} as const;

export type TarotQuizPromptInput = {
  episodeTitle?: string;
  usedMaterials?: string;
  fanLetter?: string;
  emotionalTheme?: string;
  hotTopic?: string;
  productionNotes?: string;
  platforms?: string;
  duration?: string;
};

/** Minimal skill shape shared by server loader and client preview. */
export type TarotSkill = {
  id: string;
  name: string;
  description: string;
  body: string;
};

/** Preferred assembly order; unknown skills are appended alphabetically. */
const SKILL_ORDER = [
  "tarot-quiz-episode",
  "tarot-quiz-hook",
  "tarot-quiz-q1-clue-guess",
  "tarot-quiz-q2-flash-memory",
  "tarot-quiz-q3-fake-card",
  "tarot-quiz-q4-card-meaning",
  "tarot-quiz-q5-open-question",
  "tarot-quiz-ending",
];

export function sortSkillsForAssembly<T extends { id: string }>(skills: T[]): T[] {
  return [...skills].sort((first, second) => {
    const firstRank = SKILL_ORDER.indexOf(first.id);
    const secondRank = SKILL_ORDER.indexOf(second.id);
    if (firstRank !== -1 && secondRank !== -1) return firstRank - secondRank;
    if (firstRank !== -1) return -1;
    if (secondRank !== -1) return 1;
    return first.id.localeCompare(second.id);
  });
}

export function assembleTarotQuizSystemPrompt(skills: TarotSkill[]) {
  const sections = sortSkillsForAssembly(skills).map(
    (skill) => `━━━━━ 技能：${skill.name} ━━━━━\n\n${skill.body}`,
  );

  return [
    "你是抖音塔罗五题挑战栏目的总控编剧。下面是栏目技能库，生成时必须严格遵守其中的规则、流程和产出格式。",
    "若当前环境无法联网核实牌面细节，不要假装已核实，在史实核查清单中标注为待人工核查。",
    "",
    ...sections,
  ].join("\n\n");
}

function fallback(value: string | undefined, text: string) {
  const normalized = value?.trim();
  return normalized ? normalized : text;
}

export function buildTarotQuizUserPrompt(
  input: TarotQuizPromptInput,
  target: { id: string; name: string },
) {
  const isEpisode = target.id === "tarot-quiz-episode";
  const instruction = isEpisode
    ? `请严格按技能「${target.name}」的生成流程与交付格式，组装栏目「${TAROT_QUIZ_SERIES}」的一整期脚本。`
    : `本次只产出「${target.name}」技能对应的部分，严格按该技能的规则与产出格式输出，不要输出整期脚本。`;

  const title = fallback(input.episodeTitle, "塔罗牌五题挑战视频新一期");
  const usedMaterials = fallback(
    input.usedMaterials,
    "未知。请至少避开首发期基线，月亮线索题、太阳记忆题、假牌预言家、恋爱暧昧母题。",
  );
  const fanLetter = fallback(input.fanLetter, "本期没有粉丝来信，请走虚构模式。");
  const emotionalTheme = fallback(
    input.emotionalTheme,
    "优先避开恋爱暧昧，建议从职场抉择、友情裂痕、家庭关系、自我焦虑、金钱人情、人生岔路中选择一个。",
  );
  const hotTopic = fallback(input.hotTopic, "无指定热点。可以保留通用钩子，并给出热点可替换提示。");
  const productionNotes = fallback(
    input.productionNotes,
    "输出必须方便复制到Notion脚本页。纯口播块不要加入解释性标题以外的多余话。",
  );
  const platforms = fallback(input.platforms, "抖音、小红书");
  const duration = fallback(input.duration, "约一分五十秒到两分钟");

  return `
${instruction}

本期标题：
${title}

发布平台：
${platforms}

目标时长：
${duration}

往期已用素材和查重要求：
${usedMaterials}

粉丝真实问题或来信：
${fanLetter}

第五题情绪母题偏好：
${emotionalTheme}

可用热点或发布当天可替换方向：
${hotTopic}

额外制作要求：
${productionNotes}
`.trim();
}
