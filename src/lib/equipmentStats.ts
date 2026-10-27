import type { CharacterSheet } from '../domain/types';
import { getShopItem } from '../data/creationCatalog';

/** Catalog armor is currently added as worn armor; head/body penalties never stack. */
export function armorPenalty(character: CharacterSheet): number {
  return Math.max(0,...(character.purchases??[]).map(p=>getShopItem(p.catalogId??'')).filter(item=>item?.category==='armor').map(item=>item?.armorPenalty??0));
}
export function equipmentStats(character: CharacterSheet) {
  const penalty=armorPenalty(character);
  return {...character.stats,ref:Math.max(0,character.stats.ref-penalty),dex:Math.max(0,character.stats.dex-penalty),move:Math.max(0,character.stats.move-penalty)};
}
