import { CharacterSheet, StatKey } from '../../domain/types';
import { RED_ROLES, RED_SKILLS, deriveHp, deriveHumanity } from './index';
import { ROLE_ALLOCATION_FIELDS } from './roles';
import { cyberwareMaximumPenalty } from '../../lib/humanity';

export const REQUIRED_SKILLS = ['athletics', 'brawling', 'concentration', 'conversation', 'education', 'evasion', 'first-aid', 'human-perception', 'street-slang', 'local-expert-home', 'perception', 'persuasion', 'stealth'];

export function validateCharacter(character: CharacterSheet, creation: boolean) {
  const errors: string[] = [];
  const attributePoints = Object.values(character.stats).reduce((a, b) => a + b, 0);
  const skillPoints = character.skills.reduce((sum, skill) => sum + skill.level * (skill.skillId === 'culture-language' ? 0 : RED_SKILLS.find(s => s.id === skill.skillId)?.multiplier ?? 1), 0);
  if (!character.handle.trim()) errors.push('请填写角色代号。');
  if (!RED_ROLES.includes(character.role)) errors.push('身份不在正式身份列表中。');
  for (const [key, value] of Object.entries(character.stats)) {
    if (!Number.isInteger(value) || value < (creation ? 2 : 0) || (creation && value > 8)) errors.push(`${key.toUpperCase()} 必须为${creation ? '2–8' : '非负'}整数。`);
  }
  if (!Number.isInteger(character.rank) || character.rank < 1 || character.rank > 10 || (creation && character.rank !== 4)) errors.push(creation ? '基础建卡身份能力等级为 4。' : '身份等级须为 1–10。');
  const seen = new Set<string>();
  for (const skill of character.skills) {
    if (seen.has(skill.skillId)) errors.push(`技能重复：${skill.skillId}`);
    seen.add(skill.skillId);
    if (!RED_SKILLS.some(s => s.id === skill.skillId)) errors.push(`未知技能：${skill.skillId}，请先完成资料映射。`);
    if (!Number.isInteger(skill.level) || skill.level < 0 || skill.level > (creation ? 6 : 10)) errors.push(`${RED_SKILLS.find(s => s.id === skill.skillId)?.name ?? skill.skillId} 等级须为 0–${creation ? 6 : 10}。`);
  }
  if (creation) {
    if (attributePoints !== 62) errors.push(`属性已分配 ${attributePoints}/62 点。`);
    if (skillPoints !== 86) errors.push(`技能已分配 ${skillPoints}/86 点（×2 技能双倍计费）。`);
    for (const id of REQUIRED_SKILLS) if ((character.skills.find(s => s.skillId === id)?.level ?? 0) < 2) errors.push(`${RED_SKILLS.find(s => s.id === id)?.name} 至少 2 级。`);
    if (character.skills.find(s => s.skillId === 'culture-language')?.level !== 4) errors.push('文化背景语言免费获得 4 级，须与付费语言分开登记。');
  }
  if (!Number.isFinite(character.hp.current) || character.hp.current < 0 || character.hp.current > character.hp.max) errors.push('当前 HP 必须介于 0 与最大 HP 之间。');
  if (!Number.isFinite(character.humanity.current) || character.humanity.current > character.humanity.max) errors.push('当前人性不得高于人性上限。');
  for (const value of [character.armor.headSp, character.armor.bodySp, character.eurobucks, character.improvementPoints]) if (!Number.isInteger(value) || value < 0) errors.push('护甲、欧币及成长点须为非负整数。');
  if (creation && character.eurobucks > 2550) errors.push('基础完整定制的通用购置资金最多 2550eb；服饰专项资金不能并入余额。');
  const purchases = character.purchases ?? [];
  if (purchases.some(item => !item.title.trim() || !Number.isInteger(item.cost) || item.cost < 0 || !['general', 'fashion'].includes(item.budget))) errors.push('购置记录需要名称、非负整数金额与有效资金来源。');
  if (creation && purchases.filter(p => p.budget === 'general').reduce((n, p) => n + p.cost, 0) + character.eurobucks > 2550) errors.push('通用支出加欧币余额不能超过 2550eb。');
  if (creation && purchases.filter(p => p.budget === 'fashion').reduce((n, p) => n + p.cost, 0) > 800) errors.push('时装/时尚赛博组件专项资金不能超过 800eb，也不能变成现金。');
  const fields = ROLE_ALLOCATION_FIELDS[character.role];
  if (fields) {
    const allocation = character.roleAllocations ?? {};
    const values = fields.map(([id]) => allocation[id] ?? 0);
    if (Object.keys(allocation).some(id => !fields.some(([key]) => key === id)) || values.some(v => !Number.isInteger(v) || v < 0 || v > character.rank)) errors.push('身份专长分配包含非法项目或等级。');
    const total = values.reduce((a, b) => a + b, 0);
    const budget = character.rank * (character.role === '技工' ? 2 : 1);
    if (total > budget || (creation && character.role !== '佣兵' && total !== budget)) errors.push(`身份专长已分配 ${total}/${budget} 点。`);
    if (character.role === '佣兵' && ((allocation.deflection ?? 0) % 2 !== 0 || ![0, 4].includes(allocation.recovery ?? 0) || (allocation.precision ?? 0) % 3 !== 0)) errors.push('佣兵：伤害偏转每档花费2点，失手挽回需要4点，精准攻击每档3点。');
  }
  return { errors, attributePoints, skillPoints };
}

