import { Campaign } from '../domain/types';
import { moduleCatalog } from '../data/moduleCatalog';
import { sceneBriefing } from '../data/sceneBriefings';

interface Entry {names:string[];kind:string;body:string;page:number}
// Player-readable introductions only. No biographies, hidden affiliations or future scene indexes.
const glossary:Record<string,Entry[]>={
  'streets-1':[
    {names:['露西·莱因迈耶','露西'],kind:'人物',body:'大学区失踪案中的委托寻找对象，19岁。她的当前位置、处境及案情关联需要调查，不能由失踪传闻直接推断。',page:7},
    {names:['大学区'],kind:'地点',body:'本篇失踪案与歌剧活动相关的城区。学生、校园安保、活动渠道提供的是不同来源的信息，不能视为相互印证。',page:7},
    {names:['爱乐吸血鬼'],kind:'团体',body:'歌剧活动相关的演出团体。名称、装扮或传闻不能证明其成员与失踪案有关，具体关系需要现场核实。',page:8},
  ],
  'streets-2':[
    {names:['罗格·阿曼迪亚雷斯','罗格'],kind:'人物',body:'知名中间人，曾经从事佣兵工作，本篇负责牵线救援委托。她提供的介绍与客户说法仍应分开核实；预支款的归还条件不等于额外报酬。',page:22},
    {names:['孤望酒吧','孤望'],kind:'地点',body:'边缘行者接洽工作的酒吧，本篇会面入口。联络机会不代表人物已经同意借出装备或提供免费支援。',page:22},
    {names:['蓝月'],kind:'地点',body:'委托调查涉及的高档会员制场所。访问资格、安保与目击信息应通过当下的调查确认，不默认可以自由出入。',page:23},
  ],
  'streets-3':[
    {names:['拉瑟尔'],kind:'人物',body:'试镜仓库外的对手小队领头人，眼前纠纷涉及邀请资格。是否能谈妥、绕行或发生冲突，取决于你的行动与判定；不提前揭示对方部署。',page:40},
    {names:['塞奈特姐妹'],kind:'人物',body:'本篇试镜所涉影片的导演。试镜机会不是录用承诺；应先了解剧组需求，再决定如何展示角色的能力。',page:40},
    {names:['上码头区','试镜仓库'],kind:'地点',body:'本篇试镜的到访区域与地点。邀请卡、外围接近路线和实际入场条件需要分别确认，不默认已完成试镜或取得报酬。',page:40},
  ],
  'streets-4':[
    {names:['鼓手'],kind:'人物',body:'锈棚小酒馆的首个联络对象，提出调查海岸集装箱来源的工作。任务范围、所需证据与报酬以会面中确认的条件为准。',page:54},
    {names:['锈棚小酒馆','海滨区'],kind:'地点',body:'本篇初始会面区域。先处理当前接触局面，确认委托，再准备海岸行动；不默认已具备水下作业能力。',page:54},
  ],
  'streets-5':[
    {names:['剪刀'],kind:'人物',body:'制衣坊的委托联系人，涉及取货凭证、运送渠道和奖励。行动经费、最终报酬及团队物品应分开记录，不能直接作为现金到账。',page:76},
    {names:['托雷尔与江氏制衣坊'],kind:'地点',body:'本篇高端时装工坊与会面地点。工坊的人脉和委托条件是调查入口，不是对所有街头交易的自动通行许可。',page:76},
    {names:['科罗纳多农场区夜市'],kind:'地点',body:'本篇取货调查相关的市场。运单、联系人与现场情况是不同线索；不能因抵达夜市就宣告已经领到货物。',page:77},
  ],
  'streets-6':[
    {names:['斯泰尔斯少校','斯泰尔斯'],kind:'人物',body:'本篇在孤望会面的客户，安排取送设备并提供任务支援。合作经历、装备交接和报酬需要实际确认，不默认玩家已跑过前作。',page:94},
    {names:['坦齐娅'],kind:'人物',body:'委托提到的支援对象。是否已经见面、合作或完成设备交接，以当前战役记录为准，不补写玩家尚未经历的前情。',page:94},
  ],
  'streets-7':[
    {names:['崔斯·圣地亚哥','崔斯'],kind:'人物',body:'本篇发起调查的媒体人。新闻、影像、目击证词和街头传闻应分开记录；目标的外号或流言不能直接证明其身份与动机。',page:113},
    {names:['来生酒吧','来生'],kind:'地点',body:'本篇调查工作的会面地点。酒吧中能听到的消息并不自动构成证据，重要说法需要另行核实。',page:113},
  ],
  'streets-8':[{names:['谵妄夜店','谵妄'],kind:'地点',body:'改造自高档商场的夜店，本篇的开场地点。头显选择会影响所见体验；入场、酒水和切换场景的费用不能混为一笔，也不自动登记支付。',page:131}],
  'streets-9':[{names:['怡人谷公寓'],kind:'地点',body:'本篇初期客户会面的到访地点。按实际联络信息确认门禁和会面安排；不将后续剧情、未领装备或承诺报酬视为已发生。',page:153}],
};

export interface StoryMention {start:number;end:number;label:string;help:string}
export function storyMentions(text:string,campaign:Campaign):StoryMention[] {
  const moduleId=campaign.runner.moduleId==='opera-night-preview'?'streets-1':campaign.runner.moduleId==='desire-agent-preview'?'streets-2':campaign.runner.moduleId;
  const entries=(glossary[moduleId]??[]).flatMap(entry=>entry.names.map(label=>({label,help:`${entry.kind} · 玩家可读资料\n${entry.body}\n来源：街头故事 PDF ${entry.page} 页。仅解释已经提到的名称，不证明人物到场或行动成功。`})));
  for(const npc of campaign.npcs)if(typeof npc.name==='string' && npc.name.trim().length>=2)entries.push({label:npc.name.trim(),help:`战役人物记录\n身份：${npc.role||'未填写'}。这是当前存档的记录，不是官方人物身份认证；其秘密、诉求与未公开关系不会在注释中展开。`});
  const module=moduleCatalog.find(item=>item.id===campaign.runner.moduleId);
  const scene=module?.scenes.find(item=>item.id===campaign.runner.sceneId);
  if(scene && module && scene.title.length>=3)entries.push({label:scene.title,help:`场景 · ${module.title}\n${sceneBriefing(module,scene)}\n目标：${scene.objective}\n来源：${scene.pageRefs.map(ref=>ref.label).join('、')}。场景名称不代表已满足进入条件或完成目标。`});
  const mentions:StoryMention[]=[];
  for(const entry of entries){
    let start=text.indexOf(entry.label);
    while(start>=0){mentions.push({start,end:start+entry.label.length,...entry});start=text.indexOf(entry.label,start+entry.label.length);}
  }
  return mentions.sort((a,b)=>a.start-b.start || b.end-a.end);
}
