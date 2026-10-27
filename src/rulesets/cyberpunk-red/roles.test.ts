import { describe, expect, it } from 'vitest';
import { createBlankCharacter } from './index';
import { fillCreationPoints, validateCharacter } from './character';
import { roleSkillBonus, ROLE_GUIDES } from './roles';

describe('role abilities and initial funds', () => {
  it('provides ten sourced abilities and applies only matching role bonuses', () => {
    expect(Object.keys(ROLE_GUIDES)).toHaveLength(10);
    const character = createBlankCharacter();
    character.role = '游民';
    expect(roleSkillBonus(character, 'drive-land-vehicle')).toBe(4);
    expect(roleSkillBonus(character, 'handgun')).toBe(0);
    character.role = '中间人';
    expect(roleSkillBonus(character, 'trading')).toBe(4);
    expect(roleSkillBonus(character, 'persuasion')).toBe(0);
  });
  it('validates the solo pool and discrete specialization costs', () => {
    const character = fillCreationPoints(createBlankCharacter());
    character.roleAllocations = { precision: 3, threat: 1 };
    expect(validateCharacter(character, true).errors).toEqual([]);
    expect(roleSkillBonus(character, 'handgun')).toBe(1);
    expect(roleSkillBonus(character, 'perception')).toBe(1);
    character.roleAllocations = { precision: 4, threat: 1 };
    expect(validateCharacter(character, true).errors.length).toBeGreaterThan(0);
  });
  it('requires allocating tech and medtech specialization points during creation', () => {
    const character = fillCreationPoints(createBlankCharacter());
    character.role = '技工';
    expect(validateCharacter(character, true).errors.length).toBeGreaterThan(0);
    character.roleAllocations = { field: 4, fabrication: 4 };
    expect(validateCharacter(character, true).errors).toEqual([]);
    character.role = '技医'; character.roleAllocations = { surgery: 2, pharma: 2 };
    expect(validateCharacter(character, true).errors).toEqual([]);
  });
  it('keeps general and fashion funds separate, while campaign wealth is not capped', () => {
    const character = fillCreationPoints(createBlankCharacter());
    character.purchases = [{ id: '1', title: '装备', cost: 500, budget: 'general' }, { id: '2', title: '时装', cost: 800, budget: 'fashion' }];
    character.eurobucks = 2050;
    expect(validateCharacter(character, true).errors).toEqual([]);
    character.eurobucks = 2550;
    expect(validateCharacter(character, true).errors).toContain('通用支出加欧币余额不能超过 2550eb。');
    character.purchases[1].cost = 801;
    expect(validateCharacter(character, true).errors.some(error => error.includes('800eb'))).toBe(true);
    character.eurobucks = 100000;
    expect(validateCharacter(character, false).errors).toEqual([]);
  });
});
