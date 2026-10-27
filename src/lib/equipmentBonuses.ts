import type { CharacterSheet } from '../domain/types';
import { CREATION_CATALOG } from '../data/creationCatalog';

export function equipmentBonuses(character:CharacterSheet,skillId:string,condition:'standard'|'visual'|'auditory',useTools:boolean) {
  const groups=new Map<string,{name:string;value:number;page:number}>();
  for(const item of CREATION_CATALOG) {
    const installs=(character.cyberwareInstallations??[]).filter(i=>i.catalogId===item.id);
    const owned=item.category==='cyberware'?installs.length>0:(character.purchases??[]).some(p=>p.catalogId===item.id)||character.gear.includes(item.name);
    if(!owned || (item.paired && !item.slots?.every(slot=>installs.some(i=>i.slot===slot)))) continue;
    for(const bonus of item.checkBonuses??[]) {
      if(!bonus.skills.includes(skillId) || (bonus.condition==='tool'?!useTools:bonus.condition!==condition)) continue;
      const current=groups.get(bonus.group);
      if(!current || current.value<bonus.value) groups.set(bonus.group,{name:item.name,value:bonus.value,page:bonus.page});
    }
  }
  const sources=[...groups.values()];
  return {total:sources.reduce((sum,source)=>sum+source.value,0),sources};
}
