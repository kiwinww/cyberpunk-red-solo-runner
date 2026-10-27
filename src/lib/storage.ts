import { Campaign } from "../domain/types";
import { createDefaultCampaign } from "./state";
import { migrateHumanityCeiling } from "./humanity";
import { repairRunnerScene } from './runner';

export const STORAGE_KEY = "cyberpunk-red-solo-runner:v1";
const CHECKPOINT_KEY = 'cyberpunk-red-solo-runner:checkpoint:v1';
const SLOTS_KEY = 'cyberpunk-red-solo-runner:slots:v1';
const PREPARATION_KEY = 'cyberpunk-red-solo-runner:preparation:v1';
export type Preparation = Pick<Campaign, 'name' | 'settings' | 'character' | 'aiSettings'>;
export interface SaveSlot { id: string; name: string; savedAt: string; campaign: Campaign }

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const str = (value: unknown): value is string => typeof value === 'string';
const list = (value: unknown): value is unknown[] => Array.isArray(value);
const validCheck=(value:unknown):boolean=>record(value) && str(value.reason)
  && (value.skillId===undefined || str(value.skillId))
  && (value.dv===undefined || (numeric(value.dv) && Number.isInteger(value.dv) && value.dv>0 && value.dv<=99))
  && (value.modifier===undefined || (numeric(value.modifier) && Number.isInteger(value.modifier)))
  && (value.sourcePage===undefined || (numeric(value.sourcePage) && Number.isInteger(value.sourcePage) && value.sourcePage>0))
  && (value.condition===undefined || ['standard','visual','auditory'].includes(String(value.condition)));

