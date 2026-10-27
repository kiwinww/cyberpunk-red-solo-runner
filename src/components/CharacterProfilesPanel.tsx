import { useState } from 'react';
import { Save,UserRound,Download } from 'lucide-react';
import { CharacterSheet } from '../domain/types';
import { listCharacterProfiles,saveCharacterProfile } from '../lib/characterProfiles';

export function CharacterProfilesPanel({character,canSave=true,onLoad}:{character?:CharacterSheet;canSave?:boolean;onLoad:(character:CharacterSheet)=>void}) {
  const [,refresh]=useState(0);
  const [selected,setSelected]=useState(()=>{try{return Math.max(0,listCharacterProfiles().findIndex(Boolean));}catch{return 0;}});
  const [pending,setPending]=useState<number|null>(null);
  const [notice,setNotice]=useState('');
  let profiles:ReturnType<typeof listCharacterProfiles>=[];
  let error='';
  try {profiles=listCharacterProfiles();}catch{error='人物档案无法读取，原数据未被覆盖。';}
  const save=(index:number)=>{
    if(!character || !canSave)return;
    try{saveCharacterProfile(index,character);setPending(null);refresh(x=>x+1);setNotice(`已保存到人物档案 ${index+1}。`);}catch{setNotice('人物档案保存失败，未继续操作。');}
  };
  const profile=profiles[selected];
  return <section className="character-profiles" aria-label="人物档案">
    <h3><UserRound size={17}/> 人物档案 · {profiles.filter(Boolean).length}/3</h3>
    <div className="profile-slot-list" role="group" aria-label="选择人物档案">{profiles.map((item,index)=><button key={index} type="button" aria-label={`选择人物档案 ${index+1}`} aria-pressed={selected===index} title={item?.character.handle??'空位'} onClick={()=>{setSelected(index);setPending(null);setNotice('');}}><small>0{index+1}</small><strong>{item?.character.handle??'空位'}</strong></button>)}</div>
    {profile&&<p className="profile-meta">{profile.character.role} · {profile.character.age?`${profile.character.age}岁 · `:''}HP {profile.character.hp.current}/{profile.character.hp.max}</p>}
    <div className="profile-actions">
      {profile&&<button type="button" aria-label={`载入人物档案 ${selected+1}`} onClick={()=>onLoad(structuredClone(profile.character))}><Download size={15}/>载入人物</button>}
      {character&&!error&&<button type="button" aria-label={`保存到人物档案 ${selected+1}`} disabled={!canSave} onClick={()=>profile?setPending(selected):save(selected)}><Save size={15}/>保存当前角色</button>}
    </div>
    {pending!==null&&<div className="profile-confirm"><p>替换「{profiles[pending]?.character.handle}」的人物档案？战役存档不受影响。</p><button type="button" onClick={()=>save(pending)}>确认替换</button><button type="button" onClick={()=>setPending(null)}>取消</button></div>}
    {(error||notice)&&<p role={error?'alert':'status'}>{error||notice}</p>}
  </section>;
}
