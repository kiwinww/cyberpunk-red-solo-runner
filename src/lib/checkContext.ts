import type { CharacterSheet } from '../domain/types';

export function woundPenalty(character: CharacterSheet): number {
  if(character.hp.current<1) return 4;
  return character.hp.current<Math.ceil(character.hp.max/2)?2:0;
}
