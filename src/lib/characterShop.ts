import type { CharacterSheet, CyberSlot } from '../domain/types';
import { CREATION_CATALOG, getShopItem, SLOT_LABELS, type ShopItem } from '../data/creationCatalog';
import { humanityCeiling } from './humanity';

export type ShopBudget = 'general' | 'fashion';
export interface ShopResult { ok: boolean; character: CharacterSheet; message: string; }
const fail = (character: CharacterSheet, message: string): ShopResult => ({ ok: false, character, message });
const allowedFashion = (item: ShopItem) => item.category === 'fashion' || (item.category === 'cyberware' && item.slots?.includes('fashion'));
const getInstalls = (character: CharacterSheet, slot: CyberSlot) => (character.cyberwareInstallations ?? []).filter(i => i.slot === slot);
const removeOne = (values: string[], target: string) => { const next = [...values]; const index = next.lastIndexOf(target); if(index >= 0) next.splice(index, 1); return next; };
const limbSlots: CyberSlot[] = ['leftArm','rightArm','leftLeg','rightLeg'];
const requiredBase = (item:ShopItem,slot:CyberSlot) => item.slots?.length===4 ? (slot.endsWith('Leg')?'cyberleg':'cyberarm') : item.requiredBase;

function checkSinglePurchase(character: CharacterSheet, itemId: string, slot: CyberSlot | undefined, budget: ShopBudget, creation: boolean, units?:number): string | null {
  const item = getShopItem(itemId);
  if (!item) return '商品不存在。';
  if (item.manualReason) return item.manualReason;
  const quantity=units??item.minUnits??1;
  if (!Number.isSafeInteger(quantity) || quantity<(item.minUnits??1) || (!item.minUnits && quantity!==1) || !Number.isSafeInteger(item.price*quantity)) return '数量无效，请按最低数量输入整数。';
  if (!Number.isSafeInteger(character.eurobucks) || character.eurobucks < 0) return '角色资金数据无效。';
  const purchases = character.purchases ?? [];
  if (purchases.some(p => !Number.isSafeInteger(p.cost) || p.cost < 0)) return '支出记录金额无效，请先修复记录。';
  if (creation && purchases.filter(p => p.budget === 'general').reduce((sum, p) => sum + p.cost, 0) + character.eurobucks > 2550) return '建卡通用支出与现金总额超过2550eb，请先核对资金。';
  if (creation && purchases.filter(p => p.budget === 'fashion').reduce((sum, p) => sum + p.cost, 0) > 800) return '建卡时装专项支出已超过800eb，请先核对资金。';
  if (budget === 'fashion' && (!creation || !allowedFashion(item))) return '时装专项仅在完整建卡时用于时装及时尚组件。';
  const remaining = budget === 'fashion' ? 800 - (character.purchases ?? []).filter(p => p.budget === 'fashion').reduce((total,p) => total + p.cost, 0) : character.eurobucks;
  if (item.price*quantity > remaining) return `余额不足：需要 ${item.price*quantity}eb，剩余 ${remaining}eb。`;
  if (item.category !== 'cyberware') return null;
  if (!slot || !item.slots?.includes(slot)) return '请先在人体图选择正确的义体部位。';
  const installs = getInstalls(character, slot);
  if (installs.some(install => !getShopItem(install.catalogId))) return '该部位有未映射的旧义体，请先核对容量与基础组件。';
  const installedItems = installs.map(p => getShopItem(p.catalogId)).filter((p): p is ShopItem => !!p);
  const base = installedItems.find(p=>p.base);
  if (item.base) {
    if (installedItems.some(p => p.base)) return `${SLOT_LABELS[slot]}已有基础组件，不能重复安装。`;
  } else if (requiredBase(item,slot) && !(item.allowMeat && !base) && !installedItems.some(p => p.id === requiredBase(item,slot))) {
    return `安装 ${item.name} 前需先购买对应部位的基础组件。`;
  }
  if (!item.base) {
    const cap = base?.capacity ?? (slot === 'fashion' || slot === 'internal' || slot === 'external' ? 7 : item.allowMeat && limbSlots.includes(slot)?1:0);
    const used = installedItems.filter(p => !p.base).reduce((n,p) => n + (p.slotsUsed ?? 1), 0);
    if (used + (item.slotsUsed ?? 1) > cap) return `当前部位剩余槽位不足（已用 ${used}/${cap}）。`;
  }
  if (!item.repeatable && installedItems.some(p => p.id === item.id)) return '当前部位已安装同款组件。';
  if (['桑德威斯坦','克伦齐科夫'].includes(item.name) && (character.cyberwareInstallations ?? []).some(i => ['桑德威斯坦','克伦齐科夫'].includes(getShopItem(i.catalogId)?.name ?? ''))) return '角色只能同时安装一件加速组件。';
  const hl = item.humanityLoss ?? 0;
  if (creation && character.humanity.current < hl) return `人性不足：安装需要损失 ${hl} 点。`;
  return null;
}

