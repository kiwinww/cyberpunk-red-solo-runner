import { afterEach,expect,it } from 'vitest';
import { CREATION_CATALOG } from '../data/creationCatalog';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { equipmentBonuses } from './equipmentBonuses';
const original=[...CREATION_CATALOG];
afterEach(()=>CREATION_CATALOG.splice(0,CREATION_CATALOG.length,...original));
it('requires using a tool and never stacks copies of the same equipment effect',()=>{
  CREATION_CATALOG.push({id:'test-agent',name:'测试代理',category:'gear',price:100,page:352,description:'测试',checkBonuses:[{skills:['library-search'],value:2,condition:'tool',group:'agent',page:352}]});
  const character=createBlankCharacter();character.gear=['测试代理','测试代理'];
  expect(equipmentBonuses(character,'library-search','standard',false).total).toBe(0);
  expect(equipmentBonuses(character,'library-search','standard',true).total).toBe(2);
  expect(equipmentBonuses(character,'handgun','standard',true).total).toBe(0);
});
it('applies paired sensory effects only when both sides are installed and the context matches',()=>{
  CREATION_CATALOG.push({id:'test-vision',name:'测试视觉',category:'cyberware',price:500,page:360,description:'测试',paired:true,slots:['leftEye','rightEye'],checkBonuses:[{skills:['perception'],value:2,condition:'visual',group:'vision',page:360}]});
  const character=createBlankCharacter();character.cyberwareInstallations=[{purchaseId:'left',catalogId:'test-vision',slot:'leftEye',humanityLoss:3}];
  expect(equipmentBonuses(character,'perception','visual',false).total).toBe(0);
  character.cyberwareInstallations.push({purchaseId:'right',catalogId:'test-vision',slot:'rightEye',humanityLoss:3});
  expect(equipmentBonuses(character,'perception','visual',false).total).toBe(2);
  expect(equipmentBonuses(character,'perception','auditory',false).total).toBe(0);
});
