import { Fragment } from 'react';
import { Campaign,CharacterSheet } from '../domain/types';
import { deduplicateSkillLabels,skillMentions,STAT_NAMES,SKILL_USES } from '../lib/skillAdvice';
import { HelpTip } from './HelpTip';
import { ruleTermMentions } from '../lib/ruleTerms';
import { storyMentions,StoryMention } from '../lib/storyAnnotations';
import { equipmentStats } from '../lib/equipmentStats';
import { effectiveEmpathy } from '../rulesets/cyberpunk-red/character';
import { Info } from 'lucide-react';

export function SkillAnnotatedText({text:raw,character,campaign}:{text:string;character:CharacterSheet;campaign?:Campaign}) {
  const text=deduplicateSkillLabels(raw);
  const mentions:Array<StoryMention & {kind:'rule'|'story'|'skill'}>=ruleTermMentions(text,character).map(term=>({...term,kind:'rule'}));
  if(campaign)mentions.push(...storyMentions(text,campaign).map(term=>({...term,kind:'story' as const})));
  for(const mention of skillMentions(text)){
    const level=character.skills.find(skill=>skill.skillId===mention.skill.id)?.level??0;
    const stat=mention.skill.linkedStat;
    const value=stat==='emp'?effectiveEmpathy(character):equipmentStats(character)[stat];
    const claimed=text.slice(mention.end,mention.end+20).match(/^\s*(?:[（(]\s*)?等级\s*(\d+)/);
    const mismatch=claimed && Number(claimed[1])!==level ? `\n主持文字提到等级${claimed[1]}，但当前人物卡为${level}级；自动判定使用人物卡，不改写角色。` : '';
    const help=`${mention.skill.name} · ${mention.skill.id}\n${SKILL_USES[mention.skill.id]??'用于对应专业范围内的行动；未知专业、语言或地区不能按名称推定为熟练。'}\n关联属性：${STAT_NAMES[stat]}；人物卡技能等级：${level}。\n当前有效属性 ${value}＋技能 ${level}＝基准 ${value+level}（属性已包含适用护甲减值）。身份、装备、伤势与临时修正须按本次条件另行计入，不能重复加减。\n一般检定：基准＋1d10＋适用修正，最终值须严格超过DV。掷10或1有追加骰处理，不代表自动成功或失败。\n建卡通常最高6级；×2技能的点数成本翻倍，不是结果翻倍。技能等级不是角色总等级。${mismatch}\n依据：核心规则 PDF 81–90、128–141 页。`;
    mentions.push({...mention,label:mention.skill.name,help,kind:'skill'});
  }
  const parts=[];
  let end=0;
  for(const mention of mentions.sort((a,b)=>a.start-b.start || b.end-a.end)){
    if(mention.start<end)continue;
    parts.push(<Fragment key={`text-${end}`}>{text.slice(end,mention.start)}</Fragment>);
    const label=`${mention.label}${mention.kind==='skill'?'技能说明':mention.kind==='story'?'资料说明':'规则说明'}`;
    parts.push(<HelpTip key={`tip-${mention.start}`} label={label} text={mention.help}>{mention.label}{mention.kind!=='rule'&&<Info size={12} aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginLeft:3}}/>}</HelpTip>);
    end=mention.end;
  }
  parts.push(<Fragment key={`tail-${end}`}>{text.slice(end)}</Fragment>);
  return <>{parts}</>;
}
