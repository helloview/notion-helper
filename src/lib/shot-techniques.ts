export type ShotTechnique = {
  id: string;
  name: string;
  definition: string;
  effect: string;
  scenes: string[];
  imagePath?: string;
};

export const shotTechniques: ShotTechnique[] = [
  {
    id: "close_up",
    name: "特写镜头 (Close-Up / CU)",
    definition: "画框仅容纳被摄体的某一部分（如脸部、手部或关键道具），细节放大凸显。",
    effect: "能够强烈放大情绪张力，引导观众的视觉焦点，创造极强的亲密感或悬疑感。",
    scenes: ["情感转折", "内心挣扎", "微观特写", "线索道具暗示"],
    imagePath: "/images/techniques/close_up.jpg"
  },
  {
    id: "push_in",
    name: "推镜头 (Push In)",
    definition: "摄像机向前移动或焦距拉近，逐渐缩小画框范围，聚焦于核心人物或物体。",
    effect: "增加视觉张力，提示观众注意关键细节，或引导观众进入人物的内心世界。",
    scenes: ["灵光一闪", "严肃说明", "情绪渐强", "揭示秘密"],
    imagePath: "/images/techniques/push_in.jpg"
  },
  {
    id: "pull_out",
    name: "拉镜头 (Pull Out / Back)",
    definition: "摄像机向后移动或焦距拉远，画框范围逐渐扩大，将人物或主体融入更广阔的环境中。",
    effect: "常带来孤独感、舒缓感或庄严的宏大感，展示主体与环境的对比。",
    scenes: ["揭示全景", "表达孤独", "故事落幕", "高潮后的抽离"]
  },
  {
    id: "pan",
    name: "摇镜头 (Pan / Pan Left or Right)",
    definition: "摄像机位置固定，机身水平左右旋转拍摄。",
    effect: "模仿人类转头环视的视角，适合介绍场景、展现关联性或创造悬念。",
    scenes: ["场景交代", "跟随运动", "视线转移", "对比展示"]
  },
  {
    id: "tilt",
    name: "仰俯俯仰 (Tilt Up / Down)",
    definition: "摄像机位置固定，机身垂直向上或向下旋转拍摄。",
    effect: "仰拍表现高大、神浅、威严或压迫感；俯拍表现渺小、卑微、被动或全景。",
    scenes: ["高大建筑物", "强弱对比", "跌落深渊", "仰望星空"]
  },
  {
    id: "tracking_shot",
    name: "跟镜头 (Tracking / Follow)",
    definition: "摄像机移动，以恒定距离跟随着运动中的人物或物体拍摄。",
    effect: "创造极强的代入感与临场感，让观众感觉自己也是场景中的参与者。",
    scenes: ["人物奔跑", "走廊行走", "主观探索", "动态转场"],
    imagePath: "/images/techniques/tracking_shot.jpg"
  },
  {
    id: "dutch_angle",
    name: "倾斜镜头 (Dutch Angle)",
    definition: "摄像机水平线故意倾斜，使画框内的垂直线条与边缘呈夹角。",
    effect: "视觉失衡，传达出不安、疯狂、危险、幻觉或极度紧张的气氛。",
    scenes: ["醉酒幻觉", "精神紧张", "危机降临", "阴谋酝酿"],
    imagePath: "/images/techniques/dutch_angle.jpg"
  },
  {
    id: "over_the_shoulder",
    name: "过肩镜头 (Over The Shoulder / OTS)",
    definition: "越过一个角色的肩膀，拍摄对面角色的正面或侧面。",
    effect: "建立对话者之间的相对空间位置，使对话场面更具空间立体感。",
    scenes: ["双人对话", "对峙谈判", "眼神交锋", "暗中观察"]
  },
  {
    id: "birds_eye",
    name: "上帝视角俯拍 (Bird's Eye View)",
    definition: "从主体的垂直上方（如无人机或高位机位）向下俯瞰拍摄。",
    effect: "极端的旁观者视角，展示宏观几何构图、宿命感或对全局的掌控。",
    scenes: ["城市鸟瞰", "迷宫行走", "灾难现场", "地图轨迹"],
    imagePath: "/images/techniques/birds_eye.jpg"
  },
  {
    id: "extreme_close_up",
    name: "大特写 (Extreme Close-Up / ECU)",
    definition: "对物体极微小的局部进行拍摄，如眼睛的眨动、纸张上的文字等。",
    effect: "剥离常规常识空间，创造强烈的超现实感或极端的紧张与神秘感。",
    scenes: ["眼睛瞳孔", "写字细节", "微米物体", "惊悚特写"]
  }
];
