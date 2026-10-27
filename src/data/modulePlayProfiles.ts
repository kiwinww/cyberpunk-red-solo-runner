import { Campaign, RunnerChoice } from '../domain/types';

// Player-safe prompts based on the supplied openings; no hidden answers or stat blocks.
const profiles = [
  { location: '夜之城大学区', contact: '雇主代理人', focus: '失踪线索、合同条件与门票来源', observe: '核实失踪线索', talk: '询问合同与付款条件' },
  { location: '孤望酒吧', contact: '罗格与委托方', focus: '营救对象、最后行踪与可归还的周转款', observe: '整理失踪经过', talk: '向罗格询问委托' },
  { location: '上码头区试镜仓库外', contact: '试镜接待与现场人员', focus: '邀请资格、入场路线与试镜安排', observe: '观察仓库周围', talk: '出示邀请并询问安排' },
  { location: '海滨区锈棚小酒馆', contact: '鼓手', focus: '第一份海湾委托、交付目标与行动准备', observe: '观察酒馆内的局势', talk: '与鼓手接洽' },
  { location: '托雷尔与江氏制衣坊', contact: '剪刀', focus: '取货凭证、运送路线与团队奖励', observe: '确认取货所需凭证', talk: '向剪刀询问货物' },
  { location: '孤望酒吧的会面处', contact: '斯泰尔斯少校', focus: '设备取送、坦齐娅的支援需求与任务范围', observe: '整理取送设备的要求', talk: '听取少校的委托' },
  { location: '来生酒吧', contact: '崔斯', focus: '街头传闻、可验证情报与联络方式', observe: '区分传闻与证据', talk: '与崔斯核实调查目标' },
  { location: '谵妄夜店入口', contact: '夜店接待与访客', focus: '入场、头显选择与眼前异常', observe: '观察队伍与安保', talk: '询问入场和体验费用' },
  { location: '新委托的联络处', contact: '中间人与新雇主', focus: '已确认的前情、会面安排与委托条件', observe: '整理前作的真实经历', talk: '确认新雇主的会面安排' },
];

const briefing = [
  '代理人提出寻找露西的合同：每人总酬 2,000eb；签约预付 500eb，寻回后付尾款。门票不包含在合同里，演出在明晚。报价不是到账记录。（街头故事 PDF7–8）',
  '罗格负责牵线，目标与失踪经过须向客户核实。可申请的定金属于需归还的周转款，不能当作额外收入。（街头故事 PDF22–24）',
  '你的试镜邀请是一张标着 27 的芯片卡；机会不等于已经录用。先处理仓库外的入场问题，再参加试镜与签约。（街头故事 PDF40–41）',
  '第一份工作是查明海岸集装箱的来路，可留意识别芯片、条码和序列号；这是鼓手的委托，不等于已经接受后续水下任务。（街头故事 PDF54–56）',
  '剪刀需要协助取回货物。行动经费与完成后的报酬分开，额外定制西装是团队一套；取货需要运单与联系人信息。（街头故事 PDF76–77）',
  '少校的委托先取设备并交给坦齐娅，再提供任务支援；完成后每人 1,000eb。没有跑过前作，不默认你与她已经合作过。（街头故事 PDF94）',
  '崔斯约在来生见面；他是媒体人，街头关于危险目标的说法仍是传闻。先核实调查要求和联络方式，不把标签当作证据。（街头故事 PDF113–115）',
  '谵妄的入场与头显使用由你选择。当晚首个虚拟场景免费，切换场景收费，酒水另计；不能默认你已经支付或戴上头显。（街头故事 PDF131）',
  '新委托延续上一场事件。先记录你真正经历过的前情，再确认会面；报价、住宿和代金券各有条件，不是开场已领取的资产。（街头故事 PDF152–154）',
];

export function playProfile(moduleId: string) {
  const id = moduleId === 'opera-night-preview' ? 'streets-1' : moduleId === 'desire-agent-preview' ? 'streets-2' : moduleId;
  const match = /^streets-([1-9])$/.exec(id);
  const index=match ? Number(match[1]) - 1 : 0;
  return {...profiles[index],briefing:briefing[index]};
}

export function characterApproach(campaign: Campaign): string {
  const role = campaign.character.role;
  const approaches:Record<string,string>={
    '媒体人':'核对消息来源，并询问是否允许记录或采访',
    '网行者':'先确认接入点、设备与授权，不把交谈当作已完成入侵',
    '中间人':'询问货源、交易条件与双方可接受的代价',
    '技工':'先观察设备和可见故障，再决定是否需要工具或检定',
    '技医':'先评估现场人员的伤情与安全，不擅自施救或扣除药品',
    '游民':'确认路线、运载条件与撤退办法',
    '摇滚小子':'先确认现场是否有认同你的听众或粉丝，再提出请求',
    '主管':'核对团队成员与可动用的企业资源，不默认企业已批准支援',
    '执法者':'先判断支援条件与平民风险，不默认援军已经抵达',
    '佣兵':'先观察掩体、退路与可见威胁，按已分配的战斗专长行动',
  };
  const approach=approaches[role]??'先确认眼前风险、对方意图与可用退路';
  return `以${role}的方式${approach}；身份本身不保证成功。`;
}

export function profileChoices(campaign: Campaign, title: string, intro: boolean): RunnerChoice[] {
  const profile = playProfile(campaign.runner.moduleId);
  return [
    { id: crypto.randomUUID(), label: intro ? profile.observe : `搜寻「${title}」的线索`, detail:intro ? `围绕${profile.focus}收集证据，区分目击事实与他人说法。` : `明确搜索的位置与手段，寻找当前可见的痕迹；有风险时再判定。`, kind: 'investigate', intent: intro ? `核实${profile.focus}，区分亲眼所见、他人说法和未知信息。` : `调查「${title}」中当前可见的线索，先说明接触对象和风险。` },
    { id: crypto.randomUUID(), label: intro ? profile.talk : `询问「${title}」中的接触对象`, detail:intro ? `以${campaign.character.role}的身份接触${profile.contact}，先问清条件，不承诺交易。` : `与已登场人物交流，问清当前阻碍和对方诉求，不默认得到配合。`, kind: 'talk', intent: `以${campaign.character.role}的身份${intro ? `向${profile.contact}询问${profile.focus}` : `向本场景已登场的人询问「${title}」的当前阻碍`}，不提前假定对方同意。` },
  ];
}
