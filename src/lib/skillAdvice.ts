import { RunnerTurn, SkillEntry, StatKey } from '../domain/types';
import { RED_SKILLS } from '../rulesets/cyberpunk-red';
import { LocalPassage } from './localSources';

export const STAT_NAMES:Record<StatKey,string>={int:'智力',ref:'反应',dex:'敏捷',tech:'技术',cool:'酷',will:'意志',luck:'幸运',move:'移动',body:'体魄',emp:'共情'};
export type CheckSuggestion=NonNullable<RunnerTurn['checkRequest']>;
export const SKILL_USES:Record<string,string>={
  perception:'留意周围动静与可观察的细节；不自动揭示隐藏事实或他人的动机。',
  'human-perception':'从言行判断对方的情绪和意图；不是读取思想或自动识破一切谎言。',
  'personal-grooming':'打理个人仪容和身体外观，与搭配服装的技能不同。',
  'wardrobe-style':'选择和搭配服饰，判断穿着风格与场合是否相称。',
  'local-expert':'运用指定地区的本地知识；地区范围需要在角色备注中明确。',
  'local-expert-home':'运用住地的本地知识；不等于熟悉夜之城所有地区。',
  persuasion:'尝试用理由与表达说服对方；具体要求和风险决定是否需要检定。',
  bribery:'判断和提出利益交换；掷骰不代表钱已支付或对方必然接受。',
  stealth:'在行动中避免被发现，具体感官与环境影响检定条件。',
  athletics:'进行奔跑、攀爬、跳跃等身体运动；具体行动仍需按规则确定难度。',
};
export function conditionFromText(text:string):NonNullable<CheckSuggestion['condition']> {
  const auditory=/听觉|聆听|倾听/.test(text),visual=/视觉|观察|窥察|侦察|看清/.test(text);
  return auditory===visual?'standard':auditory?'auditory':'visual';
}
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliases=RED_SKILLS.flatMap(skill=>[skill.id,skill.id.replace(/-/g,' '),skill.name].map(name=>({name,skill})));
aliases.push({name:'Wardrobe & Style',skill:RED_SKILLS.find(skill=>skill.id==='wardrobe-style')!});
for(const [name,id] of [['察言观色','human-perception'],['电子/安防技术','electronics-security-tech'],['徒手搏斗','brawling']])aliases.push({name,skill:RED_SKILLS.find(skill=>skill.id===id)!});
const byName=new Map(aliases.map(item=>[item.name.toLowerCase(),item.skill]));
const pattern=[...byName.keys()].sort((a,b)=>b.length-a.length).map(name=>/^[a-z0-9]/i.test(name)?`(?<![a-z0-9-])${escape(name)}(?![a-z0-9-])`:escape(name)).join('|');

export function skillMentions(text:string):Array<{start:number;end:number;raw:string;skill:SkillEntry}> {
  const matches=[];
  for(const match of text.matchAll(new RegExp(`(?:${pattern})`,'gi'))){
    matches.push({start:match.index!,end:match.index!+match[0].length,raw:match[0],skill:byName.get(match[0].toLowerCase())!});
  }
  return matches;
}

/** Remove only adjacent aliases for the same skill, preserving different choices and grades. */
export function deduplicateSkillLabels(text:string):string {
  const mentions=skillMentions(text);
  const ranges:Array<[number,number]>=[];
  for(let i=1;i<mentions.length;i++){
    const previous=mentions[i-1],current=mentions[i];
    if(previous.skill.id!==current.skill.id)continue;
    const gap=text.slice(previous.end,current.start);
    if(!/^[\s【】\[\]（）()]*$/.test(gap))continue;
    let end=current.end;
    const suffix=text.slice(end).match(/^[】\])）]/)?.[0];
    if(suffix && /[【\[(（]/.test(gap))end+=suffix.length;
    const closing=gap.match(/^[\s】\])）]*/)?.[0].length??0;
    ranges.push([previous.end+closing,end]);
  }
  for(const [start,end] of ranges.reverse())text=text.slice(0,start)+text.slice(end);
  return text;
}

function scenePassageText(text:string,sceneTitle?:string):string {
  text=text.normalize('NFKC').replace(/D\s+V/gi,'DV');
  if(!sceneTitle)return text;
  const headings=[...text.matchAll(/(?:可选\s*)?(?:发展|悬念|高潮|结局)\s*《([^》]+)》/g)].filter(match=>!/(?:前往|参见|转入|继续|进入)[^。！？《》]{0,60}$/.test(text.slice(Math.max(0,match.index!-80),match.index)));
  if(!headings.length)return text;
  const current=headings.findIndex(heading=>heading[1].replace(/\s+/g,'')===sceneTitle.replace(/\s+/g,''));
  return current<0?'':text.slice(headings[current].index,headings[current+1]?.index);
}

