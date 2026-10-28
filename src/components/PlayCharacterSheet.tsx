import { useState } from 'react';
import type { CharacterSheet, StatKey } from '../domain/types';
import { CREATION_CATALOG, getShopItem } from '../data/creationCatalog';
import { fieldHelp } from '../data/ruleHelp';
import { equipmentHelp } from '../lib/equipmentHelp';
import { equipmentStats } from '../lib/equipmentStats';
import { STAT_NAMES } from '../lib/skillAdvice';
import { RED_SKILLS } from '../rulesets/cyberpunk-red';
import { effectiveEmpathy } from '../rulesets/cyberpunk-red/character';
import { roleGuide } from '../rulesets/cyberpunk-red/roles';
import { CyberwareOverview } from './CharacterEquipment';
import { HelpTip } from './HelpTip';
import { SkillAnnotatedText } from './SkillAnnotatedText';

export function PlayCharacterSheet({character}:{character:CharacterSheet}) {
  const [skillSearch,setSkillSearch]=useState('');
  const [showUntrained,setShowUntrained]=useState(false);
  const guide=roleGuide(character.role);
  const stats=equipmentStats(character);
  const itemFor=(name:string)=>getShopItem(character.purchases?.find(p=>p.title===name)?.catalogId??'')??CREATION_CATALOG.find(item=>item.name===name);
  const inventory=(names:string[],empty:string)=>names.length?<ul className="play-equipment-list">{names.map((name,index)=>{
    const item=itemFor(name);
    return <li key={`${name}-${index}`}><HelpTip label={`${name}说明`} text={item?equipmentHelp(item):'旧存档或手动登记的装备，尚未关联资料条目。不会据名称自动赋予伤害、护甲或技能加值。'}>{name}</HelpTip>{item?.damage&&<small>伤害 {item.damage} · ROF {item.rof??'待确认'}</small>}</li>;
  })}</ul>:<p className="hint">{empty}</p>;
  return <section className="play-character-sheet" aria-label="游戏角色卡">
    <h3>{character.handle}</h3>
    <HelpTip label="身份能力说明" text={guide?`${guide.summary}\n来源：核心规则 PDF ${guide.page} 页。身份等级不是全部技能的通用加值。`:'身份能力尚未映射，不自动添加加值。'}>{character.role} · {guide?.ability??'身份能力'} {character.rank}</HelpTip>
    <p className="hint"><HelpTip label="角色锁定说明" text="游戏角色卡为只读；已实现的伤害、采购与结算流程更新状态，AI 叙述不直接修改数值。">已锁定</HelpTip></p>
    <div className="play-inventory-summary">
      {[
        ['生命值',`${character.hp.current}/${character.hp.max}`,fieldHelp('HP')],
        ['人性 / 共情',`${character.humanity.current} / ${effectiveEmpathy(character)}`,fieldHelp('人性')],
        ['欧币',`${character.eurobucks} eb`,'实际余额；报价与未确认的报酬不计入余额。采购成功后扣款并记入存档。'],
        ['成长点',String(character.improvementPoints),'已登记的成长点；这不是属性或技能的直接加值。成长消费必须按对应规则结算。'],
      ].map(([label,value,help])=><div key={label}><HelpTip label={`${label}说明`} text={help}><small>{label}</small><strong>{value}</strong></HelpTip></div>)}
    </div>
    <h4>当前属性</h4><div className="play-stat-grid">{(Object.keys(STAT_NAMES) as StatKey[]).map(stat=><HelpTip key={stat} label={`${STAT_NAMES[stat]}当前值说明`} text={`基础 ${character.stats[stat]}；当前有效值 ${stat==='emp'?effectiveEmpathy(character):stats[stat]}。护甲与已映射的义体修正按适用规则计入，不重复扣除。`}><small>{STAT_NAMES[stat]}</small><strong>{stat==='emp'?effectiveEmpathy(character):stats[stat]}</strong></HelpTip>)}</div>
    <h4>武器</h4>{inventory(character.weapons,'尚未登记武器')}
    <h4>护甲</h4><HelpTip label="护甲当前值说明" text={fieldHelp('护甲')}>头部 SP {character.armor.headSp} · 身体 SP {character.armor.bodySp}</HelpTip>
    <h4>装备</h4>{inventory(character.gear,'尚未登记装备')}
    <h4>义体</h4><CyberwareOverview character={character}/>
    <section className="play-skills" aria-label="角色技能">
      <h4>技能</h4>
      <input type="search" aria-label="搜索角色技能" placeholder="搜索技能" value={skillSearch} onChange={event=>setSkillSearch(event.target.value)}/>
      <label className="switch"><input type="checkbox" checked={showUntrained} onChange={event=>setShowUntrained(event.target.checked)}/>显示未训练技能</label>
      <p className="hint">基础值 = 当前属性 + 技能等级；装备、伤势和情境修正在判定时另行结算。使用技能或检定失败不会自动增减等级；成长需消耗成长点，临时惩罚不改写等级。</p>
      <div className="play-skill-list">{RED_SKILLS.filter(skill=>(showUntrained||(character.skills.find(s=>s.skillId===skill.id)?.level??0)>0)&&skill.name.includes(skillSearch.trim())).map(skill=>{
        const level=character.skills.find(s=>s.skillId===skill.id)?.level??0;
        const stat=skill.linkedStat;
        const value=stat==='emp'?effectiveEmpathy(character):stats[stat];
        return <div className="play-skill-row" key={skill.id}><div><SkillAnnotatedText text={skill.name} character={character}/><small>{STAT_NAMES[stat]} {value}{skill.multiplier===2?' · 双倍成长成本':''}</small></div><span><small>等级</small><strong>{level}</strong></span><span><small>基础</small><strong>{value+level}</strong></span></div>;
      })}</div>
      {!RED_SKILLS.some(skill=>(showUntrained||(character.skills.find(s=>s.skillId===skill.id)?.level??0)>0)&&skill.name.includes(skillSearch.trim()))&&<p className="hint">没有匹配的技能。</p>}
    </section>
  </section>;
}
