import {
  CharacterSheet,
  RedCheckInput,
  RedCheckResult,
  RedRuleset,
  SkillEntry,
  StatBlock,
} from "../../domain/types";

export const RED_ROLES = [
  "摇滚小子",
  "佣兵",
  "网行者",
  "技工",
  "技医",
  "媒体人",
  "主管",
  "执法者",
  "中间人",
  "游民",
];

export const RED_SKILLS: SkillEntry[] = [
  { id: 'street-slang', name: '语言（街头俚语）', category: 'education', linkedStat: 'int' },
  { id: 'culture-language', name: '语言（文化背景，免费4级）', category: 'education', linkedStat: 'int' },
  { id: 'local-expert-home', name: '本地专家（住地）', category: 'education', linkedStat: 'int' },
  { id: 'accounting', name: '会计', category: 'education', linkedStat: 'int' },
  { id: 'animal-handling', name: '驯兽', category: 'education', linkedStat: 'int' },
  { id: 'bureaucracy', name: '官僚世故', category: 'education', linkedStat: 'int' },
  { id: 'business', name: '商业', category: 'education', linkedStat: 'int' },
  { id: 'cryptography', name: '密码学', category: 'education', linkedStat: 'int' },
  { id: 'gamble', name: '赌博', category: 'education', linkedStat: 'int' },
  { id: 'science', name: '科学（专业见备注）', category: 'education', linkedStat: 'int' },
  { id: 'wilderness-survival', name: '野外生存', category: 'education', linkedStat: 'int' },
  { id: 'bribery', name: '贿赂', category: 'social', linkedStat: 'cool' },
  { id: 'personal-grooming', name: '个人仪容', category: 'social', linkedStat: 'cool' },
  { id: 'air-vehicle-tech', name: '空中载具技术', category: 'technique', linkedStat: 'tech' },
  { id: 'demolitions', name: '爆破', category: 'technique', linkedStat: 'tech', multiplier: 2 },
  { id: 'forgery', name: '伪造', category: 'technique', linkedStat: 'tech' },
  { id: 'land-vehicle-tech', name: '地面载具技术', category: 'technique', linkedStat: 'tech' },
  { id: 'paint-draw-sculpt', name: '绘画/素描/雕塑', category: 'technique', linkedStat: 'tech' },
  { id: 'pick-lock', name: '开锁', category: 'technique', linkedStat: 'tech' },
  { id: 'pick-pocket', name: '扒窃', category: 'technique', linkedStat: 'tech' },
  { id: 'sea-vehicle-tech', name: '水上载具技术', category: 'technique', linkedStat: 'tech' },
  { id: "concentration", name: "专注", category: "awareness", linkedStat: "will" },
  { id: "conceal-reveal-object", name: "藏匿/揭示物体", category: "awareness", linkedStat: "int" },
  { id: "lip-reading", name: "唇语", category: "awareness", linkedStat: "int" },
  { id: "perception", name: "觉察", category: "awareness", linkedStat: "int" },
  { id: "tracking", name: "追踪", category: "awareness", linkedStat: "int" },
  { id: "athletics", name: "运动", category: "body", linkedStat: "dex" },
  { id: "contortionist", name: "柔术", category: "body", linkedStat: "dex" },
  { id: "dance", name: "舞蹈", category: "body", linkedStat: "dex" },
  { id: "endurance", name: "忍耐", category: "body", linkedStat: "will" },
  { id: "resist-torture-drugs", name: "折磨/药物耐受", category: "body", linkedStat: "will" },
  { id: "stealth", name: "潜行", category: "body", linkedStat: "dex" },
  { id: "drive-land-vehicle", name: "地面载具驾驶", category: "control", linkedStat: "ref" },
  { id: "pilot-air-vehicle", name: "空中载具驾驶", category: "control", linkedStat: "ref", multiplier: 2 },
  { id: "pilot-sea-vehicle", name: "海上载具驾驶", category: "control", linkedStat: "ref" },
  { id: "riding", name: "骑乘", category: "control", linkedStat: "ref" },
  { id: "education", name: "教育", category: "education", linkedStat: "int" },
  { id: "local-expert", name: "本地专家", category: "education", linkedStat: "int" },
  { id: "language", name: "语言", category: "education", linkedStat: "int" },
  { id: "library-search", name: "资料检索", category: "education", linkedStat: "int" },
  { id: "deduction", name: "推理", category: "education", linkedStat: "int" },
  { id: "criminology", name: "犯罪学", category: "education", linkedStat: "int" },
  { id: "tactics", name: "战术", category: "education", linkedStat: "int" },
  { id: "brawling", name: "斗殴", category: "fighting", linkedStat: "dex" },
  { id: "evasion", name: "闪避", category: "fighting", linkedStat: "dex" },
  { id: "martial-arts", name: "武术", category: "fighting", linkedStat: "dex", multiplier: 2 },
  { id: "melee-weapon", name: "近战武器", category: "fighting", linkedStat: "dex" },
  { id: "acting", name: "表演", category: "performance", linkedStat: "cool" },
  { id: "composition", name: "创作", category: "education", linkedStat: "int" },
  { id: "play-instrument", name: "演奏", category: "performance", linkedStat: "tech" },
  { id: "photography-film", name: "摄影/摄像", category: "technique", linkedStat: "tech" },
  { id: "handgun", name: "手枪", category: "ranged", linkedStat: "ref" },
  { id: "shoulder-arms", name: "肩射武器", category: "ranged", linkedStat: "ref" },
  { id: "autofire", name: "自动火力", category: "ranged", linkedStat: "ref", multiplier: 2 },
  { id: "heavy-weapons", name: "重武器", category: "ranged", linkedStat: "ref", multiplier: 2 },
  { id: "archery", name: "弓术", category: "ranged", linkedStat: "ref" },
  { id: "conversation", name: "交谈", category: "social", linkedStat: "emp" },
  { id: "human-perception", name: "洞察人心", category: "social", linkedStat: "emp" },
  { id: "interrogation", name: "审讯", category: "social", linkedStat: "cool" },
  { id: "persuasion", name: "说服", category: "social", linkedStat: "cool" },
  { id: "streetwise", name: "街头智慧", category: "social", linkedStat: "cool" },
  { id: "trading", name: "交易", category: "social", linkedStat: "cool" },
  { id: "wardrobe-style", name: "衣着与风格", category: "social", linkedStat: "cool" },
  { id: "basic-tech", name: "基础技术", category: "technique", linkedStat: "tech" },
  { id: "cybertech", name: "赛博技术", category: "technique", linkedStat: "tech" },
  { id: "electronics-security-tech", name: "电子/安保技术", category: "technique", linkedStat: "tech", multiplier: 2 },
  { id: "first-aid", name: "急救", category: "technique", linkedStat: "tech" },
  { id: "paramedic", name: "医护", category: "technique", linkedStat: "tech", multiplier: 2 },
  { id: "weaponstech", name: "武器技术", category: "technique", linkedStat: "tech" },
];

