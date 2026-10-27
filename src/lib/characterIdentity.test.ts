import { expect,it } from 'vitest';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { changeCharacterGender,characterIdentitySummary } from './characterIdentity';
import { createDefaultCampaign } from './state';
import { exportCampaign,importCampaign } from './storage';

it('changes gender and default pronouns without altering RED mechanics or personal relationships',()=>{
  const base={...createBlankCharacter(),backgroundDetails:{friends:'艾琳：旧同事'}};
  const female=changeCharacterGender(base,'female');
  expect(female.pronouns).toBe('她');
  const male=changeCharacterGender(female,'male');
  expect(male.pronouns).toBe('他');
  expect(male.stats).toEqual(base.stats);expect(male.skills).toEqual(base.skills);
  expect(male.humanity).toEqual(base.humanity);expect(male.backgroundDetails).toEqual(base.backgroundDetails);
  expect(changeCharacterGender({...female,pronouns:'请称我夜莺'},'nonbinary').pronouns).toBe('请称我夜莺');
});
it('saves identity preferences and defaults old saves to unspecified',()=>{
  const c=createDefaultCampaign();c.character=changeCharacterGender(c.character,'female');
  expect(characterIdentitySummary(importCampaign(exportCampaign(c)).character)).toBe('女 · 称谓：她');
  delete c.character.gender;delete c.character.pronouns;
  expect(importCampaign(exportCampaign(c)).character.gender).toBe('unspecified');
});
it('preserves optional age without changing mechanics and rejects invalid saved ages',()=>{
  const c=createDefaultCampaign();c.character.age=32;
  const loaded=importCampaign(exportCampaign(c));
  expect(loaded.character.age).toBe(32);
  expect(loaded.character.stats).toEqual(c.character.stats);
  expect(characterIdentitySummary(loaded.character)).toContain('32岁');
  c.character.age=-1;
  expect(()=>importCampaign(exportCampaign(c))).toThrow();
});
