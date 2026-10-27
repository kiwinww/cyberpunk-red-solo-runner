import { describe,expect,it } from 'vitest';
import { conditionFromText, deduplicateSkillLabels, extractCheckSuggestions, inferSourcedCheck, skillMentions,sourcedSuggestion } from './skillAdvice';

describe('skill names and optional check advice',()=>{
  it('merges adjacent bracketed aliases without removing alternatives or meaningful repetitions',()=>{
    expect(deduplicateSkillLabels('【赛博技术】（cybertech）或【电子/安保技术】（电子/安防技术）')).toBe('【赛博技术】或【电子/安保技术】');
    expect(deduplicateSkillLabels('【洞察人心】（洞察人心）检定')).toBe('【洞察人心】检定');
    expect(deduplicateSkillLabels('觉察（等级2）觉察；觉察或说服')).toBe('觉察（等级2）觉察；觉察或说服');
  });
  it('infers only an unambiguous DV in the current source section',()=>{
    const source={sourceId:'red-streets-20261010',title:'街头故事',page:40,text:'发展《对手小队》觉察 D V 13。发展《另一个场景》觉察 DV17。'};
    const suggestion={skillId:'perception',reason:'观察'};
    expect(inferSourcedCheck(suggestion,[source],'对手小队')).toMatchObject({dv:13,sourcePage:40});
    expect(inferSourcedCheck(suggestion,[{...source,text:'觉察 DV13。觉察 DV17。'}],'对手小队').dv).toBeUndefined();
    expect(inferSourcedCheck(suggestion,[{...source,gmOnly:true}],'对手小队').dv).toBeUndefined();
    expect(inferSourcedCheck(suggestion,[{...source,sourceId:'red-core-20261010'}],'对手小队').dv).toBeUndefined();
    expect(inferSourcedCheck({...suggestion,dv:19},[source],'对手小队').dv).toBe(19);
  });
  it('handles compact Chinese checks and spaced headings without borrowing a neighboring section',()=>{
    const passages=[{sourceId:'red-streets-20261010',title:'',page:40,text:'发展 \n《对手小队》DV13觉察检定。发展 《试镜》觉察 DV17。'}];
    expect(sourcedSuggestion('perception',13,40,passages,'对手小队')).toBe(true);
    expect(sourcedSuggestion('perception',17,40,passages,'对手小队')).toBe(false);
    expect(inferSourcedCheck({skillId:'perception',reason:'观察'},passages,'对手小队').dv).toBe(13);
    expect(skillMentions('superperception perception-test')).toEqual([]);
    expect(inferSourcedCheck({skillId:'perception',reason:'观察'},passages,'引子').dv).toBeUndefined();
    expect(sourcedSuggestion('perception',13,40,passages,'引子')).toBe(false);
    expect(sourcedSuggestion('perception',13,40,[{...passages[0],sourceId:'red-core-20261010'}],'对手小队')).toBe(false);
  });
  it('recognizes the pictured IDs and English display names without splitting compound skills',()=>{
    expect(skillMentions('personal-grooming、wardrobe-style、Perception、local-expert、Human Perception').map(item=>item.skill.name)).toEqual(['个人仪容','衣着与风格','觉察','本地专家','洞察人心']);
  });
  it('does not mistake narrative skill levels for a DV',()=>{
    const suggestions=extractCheckSuggestions('判定建议（可选）：personal-grooming（等级1）或 wardrobe-style（等级1）；perception（等级2）或 local-expert（等级1）。依据 PDF40 页。');
    expect(suggestions.map(s=>s.skillId)).toEqual(['personal-grooming','wardrobe-style','perception','local-expert']);
    expect(suggestions.every(s=>s.dv===undefined)).toBe(true);
  });
  it('prefills the pictured single-skill suggestion only when its DV has matching source evidence',()=>{
    const text='判定建议（可选）：若选择侦察对面的人群，请进行 Perception（等级2）检定。依据 PDF40 页指引，观察可识破伏击（DV13）。';
    const source=[{sourceId:'red-streets-20261010',title:'街头故事',page:40,text:'进行一次 DV 13 的觉察检定可发现迹象。'}];
    expect(extractCheckSuggestions(text,source)[0]).toMatchObject({skillId:'perception',dv:13,sourcePage:40,condition:'visual'});
    expect(extractCheckSuggestions(text)[0].dv).toBeUndefined();
    expect(extractCheckSuggestions(text,[{...source[0],text:'通过 DV13 说服对方。'}])[0].dv).toBeUndefined();
  });
  it('keeps mixed skills and ambiguous conditions available for manual selection',()=>{
    expect(extractCheckSuggestions('判定建议：perception 或 persuasion，DV13，依据 PDF40 页。',[{sourceId:'red-streets-20261010',title:'',page:40,text:'觉察 DV13，说服 DV13'}]).every(s=>s.dv===undefined)).toBe(true);
    expect(conditionFromText('可以通过视觉或听觉确认')).toBe('standard');
  });
  it('does not borrow the DV of a nearby different skill or sentence',()=>{
    const passages=[{sourceId:'red-streets-20261010',title:'',page:40,text:'觉察 DV13，说服 DV17。其他行动 DV15。观察是你的选择。'}];
    expect(sourcedSuggestion('perception',13,40,passages)).toBe(true);
    expect(sourcedSuggestion('perception',17,40,passages)).toBe(false);
    expect(sourcedSuggestion('persuasion',13,40,passages)).toBe(false);
    expect(sourcedSuggestion('persuasion',15,40,passages)).toBe(false);
  });
});
