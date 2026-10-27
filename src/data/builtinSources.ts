import { DataEntry, SourceEntry } from "../domain/types";

export const sourceEntries: SourceEntry[] = [
  {
    id: "rtg-store",
    title: "R. Talsorian Games 官方商店",
    sourceUrl: "https://talsorianstore.com/",
    licenseStatus: "official-link",
    note: "Cyberpunk RED 正式资料的购买和来源入口。",
    addedAt: "2026-05-21",
  },
  {
    id: "rtg-single-player-mode-plus",
    title: "Cyberpunk RED Single Player Mode+",
    sourceUrl:
      "https://rtalsoriangames.com/wp-content/uploads/2025/09/RTG-CPR-DLC-SinglePlayerModePlusv1.01.pdf",
    licenseStatus: "official-link",
    note: "官方免费 DLC，可作为单人跑团和 GM 模拟器设计参考。",
    addedAt: "2026-05-21",
  },
  {
    id: "local-easy-mode-preview",
    title: "赛博朋克红 Easy Mode 中文试阅",
    localPath: "K:\\小说\\跑团\\赛博朋克红 公开试阅文件\\赛博朋克红-EasyMode-20260401.pdf",
    licenseStatus: "public-preview",
    note: "用户提供的公开试阅 PDF。应用只登记来源与结构，不内置长篇正文。",
    addedAt: "2026-05-21",
  },
  {
    id: "local-core-preview",
    title: "赛博朋克红 核心规则中文试阅",
    localPath: "K:\\小说\\跑团\\赛博朋克红 公开试阅文件\\赛博朋克红-核心规则试阅-20260502.pdf",
    licenseStatus: "public-preview",
    note: "用户提供的核心规则试阅 PDF。用于字段、术语和导入分类参考。",
    addedAt: "2026-05-21",
  },
  {
    id: "local-character-sheet",
    title: "赛博朋克红 人物卡中文试阅",
    localPath: "K:\\小说\\跑团\\赛博朋克红 公开试阅文件\\赛博朋克红-人物卡-20260324.pdf",
    licenseStatus: "public-preview",
    note: "用户提供的人物卡 PDF。用于角色卡字段、技能分类和速查入口参考。",
    addedAt: "2026-05-21",
  },
  {
    id: "local-opera-module",
    title: "赛博朋克红 模组试阅 歌剧院一夜",
    localPath: "K:\\小说\\跑团\\赛博朋克红 公开试阅文件\\赛博朋克红-模组试阅-歌剧院一夜-20260423.zip",
    licenseStatus: "public-preview",
    note: "用户提供的模组试阅包，包含冒险 PDF 与地图 JPG。适合后续导入为模组资料包。",
    addedAt: "2026-05-21",
  },
];

export const builtinEntries: DataEntry[] = [
  {
    id: "red-source-boundary",
    title: "内置内容边界",
    category: "rules-reference",
    tags: ["合规", "导入", "Cyberpunk RED"],
    body:
      "本应用不内置 Cyberpunk RED 正式规则书正文。请把你拥有的正版资料整理为本地资料包后导入；内置层只提供字段、来源台账、判定工具和单人跑团辅助。",
    source: "应用内置说明",
    licenseStatus: "homebrew",
    ruleset: "cyberpunk-red",
    packId: "builtin",
    schemaVersion: 1,
  },
  {
    id: "red-check-quick-entry",
    title: "判定工具说明",
    category: "rules-reference",
    tags: ["判定", "骰子", "速查"],
    body:
      "判定面板按 Cyberpunk RED 的结构接收属性、技能、修正和 DV，并显示掷骰结果、极值状态与差值。具体 DV、例外规则和表格请以你导入的正式资料为准。",
    source: "应用内置说明",
    licenseStatus: "homebrew",
    ruleset: "cyberpunk-red",
    packId: "builtin",
    schemaVersion: 1,
  },
  {
    id: "red-solo-layer",
    title: "单人辅助层",
    category: "rules-reference",
    tags: ["单人", "GM模拟器", "预言机"],
    body:
      "预言机、场景压力、阵营时钟和 AI GM 都是主持辅助层，只产生叙事提示，不改变 Cyberpunk RED 的正式规则裁定。",
    source: "应用内置说明",
    licenseStatus: "homebrew",
    ruleset: "cyberpunk-red",
    packId: "builtin",
    schemaVersion: 1,
  },
];