export function checkShopPurchase(character: CharacterSheet, itemId: string, slot: CyberSlot | undefined, budget: ShopBudget, creation: boolean, units?:number): string | null {
  const item=getShopItem(itemId);
  if (!item?.paired) return checkSinglePurchase(character,itemId,slot,budget,creation,units);
  if (!slot || !item.slots?.includes(slot)) return '请选择对应义体部位。';
  for (const side of item.slots) {
    const error=checkSinglePurchase(character,itemId,side,budget,creation);
    if(error) return `${SLOT_LABELS[side]}：${error}`;
  }
  const remaining=budget==='general'?character.eurobucks:800-(character.purchases??[]).filter(p=>p.budget==='fashion').reduce((sum,p)=>sum+p.cost,0);
  if (remaining<item.price*2) return `成对安装需要 ${item.price*2}eb，剩余 ${remaining}eb。`;
  if (creation && character.humanity.current<(item.humanityLoss??0)*2) return `成对安装需损失 ${(item.humanityLoss??0)*2} 点人性。`;
  return null;
}

function postCreationHumanity(item: ShopItem, random: () => number): number {
  const expression = item.humanityDice;
  if (!expression || !(item.humanityLoss ?? 0)) return 0;
  const count = expression.includes('4d6') ? 4 : expression.includes('2d6') ? 2 : 1;
  let sum = 0;
  for (let n=0;n<count;n++) sum += Math.floor(random()*6)+1;
  return expression.includes('/2') ? Math.ceil(sum / 2) : sum;
}

type PurchaseOptions = { slot?: CyberSlot; budget?: ShopBudget; creation: boolean; random?: () => number; purchaseId?: string; units?:number };
export function purchaseCatalogItem(character: CharacterSheet, itemId: string, options: PurchaseOptions): ShopResult {
  const item=getShopItem(itemId);
  if(!item?.paired) return purchaseSingleItem(character,itemId,options);
  const error=checkShopPurchase(character,itemId,options.slot,options.budget??'general',options.creation);
  if(error) return fail(character,error);
  const groupId=options.purchaseId??crypto.randomUUID();
  if(character.purchases?.some(p=>p.groupId===groupId || p.id===groupId)) return fail(character,'这笔购买已登记，不能重复扣款。');
  let next=character;
  for(const slot of item.slots!) {
    const result=purchaseSingleItem(next,itemId,{...options,slot,purchaseId:`${groupId}:${slot}`});
    if(!result.ok) return fail(character,result.message);
    next={...result.character,purchases:result.character.purchases?.map(p=>p.id===`${groupId}:${slot}`?{...p,groupId}:p)};
  }
  return {ok:true,character:next,message:`已成对安装 ${item.name}，共 ${item.price*2}eb，人性 -${character.humanity.current-next.humanity.current}；左右两侧槽位已同步登记。`};
}

