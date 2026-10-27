import { describe, expect, it } from 'vitest';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { changeAttribute } from '../rulesets/cyberpunk-red/character';
import { checkShopPurchase, cyberSlotUsage, purchaseCatalogItem, undoCreationPurchase, uninstallCreationCyberware } from './characterShop';

describe('建卡商店与义体安装', () => {
  it('uninstalls a creation implant once and restores original money and humanity',()=>{
    const blank=createBlankCharacter();
    const installed=purchaseCatalogItem(blank,'cybereye',{creation:true,slot:'leftEye',purchaseId:'eye'}).character;
    const result=uninstallCreationCyberware(installed,'eye');
    expect(result.ok).toBe(true);
    expect(result.character.eurobucks).toBe(blank.eurobucks);
    expect(result.character.humanity).toEqual(blank.humanity);
    expect(result.character.cyberwareInstallations).toHaveLength(0);
    expect(uninstallCreationCyberware(result.character,'eye').ok).toBe(false);
  });
  it('returns fashion funds to the fashion allowance without creating cash',()=>{
    const blank=createBlankCharacter();
    const installed=purchaseCatalogItem(blank,'emp-thread',{creation:true,slot:'fashion',budget:'fashion',purchaseId:'thread'}).character;
    const result=uninstallCreationCyberware(installed,'thread');
    expect(result.ok).toBe(true);
    expect(result.character.eurobucks).toBe(blank.eurobucks);
    expect(result.character.purchases).toHaveLength(0);
    expect(result.character.humanity).toEqual(blank.humanity);
  });
  it('blocks an atomic paired-base removal if either side has dependent components',()=>{
    let c=purchaseCatalogItem(createBlankCharacter(),'cybereye',{creation:true,slot:'leftEye',purchaseId:'left'}).character;
    c=purchaseCatalogItem(c,'cybereye',{creation:true,slot:'rightEye',purchaseId:'right'}).character;
    c={...c,purchases:c.purchases?.map(p=>({...p,groupId:'paired-bases'}))};
    c=purchaseCatalogItem(c,'chiron',{creation:true,slot:'rightEye',purchaseId:'addon'}).character;
    const result=uninstallCreationCyberware(c,'left');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('右赛博眼');
    expect(result.character).toBe(c);
    const withoutAddon=uninstallCreationCyberware(c,'addon').character;
    const removed=uninstallCreationCyberware(withoutAddon,'left');
    expect(removed.character.cyberwareInstallations).toHaveLength(0);
    expect(removed.character.eurobucks).toBe(createBlankCharacter().eurobucks);
  });
  const buy = (itemId: string, slot?: Parameters<typeof purchaseCatalogItem>[2]['slot']) => purchaseCatalogItem(createBlankCharacter(), itemId, {creation:true,slot,purchaseId:'purchase-'+itemId});

  it('购买武器、护甲并撤销时不丢失初始 SP', () => {
    let character=createBlankCharacter();
    character.armor={headSp:7,bodySp:0};
    const gun=purchaseCatalogItem(character,'heavy-pistol',{creation:true,purchaseId:'gun'});
    expect(gun.ok).toBe(true);
    expect(gun.character.weapons).toContain('重型手枪');
    const armor=purchaseCatalogItem(gun.character,'head-lightjack',{creation:true,purchaseId:'armor'});
    expect(armor.ok).toBe(true);
    expect(armor.character.armor.headSp).toBe(11);
    const undo=undoCreationPurchase(armor.character,'armor');
    expect(undo.armor.headSp).toBe(7);
    expect(undo.weapons).toContain('重型手枪');
    expect(undoCreationPurchase(undo,'gun').eurobucks).toBe(character.eurobucks);
  });

  it('800eb 时装专项不扣通用现金，只允许购买相应类别', () => {
    const original=createBlankCharacter();
    const buyFashion=purchaseCatalogItem(original,'jacket-fashion',{creation:true,budget:'fashion',purchaseId:'fashion'});
    expect(buyFashion.ok).toBe(true);
    expect(buyFashion.character.eurobucks).toBe(original.eurobucks);
    expect(buyFashion.character.gear).toContain('大众潮流风夹克');
    expect(purchaseCatalogItem(original,'heavy-pistol',{creation:true,budget:'fashion'}).ok).toBe(false);
  });

  it('左眼和右眼独立，必须先有基础义眼才能安装视幕', () => {
    const blank=createBlankCharacter();
    expect(checkShopPurchase(blank,'chiron','leftEye','general',true)).toMatch(/基础组件/);
    const left=purchaseCatalogItem(blank,'cybereye',{creation:true,slot:'leftEye',purchaseId:'left'});
    expect(left.ok).toBe(true);
    const addon=purchaseCatalogItem(left.character,'chiron',{creation:true,slot:'leftEye',purchaseId:'view'});
    expect(addon.ok).toBe(true);
    expect(cyberSlotUsage(addon.character,'leftEye').used).toBe(1);
    expect(cyberSlotUsage(addon.character,'rightEye').items).toHaveLength(0);
    expect(purchaseCatalogItem(addon.character,'cybereye',{creation:true,slot:'leftEye'}).ok).toBe(false);
    expect(purchaseCatalogItem(addon.character,'cybereye',{creation:true,slot:'rightEye'}).ok).toBe(true);
    expect(undoCreationPurchase(addon.character,'left')).toEqual(addon.character); // 先撤销选配
    const after=undoCreationPurchase(undoCreationPurchase(addon.character,'view'),'left');
    expect(after.humanity.current).toBe(blank.humanity.current);
    expect(after.humanity.max).toBe(blank.humanity.max);
    expect(after.eurobucks).toBe(blank.eurobucks);
    expect(after.cyberware).toHaveLength(0);
  });

  it('神经插口必须有神经链接；资金不足时不更改角色', () => {
    const blank=createBlankCharacter();
    expect(buy('interface-plugs','neural').ok).toBe(false);
    const poor={...blank,eurobucks:10};
    const result=purchaseCatalogItem(poor,'neural-link',{creation:true,slot:'neural'});
    expect(result.ok).toBe(false);
    expect(result.character).toBe(poor);
  });

  it('赛博义体消耗 HL，时尚无损失，战役阶段按骰式计算', () => {
    const c=createBlankCharacter();
    const neural=purchaseCatalogItem(c,'neural-link',{creation:true,slot:'neural',purchaseId:'1'});
    expect(neural.character.humanity.current).toBe(c.humanity.current-7);
    expect(neural.character.humanity.max).toBe(c.humanity.max-2);
    const fashion=purchaseCatalogItem(neural.character,'emp-thread',{creation:true,slot:'fashion',budget:'fashion',purchaseId:'2'});
    expect(fashion.character.humanity.current).toBe(neural.character.humanity.current);
    expect(fashion.character.humanity.max).toBe(neural.character.humanity.max);
    const runtime=purchaseCatalogItem(c,'neural-link',{creation:false,slot:'neural',random:()=>0,purchaseId:'3'});
    expect(runtime.character.humanity.current).toBe(c.humanity.current-2); // 2d6 最低 2
  });

  it('安装义体后修改共情属性不会抹掉已扣人性', () => {
    const c=createBlankCharacter();
    const installed=purchaseCatalogItem(c,'cybereye',{creation:true,slot:'leftEye'}).character;
    const modified=changeAttribute(installed,'emp',6,true);
    expect(modified.humanity.current).toBe(60-7);
    expect(modified.humanity.max).toBe(58);
  });

  it('手臂、义腿单侧可用；旧存档无新字段仍可购物', () => {
    let character=createBlankCharacter();
    delete character.purchases;
    delete character.cyberwareInstallations;
    const arm=purchaseCatalogItem(character,'cyberarm',{creation:true,slot:'rightArm',purchaseId:'arm'});
    const leg=purchaseCatalogItem(arm.character,'cyberleg',{creation:true,slot:'leftLeg',purchaseId:'leg'});
    expect(leg.ok).toBe(true);
    expect(cyberSlotUsage(leg.character,'leftLeg').total).toBe(3);
    expect(cyberSlotUsage(leg.character,'rightLeg').items).toHaveLength(0);
  });
  it('rejects invalid creation funds and duplicate purchase IDs without charging again', () => {
    const character=createBlankCharacter();
    expect(purchaseCatalogItem({...character,eurobucks:3000},'heavy-pistol',{creation:true}).ok).toBe(false);
    expect(purchaseCatalogItem({...character,eurobucks:3000},'heavy-pistol',{creation:false}).ok).toBe(true);
    const first=purchaseCatalogItem(character,'heavy-pistol',{creation:true,purchaseId:'same'}).character;
    const repeated=purchaseCatalogItem(first,'heavy-pistol',{creation:true,purchaseId:'same'});
    expect(repeated.ok).toBe(false);
    expect(repeated.character).toBe(first);
  });
  it('undo is idempotent and fashion refunds never become cash', () => {
    const character=createBlankCharacter();
    const bought=purchaseCatalogItem(character,'jacket-fashion',{creation:true,budget:'fashion',purchaseId:'f'}).character;
    const undone=undoCreationPurchase(bought,'f');
    expect(undone.eurobucks).toBe(character.eurobucks);
    expect(undone.gear).toEqual(character.gear);
    expect(undoCreationPurchase(undone,'f')).toBe(undone);
  });
  it('preserves unknown legacy implants and blocks purchases until capacity is verified', () => {
    const character=createBlankCharacter();
    character.cyberwareInstallations=[{purchaseId:'legacy',catalogId:'unknown-old-eye',slot:'leftEye',humanityLoss:7}];
    expect(cyberSlotUsage(character,'leftEye').unknownCount).toBe(1);
    expect(checkShopPurchase(character,'cybereye','leftEye','general',true)).toContain('未映射');
    expect(character.cyberwareInstallations[0].catalogId).toBe('unknown-old-eye');
  });
});