export function changeAttribute(character: CharacterSheet, key: StatKey, value: number, creation: boolean): CharacterSheet {
  const stats = { ...character.stats, [key]: value };
  const hp = deriveHp(stats);
  const humanity = deriveHumanity(stats);
  const humanityMax = creation ? Math.max(0, humanity.max - cyberwareMaximumPenalty(character)) : Math.max(0, humanity.max - Math.max(0, deriveHumanity(character.stats).max - character.humanity.max));
  const installedHumanityLoss = (character.cyberwareInstallations ?? []).reduce((sum, item) => sum + item.humanityLoss, 0);
  return { ...character, stats,
    hp: { ...hp, current: creation ? hp.max : Math.max(0, hp.max - (character.hp.max - character.hp.current)) },
    humanity: { ...character.humanity, ...(key === 'emp' ? { max: humanityMax, current: creation ? Math.max(0, Math.min(humanityMax,humanity.max - installedHumanityLoss)) : Math.min(character.humanity.current, humanityMax) } : {}) },
  };
}

export function effectiveEmpathy(character: CharacterSheet): number {
  return Math.max(0, Math.min(character.stats.emp, Math.floor(character.humanity.current / 10)));
}

export function resetCreationAttributes(character:CharacterSheet):CharacterSheet {
  return (Object.keys(character.stats) as StatKey[]).reduce((next,key)=>changeAttribute(next,key,2,true),character);
}

export function fillCreationPoints(character: CharacterSheet): CharacterSheet {
  let next = structuredClone(character);
  next.rank = 4;
  for (const key of Object.keys(next.stats) as StatKey[]) next = changeAttribute(next, key, Math.min(8, Math.max(2, Math.round(next.stats[key]))), true);
  for (let i = 0; i < 62; i++) {
    if (Object.values(next.stats).reduce((a, b) => a + b, 0) >= 62) break;
    const key = (Object.keys(next.stats) as StatKey[]).filter(k => next.stats[k] < 8).sort((a, b) => next.stats[a] - next.stats[b])[0];
    next = changeAttribute(next, key, next.stats[key] + 1, true);
  }
  next.skills = RED_SKILLS.map(skill => ({ skillId: skill.id, level: skill.id === 'culture-language' ? 4 : Math.min(6, Math.max(REQUIRED_SKILLS.includes(skill.id) ? 2 : 0, next.skills.find(s => s.skillId === skill.id)?.level ?? 0)) }));
  let remaining = 86 - validateCharacter(next, true).skillPoints;
  while (remaining > 0) {
    const skill = next.skills.filter(s => s.skillId !== 'culture-language' && s.level < 6 && (RED_SKILLS.find(entry => entry.id === s.skillId)?.multiplier ?? 1) <= remaining).sort((a, b) => a.level - b.level)[0];
    if (!skill) break;
    skill.level++;
    remaining -= RED_SKILLS.find(entry => entry.id === skill.skillId)?.multiplier ?? 1;
  }
  return next;
}
