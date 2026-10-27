import { expect,it } from 'vitest';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { woundPenalty } from './checkContext';

it('applies wound penalties at the strict thresholds from PDF186',()=>{
  const character=createBlankCharacter();
  expect(woundPenalty(character)).toBe(0);
  expect(woundPenalty({...character,hp:{...character.hp,current:character.hp.seriouslyWoundedAt}})).toBe(0);
  expect(woundPenalty({...character,hp:{...character.hp,current:character.hp.seriouslyWoundedAt-1}})).toBe(2);
  expect(woundPenalty({...character,hp:{...character.hp,current:0}})).toBe(4);
});
