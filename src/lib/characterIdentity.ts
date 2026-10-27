import { CharacterSheet } from '../domain/types';

export const GENDER_LABELS = {unspecified:'未设定',male:'男',female:'女',nonbinary:'非二元'};

export function changeCharacterGender(character:CharacterSheet,gender:NonNullable<CharacterSheet['gender']>):CharacterSheet {
  const defaults=['','他','她','TA'];
  const pronouns=defaults.includes(character.pronouns??'') ? {unspecified:'',male:'他',female:'她',nonbinary:'TA'}[gender] : character.pronouns;
  return {...character,gender,pronouns};
}

export function characterIdentitySummary(character:CharacterSheet):string {
  return `${GENDER_LABELS[character.gender??'unspecified']}${character.age?` · ${character.age}岁`:''}${character.pronouns?.trim()?` · 称谓：${character.pronouns.trim()}`:''}`;
}
