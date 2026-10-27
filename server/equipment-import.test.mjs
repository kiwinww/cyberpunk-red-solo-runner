import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { localSourcesPlugin } from './local-sources.mjs';
import { parseEquipmentCatalog } from '../src/lib/equipmentCatalog';

describe.skipIf(!existsSync('.local-sources/equipment.json'))('local book equipment integration', () => {
  it('serves the validated private catalog without packaging book prose or filesystem paths', () => {
    let middleware;
    localSourcesPlugin().configureServer({middlewares:{use(fn){middleware=fn;}}});
    const headers={};
    let result;
    middleware({method:'GET',url:'/api/local-sources/equipment'},{setHeader(name,value){headers[name]=value;},end(body){result=JSON.parse(body);}},()=>{throw new Error('unhandled route');});
    expect(headers['Cache-Control']).toBe('private, no-store');
    expect(result.items).toHaveLength(447);
    expect(parseEquipmentCatalog(result)).toHaveLength(447);
    expect(JSON.stringify(result)).not.toContain('D:/');
    expect(result.items.every(item=>item.description.length<=100)).toBe(true);
  });
  it('covers the full equipment sections with correct packaging, prices and safe manual guards', () => {
    const {items}=JSON.parse(readFileSync('.local-sources/equipment.json','utf8'));
    const find=name=>items.find(item=>item.name===name);
    expect(items.filter(item=>item.category==='cyberware')).toHaveLength(96);
    expect(items.filter(item=>item.category==='fashion')).toHaveLength(90);
    expect(items.filter(item=>item.group==='弹药')).toHaveLength(52);
    expect(find('追踪器').price).toBe(500); // Portable tracker, not the 100eb implant.
    expect(items.find(item=>item.name==='追踪器' && item.category==='cyberware').price).toBe(100);
    expect(find('独立供氧系统').price).toBe(1000); // Not the 50eb replacement air tank.
    expect(find('博维生命紧身服').armorZone).toBe('both');
    expect(find('客舱巡航艇').minUnits).toBe(2);
    expect(find('防炫光').paired).toBe(true);
    expect(find('防炫光').manualReason).toBeUndefined();
    expect(find('技能芯片').manualReason).toContain('500eb');
    expect(find('基础弹药·榴弹（1枚）')).toBeUndefined();
    expect(find('穿甲弹药·榴弹（1枚）').price).toBe(100);
    expect(find('穿甲弹药·霰弹（10发）')).toBeUndefined();
  });
});
