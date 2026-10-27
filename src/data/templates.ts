import { DataPack } from "../domain/types";

export const dataPackTemplate: DataPack = {
  manifest: {
    id: "my-cyberpunk-red-pack",
    name: "我的 Cyberpunk RED 资料包",
    version: "0.1.0",
    author: "本地用户",
    ruleset: "cyberpunk-red",
    schemaVersion: 1,
    language: "zh-CN",
    sourceUrl: "https://talsorianstore.com/",
    ownershipNote: "我拥有此资料的合法访问权；仅用于本地个人跑团。",
    licenseStatus: "user-owned",
    categories: ["rules-reference", "skill", "weapon", "cyberware", "npc", "module"],
  },
  entries: [
    {
      id: "example-entry",
      title: "示例条目",
      category: "rules-reference",
      tags: ["示例"],
      body: "在这里写你自己的摘要、页码索引或本地速查。不要把不打算长期本地保存的整本规则正文塞进内置包。",
      source: "Cyberpunk RED 正版资料",
      sourceUrl: "https://talsorianstore.com/",
      licenseStatus: "user-owned",
      ruleset: "cyberpunk-red",
      packId: "my-cyberpunk-red-pack",
      schemaVersion: 1,
      metadata: {
        page: "",
        originalTitle: "",
      },
    },
  ],
  randomTables: [
    {
      id: "example-table",
      title: "示例随机表",
      category: "random-table",
      dice: "1d6",
      source: "本地整理",
      packId: "my-cyberpunk-red-pack",
      entries: [
        { range: "1-2", result: "低风险线索" },
        { range: "3-4", result: "代价或延迟" },
        { range: "5-6", result: "危险转折" },
      ],
    },
  ],
  enabled: true,
};