/** Reject malformed imports before merging legacy optional fields with defaults. */
function validateCampaign(source: unknown): asserts source is Campaign {
  const error = (field: string): never => { throw new Error(`存档结构无效：${field}。当前战役未被修改。`); };
  if (!record(source) || source.ruleset !== 'cyberpunk-red') error('ruleset');
  const c = source as Record<string, unknown>;
  if (!str(c.id) || !c.id || !str(c.name) || !str(c.createdAt) || !str(c.updatedAt)) error('战役基本信息');
  if(c.activeSaveSlotId!==undefined && (!str(c.activeSaveSlotId) || !c.activeSaveSlotId.trim())) error('当前存档槽');
  if(c.playerNotes!==undefined && !str(c.playerNotes)) error('玩家线索笔记');
  if (!record(c.character)) error('character');
  const ch = c.character as Record<string, unknown>;
  if (!str(ch.id) || !str(ch.handle) || !str(ch.role) || !numeric(ch.rank)) error('人物基本信息');
  if(ch.age!==undefined && (!Number.isSafeInteger(ch.age) || Number(ch.age)<1)) error('人物年龄');
  if(ch.gender!==undefined && !['unspecified','male','female','nonbinary'].includes(String(ch.gender))) error('人物性别');
  if(ch.pronouns!==undefined && (!str(ch.pronouns) || ch.pronouns.length>80)) error('人物称谓');
  if (!record(ch.stats) || !['int','ref','dex','tech','cool','will','luck','move','body','emp'].every(k => numeric((ch.stats as Record<string, unknown>)[k]))) error('character.stats');
  if (!list(ch.skills) || !ch.skills.every(s => record(s) && str(s.skillId) && numeric(s.level) && (s.modifier === undefined || numeric(s.modifier)))) error('character.skills');
  if (!record(ch.hp) || !['current','max','seriouslyWoundedAt','deathSave'].every(k => numeric((ch.hp as Record<string, unknown>)[k]))) error('character.hp');
  if (!record(ch.humanity) || !['current','max'].every(k => numeric((ch.humanity as Record<string, unknown>)[k]))) error('character.humanity');
  if (!record(ch.armor) || !['headSp','bodySp'].every(k => numeric((ch.armor as Record<string, unknown>)[k]))) error('character.armor');
  for (const k of ['weapons','cyberware','gear']) if (!list(ch[k]) || !ch[k].every(str)) error(`character.${k}`);
  for (const k of ['eurobucks','improvementPoints']) if (!numeric(ch[k])) error(`character.${k}`);
  for (const k of ['lifepathNotes','notes']) if (!str(ch[k])) error(`character.${k}`);
  if (ch.purchases !== undefined && (!list(ch.purchases) || !ch.purchases.every(p => record(p) && str(p.id) && str(p.title) && numeric(p.cost) && ['fashion','general'].includes(String(p.budget))))) error('character.purchases');
  if (list(ch.purchases) && ch.purchases.some(p=>record(p) && p.groupId!==undefined && (!str(p.groupId) || !p.groupId.trim()))) error('character.purchases 成对记录');
  if (list(ch.purchases) && (new Set(ch.purchases.map(p => (p as Record<string, unknown>).id)).size !== ch.purchases.length || ch.purchases.some(p => !record(p) || !Number.isSafeInteger(p.cost) || Number(p.cost) < 0 || (p.humanityLoss !== undefined && (!numeric(p.humanityLoss) || p.humanityLoss < 0))))) error('character.purchases 金额或重复ID');
  if (ch.cyberwareInstallations !== undefined && (!list(ch.cyberwareInstallations) || !ch.cyberwareInstallations.every(p => record(p) && str(p.purchaseId) && str(p.catalogId) && str(p.slot) && numeric(p.humanityLoss)))) error('character.cyberwareInstallations');
  if (ch.backgroundDetails !== undefined && (!record(ch.backgroundDetails) || !Object.values(ch.backgroundDetails).every(str))) error('character.backgroundDetails');
  if (ch.roleAllocations !== undefined && (!record(ch.roleAllocations) || !Object.values(ch.roleAllocations).every(numeric))) error('character.roleAllocations');
  if (ch.armorPurchaseBaseline !== undefined && (!record(ch.armorPurchaseBaseline) || !numeric(ch.armorPurchaseBaseline.headSp) || !numeric(ch.armorPurchaseBaseline.bodySp))) error('character.armorPurchaseBaseline');
  if (c.settings !== undefined && (!record(c.settings) || !str(c.settings.selectedModuleId) || !str(c.settings.starterSceneId) || !['ai','offline'].includes(String(c.settings.runnerMode)) || !list(c.settings.enabledPackIds) || !c.settings.enabledPackIds.every(str) ||
    (c.settings.difficulty !== undefined && !['easy','standard','hard'].includes(String(c.settings.difficulty))) ||
    (c.settings.netrunningEnabled !== undefined && typeof c.settings.netrunningEnabled !== 'boolean'))) error('settings');
  if (!record(c.currentScene) || !str(c.currentScene.id) || !str(c.currentScene.title) || !str(c.currentScene.location) || !str(c.currentScene.objective) || !numeric(c.currentScene.pressure) || !numeric(c.currentScene.heat) || !list(c.currentScene.threads) || !c.currentScene.threads.every(str) || !['open','resolved','failed'].includes(String(c.currentScene.status))) error('currentScene');
  for (const k of ['missions','factions','npcs','oracleHistory','journal','packs']) {
    if (!list(c[k]) || !c[k].every(record)) error(k);
  }
  const checked = c as unknown as Campaign;
  if (!checked.missions.every(m => str(m.id) && str(m.title) && str(m.client) && str(m.target) && str(m.reward) && str(m.complication) && ['offered','active','completed','burned'].includes(String(m.status)))) error('missions');
  if (!checked.factions.every(f => str(f.id) && str(f.name) && str(f.goal) && numeric(f.segments) && numeric(f.progress) && ['hostile','wary','neutral','useful','allied'].includes(String(f.attitude)))) error('factions');
  if (!checked.npcs.every(n => str(n.id) && str(n.name) && str(n.role) && str(n.want) && str(n.leverage) && ['hostile','cold','neutral','warm','loyal'].includes(String(n.disposition)))) error('npcs');
  if (!checked.journal.every(j => str(j.id) && str(j.title) && str(j.body) && str(j.createdAt) && (j.moduleId===undefined || str(j.moduleId)) && (j.sceneId===undefined || str(j.sceneId)) && ['scene','oracle','combat','netrunning','import','ai','note'].includes(String(j.type)))) error('journal');
  if (!checked.packs.every(p => record(p.manifest) && str(p.manifest.id) && list(p.entries) && p.entries.every(record))) error('packs');
  if (!checked.oracleHistory.every(r => str(r.id) && str(r.question) && numeric(r.die) && str(r.createdAt))) error('oracleHistory');
  if (!record(c.combat) || typeof c.combat.active !== 'boolean' || !numeric(c.combat.round) || !numeric(c.combat.turnIndex) || !list(c.combat.combatants) || !c.combat.combatants.every(record)) error('combat');
  if (!record(c.netrun) || typeof c.netrun.active !== 'boolean' || !numeric(c.netrun.floor) || !numeric(c.netrun.alarms) || !str(c.netrun.objective) || !str(c.netrun.notes) || !list(c.netrun.blackIce) || !c.netrun.blackIce.every(str)) error('netrun');
  if (c.runner !== undefined && (!record(c.runner) || typeof c.runner.configured !== 'boolean' || !str(c.runner.moduleId) || !str(c.runner.sceneId) || !['ai','offline'].includes(String(c.runner.mode)) || !list(c.runner.turns) || !c.runner.turns.every(t => record(t) && str(t.id) && str(t.body) && str(t.speaker) && str(t.createdAt) && (t.logSummary===undefined || str(t.logSummary)) && ['system','player','gm','oracle','check','log'].includes(String(t.type)) &&
     (t.pending === undefined || (typeof t.pending === 'boolean' && (!t.pending || str(t.pendingIntent)))) &&
     (t.choices === undefined || (list(t.choices) && t.choices.every(ch => record(ch) && str(ch.id) && str(ch.label) && str(ch.intent) && (ch.detail===undefined || str(ch.detail)))))))) error('runner');
  if (c.runner !== undefined && record(c.runner) && list(c.runner.turns) && c.runner.turns.some(t => !record(t) || (t.responseState !== undefined && t.responseState !== 'failed') || (t.responseState === 'failed' && (!str(t.pendingIntent) || !t.pendingIntent.trim())) || (t.pendingChoice !== undefined && (!record(t.pendingChoice) || !str(t.pendingChoice.intent) || !str(t.pendingChoice.label) || !str(t.pendingChoice.kind))))) error('runner 恢复信息');
  if(c.runner!==undefined && record(c.runner) && list(c.runner.turns) && c.runner.turns.some(t=>record(t) && t.checkResult!==undefined && (!record(t.checkResult) || !str(t.checkResult.skillName) || !numeric(t.checkResult.total) || !numeric(t.checkResult.dv) || typeof t.checkResult.success!=='boolean'))) error('runner 判定结果');
  if(c.runner!==undefined && record(c.runner) && c.runner.resolutions!==undefined && (!list(c.runner.resolutions) || !c.runner.resolutions.every(r=>record(r) && str(r.moduleId) && str(r.sceneId) && str(r.summary) && str(r.createdAt) && ['success','failure','mixed','no-check'].includes(String(r.outcome))))) error('场景进展');
  if(c.runner!==undefined && record(c.runner) && list(c.runner.turns) && c.runner.turns.some(t=>record(t) && t.retryAt!==undefined && (!numeric(t.retryAt) || t.retryAt<0))) error('AI 重试时间');
  if(c.runner!==undefined && record(c.runner) && list(c.runner.turns) && c.runner.turns.some(t=>record(t) && ((t.checkRequest!==undefined && !validCheck(t.checkRequest)) || (t.checkSuggestions!==undefined && (!list(t.checkSuggestions) || !t.checkSuggestions.every(validCheck)))))) error('主持判定建议');
  if (!record(c.aiSettings) || typeof c.aiSettings.enabled !== 'boolean' || !str(c.aiSettings.apiBase) || !str(c.aiSettings.model) || (c.aiSettings.fastMode!==undefined && typeof c.aiSettings.fastMode!=='boolean')) error('aiSettings');
  if (c.worldHistory !== undefined && (!list(c.worldHistory) || !c.worldHistory.every(record))) error('worldHistory');
  if (c.storyEdits !== undefined && (!record(c.storyEdits) || !Object.values(c.storyEdits).every(str))) error('storyEdits');
}

