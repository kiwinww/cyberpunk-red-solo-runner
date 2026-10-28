import { getShopItem, SLOT_LABELS, type ShopItem } from '../data/creationCatalog';
import { RED_SKILLS } from '../rulesets/cyberpunk-red';

export function equipmentHelp(item:ShopItem):string {
  return [item.name,item.detail??item.description,
    `价格：${item.priceLabel??`${item.price}eb`}${item.paired?' / 单件，须购买两件':''}`,
    item.damage?`伤害 ${item.damage} · ROF ${item.rof??'依原文'}`:'',
    item.armorSp?`SP ${item.armorSp}，同部位取最高值；反应/敏捷/移动惩罚 -${item.armorPenalty??0}，头身不叠加。`:'',
    item.category==='cyberware'?`建卡人性损失 ${item.humanityLoss??'待确认'}；跑团安装时${item.humanityDice?`按 ${item.humanityDice} 结算`:item.humanityLoss===0?'此条目无安装人性损失':'损失方式需核对原文'}，不是每次使用重复扣除。${item.paired?'两侧各自结算。':''}`:'',
    item.slots?`部位：${item.slots.map(slot=>SLOT_LABELS[slot]).join('、')}；${item.base?`提供${item.capacity??'待确认'}槽`:item.manualReason?'安装方式待配置':`占用${item.slotsUsed??1}槽${item.paired?' / 每侧':''}`}。`:'',
    item.requiredBase?`安装前置：${getShopItem(item.requiredBase)?.name??item.requiredBase}；未满足前置时不能自动赋予组件效果。`:'',
    item.manualReason??'',`来源：本机核心规则 PDF ${item.page}页。条件性效果不会仅因购买就自动全部生效。`,
    ...(item.checkBonuses??[]).map(b=>`判定加值 +${b.value}：${b.skills.map(id=>RED_SKILLS.find(s=>s.id===id)?.name??id).join('、')}；${b.condition==='tool'?'确认使用工具时':b.condition==='visual'?'视觉检定时':'听觉检定时'}计入，同类不叠加。PDF ${b.page}页。`),
  ].filter(Boolean).join('\n');
}
