import { beforeEach,expect,it } from 'vitest';
import { listCharacterProfiles,saveCharacterProfile } from './characterProfiles';
import { createDefaultCampaign } from './state';
import { saveCampaign } from './storage';

beforeEach(()=>window.localStorage.clear());
it('stores exactly three independent character profiles without changing campaign saves',()=>{
  const campaign=createDefaultCampaign();saveCampaign(campaign);
  const before=window.localStorage.getItem('cyberpunk-red-solo-runner:v1');
  expect(listCharacterProfiles()).toEqual([null,null,null]);
  for(let i=0;i<3;i++)saveCharacterProfile(i,{...campaign.character,handle:`角色${i+1}`,age:25+i});
  expect(listCharacterProfiles().map(p=>p?.character.handle)).toEqual(['角色1','角色2','角色3']);
  expect(()=>saveCharacterProfile(3,campaign.character)).toThrow();
  saveCharacterProfile(1,{...campaign.character,handle:'替换角色'});
  expect(listCharacterProfiles()[0]?.character.handle).toBe('角色1');
  expect(listCharacterProfiles()[1]?.character.handle).toBe('替换角色');
  expect(window.localStorage.getItem('cyberpunk-red-solo-runner:v1')).toBe(before);
});
it('refuses to replace corrupted profile bytes',()=>{
  const key='cyberpunk-red-solo-runner:characters:v1';
  window.localStorage.setItem(key,'{bad');
  expect(()=>saveCharacterProfile(0,createDefaultCampaign().character)).toThrow();
  expect(window.localStorage.getItem(key)).toBe('{bad');
});