export function listSaveSlots(): SaveSlot[] {
  const raw = window.localStorage.getItem(SLOTS_KEY);
  if (raw !== null) {
    const values: unknown = JSON.parse(raw);
    if (!list(values)) throw new Error('存档列表格式错误，请先导出备份。');
    return values.map(slot => {
      if (!record(slot) || !str(slot.id) || !str(slot.name) || !str(slot.savedAt)) throw new Error('存档条目格式错误。');
      return { id: slot.id, name: slot.name, savedAt: slot.savedAt, campaign: {...importCampaign(JSON.stringify(slot.campaign)),activeSaveSlotId:slot.id} };
    });
  }
  try {
    const legacy = window.localStorage.getItem(CHECKPOINT_KEY);
    if (!legacy) return [];
    const campaign = importCampaign(legacy);
    return [{ id: 'legacy-checkpoint', name: campaign.name, savedAt: campaign.updatedAt, campaign:{...campaign,activeSaveSlotId:'legacy-checkpoint'} }];
  } catch { return []; }
}

export function deleteSaveSlot(id: string): void {
  window.localStorage.setItem(SLOTS_KEY, JSON.stringify(listSaveSlots().filter(slot => slot.id !== id)));
}

export function saveLocalCheckpoint(campaign: Campaign, name?: string): Campaign {
  const id=crypto.randomUUID();
  const saved: Campaign = JSON.parse(exportCampaign({...campaign,activeSaveSlotId:id}));
  const slot = { id, name: name?.trim() || `${campaign.character.handle} · ${campaign.currentScene.title}`, savedAt: saved.updatedAt, campaign: saved };
  window.localStorage.setItem(SLOTS_KEY, JSON.stringify([slot, ...listSaveSlots()]));
  return saved;
}

