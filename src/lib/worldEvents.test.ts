import { describe, expect, it } from 'vitest';
import { createDefaultCampaign } from './state';
import { registerWorldAction, resolveWorldAction } from './worldEvents';
import { exportCampaign, importCampaign } from './storage';
import { worldPromptContext } from '../data/lore';

describe('world actions and reviewed consequences', () => {
  it('records the attempt without claiming success', () => {
    const campaign = createDefaultCampaign();
    const next = registerWorldAction(campaign, 'night-market', '联系夜市中间人');
    expect(next.worldHistory?.[0]?.hookId).toBe('night-market');
    expect(next.worldHistory?.[0]?.status).toBe('pending');
    expect(next.journal[0].body).toContain('结果尚未结算');
    expect(campaign.worldHistory).toBeUndefined();
  });

  it('requires a confirmed narrative and applies known faction/NPC effects once', () => {
    const campaign = createDefaultCampaign();
    campaign.npcs = [{ id: 'fixer', name: '联系人', role: 'fixer', want: '交货', leverage: '', disposition: 'neutral' }];
    const pending = registerWorldAction(campaign, 'night-market', '与中间人见面');
    const id = pending.worldHistory![0].id;
    const proposal = { outcome: 'complication' as const, consequence: '找到补给，但安保记住了我的长相。', impact: {
      factionId: pending.factions[0].id, factionAttitudeDelta: -1 as const, factionClockDelta: 1 as const,
      npcId: 'fixer', npcDispositionDelta: 1 as const, heatDelta: 1 as const,
    } };
    expect(resolveWorldAction(pending, id, { ...proposal, consequence: '' }).ok).toBe(false);
    const result = resolveWorldAction(pending, id, proposal);
    expect(result.ok).toBe(true);
    expect(result.campaign.factions[0].attitude).toBe('hostile');
    expect(result.campaign.factions[0].progress).toBe(pending.factions[0].progress + 1);
    expect(result.campaign.npcs[0].disposition).toBe('warm');
    expect(result.campaign.currentScene.heat).toBe(pending.currentScene.heat + 1);
    expect(result.campaign.worldHistory?.[0]?.status).toBe('resolved');
    expect(result.campaign.journal[0].title).toContain('世界后果');
    expect(resolveWorldAction(result.campaign, id, proposal).ok).toBe(false);
    expect(pending.npcs[0].disposition).toBe('neutral');
    const restored = importCampaign(exportCampaign(result.campaign));
    expect(restored.worldHistory?.[0].consequence).toContain('安保');
    expect(worldPromptContext(restored, '')).toContain('安保记住了我的长相');
    expect(worldPromptContext(restored, '')).toContain('confirmed');
  });

  it('rejects changes to missing targets, invalid deltas and caps heat/clocks', () => {
    const campaign = createDefaultCampaign();
    campaign.currentScene.heat = 10;
    campaign.factions[0].progress = campaign.factions[0].segments;
    const pending = registerWorldAction(campaign, 'gang-turf', '打听这里的规矩');
    const id = pending.worldHistory![0].id;
    expect(resolveWorldAction(pending, id, { outcome: 'progress', consequence: '找到联系人', impact: { factionId: 'missing', factionClockDelta: 1 } }).ok).toBe(false);
    expect(resolveWorldAction(pending, id, { outcome: 'progress', consequence: '找到联系人', impact: { heatDelta: 5 as 1 } }).ok).toBe(false);
    const result = resolveWorldAction(pending, id, { outcome: 'progress', consequence: '找到联系人', impact: { factionId: pending.factions[0].id, factionClockDelta: 1, heatDelta: 1 } });
    expect(result.ok).toBe(true);
    expect(result.campaign.factions[0].progress).toBe(campaign.factions[0].segments);
    expect(result.campaign.currentScene.heat).toBe(10);
  });

  it('treats old saves with missing status as pending', () => {
    const pending = registerWorldAction(createDefaultCampaign(), 'street-life', '观察路人');
    const old = { ...pending, worldHistory: pending.worldHistory!.map(({ status: _status, ...rest }) => rest) };
    const restored = importCampaign(exportCampaign(old));
    expect(resolveWorldAction(restored, restored.worldHistory![0].id, { outcome: 'setback', consequence: '无人理会' }).ok).toBe(true);
  });
});
