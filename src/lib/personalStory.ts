import { CharacterSheet } from '../domain/types';

export function personalStoryReminder(character:CharacterSheet,intent:string):string {
  const details=character.backgroundDetails??{};
  const keys=/朋友|联系人|熟人|援助|帮忙/.test(intent)?['friends','values']
    :/敌人|仇|威胁|报复/.test(intent)?['enemies','values']
    :/家庭|家人|亲人/.test(intent)?['family','values']
    :/外观|打扮|仪容|衣着/.test(intent)?['appearance','values']
    :/身份|专长|工作经历/.test(intent)?['role','motivation']
    :/感情|恋人|情感/.test(intent)?['romance','values']
    :/交涉|询问|交谈|说服/.test(intent)?['personality','culture','motivation']
    :['motivation','values'];
  const labels:Record<string,string>={friends:'朋友与联系人',enemies:'敌人与恩怨',values:'看重的人与事',family:'家庭经历',personality:'处事方式',culture:'文化背景',motivation:'人生目标',appearance:'外观与风格',role:'身份经历',romance:'情感经历'};
  const facts=keys.filter(key=>details[key]?.trim()).slice(0,2).map(key=>`${labels[key]}：${details[key].trim().slice(0,120)}`);
  if(!facts.length && details.motivation?.trim()) facts.push(`人生目标：${details.motivation.trim().slice(0,120)}`);
  return facts.length?`你已有的背景：${facts.join('；')}。这能影响你的选择，不表示相关人物已到场、答应援助或判定成功。`:'';
}