export function saveCurrentCheckpoint(campaign: Campaign, asNew=false): Campaign {
  const slots=listSaveSlots();
  const active=slots.find(slot=>slot.id===campaign.activeSaveSlotId && slot.campaign.id===campaign.id);
  if(asNew || !active) return saveLocalCheckpoint(campaign);
  const saved:Campaign=JSON.parse(exportCampaign(campaign));
  const updated={...active,savedAt:saved.updatedAt,campaign:saved};
  window.localStorage.setItem(SLOTS_KEY,JSON.stringify([updated,...slots.filter(slot=>slot.id!==active.id)]));
  return saved;
}

export function loadLocalCheckpoint(): Campaign | null {
  try { return listSaveSlots()[0]?.campaign ?? null; } catch { return null; }
}

export function loadPreparation(campaign: Campaign): Preparation {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREPARATION_KEY) ?? 'null');
    if (raw?.campaignId === campaign.id && raw.draft) {
      const merged = importCampaign(JSON.stringify({ ...campaign, ...raw.draft }));
      return { name: merged.name, settings: merged.settings, character: merged.character, aiSettings: merged.aiSettings };
    }
  } catch { /* Preserve existing character if setup draft cannot be read. */ }
  return { name: campaign.name, settings: campaign.settings, character: campaign.character, aiSettings: campaign.aiSettings };
}
export function savePreparation(campaignId: string, draft: Preparation): void {
  window.localStorage.setItem(PREPARATION_KEY, JSON.stringify({ campaignId, draft: { ...draft, aiSettings: { ...draft.aiSettings, apiKey: "" } } }));
}
export function clearPreparation(): void { window.localStorage.removeItem(PREPARATION_KEY); }

/** Throws on corruption: callers MUST NOT replace the corrupt bytes through autosave. */
export function loadCampaign(): Campaign {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? createDefaultCampaign() : importCampaign(raw);
}

export function saveCampaign(campaign: Campaign): void {
  window.localStorage.setItem(STORAGE_KEY, exportCampaign(campaign));
}
export function exportCampaign(campaign: Campaign): string {
  return JSON.stringify({ ...campaign, aiSettings: { ...campaign.aiSettings, apiKey: "" }, updatedAt: new Date().toISOString() }, null, 2);
}
export function rawCampaignBackup(): string | null { return window.localStorage.getItem(STORAGE_KEY); }
export function clearCorruptedCampaign(): void { window.localStorage.removeItem(STORAGE_KEY); }
export function importCampaign(raw: string): Campaign {
  const parsed: unknown = JSON.parse(raw);
  validateCampaign(parsed);
  const defaults = createDefaultCampaign();
  return repairRunnerScene({
    ...defaults,
    ...parsed,
    character: migrateHumanityCeiling({ ...defaults.character, ...parsed.character }),
    settings: { ...defaults.settings, ...parsed.settings },
    aiSettings: { ...defaults.aiSettings, ...parsed.aiSettings, apiKey: "" },
    runner: { ...defaults.runner, ...parsed.runner, turns: (parsed.runner?.turns ?? defaults.runner.turns).map((turn, index, turns) => {
      if (index === turns.length - 1 && turn.type === 'system' && turn.speaker === '连接中断' && !turn.responseState && !turn.pending) {
        const player = [...turns.slice(0, index)].reverse().find(t => t.type === 'player');
        if (player) return { ...turn, responseState: 'failed' as const, pendingIntent: player.body };
      }
      return turn;
    }) },
  });
}