export function sourcedSuggestion(skillId:string,dv:unknown,page:unknown,passages:LocalPassage[],sceneTitle?:string):boolean {
  return Number.isInteger(dv) && Number(dv)>0 && Number(dv)<=99 && passages.some(p=>{
    if(p.gmOnly || p.page!==page || !p.sourceId.startsWith('red-')) return false;
    if(sceneTitle && p.sourceId!=='red-streets-20261010')return false;
    if(p.sourceId==='red-streets-20261010' && (sceneTitle==='引子'||sceneTitle==='背景与引入'))return false;
    const source=scenePassageText(p.text,sceneTitle);
    const mentions=skillMentions(source),dvs=[...source.matchAll(/DV\s*([0-9]{1,2})(?![0-9])/gi)];
    return mentions.some(mention=>mention.skill.id===skillId && dvs.some(value=>{
      if(Number(value[1])!==dv) return false;
      const start=Math.min(mention.start,value.index!),end=Math.max(mention.end,value.index!+value[0].length);
      return end-start<=100 && !/[。！？；;，,、]/.test(source.slice(start,end))
        && !mentions.some(other=>other.start!==mention.start && other.start>=start && other.end<=end)
        && !dvs.some(other=>other.index!==value.index && other.index!>=start && other.index!<end);
    }));
  });
}

export function inferSourcedCheck(suggestion:CheckSuggestion,passages:LocalPassage[],sceneTitle:string):CheckSuggestion {
  if(!suggestion.skillId || suggestion.dv!==undefined)return suggestion;
  if(sceneTitle==='引子'||sceneTitle==='背景与引入')return suggestion;
  const candidates:Array<{dv:number;page:number}>=[];
  for(const passage of passages){
    if(passage.gmOnly || passage.sourceId!=='red-streets-20261010' || (suggestion.sourcePage && suggestion.sourcePage!==passage.page))continue;
    const text=scenePassageText(passage.text,sceneTitle);
    for(const match of text.matchAll(/DV\s*([0-9]{1,2})(?![0-9])/gi)){
      const dv=Number(match[1]);
      if(sourcedSuggestion(suggestion.skillId,dv,passage.page,[{...passage,text}]))candidates.push({dv,page:passage.page});
    }
  }
  const unique=[...new Set(candidates.map(item=>item.dv))];
  return unique.length===1?{...suggestion,dv:unique[0],sourcePage:candidates[0].page}:suggestion;
}

/** Optional prose advice never becomes a compulsory pending check. */
export function extractCheckSuggestions(text:string,passages:LocalPassage[]=[],sceneTitle?:string):CheckSuggestion[] {
  const hint=text.match(/(?:判定建议|检定建议|需要判定|建议判定)[：:（(]|(?:请|需要|建议)(?:进行|做)(?:一次)?/);
  if(!hint) return [];
  const advice=text.slice(hint.index!,hint.index!+2000);
  const pageMatches=[...advice.matchAll(/PDF\s*(\d+)\s*页/gi)];
  const pages=[...new Set(pageMatches.map(match=>Number(match[1])))];
  const allSkills=new Set(skillMentions(advice).map(mention=>mention.skill.id));
  const allDvs=[...new Set([...advice.matchAll(/DV\s*([0-9]{1,2})(?![0-9])/gi)].map(match=>Number(match[1])))];
  const suggestions:CheckSuggestion[]=[];
  for(const clause of advice.split(/[。；;\n]/)){
    const mentions=skillMentions(clause);
    const ids=[...new Set(mentions.map(mention=>mention.skill.id))];
    const dvs=[...new Set([...clause.matchAll(/DV\s*([0-9]{1,2})(?![0-9])/gi)].map(match=>Number(match[1])))];
    for(const skillId of ids){
      if(suggestions.some(item=>item.skillId===skillId)) continue;
      const dv=ids.length===1 && dvs.length===1 ? dvs[0] : allSkills.size===1 && allDvs.length===1 ? allDvs[0] : undefined;
      const page=pages.length===1?pages[0]:undefined;
      const verified=sourcedSuggestion(skillId,dv,page,passages,sceneTitle);
      suggestions.push({skillId,reason:clause.trim().slice(0,500),dv:verified?dv:undefined,sourcePage:verified?page:undefined,condition:conditionFromText(clause)});
    }
  }
  return suggestions.slice(0,6);
}
