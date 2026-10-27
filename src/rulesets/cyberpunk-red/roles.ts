import { CharacterSheet } from '../../domain/types';

export const ROLE_GUIDES: Record<string, { ability: string; page: number; summary: string; action: string }> = {
  '摇滚小子': { ability: '魅力冲击', page: 144, summary: '影响粉丝；请求范围与群体规模需按等级及原文确认，不能对任何人直接生效。', action: '判断现场是否有粉丝，并确认能否使用魅力冲击争取帮助。' },
  '佣兵': { ability: '战斗意识', page: 146, summary: '把身份等级对应的点数分配给战斗专长；调整时机、动作成本和伤害效果按原文处理。', action: '检查当前战斗意识分配，评估威胁与战斗准备。' },
  '网行者': { ability: '交互界面', page: 147, summary: '允许进行网行，等级影响网络动作数与交互界面检定；仍需设备和有效入口。', action: '寻找可接入的网络入口，确认交互界面能力与行动条件。' },
  '技工': { ability: '创客', page: 147, summary: '每级分配两个不同专长点，可临时修理、升级、制造与发明；时间、材料及DV另行核对。', action: '依据创客专长检查能否修理、升级或制造当前所需物品。' },
  '技医': { ability: '医学', page: 149, summary: '医学等级分配至外科手术、制药或低温系统操作，解锁对应专业能力。', action: '确认医学专长是否允许处理当前伤情或治疗需求。' },
  '媒体人': { ability: '可信度', page: 151, summary: '获取传闻并影响报道的可信程度；证据、受众与等级决定效果，不等同于读心。', action: '联系消息来源，收集可核实证据并评估报道的影响。' },
  '主管': { ability: '团队协作', page: 153, summary: '随等级获得企业资源与团队成员；使用团队需处理成员职能、忠诚度及企业关系。', action: '确认可用的企业资源与团队成员，提出合适的协助请求。' },
  '执法者': { ability: '后备支援', page: 158, summary: '满足条件时呼叫支援；响应与抵达时间有独立掷骰流程，并非立即获得无限援军。', action: '核对情势是否允许呼叫后备支援，再执行响应与抵达判定。' },
  '中间人': { ability: '操盘手', page: 159, summary: '人脉、货源门路、议价与文化适应随等级变化；联系渠道不免除交易费用。', action: '通过人脉寻找货源或情报，确认可用门路与议价条件。' },
  '游民': { ability: '机车', page: 161, summary: '等级加入相应驾驶与载具技术检定，并影响家族载具及升级的获取。', action: '核对家族车库资源，评估可用载具与驾驶方案。' },
};

export function roleGuide(role: string) { return ROLE_GUIDES[role]; }
export const RED_ATTACK_SKILLS=['handgun','shoulder-arms','autofire','heavy-weapons','archery','brawling','melee-weapon','martial-arts'];

export function roleSkillBonus(character: CharacterSheet, skillId: string): number {
  if (character.role === '游民' && ['drive-land-vehicle', 'pilot-air-vehicle', 'pilot-sea-vehicle', 'air-vehicle-tech', 'land-vehicle-tech', 'sea-vehicle-tech'].includes(skillId)) return character.rank;
  if (character.role === '中间人' && skillId === 'trading') return character.rank;
  if (character.role === '佣兵') {
    if (skillId === 'perception') return character.roleAllocations?.threat ?? 0;
    if (RED_ATTACK_SKILLS.includes(skillId)) return Math.floor((character.roleAllocations?.precision ?? 0) / 3);
  }
  if (character.role === '技工' && ['basic-tech', 'cybertech', 'electronics-security-tech', 'weaponstech', 'air-vehicle-tech', 'land-vehicle-tech', 'sea-vehicle-tech'].includes(skillId)) return character.roleAllocations?.field ?? 0;
  return 0;
}

export const ROLE_ALLOCATION_FIELDS: Record<string, Array<[string, string]>> = {
  '佣兵': [['deflection', '伤害偏转'], ['recovery', '失手挽回'], ['initiative', '先攻反应'], ['precision', '精准攻击'], ['weakness', '识破弱点'], ['threat', '威胁察觉']],
  '技工': [['field', '临场专精'], ['upgrade', '升级专精'], ['fabrication', '制造专精'], ['invention', '发明专精']],
  '技医': [['surgery', '外科手术'], ['pharma', '医学技术（制药）'], ['cryo', '医学技术（低温）']],
};
