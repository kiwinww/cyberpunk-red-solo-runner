import type { Campaign } from '../domain/types';

/**
 * Small, original, play-oriented situation seeds, not reproduced encyclopedia text.
 * RED 2045 is authoritative in this campaign. 2077 is used only as mood/design inspiration.
 */
export interface WorldHook {
  id: string;
  title: string;
  theme: string;
  detail: string;
  gmUse: string;
  action: string;
  tags: string[];
  sourceUrl: string;
  sourceLabel: string;
  era: '2045' | 'inspiration';
}

export const WORLD_HOOKS: WorldHook[] = [
  {
    id: 'night-market', title: '补给紧俏与夜市中间人', theme: '物资与交易',
    detail: '战后供应链脆弱，稀缺器材往往要通过可信的中间人、街区门路或临时夜市才能摸到。',
    gmUse: '让补给来源、交易对象、货源风险影响购买与任务；普通商品可直购，稀缺装备不要无条件开放。',
    action: '询问附近的中间人，寻找一处可靠的临时夜市。',
    tags: ['市场', '交易', '商店', '买', '装备', '补给', '货', '资金', '夜市', '票', '采购'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_red', sourceLabel: 'RED · 日常事务 / 装备渠道', era: '2045',
  },
  {
    id: 'corp-leverage', title: '公司背后的交易', theme: '企业与权力',
    detail: '大型企业通过合约、安保和代理人渗透街头委托；一个体面的邀约也可能带来不对等的代价。',
    gmUse: '让委托人有可追查的雇佣链、商业动机与代价；不要假设某个未登记企业已介入。',
    action: '追查雇主、安保合同或付款链背后的企业关系。',
    tags: ['公司', '企业', '委托', '雇主', '安保', '歌剧', '大学', '合同', '追查', '失踪'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_red', sourceLabel: 'RED · 血色时代里的巨型企业', era: '2045',
  },
  {
    id: 'gang-turf', title: '街区帮派与地盘', theme: '街头势力',
    detail: '夜之城的街区有自己的规矩；衣着、话语、熟人或未经许可的拍摄，都可能被当地团伙解读成挑衅。',
    gmUse: 'NPC 的态度受街区势力与玩家举动影响；若没有明确地点，不要凭空指定已遭遇的具体帮派。',
    action: '调查这片街区由谁说了算，并通过当地熟人建立联系。',
    tags: ['帮派', '街头', '战区', '跟踪', '危险', '地盘', '安保', '冲突', '调查'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_red/baike781', sourceLabel: 'RED · 夜城帮派', era: '2045',
  },
  {
    id: 'nomad-route', title: '游民车队与战后物流', theme: '交通与生计',
    detail: '跨城交通和运货离不开熟路的车队；信息、燃料和互相信任，比一张漂亮的路线图更值钱。',
    gmUse: '车队可以提供线索、运送或掩护，但要考虑成本、关系及出城风险。',
    action: '联系游民车队，打听安全路线或近期异常的货运。',
    tags: ['车', '运输', '货', '追踪', '驾', '撤离', '郊区', '高速', '游民', '路线'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_red', sourceLabel: 'RED · 交通与世界设定', era: '2045',
  },
  {
    id: 'data-is-local', title: '碎片化网络与物理入口', theme: '技术与潜入',
    detail: 'RED 时代的网行需要关注局域网络、物理接入和现场安保；不是在城市任何地方都能远程入侵一切。',
    gmUse: '明确接入点、设备、守卫与失败后果；网行行动按 RED 规则处理，不套用 2077 的扫描即破解机制。',
    action: '侦察现场可接入的网络架构和安保设备。',
    tags: ['网络', '黑客', '网行', '监控', '数据', '入侵', '门禁', '摄像', '技术', '服务器'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_red', sourceLabel: 'RED · 网行规则入口', era: '2045',
  },
  {
    id: 'humanity-cost', title: '义体、人性与身份', theme: '义体与社会',
    detail: '义体意味着能力，也意味着医疗、维护、身体认同和人性成本；街上的人会依据自己的经历作出判断。',
    gmUse: '义体引发的社会反应可以进入对话；数值变化仅由正式规则与已记录治疗/安装动作决定。',
    action: '寻找技医或义体诊所，了解风险与可能的改装方案。',
    tags: ['义体', '医生', '手术', '人性', '科技', '医院', '改装', '伤', '共情'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_red', sourceLabel: 'RED · 赛博技术与义肢', era: '2045',
  },
  {
    id: 'street-media', title: '超梦与街头信息', theme: '文化与线索',
    detail: '街头流言、超梦体验、新闻和广告都能塑造人们对案件的认知，但传播出去的并不一定是真相。',
    gmUse: '把传闻视为待核实线索，不要自动把八卦当作已确认的剧情事实。',
    action: '找一位当地媒体人或超梦贩子，验证刚得到的消息。',
    tags: ['新闻', '超梦', '媒体', '娱乐', '传闻', '线索', '消息', '采访', '秘密'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_red', sourceLabel: 'RED · 娱乐与信息来源', era: '2045',
  },
  {
    id: 'street-life', title: '城市日常也是任务现场', theme: '生存与街景',
    detail: '小贩、食宿、临时工作、公共交通与安保收费，决定每条街道的节奏；城市不应只在战斗时才活起来。',
    gmUse: '在空白场景加入与地点相关的生活细节、可对话市民和可用服务，不强制触发新主线。',
    action: '观察附近人群和商户的日常，寻找容易被忽略的情报。',
    tags: ['夜之城', '街', '人群', '日常', '校园', '公寓', '美食', '观察', '散步'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_2077', sourceLabel: '2077 · 仅借鉴城市生活表现', era: 'inspiration',
  },
  {
    id: 'brand-pressure', title: '企业品牌与隐性影响', theme: '环境叙事',
    detail: '品牌标识、广告、门禁和摄像头透露了谁在支付维持秩序的费用；它们是可供观察的线索。',
    gmUse: '以场景道具和 NPC 行为体现企业影响，不直接引入 2077 年才出现的任务或机制。',
    action: '检查广告、监控和门禁标识，推测此地真正的管理者。',
    tags: ['广告', '公司', '监控', '安保', '城市', '招牌', '设施', '企业'],
    sourceUrl: 'https://www.vgbaike.com/cyberpunk_2077/baike934', sourceLabel: '2077 · 企业社会氛围灵感', era: 'inspiration',
  },
];

function collectWorldText(campaign: Campaign, intent: string): string {
  return [
    campaign.currentScene.location,
    campaign.currentScene.title,
    campaign.currentScene.objective,
    ...campaign.currentScene.threads,
    ...campaign.missions.filter(m => m.status === 'active' || m.status === 'offered').slice(0, 2).flatMap(m => [m.title, m.target, m.complication]),
    campaign.character.role,
    intent,
  ].join(' ').toLowerCase();
}

/** Stable selection; actively matches story state and player action, not encyclopedia search UI. */
export function getContextualWorldHooks(campaign: Campaign, intent = '', count = 3): WorldHook[] {
  const context = collectWorldText(campaign, intent);
  const action = intent.toLowerCase();
  const withScore = WORLD_HOOKS.map((hook, index) => {
    let score = 0;
    for (const tag of hook.tags) {
      if (context.includes(tag.toLowerCase())) score += 2;
      if (action.includes(tag.toLowerCase())) score += 4;
    }
    if (hook.era === '2045') score += 2;
    if (hook.id === 'street-life') score += 1;
    return { hook, score, index };
  });
  return withScore.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, count).map(item => item.hook);
}

export function worldPromptContext(campaign: Campaign, intent: string): string {
  return JSON.stringify({
    year: 2045,
    ruleset: 'Cyberpunk RED；不可使用2077电子游戏的等级、技能树、黑客机制或未来事件作为当前事实',
    recentWorldActions: (campaign.worldHistory ?? []).slice(-12).map(entry => ({
      title: entry.sceneTitle, action: entry.action, hook: entry.hookId,
      status: entry.status === 'resolved' ? 'confirmed' : 'pending-GM-resolution',
      outcome: entry.status === 'resolved' ? entry.outcome : undefined,
      consequence: entry.status === 'resolved' ? entry.consequence : undefined,
      impact: entry.status === 'resolved' ? entry.impact : undefined,
    })),
    knownFactions: campaign.factions.map(f => ({ name: f.name, attitude: f.attitude, goal: f.goal, progress: f.progress, total: f.segments })),
    knownNpcs: campaign.npcs.map(n => ({ name: n.name, role: n.role, disposition: n.disposition, want: n.want })),
    sceneHeat: campaign.currentScene.heat,
    situationHooks: getContextualWorldHooks(campaign, intent).map(hook => ({
      title: hook.title,
      era: hook.era,
      situation: hook.detail,
      gmUse: hook.gmUse,
      availableAction: hook.action,
      reference: hook.sourceUrl,
    })),
    directive: '把其中1-2项自然融入环境、NPC动机、交易障碍与合理后果。待结算的尝试不等于成功；已确认的世界后果和势力/NPC态度是后续故事必须遵守的事实。不得私自改变数值或虚构阵营。2077只用于氛围参考，不作为2045年发生的事实。不要输出百科讲解。',
  });
}
