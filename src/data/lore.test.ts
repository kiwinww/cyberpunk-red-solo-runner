import { describe, expect, it } from 'vitest';
import { createDefaultCampaign } from '../lib/state';
import { getContextualWorldHooks, worldPromptContext } from './lore';

describe('world setting in actual gameplay', () => {
  it('surfaces equipment supply when the player tries to shop', () => {
    const campaign = createDefaultCampaign();
    expect(getContextualWorldHooks(campaign, '我想买装备')[0].id).toBe('night-market');
  });
  it('uses local-net architecture for hacking actions', () => {
    const campaign = createDefaultCampaign();
    expect(getContextualWorldHooks(campaign, '黑客入侵监控')[0].id).toBe('data-is-local');
  });
  it('labels later game content as inspiration, with a firm RED rules boundary', () => {
    const context = worldPromptContext(createDefaultCampaign(), '调查街头');
    expect(context).toContain('2045');
    expect(context).toContain('不可使用2077电子游戏');
  });
});
