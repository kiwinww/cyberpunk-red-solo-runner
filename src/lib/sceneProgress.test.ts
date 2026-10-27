import { describe,expect,it } from 'vitest';
import { moduleCatalog } from '../data/moduleCatalog';
import { characterApproach } from '../data/modulePlayProfiles';
import { ROLE_GUIDES } from '../rulesets/cyberpunk-red/roles';
import { createDefaultCampaign } from './state';
import { advanceRunnerScene,buildOfflineChoices,createOfflineGmTurn,recordSceneResolution,selectRunnerScene,startRunnerCampaign } from './runner';
import { exportCampaign,importCampaign } from './storage';

describe('source-backed solo progression',()=>{
  it('can load and save every canonical scene without altering character resources',()=>{
    for(const module of moduleCatalog.filter(item=>item.id.startsWith('streets-'))){
      for(const scene of module.scenes){
        const base=createDefaultCampaign();
        const moved=selectRunnerScene(base,module.id,scene.id);
        expect(moved.runner.sceneId).toBe(scene.id);
        expect(moved.settings.selectedModuleId).toBe(module.id);
        const recorded=recordSceneResolution(moved,'测试记录：仅验证存读，不宣告正式剧情结果。','no-check');
        const loaded=importCampaign(exportCampaign(recorded));
        expect(loaded.runner.sceneId).toBe(scene.id);
        expect(loaded.runner.resolutions?.[0].sceneInstanceId).toBe(loaded.currentScene.id);
        expect(loaded.character).toEqual(base.character);
        expect(createOfflineGmTurn(loaded).choices?.every(choice=>!choice.targetSceneId||module.scenes.some(item=>item.id===choice.targetSceneId))).toBe(true);
      }
    }
  });
  it.each(moduleCatalog)('$id preserves an essential route at every pace',module=>{
    for(const pace of ['slow','standard','fast'] as const){
      const base=createDefaultCampaign();
      const campaign=startRunnerCampaign(base,{...base.settings,selectedModuleId:module.id,starterSceneId:module.starterSceneId,pace});
      const scene=module.scenes.find(item=>item.id===module.starterSceneId)!;
      expect(buildOfflineChoices(campaign,module,scene).some(choice=>choice.kind==='scene')).toBe(true);
      const next=scene.nextSceneIds![0];
      const resolved=recordSceneResolution(campaign,'已核实本场景的联络条件；没有收款。','no-check');
      const moved=advanceRunnerScene(resolved,next);
      expect(moved.runner.sceneId).toBe(next);
      expect(moved.settings.starterSceneId).toBe(next);
      expect(moved.runner.resolutions?.[0].summary).toContain('没有收款');
      expect(importCampaign(exportCampaign(moved)).runner.resolutions).toEqual(moved.runner.resolutions);
      expect(moved.character).toEqual(base.character);
    }
  });
  it('keeps UI, GM and retrieval pointers together during cross-module loads',()=>{
    const base=createDefaultCampaign();
    const started=startRunnerCampaign(base,{...base.settings,selectedModuleId:'streets-9',starterSceneId:'streets-9-intro'});
    const moved=selectRunnerScene(started,'streets-1','streets-1-index-1');
    expect(moved.currentScene.title).toBe('搞到门票');
    expect(moved.runner.moduleId).toBe('streets-1');
    expect(moved.settings.selectedModuleId).toBe('streets-1');
    expect(moved.runner.turns.slice(-1)[0].sceneId).toBe('streets-1-index-1');
    expect(moved.runner.turns.slice(-1)[0].choices?.every(choice=>!choice.targetSceneId||choice.targetSceneId.startsWith('streets-1'))).toBe(true);
    expect(moved.character).toEqual(base.character);
  });
  it('repairs a recognized legacy mismatch without destroying visible state or old turns',()=>{
    const base=createDefaultCampaign();
    let c=startRunnerCampaign(base,{...base.settings,selectedModuleId:'streets-9',starterSceneId:'streets-9-intro'});
    const correct=selectRunnerScene(c,'streets-1','streets-1-index-1');
    c={...c,currentScene:correct.currentScene};
    const loaded=importCampaign(exportCampaign(c));
    expect(loaded.runner.moduleId).toBe('streets-1');
    expect(loaded.currentScene).toEqual(c.currentScene);
    expect(loaded.character).toEqual(c.character);
    expect(loaded.runner.turns.slice(0,c.runner.turns.length)).toEqual(c.runner.turns);
    expect(importCampaign(exportCampaign(loaded)).runner.turns).toEqual(loaded.runner.turns);
  });
  it('does not switch scenes while a response is pending',()=>{
    const c=createDefaultCampaign();c.runner.turns=[{id:'p',createdAt:'',speaker:'AI',type:'system',body:'等待',pending:true,pendingIntent:'行动'}];
    expect(selectRunnerScene(c,'streets-1','streets-1-index-1')).toBe(c);
  });
  it('does not reuse a check from an earlier visit or turn failure into success',()=>{
    const c=startRunnerCampaign(createDefaultCampaign(),createDefaultCampaign().settings);
    expect(recordSceneResolution(c,'没有掷骰却宣告成功','success')).toBe(c);
    c.runner.turns.push({id:'check',type:'check',speaker:'规则',body:'失败',createdAt:'',sceneId:c.runner.sceneId,moduleId:c.runner.moduleId,sceneInstanceId:c.currentScene.id,checkResult:{skillName:'觉察',total:10,dv:13,success:false}});
    expect(recordSceneResolution(c,'改成成功','success')).toBe(c);
    expect(recordSceneResolution(c,'失败后寻找其他办法','failure').runner.resolutions?.[0].outcome).toBe('failure');
    expect(recordSceneResolution({...c,currentScene:{...c.currentScene,id:'new-visit'}},'重复旧骰子','failure').runner.resolutions).toBeUndefined();
    const reply=createOfflineGmTurn(c,'请根据刚才记录的真实判定结果描述后果并继续。');
    expect(reply.choices?.map(choice=>choice.label)).toEqual(['换一种调查办法','尝试交涉或求助','评估退路与代价']);
    expect(reply.choices?.every(choice=>!choice.targetSceneId)).toBe(true);
  });
  it('uses distinct role approaches and player-safe openings instead of host instructions',()=>{
    const c=createDefaultCampaign();
    expect(new Set(Object.keys(ROLE_GUIDES).map(role=>characterApproach({...c,character:{...c.character,role}}))).size).toBe(10);
    for(const module of moduleCatalog.filter(item=>item.id.startsWith('streets-'))){
      const started=startRunnerCampaign(c,{...c.settings,selectedModuleId:module.id,starterSceneId:module.starterSceneId});
      const opening=createOfflineGmTurn(started);
      expect(opening.body).toContain(module.background.openingHook);
      expect(opening.body).not.toContain('按原文引子确认');
      expect(opening.body).not.toContain('大型企业通过合约');
    }
  });
  it('resolves a recorded failed check as failure and never grants money',()=>{
    let c=startRunnerCampaign(createDefaultCampaign(),createDefaultCampaign().settings);
    c.runner.turns.push({id:'check',type:'check',speaker:'规则',body:'觉察失败',createdAt:'',sceneId:c.runner.sceneId,moduleId:c.runner.moduleId,sceneInstanceId:c.currentScene.id,checkResult:{skillName:'觉察',total:10,dv:13,success:false}});
    const reply=createOfflineGmTurn(c,'请根据刚才记录的真实判定结果描述后果并继续。');
    expect(reply.body).toContain('本次行动检定失败');
    expect(recordSceneResolution(c,'没有找到有效线索，准备更换路线。','failure').character.eurobucks).toBe(c.character.eurobucks);
  });
  it.each(moduleCatalog)('$id never narrates an earlier visit as the current dice result',module=>{
    let c=startRunnerCampaign(createDefaultCampaign(),{...createDefaultCampaign().settings,selectedModuleId:module.id,starterSceneId:module.starterSceneId});
    c.runner.turns.push({id:'old-check',type:'check',speaker:'规则',body:'旧来访成功',createdAt:'',sceneId:c.runner.sceneId,moduleId:module.id,sceneInstanceId:c.currentScene.id,checkResult:{skillName:'觉察',total:20,dv:13,success:true}});
    c={...c,currentScene:{...c.currentScene,id:'new-visit'}};
    const reply=createOfflineGmTurn(c,'请根据刚才记录的真实判定结果描述后果并继续。');
    expect(reply.body).not.toContain('旧来访成功');
    expect(reply.body).not.toContain('本次行动检定成功');
  });
});