function purchaseSingleItem(character: CharacterSheet, itemId: string, options: PurchaseOptions): ShopResult {
  const item = getShopItem(itemId);
  if (!item) return fail(character, '商品不存在。');
  const budget = options.budget ?? 'general';
  if (options.purchaseId && character.purchases?.some(p => p.id === options.purchaseId)) return fail(character, '这笔购买已登记，不能重复扣款。');
  const error = checkSinglePurchase(character, itemId, options.slot, budget, options.creation,options.units);
  if (error) return fail(character, error);
  const quantity=options.units??item.minUnits??1;
  const price=item.price*quantity;
  const title=item.minUnits?`${item.name}（${quantity}${item.unitLabel}）`:item.name;
  const humanityLoss = item.category === 'cyberware' ? (options.creation ? item.humanityLoss ?? 0 : postCreationHumanity(item, options.random ?? Math.random)) : 0;
  if (humanityLoss > character.humanity.current) return fail(character, `当前人性不足，未扣款或安装。本次人性损失为 ${humanityLoss}，需先恢复人性或取消改造。`);
  const purchaseId = options.purchaseId ?? crypto.randomUUID();
  const label = item.category === 'cyberware' ? `${item.name}（${SLOT_LABELS[options.slot!]}）` : item.name;
  const armorBaseline = character.armorPurchaseBaseline ?? { ...character.armor };
  const newArmor = { ...character.armor };
  if (item.category === 'armor' && item.armorSp && item.armorZone) {
    if (item.armorZone !== 'body') newArmor.headSp = Math.max(newArmor.headSp, item.armorSp);
    if (item.armorZone !== 'head') newArmor.bodySp = Math.max(newArmor.bodySp, item.armorSp);
  }
  const next: CharacterSheet = {
    ...character,
    eurobucks: character.eurobucks - (budget === 'general' ? price : 0),
    purchases: [...(character.purchases ?? []), {id:purchaseId,title,cost:price,budget,catalogId:item.id,slot:options.slot,humanityLoss}],
    weapons: item.category === 'weapon' ? [...character.weapons, item.name] : [...character.weapons],
    gear: item.category === 'gear' || item.category === 'fashion' || item.category === 'armor' ? [...character.gear,title] : [...character.gear],
    cyberware: item.category === 'cyberware' ? [...character.cyberware, label] : [...character.cyberware],
    cyberwareInstallations: item.category === 'cyberware' ? [...(character.cyberwareInstallations ?? []), {purchaseId,catalogId:item.id,slot:options.slot!,humanityLoss}] : character.cyberwareInstallations,
    humanity: { ...character.humanity, current: character.humanity.current - humanityLoss, max: Math.max(0, character.humanity.max - (humanityLoss > 0 ? (options.slot === 'borg' ? 4 : 2) : 0)) },
    armor: newArmor,
    armorPurchaseBaseline: item.category === 'armor' ? armorBaseline : character.armorPurchaseBaseline,
  };
  next.humanity.current = Math.min(next.humanity.current, next.humanity.max);
  return {ok:true,character:next,message:`已购入 ${title}（-${budget === 'general' ? `${price}eb` : `时装专项 ${price}eb`}）${humanityLoss ? `，人性 -${humanityLoss}` : ''}${item.armorSp?'，已计入当前穿戴护甲（SP取最高，惩罚取最重）':''}。`};
}

/** 仅用于建卡编辑时撤销；战役中的实际卖出、拆除与人性恢复不等同于退款。 */
export function undoCreationPurchase(character: CharacterSheet, purchaseId: string): CharacterSheet {
  if(creationUndoError(character,purchaseId)) return character;
  const purchase=character.purchases?.find(p=>p.id===purchaseId);
  const group=purchase?.groupId ? character.purchases!.filter(p=>p.groupId===purchase.groupId) : purchase?[purchase]:[];
  return group.reduce((next,p)=>undoOneCreationPurchase(next,p.id),character);
}

