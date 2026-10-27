import { builtinEntries } from "../data/builtinSources";
import { moduleCatalog } from "../data/moduleCatalog";
import { Campaign, CampaignSettings, CombatState, NetrunState, RunnerState, Scene } from "../domain/types";
import { createBlankCharacter } from "../rulesets/cyberpunk-red";

export function createDefaultScene(): Scene {
  return {
    id: crypto.randomUUID(),
    title: "霓虹雨下的第一单",
    objective: "确认雇主、目标、报酬和第一个风险。",
    location: "夜之城，待指定地点",
    pressure: 1,
    heat: 0,
    threads: ["谁在背后付款？", "这单会得罪哪一方？"],
    status: "open",
  };
}

export function createDefaultCombat(): CombatState {
  return {
    active: false,
    round: 1,
    turnIndex: 0,
    combatants: [],
  };
}

export function createDefaultNetrun(): NetrunState {
  return {
    active: false,
    floor: 1,
    objective: "确认架构入口、目标文件和警报条件。",
    alarms: 0,
    blackIce: [],
    notes: "",
  };
}

export function createDefaultSettings(): CampaignSettings {
  const firstModule = moduleCatalog[0];
  const starterSceneId = firstModule?.starterSceneId ?? "";
  return {
    selectedModuleId: firstModule?.id ?? "",
    starterSceneId,
    difficulty: "standard",
    pace: "standard",
    combatFrequency: "medium",
    netrunningEnabled: true,
    spoilerLevel: "player",
    runnerMode: "offline",
    enabledPackIds: ["builtin"],
  };
}

export function createDefaultRunnerState(): RunnerState {
  const settings = createDefaultSettings();
  return {
    configured: false,
    moduleId: settings.selectedModuleId,
    sceneId: settings.starterSceneId,
    mode: settings.runnerMode,
    turns: [],
  };
}

export function createDefaultCampaign(): Campaign {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Cyberpunk RED 单人战役",
    ruleset: "cyberpunk-red",
    createdAt: now,
    updatedAt: now,
    settings: createDefaultSettings(),
    character: createBlankCharacter(),
    currentScene: createDefaultScene(),
    missions: [
      {
        id: crypto.randomUUID(),
        title: "等待雇主",
        client: "未确认",
        target: "未确认",
        reward: "待谈",
        complication: "雇主隐瞒了至少一个关键信息。",
        status: "offered",
      },
    ],
    factions: [
      {
        id: crypto.randomUUID(),
        name: "NCPD",
        goal: "控制事态，不让街头丑闻扩大。",
        segments: 6,
        progress: 1,
        attitude: "wary",
      },
      {
        id: crypto.randomUUID(),
        name: "未知雇主",
        goal: "让边缘行者替自己承担风险。",
        segments: 4,
        progress: 0,
        attitude: "neutral",
      },
    ],
    npcs: [],
    combat: createDefaultCombat(),
    netrun: createDefaultNetrun(),
    oracleHistory: [],
    journal: [
      {
        id: crypto.randomUUID(),
        type: "note",
        title: "应用初始化",
        body: "已创建 Cyberpunk RED 单人跑团控制台。正式规则资料请通过资料包导入。",
        createdAt: now,
      },
    ],
    packs: [
      {
        manifest: {
          id: "builtin",
          name: "内置框架说明",
          version: "0.1.0",
          author: "Codex",
          ruleset: "cyberpunk-red",
          schemaVersion: 1,
          language: "zh-CN",
          ownershipNote: "仅包含应用说明、来源入口和用户导入边界。",
          licenseStatus: "homebrew",
          categories: ["rules-reference", "source"],
          importedAt: now,
        },
        entries: builtinEntries,
        enabled: true,
      },
    ],
    aiSettings: {
      enabled: false,
      apiBase: "/api/ai",
      model: "glm-4.7-flash",
      apiKey: "",
    },
    runner: createDefaultRunnerState(),
  };
}

export function appendJournal(
  campaign: Campaign,
  entry: Omit<Campaign["journal"][number], "id" | "createdAt">,
): Campaign {
  return {
    ...campaign,
    journal: [
      {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      ...campaign.journal,
    ],
  };
}
