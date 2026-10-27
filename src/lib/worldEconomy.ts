import type { Campaign } from '../domain/types';
import { appendJournal } from './state';

export interface StreetItem {
  id: string;
  name: string;
  price: number;
  category: 'gear' | 'service';
  tooltip: string;
}

// House-priced examples, not a substitute for official RED equipment tables.
export const STREET_CATALOG: StreetItem[] = [
  { id: 'food', name: '街头口粮（1份）', price: 10, category: 'gear', tooltip: '方便携带的普通消耗品。本项目示例价格，不恢复 HP。' },
  { id: 'ammo', name: '普通弹药补给', price: 20, category: 'gear', tooltip: '补给记录，不自动增加特定枪械弹夹容量；请按实际武器弹种登记。' },
  { id: 'first-aid', name: '基础医疗用品', price: 50, category: 'gear', tooltip: '仅加入物品栏，不自动治疗。医疗判定及修复效果请按 RED 规则处理。' },
  { id: 'burner', name: '一次性通讯机', price: 50, category: 'gear', tooltip: '用于联络 NPC 或接收消息，不意味着具备远程破解能力。' },
  { id: 'jacket', name: '街头外套', price: 20, category: 'gear', tooltip: '普通衣物，不计为防弹护甲，不提升 SP。' },
  { id: 'ride', name: '短途搭车服务', price: 10, category: 'service', tooltip: '叙事性交通服务，完成支付后记录在资金流水，不增加背包物品。' },
];

export function buyStreetItem(campaign: Campaign, itemId: string): { campaign: Campaign; message: string; ok: boolean } {
  const item = STREET_CATALOG.find(entry => entry.id === itemId);
  if (!item) return { campaign, ok: false, message: '未找到商品。' };
  if (!Number.isSafeInteger(campaign.character.eurobucks) || campaign.character.eurobucks < item.price) {
    return { campaign, ok: false, message: `${item.name} 需要 ${item.price}eb，当前余额不足。` };
  }
  const name = item.name;
  const next: Campaign = {
    ...campaign,
    character: {
      ...campaign.character,
      eurobucks: campaign.character.eurobucks - item.price,
      gear: item.category === 'gear' ? [...campaign.character.gear, name] : campaign.character.gear,
      purchases: [...(campaign.character.purchases ?? []), { id: crypto.randomUUID(), title: name, cost: item.price, budget: 'general' }],
    },
  };
  return {
    ok: true,
    message: `已支付 ${item.price}eb：${name}。${item.category === 'gear' ? '已加入物品栏。' : '服务已登记。'} 请由主持确认如何在剧情中领取或使用。`,
    campaign: appendJournal(next, { type: 'note', title: `街头交易 · ${name}`, body: `${name}：-${item.price}eb；剩余 ${next.character.eurobucks}eb。采用本游戏示例定价，非官方定价。` }),
  };
}
