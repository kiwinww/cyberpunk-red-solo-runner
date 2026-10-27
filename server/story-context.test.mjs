import { describe,expect,it } from 'vitest';
import { existsSync,readFileSync } from 'node:fs';
import { modulePeople } from './story-context.mjs';
import { localSourcesPlugin } from './local-sources.mjs';

it('scopes biography records to their module and marks them as backstage information',()=>{
  const document={id:'test',title:'测试人物书',outline:[{title:'Appendix C: Biographies',page:1}],pages:['露西（她）：一名调查对象。登场于《甲剧本》。\n莲（他）：另一人的秘密。登场于《乙剧本》。']};
  const people=modulePeople(document,'甲剧本','露西和莲');
  expect(people).toHaveLength(1);expect(people[0].name).toBe('露西');expect(people[0].gmOnly).toBe(true);
  expect(people[0].text).not.toContain('另一人的秘密');
});
describe.skipIf(!existsSync('.local-sources/documents.json'))('owned book character integration',()=>{
  it('pins every adventure to its actual current scene even when a query asks for later endings',()=>{
    const adventures=JSON.parse(readFileSync('src/data/streetAdventures.json','utf8'));
    const index=JSON.parse(readFileSync('src/data/streetSceneIndex.json','utf8'));
    let middleware;localSourcesPlugin().configureServer({middlewares:{use(fn){middleware=fn;}}});
    for(const adventure of adventures){
      for(const scene of [undefined,index[adventure.id][1]]){
        let hits;
        middleware({method:'GET',url:`/api/local-sources/search?q=${encodeURIComponent('结局 尾声 幕后')}&module=${adventure.id}&scene=${scene?.id??adventure.id+'-intro'}&intro=170&start=1&end=198`},{setHeader(){},end(body){hits=JSON.parse(body);}},()=>{});
        const story=hits.filter(hit=>hit.sourceId==='red-streets-20261010' && !hit.gmOnly);
        expect(story.length).toBeGreaterThan(0);
        expect(story.every(hit=>hit.page>=(scene?.page??adventure.intro) && hit.page<=(scene?.endPage??index[adventure.id][0].page))).toBe(true);
      }
    }
  });
  it('retrieves the selected adventure biography without importing NPCs from other adventures',()=>{
    const documents=JSON.parse(readFileSync('.local-sources/documents.json','utf8'));
    const book=documents.find(doc=>doc.id==='red-streets-20261010');
    const people=modulePeople(book,'歌剧院之夜','露西');
    expect(people.some(person=>person.name.includes('露西'))).toBe(true);
    expect(people.every(person=>person.text.includes('《歌剧院之夜》'))).toBe(true);
    expect(people.some(person=>person.name.includes('勒马尔'))).toBe(false);
  });
  it('uses authoritative adventure bounds and excludes unrelated encounters and sheet templates',()=>{
    let middleware;localSourcesPlugin().configureServer({middlewares:{use(fn){middleware=fn;}}});
    let hits;
    middleware({method:'GET',url:`/api/local-sources/search?q=${encodeURIComponent('露西')}&module=streets-1&start=20&end=37`},{setHeader(){},end(body){hits=JSON.parse(body);}},()=>{});
    expect(hits.some(hit=>hit.kind==='world')).toBe(true);
    expect(hits.some(hit=>hit.kind==='npc' && hit.name.includes('露西'))).toBe(true);
    expect(hits.filter(hit=>hit.sourceId==='red-streets-20261010' && !hit.gmOnly).every(hit=>hit.page>=6 && hit.page<=19)).toBe(true);
    expect(hits.some(hit=>hit.sourceId==='red-sheet-20260507')).toBe(false);
    expect(hits.some(hit=>hit.sourceId==='red-core-20261010' && hit.page>=417)).toBe(false);
  });
});
