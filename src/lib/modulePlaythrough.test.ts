import { describe,expect,it } from 'vitest';
import { moduleCatalog } from '../data/moduleCatalog';
import { createDefaultCampaign } from './state';
import { advanceRunnerScene,createOfflineGmTurn,startRunnerCampaign } from './runner';
import { exportCampaign,importCampaign } from './storage';

describe('every module and scene playthrough',()=>{
  it.each(moduleCatalog)('$id supports scene actions, branches and save round-trips',module=>{
    for(const scene of module.scenes){
      const base=createDefaultCampaign();
      const campaign=startRunnerCampaign(base,{...base.settings,selectedModuleId:module.id,starterSceneId:scene.id});
      const reply=createOfflineGmTurn(campaign,'观察现场并确认风险');
      expect(reply.sceneId).toBe(scene.id);
      expect(reply.moduleId).toBe(module.id);
      expect(reply.body).not.toMatch(/undefined|NaN/);
      expect(reply.choices?.length).toBeGreaterThan(0);
      for(const choice of reply.choices??[])if(choice.targetSceneId){
        expect(scene.nextSceneIds).toContain(choice.targetSceneId);
        const moved=advanceRunnerScene(campaign,choice.targetSceneId);
        expect(moved.runner.sceneId).toBe(choice.targetSceneId);
        expect(moved.character).toEqual(base.character);
      }
      const loaded=importCampaign(exportCampaign(campaign));
      expect(loaded.runner.sceneId).toBe(scene.id);
      expect(loaded.character).toEqual(campaign.character);
    }
  });
  it.each(moduleCatalog)('$id keeps conversation, resolved checks and character resources separate in every scene',module=>{
    for(const scene of module.scenes){
      const base=createDefaultCampaign();
      const campaign=startRunnerCampaign(base,{...base.settings,selectedModuleId:module.id,starterSceneId:scene.id});
      const conversation=createOfflineGmTurn(campaign,'询问当前情况，不执行风险行动');
      expect(conversation.checkRequest).toBeUndefined();
      for(const success of [true,false]){
        const checked={...campaign,runner:{...campaign.runner,turns:[...campaign.runner.turns,{
          id:`check-${success}`,type:'check' as const,speaker:'规则判定',body:`觉察：${success?'成功':'失败'}`,createdAt:'',
          sceneId:scene.id,moduleId:module.id,sceneInstanceId:campaign.currentScene.id,
          checkResult:{skillName:'觉察',total:success?16:10,dv:13,success},
        }]}};
        const before=JSON.stringify(checked);
        const reply=createOfflineGmTurn(checked,'请根据刚才记录的真实判定结果描述后果并继续。');
        expect(reply.body).toContain(success?'本次行动检定成功':'本次行动检定失败');
        expect(reply.checkRequest).toBeUndefined();
        expect(reply.sceneInstanceId).toBe(campaign.currentScene.id);
        expect(reply.body).not.toMatch(/undefined|NaN/);
        if(!success)expect(reply.choices?.every(choice=>choice.kind!=='scene')).toBe(true);
        expect(JSON.stringify(checked)).toBe(before);
        expect(checked.character).toEqual(campaign.character);
      }
    }
  });
});

