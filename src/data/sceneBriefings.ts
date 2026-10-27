import { ModuleScene, ModuleSource } from '../domain/types';

// Short arrival summaries only; hidden motives and later outcomes stay in local sources.
const arrivals:Record<string,string>={
  'streets-1-index-1':'大学区公交站附近贴着歌剧活动海报，等车的学生正在议论演出。你可以询问他们、核实购票渠道，再决定如何入场。',
  'streets-2-index-1':'委托人的企业公寓位于上码头区，大堂有保安。先确认罗格提供的访问资料，再向委托人核实失踪经过。',
  'streets-3-index-1':'试镜仓库外有人拦路，要求你交出邀请函。交涉、观察与寻找其他路线都是可考虑的行动；尚未判定对方的布置。',
  'streets-4-index-1':'在相对安全的会面处，鼓手说明海岸集装箱的调查委托。先核实要找的货物特征、来源信息与工作范围，再决定是否接受。',
  'streets-5-index-1':'科罗纳多农场区夜市排着长队。取货要从运单与联系人着手，眼前的拥堵和摊位情况值得留意。',
  'streets-6-index-1':'码头上集装箱密布，工人和无人机忙着调运设备。你带着少校提供的取货地址，先确认接洽与领取手续。',
  'streets-7-index-1':'崔斯拿出收集的新闻和影像。先区分报道、目击说法与可验证证据，再选择调查方向；传闻不是凶手身份的证明。',
  'streets-8-index-1':'谵妄夜店陷入混乱，安保正控制现场。是否戴着头显会影响眼前处境，先确认自身状态与退路，不默认已摘下设备。',
  'streets-9-index-1':'你抵达怡人谷公寓，客户发来了门禁码与会面房号。先确认联络信息和当前处境，再决定如何进入会面。',
};
const phasePrompts:Record<ModuleScene['phase'],string>={
  intro:'先确认对方提出的要求、你愿意承担的风险，以及尚未接受的条件。',
  investigation:'先选一个可接触的人或地点，问清你要验证什么。区分亲眼所见、他人说法与推测。',
  access:'先确认进入所需的身份、许可、路线和代价，再选择交涉或其他办法。',
  escalation:'先确认眼前威胁、可用掩体和退路，再决定继续交涉、避开冲突或行动。',
  finale:'围绕已证实的目标作出决定；检定、战斗与代价仍需实际结算，不由场景标题决定胜负。',
  aftermath:'整理已经发生的后果、未完成的约定和实际收支，保留尚未解决的问题。',
};
export function sceneBriefing(module:ModuleSource,scene:ModuleScene):string {
  if(scene.phase==='intro') return module.background.openingHook;
  const canonical=scene.id.replace(/^(?:opera-night-preview|desire-agent-preview)-/,'');
  return arrivals[canonical]??phasePrompts[scene.phase];
}
