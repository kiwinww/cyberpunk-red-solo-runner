import { existsSync,readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { RED_SKILLS } from '../src/rulesets/cyberpunk-red/index.ts';
import { inferSourcedCheck,sourcedSuggestion } from '../src/lib/skillAdvice.ts';
import { localSourcesPlugin } from './local-sources.mjs';

describe.skipIf(!existsSync('.local-sources/documents.json'))('private source numeric audit',()=>{
  it('checks source lookup and automatic DV candidates in every indexed scene',()=>{
    const index=JSON.parse(readFileSync('src/data/streetSceneIndex.json','utf8'));
    let middleware;
    localSourcesPlugin().configureServer({middlewares:{use(fn){middleware=fn;}}});
    let scenes=0,filled=0;
    for(const [module,entries] of Object.entries(index))for(const scene of entries){
      let passages=[];
      middleware({method:'GET',url:`/api/local-sources/search?module=${module}&scene=${scene.id}&q=${encodeURIComponent(scene.title+' DV 判定 检定')}`},{setHeader(){},end(body){passages=JSON.parse(body);}},()=>{});
      expect(Array.isArray(passages)).toBe(true);
      const story=passages.filter(p=>p.sourceId==='red-streets-20261010'&&!p.gmOnly);
      expect(story.length).toBeGreaterThan(0);
      expect(story.every(p=>p.page>=scene.page&&p.page<=scene.endPage)).toBe(true);
      for(const skill of RED_SKILLS){
        const result=inferSourcedCheck({skillId:skill.id,reason:'核对当前场景'},passages,scene.title);
        if(result.dv===undefined)continue;
        filled++;
        expect(Number.isInteger(result.dv)).toBe(true);
        expect(result.dv).toBeGreaterThan(0);
        expect(sourcedSuggestion(skill.id,result.dv,result.sourcePage,story,scene.title)).toBe(true);
      }
      scenes++;
    }
    expect(scenes).toBe(109);
    expect(filled).toBeGreaterThan(0);
    console.info(`Source audit: ${scenes} scenes, ${filled} unique skill/DV candidates; conditional outcomes still require action context.`);
  });
});
