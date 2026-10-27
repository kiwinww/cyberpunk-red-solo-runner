import { Campaign } from '../domain/types';

export function updateTrackedHp(campaign:Campaign,id:string,value:number):Campaign {
  const target=campaign.combat.combatants.find(item=>item.id===id);
  const max=target?.side==='player'?campaign.character.hp.max:target?.hpMax;
  if(!target || !Number.isInteger(value) || value<0 || value>(max??0))return campaign;
  return {...campaign,
    character:target.side==='player'?{...campaign.character,hp:{...campaign.character.hp,current:value}}:campaign.character,
    combat:{...campaign.combat,combatants:campaign.combat.combatants.map(item=>item.id===id?{...item,hpCurrent:value}:item)},
  };
}
