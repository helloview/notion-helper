import type { TaskKind, TaskStep } from "./types";

export type TaskStepTemplate = Pick<
  TaskStep,
  "phase" | "title" | "description"
>;

export const videoProductionTemplate: TaskStepTemplate[] = [
  {
    phase: "脚本",
    title: "脚本",
    description: "生成完整视频脚本，拆出镜头/旁白/画面提示。",
  },
  {
    phase: "音频",
    title: "音频",
    description: "按脚本段落产出可剪辑音频，并标注文件名与段落顺序。",
  },
  {
    phase: "素材",
    title: "素材",
    description: "为每个脚本段落收集画面、图片、B-roll、参考链接。",
  },
  {
    phase: "剪辑",
    title: "剪辑",
    description: "完成初剪、字幕、音乐、节奏、封面和导出。",
  },
  {
    phase: "发布",
    title: "发布",
    description: "发布到目标平台，记录发布时间、数据表现和复盘结论。",
  },
];

export function defaultStepsForKind(kind: TaskKind) {
  if (kind === "video") {
    return videoProductionTemplate.map((step) => step.title);
  }

  return ["确认需求", "执行任务", "交付和复盘"];
}
