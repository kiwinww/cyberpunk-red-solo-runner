import type { CyberSlot } from '../domain/types';

export type ShopCategory = 'weapon' | 'armor' | 'gear' | 'fashion' | 'cyberware';
export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  price: number;
  description: string;
  page: number; // 规则书 PDF 的物理页码
  detail?: string;
  group?: string;
  manualReason?: string;
  paired?: boolean;
  repeatable?: boolean;
  allowMeat?: boolean;
  armorPenalty?: number;
  minUnits?: number;
  unitLabel?: string;
  priceLabel?: string;
  checkBonuses?: Array<{ skills:string[]; value:number; condition:'tool'|'visual'|'auditory'; group:string; page:number }>;
  damage?: string;
  rof?: number;
  armorSp?: number;
  armorZone?: 'head' | 'body' | 'both';
  slots?: CyberSlot[];
  base?: boolean;
  capacity?: number;
  slotsUsed?: number;
  requiredBase?: string;
  humanityLoss?: number; // 完整定制阶段的固定值；战役阶段掷骰的义体另由主持结算
  humanityDice?: string;
}
export const SLOT_LABELS: Record<CyberSlot, string> = {
  neural: '神经链路', leftEye: '左赛博眼', rightEye: '右赛博眼', audio: '音频组件',
  leftArm: '左赛博手臂', rightArm: '右赛博手臂', leftLeg: '左赛博腿', rightLeg: '右赛博腿',
  internal: '体内组件', external: '外周组件', fashion: '时尚组件', borg: '赛博格组件',
};
const eyes: CyberSlot[] = ['leftEye', 'rightEye'];
const arms: CyberSlot[] = ['leftArm', 'rightArm'];
const legs: CyberSlot[] = ['leftLeg', 'rightLeg'];

