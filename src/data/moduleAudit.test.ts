import { describe,expect,it } from 'vitest';
import adventures from './streetAdventures.json';
import index from './streetSceneIndex.json';
import { streetModules } from './streetModules';
import { moduleAliases, moduleCatalog, moduleChoices } from './moduleCatalog';
import { moduleHostingChecks } from './moduleHosting';

describe('all adventure indexes',()=>{
  it('offers nine unique stories while retaining both legacy IDs for saved campaigns',()=>{
    expect(moduleChoices).toHaveLength(9);
    expect(new Set(moduleChoices.map(module=>module.id)).size).toBe(9);
    for(const [legacy,current] of Object.entries(moduleAliases)){
      expect(moduleCatalog.some(module=>module.id===legacy)).toBe(true);
      expect(moduleChoices.some(module=>module.id===legacy)).toBe(false);
      expect(moduleChoices.some(module=>module.id===current)).toBe(true);
    }
  });
  it.each(adventures)('$id has distinct, bounded scene references and continuity checks',adventure=>{
    const scenes=index[adventure.id as keyof typeof index];
    const module=streetModules.find(module=>module.id===adventure.id)!;
    expect(scenes.length).toBeGreaterThanOrEqual(7);
    expect(new Set(module.scenes.map(scene=>scene.id)).size).toBe(module.scenes.length);
    for(const entry of scenes){
      expect(entry.page).toBeGreaterThanOrEqual(adventure.start);
      expect(entry.endPage).toBeLessThanOrEqual(adventure.end);
      expect(entry.endPage).toBeGreaterThanOrEqual(entry.page);
      expect(module.scenes.find(scene=>scene.id===entry.id)?.pageRefs[0].page).toBe(entry.page);
    }
    expect(moduleHostingChecks(adventure.id)).toHaveLength(3);
    expect(module.scenes.slice(1).every(scene=>scene.spoilerLevel==='gm-index')).toBe(true);
    expect(module.scenes[0].nextSceneIds?.length).toBeGreaterThan(0);
    for(const scene of module.scenes) for(const next of scene.nextSceneIds??[]) expect(module.scenes.some(item=>item.id===next)).toBe(true);
  });
  it('preserves legacy scene identifiers and exposes the corresponding verified index',()=>{
    for(const [id,oldId,canonical] of [['opera-night-preview','opera-setup','streets-1'],['desire-agent-preview','desire-setup','streets-2']]){
      const module=moduleCatalog.find(module=>module.id===id)!;
      expect(module.scenes.some(scene=>scene.id===oldId)).toBe(true);
      expect(module.scenes.some(scene=>scene.id===`${id}-${canonical}-index-1`)).toBe(true);
      expect(moduleHostingChecks(id)).toEqual(moduleHostingChecks(canonical));
    }
  });
});