function undoOneCreationPurchase(character: CharacterSheet, purchaseId: string): CharacterSheet {
  const purchase = character.purchases?.find(p=>p.id === purchaseId);
  if (!purchase) return character;
  const item = purchase.catalogId ? getShopItem(purchase.catalogId) : undefined;
  if (purchase.catalogId && !item) return character;
  if (purchase.slot && item?.base && (character.cyberwareInstallations ?? []).some(i => i.slot === purchase.slot && i.purchaseId !== purchaseId)) return character;
  const kept = (character.purchases ?? []).filter(p=>p.id !== purchaseId);
  const remainingArmor = (zone:'head'|'body') => Math.max(
    zone === 'head' ? character.armorPurchaseBaseline?.headSp ?? 0 : character.armorPurchaseBaseline?.bodySp ?? 0,
    ...kept.map(p => p.catalogId && getShopItem(p.catalogId)).filter((candidate): candidate is ShopItem => !!candidate && candidate.category === 'armor' && (candidate.armorZone === zone || candidate.armorZone === 'both')).map(p=>p.armorSp ?? 0),
  );
  const installed = (character.cyberwareInstallations ?? []).filter(i=>i.purchaseId !== purchaseId);
  const newMaximum = item?.category === 'cyberware' && (purchase.humanityLoss ?? 0) > 0
    ? Math.min(character.humanity.max + (purchase.slot === 'borg' ? 4 : 2), humanityCeiling({ ...character, cyberwareInstallations: installed }))
    : character.humanity.max;
  return {
    ...character,
    purchases: kept,
    eurobucks: character.eurobucks + (purchase.budget === 'general' ? purchase.cost : 0),
    weapons: item?.category === 'weapon' ? removeOne(character.weapons,item.name) : character.weapons,
    gear: item && ['gear','fashion','armor'].includes(item.category) ? removeOne(character.gear,purchase.title) : character.gear,
    cyberware: item?.category === 'cyberware' ? removeOne(character.cyberware, `${item.name}（${SLOT_LABELS[purchase.slot!]}）`) : character.cyberware,
    cyberwareInstallations: installed,
    humanity: {max: newMaximum, current: Math.min(newMaximum,character.humanity.current + (item?.category === 'cyberware' ? purchase.humanityLoss ?? 0 : 0))},
    armor: item?.category === 'armor' ? {headSp:remainingArmor('head'),bodySp:remainingArmor('body')} : character.armor,
  };
}

export function creationUndoError(character: CharacterSheet, purchaseId: string): string | null {
  const purchase = character.purchases?.find(p => p.id === purchaseId);
  if (!purchase) return '购买记录不存在。';
  const group=purchase.groupId ? character.purchases!.filter(p=>p.groupId===purchase.groupId) : [purchase];
  for(const member of group){
    const item=member.catalogId ? getShopItem(member.catalogId) : undefined;
    if(member.catalogId && !item) return '商品目录尚未载入，请刷新目录后再撤销，避免物品与退款不同步。';
    if(item?.base && member.slot && character.cyberwareInstallations?.some(i=>i.slot===member.slot && !group.some(p=>p.id===i.purchaseId))) return `请先撤销${SLOT_LABELS[member.slot]}的选配组件，再撤销基础组件。`;
  }
  return null;
}

export function uninstallCreationCyberware(character:CharacterSheet,purchaseId:string):ShopResult {
  const purchase=character.purchases?.find(p=>p.id===purchaseId);
  const item=purchase?.catalogId ? getShopItem(purchase.catalogId) : undefined;
  if(!purchase || item?.category!=='cyberware' || !character.cyberwareInstallations?.some(i=>i.purchaseId===purchaseId)) return fail(character,'没有可撤销的结构化安装记录；已有备注与旧数据保持不变。');
  const error=creationUndoError(character,purchaseId);
  if(error) return fail(character,error);
  const next=undoCreationPurchase(character,purchaseId);
  return {ok:true,character:next,message:`已${purchase.groupId?'成对':''}卸下 ${item.name}；建卡安装已撤销，资金退回原预算，槽位与对应人性同步恢复。`};
}

export function cyberSlotUsage(character: CharacterSheet, slot: CyberSlot) {
  const installs = getInstalls(character, slot);
  const purchased = installs.map(p=>CREATION_CATALOG.find(i=>i.id===p.catalogId)).filter((p):p is ShopItem=>!!p);
  const base = purchased.find(p=>p.base);
  const total = base?.capacity ?? (['fashion','internal','external'].includes(slot)? 7:limbSlots.includes(slot)?1:0);
  const used = purchased.filter(p=>!p.base).reduce((n,p)=>n+(p.slotsUsed??1),0);
  return {total,used,items:purchased,unknownCount:installs.length-purchased.length};
}
