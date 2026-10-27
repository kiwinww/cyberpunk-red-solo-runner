import { expect,it } from 'vitest';
import { createDefaultCampaign } from './state';
import { updateTrackedHp } from './combatTracking';
import { woundPenalty } from './checkContext';
import { exportCampaign,importCampaign } from './storage';

it('synchronizes tracked player HP, wound penalties and saves without healing other characters',()=>{
  const c=createDefaultCampaign();
  c.combat.combatants=[{id:'p',name:c.character.handle,side:'player',initiative:10,hpCurrent:c.character.hp.current,hpMax:c.character.hp.max,headSp:0,bodySp:0,notes:'',active:true},{id:'e',name:'原文目标',side:'enemy',initiative:8,hpCurrent:20,hpMax:20,headSp:0,bodySp:0,notes:'用户确认来源',active:true}];
  const next=updateTrackedHp(c,'p',1);
  expect(next.character.hp.current).toBe(1);expect(woundPenalty(next.character)).toBe(2);
  expect(next.combat.combatants[0].hpCurrent).toBe(1);
  expect(importCampaign(exportCampaign(next)).character.hp.current).toBe(1);
  expect(updateTrackedHp(next,'e',2).character).toEqual(next.character);
  expect(updateTrackedHp(c,'p',c.character.hp.max+1)).toBe(c);
  expect(updateTrackedHp(c,'p',-1)).toBe(c);
  expect(updateTrackedHp(c,'p',1.5)).toBe(c);
});
