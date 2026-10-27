import { CharacterSheet } from '../domain/types';
import { createDefaultCampaign } from './state';
import { importCampaign } from './storage';

const KEY='cyberpunk-red-solo-runner:characters:v1';
export interface CharacterProfile {character:CharacterSheet;savedAt:string}
export function listCharacterProfiles():Array<CharacterProfile|null> {
  const raw=window.localStorage.getItem(KEY);
  if(raw===null)return [null,null,null];
  const values:unknown=JSON.parse(raw);
  if(!Array.isArray(values)||values.length!==3)throw new Error('人物档案格式异常，未覆盖原数据。');
  return values.map(value=>{
    if(value===null)return null;
    if(!value || typeof value.savedAt!=='string')throw new Error('人物档案格式异常，未覆盖原数据。');
    const character=importCampaign(JSON.stringify({...createDefaultCampaign(),character:value.character})).character;
    return {character,savedAt:value.savedAt};
  });
}
export function saveCharacterProfile(index:number,character:CharacterSheet):void {
  if(!Number.isInteger(index)||index<0||index>2)throw new Error('只能保存到三个固定人物档案。');
  const validated=importCampaign(JSON.stringify({...createDefaultCampaign(),character})).character;
  const profiles=listCharacterProfiles();
  profiles[index]={character:validated,savedAt:new Date().toISOString()};
  window.localStorage.setItem(KEY,JSON.stringify(profiles));
}
