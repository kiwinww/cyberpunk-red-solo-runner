import { CharacterSheet } from '../domain/types';

export function ruleTermMentions(text:string,character:CharacterSheet):Array<{start:number;end:number;label:string;help:string}> {
  const terms:Record<string,string>={
    DV:'难度值。一般技能检定的最终总值必须严格超过DV；等于DV不算成功。具体目标和例外以适用规则为准。',
    HP:`生命值；人物卡当前 ${character.hp.current}/${character.hp.max}。受伤与重伤惩罚按实际伤害结算，叙述不会自动恢复生命。`,
    SP:`护甲防护值；人物卡头部 ${character.armor.headSp}，身体 ${character.armor.bodySp}。防护位置、穿透、衰减和特殊攻击按对应规则处理。`,
    人性:`人物卡当前人性 ${character.humanity.current}/${character.humanity.max}，基础共情 ${character.stats.emp}。有效共情受当前人性限制；安装义体的损失与人性上限分别记录。`,
    共情:`基础共情 ${character.stats.emp}，当前有效共情 ${Math.max(0,Math.min(character.stats.emp,Math.floor(character.humanity.current/10)))}。用于相关技能；不因性别或年龄自动加减。`,
    身份等级:`人物卡 ${character.role} ${character.rank}级。它是身份专属能力等级，不是所有技能通用的加值。`,
    欧币:`人物卡现金 ${character.eurobucks} eb。报价、承诺和预支条件不等于已到账；收支需要明确记录。`,
  };
  return [...text.matchAll(/(?<![a-zA-Z])(?:DV|HP|SP)(?![a-zA-Z])|身份等级|人性|共情|欧币/g)].map(match=>({start:match.index!,end:match.index!+match[0].length,label:match[0],help:terms[match[0]]}));
}
