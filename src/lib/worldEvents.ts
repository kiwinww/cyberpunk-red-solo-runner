import type { Campaign, FactionClock, Npc, WorldActionRecord, WorldImpact, WorldOutcome } from '../domain/types';
import { WORLD_HOOKS } from '../data/lore';
import { appendJournal } from './state';

const FACTION_ATTITUDES: FactionClock['attitude'][] = ['hostile', 'wary', 'neutral', 'useful', 'allied'];
const NPC_DISPOSITIONS: Npc['disposition'][] = ['hostile', 'cold', 'neutral', 'warm', 'loyal'];

function moveRank<T>(value: T, order: T[], delta: number): T {
  return order[Math.max(0, Math.min(order.length - 1, order.indexOf(value) + delta))];
}

function validateDelta(value: unknown): value is -1 | 0 | 1 | undefined {
  return value === undefined || value === -1 || value === 0 || value === 1;
}

/** Log the attempt without assuming whether the GM will award success. */
export function registerWorldAction(campaign: Campaign, hookId: string, action: string): Campaign {
  const hook = WORLD_HOOKS.find(entry => entry.id === hookId);
  if (!hook) return campaign;
  const record: WorldActionRecord = {
    id: crypto.randomUUID(), hookId,
    sceneId: campaign.currentScene.id, sceneTitle: campaign.currentScene.title,
    action, status: 'pending', createdAt: new Date().toISOString(),
  };
  return appendJournal({ ...campaign, worldHistory: [...(campaign.worldHistory ?? []), record] }, {
    type: 'note', title: `街区行动 · ${hook.title}`,
    body: `尝试：${action}\n涉及：${hook.theme}\n结果尚未结算，交由主持按现场情况确定。`,
  });
}

export interface WorldResolutionInput {
  outcome: WorldOutcome;
  consequence: string;
  impact?: WorldImpact;
}

export interface WorldResolutionResult { ok: boolean; campaign: Campaign; message: string }

/** Commit a single reviewed consequence. Never execute an AI-proposed numeric change automatically. */
export function resolveWorldAction(campaign: Campaign, actionId: string, input: WorldResolutionInput): WorldResolutionResult {
  const record = campaign.worldHistory?.find(item => item.id === actionId);
  if (!record) return { ok: false, campaign, message: '找不到这条街区行动。' };
  if (record.status === 'resolved') return { ok: false, campaign, message: '这条行动已结算，不能重复应用。' };
  if (!['progress', 'complication', 'setback'].includes(input.outcome)) return { ok: false, campaign, message: '无效的结果类型。' };
  const note = input.consequence.trim();
  if (!note || note.length > 500) return { ok: false, campaign, message: '请填写不超过500字的实际结果。' };
  const impact = input.impact ?? {};
  if (![impact.factionAttitudeDelta, impact.factionClockDelta, impact.npcDispositionDelta, impact.heatDelta].every(validateDelta)) {
    return { ok: false, campaign, message: '关系、时钟和热度的变化一次只能为 -1、0 或 +1。' };
  }
  if ((impact.factionAttitudeDelta || impact.factionClockDelta) && !campaign.factions.some(faction => faction.id === impact.factionId)) {
    return { ok: false, campaign, message: '请选择战役中已存在的势力。' };
  }
  if (impact.npcDispositionDelta && !campaign.npcs.some(npc => npc.id === impact.npcId)) {
    return { ok: false, campaign, message: '请选择战役中已存在的 NPC。' };
  }
  const now = new Date().toISOString();
  const factions = campaign.factions.map(faction => faction.id === impact.factionId ? {
    ...faction,
    attitude: moveRank(faction.attitude, FACTION_ATTITUDES, impact.factionAttitudeDelta ?? 0),
    progress: Math.max(0, Math.min(faction.segments, faction.progress + (impact.factionClockDelta ?? 0))),
  } : faction);
  const npcs = campaign.npcs.map(npc => npc.id === impact.npcId ? {
    ...npc,
    disposition: moveRank(npc.disposition, NPC_DISPOSITIONS, impact.npcDispositionDelta ?? 0),
  } : npc);
  const updated = {
    ...campaign,
    factions,
    npcs,
    currentScene: {
      ...campaign.currentScene,
      heat: Math.max(0, Math.min(10, campaign.currentScene.heat + (impact.heatDelta ?? 0))),
    },
    worldHistory: (campaign.worldHistory ?? []).map(item => item.id === actionId ? {
      ...item, status: 'resolved' as const, outcome: input.outcome, consequence: note, impact, resolvedAt: now,
    } : item),
  };
  const hookTitle = WORLD_HOOKS.find(hook => hook.id === record.hookId)?.title ?? record.hookId;
  return {
    ok: true, message: '事件已结算，影响将保存在战役中。',
    campaign: appendJournal(updated, {
      type: 'note', title: `世界后果 · ${hookTitle}`,
      body: `玩家行动：${record.action}\n结果：${input.outcome}\n实际后果：${note}\n状态变化：${JSON.stringify(impact)}`,
    }),
  };
}
