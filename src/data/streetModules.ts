import adventures from './streetAdventures.json';
import { ModuleSource } from '../domain/types';
import { streetBackgrounds } from './streetBackgrounds';
import sceneIndex from './streetSceneIndex.json';
import { playProfile } from './modulePlayProfiles';
import openingRoutes from './streetOpeningRoutes.json';

export const streetModules: ModuleSource[] = adventures.map((adventure, index) => {
  const sourceId = 'red-streets-20261010';
  const ref = { sourceId, label: `街头故事 · PDF ${adventure.start}-${adventure.end} 页`, page: adventure.start };
  return {
    id: adventure.id,
    title: `${adventure.title}（街头故事）`,
    sourceAssetId: sourceId,
    licenseStatus: 'public-preview',
    summary: `来自你提供的街头故事预览版，PDF ${adventure.start}-${adventure.end} 页。`,
    background: {
      ...streetBackgrounds[index],
      sourceRefs: [{ sourceId, page: adventure.start + 1, label: `玩家背景 · PDF ${adventure.start + 1} 页` }],
      gmNotes: ['秘密、敌方与结局由 AI 在需要时检索，玩家可随时查阅原 PDF。'],
    },
    starterSceneId: `${adventure.id}-intro`,
    playTimeHint: '可暂停并保存；时长由行动与原模组决定。',
    sourceRefs: [ref],
    maps: [],
    scenes: [{
      id: `${adventure.id}-intro`, moduleId: adventure.id, title: '引子',
      phase: 'intro', spoilerLevel: 'player', location: playProfile(adventure.id).location,
      objective: `确认${playProfile(adventure.id).focus}。`,
      pressure: 1, heat: 0, maps: [], npcBlocks: ['人物以当前原文场景为准'],
      pageRefs: [{ sourceId, page: adventure.intro, label: `原文引子 · PDF ${adventure.intro} 页` }],
      starterPrompt: streetBackgrounds[index].openingHook,
      nextSceneIds: openingRoutes[adventure.id as keyof typeof openingRoutes],
    }, ...sceneIndex[adventure.id as keyof typeof sceneIndex].map(entry => ({
      id: entry.id, moduleId: adventure.id, title: entry.title,
      phase: entry.phase as ModuleSource['scenes'][number]['phase'], spoilerLevel: 'gm-index' as const,
      location: '以当前场景原文确认',
      objective: `查阅「${entry.title}」并确认进入条件${entry.optional ? '；这是可选分支' : ''}。`,
      pressure: 1, heat: 0, maps: [], npcBlocks: ['仅使用本场景已登场人物'],
      pageRefs: [{ sourceId, page: entry.page, label: `场景索引 · PDF ${entry.page} 页` }],
      starterPrompt: '先核实上一场景的真实结果与本场景进入条件。目录顺序不等于必经路线，不自动完成任务、结算报酬或揭示其他分支。',
      nextSceneIds: entry.nextSceneIds,
    }))],
  };
});
