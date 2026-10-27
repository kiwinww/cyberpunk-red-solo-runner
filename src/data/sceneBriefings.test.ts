import { expect,it } from 'vitest';
import { moduleCatalog } from './moduleCatalog';
import { sceneBriefing } from './sceneBriefings';

it('provides short guidance for every scene and distinct source-backed first arrivals',()=>{
  const first=[];
  for(const module of moduleCatalog){
    for(const scene of module.scenes){
      const brief=sceneBriefing(module,scene);
      expect(brief.length).toBeGreaterThan(10);
      expect(brief.length).toBeLessThan(200);
      expect(brief).not.toMatch(/已获得|自动成功|奖励到账/);
    }
    if(module.id.startsWith('streets-')) first.push(sceneBriefing(module,module.scenes[1]));
  }
  expect(new Set(first).size).toBe(9);
});
