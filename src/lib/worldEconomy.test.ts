import { describe, expect, it } from 'vitest';
import { createDefaultCampaign } from './state';
import { buyStreetItem } from './worldEconomy';

describe('street market transactions', () => {
  it('deducts funds and adds gear with an auditable purchase record', () => {
    const c = createDefaultCampaign(); c.character.eurobucks = 100;
    const result = buyStreetItem(c, 'first-aid');
    expect(result.ok).toBe(true);
    expect(result.campaign.character.eurobucks).toBe(50);
    expect(result.campaign.character.gear).toContain('基础医疗用品');
    expect(result.campaign.character.purchases?.[0]?.cost).toBe(50);
    expect(c.character.eurobucks).toBe(100);
  });
  it('cannot spend beyond available cash', () => {
    const c = createDefaultCampaign(); c.character.eurobucks = 0;
    const result = buyStreetItem(c, 'first-aid');
    expect(result.ok).toBe(false);
    expect(result.campaign).toBe(c);
  });
  it('does not add narrative services as inventory gear', () => {
    const c = createDefaultCampaign(); c.character.eurobucks = 100;
    const next = buyStreetItem(c, 'ride').campaign;
    expect(next.character.gear).toEqual(c.character.gear);
  });
});
