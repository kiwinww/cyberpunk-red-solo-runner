import { CampaignSettings, RunnerChoice } from '../domain/types';

export function hostingPreferences(settings: CampaignSettings): string[] {
  return [
    { easy: '提供更多行动线索与风险提醒', standard: '提供必要线索，保留玩家判断', hard: '减少主动提示，要求玩家明确行动细节' }[settings.difficulty],
    { slow: '放慢场景推进，优先调查和人物交流', standard: '平衡调查、交涉与推进', fast: '精简重复描述，及时总结并推进' }[settings.pace],
    { low: '可选冲突优先提供非暴力路线', medium: '按场景呈现冲突和交涉机会', high: '增加战术与冲突准备选项' }[settings.combatFrequency],
    settings.netrunningEnabled ? '提供符合身份与设备条件的网行线索' : '不主动添加可选网行支线，原模组必要内容仍须按来源处理',
    settings.spoilerLevel === 'player' ? '仅描述玩家当前可知信息' : '可额外给出标明“主持参考”的建议，未发现的秘密仍不作为玩家已知事实',
    '以上均为应用主持偏好，不改变正式DV、伤害、敌人数值与原模组必需遭遇。',
  ];
}

export function actionHint(choice: RunnerChoice): string {
  const official = ['investigate', 'talk', 'sneak', 'fight', 'check'].includes(choice.kind);
  return `${choice.detail ? choice.detail+'\n' : ''}${choice.checkHint ?? choice.intent} ${official ? '正式判定：按相关属性、技能与场景条件处理，不能仅凭选项宣告成功。核心规则 PDF 128–141 页。' : '这是应用的单人主持/场景工具，不是额外的官方规则。'}`;
}

export function actionLabel(choice:RunnerChoice):string {
  if(choice.kind==='scene')return '确认条件后推进';
  if(choice.kind==='background')return '查阅信息';
  if(choice.kind==='oracle')return '单人预言机';
  if(choice.kind==='check')return '判定建议 · 先确认条件';
  if(choice.kind==='fight')return '战斗行动 · 先确认判定';
  return '提出行动 · 主持确认风险';
}
