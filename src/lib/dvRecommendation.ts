import { RED_SKILLS } from '../rulesets/cyberpunk-red';
import { RED_ATTACK_SKILLS } from '../rulesets/cyberpunk-red/roles';

export const GENERAL_DV_LEVELS=[
  {id:'everyday',label:'日常',dv:13},
  {id:'difficult',label:'困难',dv:15},
  {id:'professional',label:'专业',dv:17},
] as const;
export type GeneralDifficulty=typeof GENERAL_DV_LEVELS[number]['id'];

/** A GM estimate for ordinary tasks, never evidence of a module's fixed target. */
export function recommendSkillDv(skillId:string,reason:string,difficulty:GeneralDifficulty='everyday') {
  if(!RED_SKILLS.some(skill=>skill.id===skillId)||RED_ATTACK_SKILLS.includes(skillId)
    ||['evasion','first-aid','paramedic','surgery'].includes(skillId)
    ||/对抗|伏击|闪避攻击|射击|攻击命中|近战|投掷|手雷|网行|黑冰|密码节点|死亡豁免|稳定伤势|外科手术/.test(reason))return undefined;
  const level=GENERAL_DV_LEVELS.find(level=>level.id===difficulty)??GENERAL_DV_LEVELS[0];
  return {dv:level.dv,label:level.label,explanation:`主持建议 · ${level.label} DV ${level.dv}。依据核心规则 PDF 129 页的通用难度档位；这是本次主持估计，不是模组固定值。未确认难度时以日常档作起点，不能代替武器距离表、对抗或专门规则。`};
}
