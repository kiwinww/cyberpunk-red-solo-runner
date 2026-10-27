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
});