/** 精选起始目录；价格和固定 HL 根据用户提供的 RED 核心规则书预览版相关表格核对。 */
export const CREATION_CATALOG: ShopItem[] = [
  {id:'medium-pistol',name:'中型手枪',category:'weapon',price:50,page:94,description:'2d6 伤害，弹匣12，ROF 2，可隐藏。',damage:'2d6',rof:2},
  {id:'heavy-pistol',name:'重型手枪',category:'weapon',price:100,page:94,description:'3d6 伤害，弹匣8，ROF 2，可隐藏。',damage:'3d6',rof:2},
  {id:'very-heavy-pistol',name:'超重型手枪',category:'weapon',price:100,page:94,description:'4d6 伤害，弹匣8，ROF 1，不可隐藏。',damage:'4d6',rof:1},
  {id:'assault-rifle',name:'突击步枪',category:'weapon',price:500,page:94,description:'5d6 伤害，弹匣25，ROF 1，支持自动射击。',damage:'5d6',rof:1},
  {id:'shotgun',name:'霰弹枪',category:'weapon',price:500,page:94,description:'5d6 伤害，弹匣4，ROF 1。',damage:'5d6',rof:1},
  {id:'heavy-melee',name:'重型近战武器',category:'weapon',price:100,page:92,description:'3d6 伤害，ROF 2；例如长剑或重棒。',damage:'3d6',rof:2},
  {id:'ammo-pistol',name:'基础手枪弹药（10发）',category:'gear',price:10,page:94,description:'标准弹药，购买后计入背包；未自动装填。'},
  {id:'ammo-rifle',name:'基础步枪弹药（10发）',category:'gear',price:10,page:94,description:'标准步枪弹药，未自动装填。'},
  {id:'head-leather',name:'皮衣防护（头部）',category:'armor',price:20,page:97,description:'头部 SP 4，无行动惩罚。',armorSp:4,armorZone:'head'},
  {id:'body-leather',name:'皮衣防护（身体）',category:'armor',price:20,page:97,description:'身体 SP 4，无行动惩罚。',armorSp:4,armorZone:'body'},
  {id:'head-kevlar',name:'凯夫拉（头部）',category:'armor',price:50,page:97,description:'头部 SP 7，无行动惩罚。',armorSp:7,armorZone:'head'},
  {id:'body-kevlar',name:'凯夫拉（身体）',category:'armor',price:50,page:97,description:'身体 SP 7，无行动惩罚。',armorSp:7,armorZone:'body'},
  {id:'head-lightjack',name:'轻型护甲夹克（头部）',category:'armor',price:100,page:97,description:'头部 SP 11，无行动惩罚。',armorSp:11,armorZone:'head'},
  {id:'body-lightjack',name:'轻型护甲夹克（身体）',category:'armor',price:100,page:97,description:'身体 SP 11，无行动惩罚。',armorSp:11,armorZone:'body'},
  {id:'agent',name:'智能代理',category:'gear',price:100,page:100,description:'口袋 AI 终端；图书馆检索有规则加值，按 GM 判定使用。'},
  {id:'cyberdeck',name:'赛博碟板',category:'gear',price:500,page:100,description:'网行工具，拥有7个程序/硬件槽位。'},
  {id:'flashlight',name:'手电筒',category:'gear',price:20,page:100,description:'照射距离约100米，单次充电可持续10小时。'},
  {id:'lockpick',name:'开锁工具套装',category:'gear',price:20,page:101,description:'机械锁的开锁工具，不保证自动成功。'},
  {id:'medkit',name:'技医医疗包',category:'gear',price:100,page:101,description:'医疗用品集合，不自动恢复生命值。'},
  {id:'rope',name:'绳索（60米）',category:'gear',price:20,page:101,description:'60米尼龙绳。'},
  {id:'rations',name:'“狗粮”包（一餐）',category:'gear',price:10,page:101,description:'赤红时代常见的便宜合成口粮。'},
  {id:'sunglasses',name:'大众潮流风镜面墨镜',category:'fashion',price:20,page:102,description:'时装专项可购买；不提供护甲 SP。'},
  {id:'jacket-fashion',name:'大众潮流风夹克',category:'fashion',price:50,page:102,description:'时装专项可购买；不提供护甲 SP。'},
  {id:'neural-link',name:'神经链接',category:'cyberware',price:500,page:112,description:'神经组件的基础装置，提供5个升级槽位。',slots:['neural'],base:true,capacity:5,humanityLoss:7,humanityDice:'2d6'},
  {id:'interface-plugs',name:'交互界面插口',category:'cyberware',price:500,page:112,description:'连接赛博碟板、智能枪等设备；需要神经链接。',slots:['neural'],requiredBase:'neural-link',humanityLoss:7,humanityDice:'2d6'},
  {id:'sandevistan',name:'桑德威斯坦',category:'cyberware',price:500,page:112,description:'加速装置；使用一个动作激活后获得先攻加值，有冷却时间。',slots:['neural'],requiredBase:'neural-link',humanityLoss:7,humanityDice:'2d6'},
  {id:'cybereye',name:'赛博义眼',category:'cyberware',price:100,page:112,description:'单只义眼，提供3个可选组件槽位。',slots:eyes,base:true,capacity:3,humanityLoss:7,humanityDice:'2d6'},
  {id:'chiron',name:'视幕',category:'cyberware',price:100,page:112,description:'在义眼视野中叠加小型屏幕；需要一只赛博义眼。',slots:eyes,requiredBase:'cybereye',humanityLoss:2,humanityDice:'1d6/2（向上取整）'},
  {id:'microscope',name:'显微光学',category:'cyberware',price:100,page:113,description:'最高400倍放大视野；需要一只赛博义眼。',slots:eyes,requiredBase:'cybereye',humanityLoss:2,humanityDice:'1d6/2（向上取整）'},
  {id:'audio-suite',name:'赛博音频套件',category:'cyberware',price:500,page:113,description:'基础音频装置，提供3个可选槽位。',slots:['audio'],base:true,capacity:3,humanityLoss:7,humanityDice:'2d6'},
  {id:'hearing-boost',name:'听觉增强',category:'cyberware',price:100,page:113,description:'听觉相关觉察判定可获加值；需要音频套件。',slots:['audio'],requiredBase:'audio-suite',humanityLoss:3,humanityDice:'1d6'},
  {id:'cyberarm',name:'赛博手臂',category:'cyberware',price:500,page:115,description:'独立安装的机械手臂，附标准义手，提供4个选件槽。',slots:arms,base:true,capacity:4,humanityLoss:7,humanityDice:'2d6'},
  {id:'grapple-hand',name:'抓钩手',category:'cyberware',price:100,page:115,description:'发射抓钩与30米绳索，需要赛博手臂。',slots:arms,requiredBase:'cyberarm',humanityLoss:3,humanityDice:'1d6'},
  {id:'cyberleg',name:'赛博义腿',category:'cyberware',price:100,page:116,description:'独立安装的机械腿，附标准义足，提供3个选件槽。',slots:legs,base:true,capacity:3,humanityLoss:3,humanityDice:'1d6'},
  {id:'internal-filter',name:'鼻腔过滤器',category:'cyberware',price:100,page:114,description:'对吸入型毒气和烟雾提供保护；使用独立体内槽位。',slots:['internal'],humanityLoss:2,humanityDice:'1d6/2（向上取整）'},
  {id:'subdermal-pocket',name:'皮下口袋',category:'cyberware',price:100,page:114,description:'隐蔽的小型皮下储物空间。',slots:['external'],humanityLoss:3,humanityDice:'1d6'},
  {id:'biomonitor',name:'生物监测仪',category:'cyberware',price:100,page:111,description:'皮下生理读数监测设备，安装无 HL。',slots:['fashion'],humanityLoss:0},
  {id:'emp-thread',name:'EMP编织线纹',category:'cyberware',price:10,page:111,description:'电路纹样装饰，不具备实际 EMP 防护。',slots:['fashion'],humanityLoss:0},
];
export const SHOP_CATEGORY_LABELS: Record<ShopCategory,string> = { weapon:'武器', armor:'防具', gear:'装备',fashion:'时装',cyberware:'义体' };
export function getShopItem(id: string) { return CREATION_CATALOG.find(item => item.id === id); }
