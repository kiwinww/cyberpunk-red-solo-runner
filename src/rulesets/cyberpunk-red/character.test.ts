import { describe, expect, it } from 'vitest';
import { createBlankCharacter, RED_SKILLS } from './index';
import { changeAttribute, effectiveEmpathy, fillCreationPoints, resetCreationAttributes, validateCharacter } from './character';

describe('document based complete package creation', () => {
  it('resets only attribute allocation and recomputes humanity without deducting the ceiling twice',()=>{
    const character=fillCreationPoints(createBlankCharacter());
    character.cyberwareInstallations=[{purchaseId:'eye',catalogId:'cybereye',slot:'leftEye',humanityLoss:7}];
    character.gear=['保留装备'];character.eurobucks=1234;
    const reset=resetCreationAttributes(character);
    expect(Object.values(reset.stats)).toEqual(Array(10).fill(2));
    expect(reset.gear).toEqual(character.gear);expect(reset.skills).toEqual(character.skills);
    expect(reset.eurobucks).toBe(1234);expect(reset.cyberwareInstallations).toEqual(character.cyberwareInstallations);
    expect(reset.humanity).toEqual({current:13,max:18});
    expect(changeAttribute(reset,'emp',6,true).humanity).toEqual({current:53,max:58});
  });
  it('fills an unfinished sheet within the documented point limits', () => {
    const character = fillCreationPoints(createBlankCharacter());
    const result = validateCharacter(character, true);
    expect(result.errors).toEqual([]);
    expect(result.attributePoints).toBe(62);
    expect(result.skillPoints).toBe(86);
  });
  it('rejects fractional stats, overlimits and missing required skills', () => {
    const character = fillCreationPoints(createBlankCharacter());
    character.stats.body = 8.5;
    character.skills.find(s => s.skillId === 'athletics')!.level = 1;
    character.skills.find(s => s.skillId === 'handgun')!.level = 7;
    expect(validateCharacter(character, true).errors).toEqual(expect.arrayContaining([expect.stringContaining('BODY'), expect.stringContaining('运动'), expect.stringContaining('手枪')]));
  });
  it('charges x2 skills and exempts only the cultural language', () => {
    const character = fillCreationPoints(createBlankCharacter());
    const before = validateCharacter(character, true).skillPoints;
    character.skills.find(s => s.skillId === 'autofire')!.level++;
    expect(validateCharacter(character, true).skillPoints).toBe(before + 2);
    character.skills.find(s => s.skillId === 'language')!.level++;
    expect(validateCharacter(character, true).skillPoints).toBe(before + 3);
  });
  it('keeps damage and humanity losses when unrelated attributes change', () => {
    const character = fillCreationPoints(createBlankCharacter());
    character.hp.current -= 12;
    character.humanity.current -= 19;
    const changed = changeAttribute(character, 'int', 7, false);
    expect(changed.hp.current).toBe(character.hp.current);
    expect(changed.humanity.current).toBe(character.humanity.current);
    const stronger = changeAttribute(character, 'body', character.stats.body + 2, false);
    expect(stronger.hp.max - stronger.hp.current).toBe(12);
  });
  it('permits growth and cyberware stats without imposing a creation budget', () => {
    const character = fillCreationPoints(createBlankCharacter());
    character.stats.body = 12;
    character.skills.find(s => s.skillId === 'handgun')!.level = 10;
    character.humanity.current = -1;
    expect(validateCharacter(character, false).errors).toEqual([]);
    expect(validateCharacter(character, true).errors.length).toBeGreaterThan(0);
    expect(effectiveEmpathy(character)).toBe(0);
  });
  it('preserves an existing humanity maximum reduction when base empathy changes', () => {
    const character = createBlankCharacter();
    character.humanity = { current: 30, max: 40 };
    const changed = changeAttribute(character, 'emp', 6, false);
    expect(changed.humanity).toEqual({ current: 30, max: 50 });
  });
  it('rejects duplicate skills, excessive HP and creation money', () => {
    const character = fillCreationPoints(createBlankCharacter());
    character.skills.push(character.skills[0]);
    character.hp.current = character.hp.max + 1;
    character.eurobucks = 3350;
    expect(validateCharacter(character, true).errors.length).toBeGreaterThanOrEqual(3);
    expect(RED_SKILLS.find(s => s.id === 'composition')?.linkedStat).toBe('int');
  });
});
