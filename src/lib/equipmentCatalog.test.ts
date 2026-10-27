import { afterEach, describe, expect, it, vi } from 'vitest';
import { CREATION_CATALOG, type ShopItem } from '../data/creationCatalog';
import { equipmentCatalogStatus, loadLocalEquipmentCatalog, parseEquipmentCatalog } from './equipmentCatalog';
import { checkShopPurchase, creationUndoError, purchaseCatalogItem, undoCreationPurchase } from './characterShop';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { armorPenalty, equipmentStats } from './equipmentStats';
import { exportCampaign, importCampaign } from './storage';
import { createDefaultCampaign } from './state';

const original = [...CREATION_CATALOG];
const armor: ShopItem = {id:'core-bodysuit',name:'测试全身护甲',category:'armor',price:1000,page:350,description:'头部与身体',armorSp:11,armorZone:'both'};
const pack = (items: unknown[]) => ({schemaVersion:1,sourceId:'red-core-20261010',items});
afterEach(() => {
  CREATION_CATALOG.splice(0,CREATION_CATALOG.length,...original);
  equipmentCatalogStatus.loaded=false;
  equipmentCatalogStatus.message='精选起始目录（完整本机装备索引尚未加载）';
  vi.unstubAllGlobals();
});

describe('private equipment import', () => {
  it('merges new equipment without dropping stable IDs or mutating the active catalog', () => {
    const items=parseEquipmentCatalog(pack([armor]));
    expect(items).toHaveLength(original.length+1);
    expect(items.find(item=>item.id==='heavy-pistol')).toEqual(original.find(item=>item.id==='heavy-pistol'));
    expect(CREATION_CATALOG).toEqual(original);
  });
  it('rejects invalid schema, prices, duplicate IDs and historical identity conflicts', () => {
    for (const value of [pack([armor,armor]),pack([{...armor,price:-1}]),pack([{...armor,price:NaN}]),pack([{...armor,page:458}]),pack([{...armor,id:'heavy-pistol'}]),{...pack([armor]),schemaVersion:2}]) expect(()=>parseEquipmentCatalog(value)).toThrow();
  });
  it('rejects invalid implant slots, missing bases and unsupported humanity dice', () => {
    const implant: ShopItem={id:'core-implant',name:'测试植入物',category:'cyberware',price:100,page:360,description:'测试',slots:['leftEye'],humanityLoss:7,humanityDice:'2d6'};
    expect(()=>parseEquipmentCatalog(pack([{...implant,slots:['toString']}]))).toThrow();
    expect(()=>parseEquipmentCatalog(pack([{...implant,requiredBase:'missing'}]))).toThrow();
    expect(()=>parseEquipmentCatalog(pack([{...implant,humanityDice:'3d6+2'}]))).toThrow();
  });
  it('loads a private catalog and degrades visibly without replacing it on network/format failure', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>pack([armor])}));
    await loadLocalEquipmentCatalog();
    expect(equipmentCatalogStatus.loaded).toBe(true);
    expect(CREATION_CATALOG.some(item=>item.id===armor.id)).toBe(true);
    const loaded=[...CREATION_CATALOG];
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
    await loadLocalEquipmentCatalog();
    expect(CREATION_CATALOG).toEqual(loaded);
    expect(equipmentCatalogStatus.loaded).toBe(false);
    expect(equipmentCatalogStatus.message).toContain('sources:equipment');
  });
  it('never charges for manual-only equipment', () => {
    CREATION_CATALOG.push({...armor,manualReason:'需核对配置总价'});
    const character=createBlankCharacter();
    const result=purchaseCatalogItem(character,armor.id,{creation:true});
    expect(result.ok).toBe(false);
    expect(result.character).toBe(character);
    expect(result.message).toContain('配置总价');
  });
  it('applies both-zone armor once and undoes it without erasing the original armor', () => {
    CREATION_CATALOG.push(armor);
    const character={...createBlankCharacter(),armor:{headSp:7,bodySp:4}};
    const result=purchaseCatalogItem(character,armor.id,{creation:true,purchaseId:'suit'});
    expect(result.ok).toBe(true);
    expect(result.character.armor).toEqual({headSp:11,bodySp:11});
    const undone=undoCreationPurchase(result.character,'suit');
    expect(undone.armor).toEqual(character.armor);
    expect(undone.eurobucks).toBe(character.eurobucks);
    expect(undoCreationPurchase(undone,'suit')).toBe(undone);
  });
  it('enforces acceleration exclusivity in either installation order', () => {
    const kerenzikov: ShopItem={id:'core-kerenzikov',name:'克伦齐科夫',category:'cyberware',price:500,page:359,description:'加速组件',slots:['neural'],requiredBase:'neural-link',humanityLoss:14,humanityDice:'4d6'};
    CREATION_CATALOG.push(kerenzikov);
    for (const [first,second] of [['sandevistan',kerenzikov.id],[kerenzikov.id,'sandevistan']]) {
      const neural=purchaseCatalogItem(createBlankCharacter(),'neural-link',{creation:true,slot:'neural'}).character;
      const installed=purchaseCatalogItem(neural,first,{creation:true,slot:'neural'});
      expect(installed.ok).toBe(true);
      expect(checkShopPurchase(installed.character,second,'neural','general',true)).toContain('加速组件');
    }
  });
  it('does not refund an unmapped imported item while leaving it in the backpack', () => {
    const character=createBlankCharacter();
    character.purchases=[{id:'legacy',title:'导入物品',cost:100,budget:'general',catalogId:'core-unavailable'}];
    character.gear=['导入物品'];
    expect(creationUndoError(character,'legacy')).toContain('尚未载入');
    expect(undoCreationPurchase(character,'legacy')).toBe(character);
  });
  const pair:ShopItem={id:'test-pair',name:'测试成对义眼组件',category:'cyberware',price:100,page:360,description:'成对测试',paired:true,slots:['leftEye','rightEye'],requiredBase:'cybereye',humanityLoss:2,humanityDice:'1d6'};
  const withEyes=()=>{
    const left=purchaseCatalogItem(createBlankCharacter(),'cybereye',{creation:true,slot:'leftEye'}).character;
    return purchaseCatalogItem(left,'cybereye',{creation:true,slot:'rightEye'}).character;
  };
  it('installs a pair atomically and refunds both sides exactly once',()=>{
    CREATION_CATALOG.push(pair);
    const character=withEyes();
    const result=purchaseCatalogItem(character,pair.id,{creation:true,slot:'rightEye',purchaseId:'pair'});
    expect(result.ok).toBe(true);
    expect(result.character.eurobucks).toBe(character.eurobucks-200);
    expect(result.character.humanity.current).toBe(character.humanity.current-4);
    expect(result.character.humanity.max).toBe(character.humanity.max-4);
    expect(result.character.purchases?.filter(p=>p.groupId==='pair')).toHaveLength(2);
    const undone=undoCreationPurchase(result.character,'pair:leftEye');
    expect(undone.eurobucks).toBe(character.eurobucks);
    expect(undone.humanity).toEqual(character.humanity);
    expect(undoCreationPurchase(undone,'pair:rightEye')).toBe(undone);
    expect(purchaseCatalogItem(result.character,pair.id,{creation:true,slot:'leftEye',purchaseId:'pair'}).ok).toBe(false);
    const restored=importCampaign(exportCampaign({...createDefaultCampaign(),character:result.character}));
    expect(undoCreationPurchase(restored.character,'pair:rightEye').eurobucks).toBe(character.eurobucks);
    expect(undoCreationPurchase(restored.character,'pair:rightEye').humanity).toEqual(character.humanity);
  });
  it('rejects missing counterparts, insufficient slots/cash and rolls back second-side runtime failure',()=>{
    CREATION_CATALOG.push({...pair,slotsUsed:3});
    const left=purchaseCatalogItem(createBlankCharacter(),'cybereye',{creation:true,slot:'leftEye'}).character;
    expect(checkShopPurchase(left,pair.id,'leftEye','general',true)).toContain('右赛博眼');
    const eyes=withEyes();
    const full=purchaseCatalogItem(eyes,'chiron',{creation:true,slot:'leftEye'}).character;
    expect(checkShopPurchase(full,pair.id,'leftEye','general',true)).toContain('槽位不足');
    expect(checkShopPurchase({...eyes,eurobucks:150},pair.id,'leftEye','general',true)).toContain('200eb');
    const lowHumanity={...eyes,humanity:{...eyes.humanity,current:6}};
    let roll=0;
    const failed=purchaseCatalogItem(lowHumanity,pair.id,{creation:false,slot:'leftEye',random:()=>roll++===0?0:0.99});
    expect(failed.ok).toBe(false);
    expect(failed.character).toBe(lowHumanity);
  });
  it('prices configurable units, validates minimum/integer counts and undoes the exact purchased title',()=>{
    const vehicle:ShopItem={id:'test-vehicle',name:'测试船舱',category:'gear',price:30000,page:190,description:'按舱室计价',minUnits:2,unitLabel:'舱室'};
    CREATION_CATALOG.push(vehicle);
    const rich={...createBlankCharacter(),eurobucks:100000};
    expect(purchaseCatalogItem(rich,vehicle.id,{creation:false,units:1}).ok).toBe(false);
    expect(purchaseCatalogItem(rich,vehicle.id,{creation:false,units:2.5}).ok).toBe(false);
    const bought=purchaseCatalogItem(rich,vehicle.id,{creation:false,units:3,purchaseId:'boat'});
    expect(bought.ok).toBe(true);
    expect(bought.character.eurobucks).toBe(10000);
    expect(bought.character.gear).toContain('测试船舱（3舱室）');
    const undo=undoCreationPurchase(bought.character,'boat');
    expect(undo.eurobucks).toBe(100000);
    expect(undo.gear).toEqual(rich.gear);
  });
  it('applies only the worst worn armor penalty without changing creation attributes',()=>{
    CREATION_CATALOG.push({...armor,id:'test-heavy-head',armorZone:'head',armorPenalty:2,price:100},{...armor,id:'test-heavy-body',armorZone:'body',armorPenalty:4,price:500});
    const original=createBlankCharacter();
    const head=purchaseCatalogItem(original,'test-heavy-head',{creation:true,purchaseId:'h'}).character;
    const body=purchaseCatalogItem(head,'test-heavy-body',{creation:true,purchaseId:'b'}).character;
    expect(armorPenalty(body)).toBe(4);
    expect(equipmentStats(body).ref).toBe(Math.max(0,original.stats.ref-4));
    expect(body.stats).toEqual(original.stats);
    expect(armorPenalty(undoCreationPurchase(body,'b'))).toBe(2);
    expect(equipmentStats({...body,stats:{...body.stats,move:2}}).move).toBe(0);
  });
  it('allows a single meat-limb component and uses the matching limb base for universal covers',()=>{
    const meat:ShopItem={id:'test-meat',name:'测试肉体组件',category:'cyberware',price:100,page:364,description:'肉体手臂可用',slots:['leftArm','rightArm'],requiredBase:'cyberarm',allowMeat:true,humanityLoss:3,humanityDice:'1d6'};
    CREATION_CATALOG.push(meat,{...meat,id:'test-second-meat'});
    const first=purchaseCatalogItem(createBlankCharacter(),meat.id,{creation:true,slot:'leftArm'});
    expect(first.ok).toBe(true);
    expect(purchaseCatalogItem(first.character,'test-second-meat',{creation:true,slot:'leftArm'}).ok).toBe(false);
    CREATION_CATALOG.push({...meat,id:'test-cover',allowMeat:false,slots:['leftArm','rightArm','leftLeg','rightLeg'],slotsUsed:0,humanityLoss:0});
    const leg=purchaseCatalogItem(createBlankCharacter(),'cyberleg',{creation:true,slot:'leftLeg'}).character;
    expect(purchaseCatalogItem(leg,'test-cover',{creation:true,slot:'leftLeg'}).ok).toBe(true);
  });
});