export function rollD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}

export function rollRedCheck(input: RedCheckInput): RedCheckResult {
  const firstDie = rollD10();
  const base = input.stat + input.skill + (input.modifier ?? 0);
  let total = base + firstDie;
  let extraDie: number | undefined;
  let critical: RedCheckResult["critical"] = "none";

  if (firstDie === 10) {
    extraDie = rollD10();
    total += extraDie;
    critical = "success";
  }

  if (firstDie === 1 && !input.ignoreCriticalFailure) {
    extraDie = rollD10();
    total = base + firstDie - extraDie;
    critical = "failure";
  }

  const margin = input.dv === undefined ? undefined : total - input.dv;
  const success = input.dv === undefined ? undefined : total > input.dv;

  return { firstDie, extraDie, total, critical, margin, success };
}

export function deriveHp(stats: StatBlock): CharacterSheet["hp"] {
  const max = 10 + 5 * Math.ceil((stats.body + stats.will) / 2);
  return {
    current: max,
    max,
    seriouslyWoundedAt: Math.ceil(max / 2),
    deathSave: stats.body,
  };
}

export function deriveHumanity(stats: StatBlock): CharacterSheet["humanity"] {
  const max = stats.emp * 10;
  return { current: max, max };
}

export function createBlankCharacter(): CharacterSheet {
  const stats: StatBlock = {
    int: 5,
    ref: 5,
    dex: 5,
    tech: 5,
    cool: 5,
    will: 5,
    luck: 5,
    move: 5,
    body: 5,
    emp: 5,
  };

  return {
    id: crypto.randomUUID(),
    handle: "未命名边缘行者",
    gender: 'unspecified',
    pronouns: '',
    role: RED_ROLES[1],
    rank: 4,
    stats,
    hp: deriveHp(stats),
    humanity: deriveHumanity(stats),
    armor: { headSp: 0, bodySp: 0 },
    skills: RED_SKILLS.map((skill) => ({ skillId: skill.id, level: 0 })),
    weapons: [],
    cyberware: [],
    gear: [],
    eurobucks: 2550,
    improvementPoints: 0,
    lifepathNotes: "",
    notes: "",
  };
}

export const cyberpunkRedRuleset: RedRuleset = {
  id: "cyberpunk-red",
  title: "Cyberpunk RED",
  officialSourceUrl: "https://talsorianstore.com/",
  sourceNotice:
    "此应用只提供本地工具框架和用户资料包入口；正式规则、表格和长段文本请由用户从正版资料导入。",
  roles: RED_ROLES,
  skills: RED_SKILLS,
  rollCheck: rollRedCheck,
  createBlankCharacter,
  deriveHp,
  deriveHumanity,
};
