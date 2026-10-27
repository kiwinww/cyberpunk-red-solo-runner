import { CREATION_CATALOG, SLOT_LABELS, type ShopItem } from '../data/creationCatalog';

export const equipmentCatalogStatus = { loaded: false, message: '精选起始目录（完整本机装备索引尚未加载）' };

/** Validate everything before replacing the catalog; malformed imports must not affect saves. */
export function parseEquipmentCatalog(value: unknown): ShopItem[] {
  const data = value as { schemaVersion?: number; sourceId?: string; items?: unknown[] } | null;
  if (!data || data.schemaVersion !== 1 || data.sourceId !== 'red-core-20261010' || !Array.isArray(data.items) || !data.items.length) throw new Error('装备索引版本或来源无效');
  const ids = new Set<string>();
  const items = data.items.map(value => {
    if (!value || typeof value !== 'object') throw new Error('装备条目无效');
    const item = value as ShopItem;
    if (typeof item.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(item.id) || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100
      || !['weapon','armor','gear','fashion','cyberware'].includes(item.category)
      || !Number.isSafeInteger(item.price) || item.price < 0
      || !Number.isInteger(item.page) || item.page < 1 || item.page > 457
      || typeof item.description !== 'string' || item.description.length > 300) throw new Error('装备字段或重复ID无效');
    for (const field of ['group','detail','manualReason','requiredBase','humanityDice','damage','unitLabel','priceLabel'] as const) {
      if (item[field] !== undefined && (typeof item[field] !== 'string' || item[field]!.length > 500)) throw new Error('装备说明无效');
    }
    for (const field of ['rof','armorSp','capacity','slotsUsed','humanityLoss','armorPenalty','minUnits'] as const) {
      if (item[field] !== undefined && (!Number.isSafeInteger(item[field]) || item[field]! < 0)) throw new Error('装备数值无效');
    }
    if (item.base !== undefined && typeof item.base !== 'boolean') throw new Error('基础组件标记无效');
    if(item.checkBonuses!==undefined && (!Array.isArray(item.checkBonuses) || item.checkBonuses.some(b=>!b || !Array.isArray(b.skills) || !b.skills.every(s=>typeof s==='string') || !Number.isInteger(b.value) || b.value<0 || b.value>10 || !['tool','visual','auditory'].includes(b.condition) || typeof b.group!=='string' || !Number.isInteger(b.page) || b.page<1 || b.page>457))) throw new Error('装备判定修正无效');
    if (item.repeatable !== undefined && typeof item.repeatable !== 'boolean') throw new Error('重复安装标记无效');
    if (item.allowMeat !== undefined && typeof item.allowMeat !== 'boolean') throw new Error('肉体安装标记无效');
    if (item.minUnits !== undefined && (item.minUnits<1 || item.category==='cyberware' || !item.unitLabel)) throw new Error('计价单位无效');
    if (item.paired !== undefined && (typeof item.paired !== 'boolean' || (item.paired && (item.category!=='cyberware' || !item.slots || ![['leftEye','rightEye'],['leftLeg','rightLeg']].some(pair=>pair.length===item.slots!.length && pair.every(slot=>item.slots!.includes(slot as keyof typeof SLOT_LABELS))))))) throw new Error('成对安装部位无效');
    if (item.armorZone !== undefined && !['head','body','both'].includes(item.armorZone)) throw new Error('护甲部位无效');
    if (item.slots !== undefined && (!Array.isArray(item.slots) || !item.slots.length || new Set(item.slots).size !== item.slots.length || item.slots.some(slot => !Object.prototype.hasOwnProperty.call(SLOT_LABELS, slot)))) throw new Error('义体部位无效');
    if (item.category === 'cyberware' && (!item.slots?.length || item.humanityLoss === undefined
      || ((item.humanityLoss ?? 0) > 0 && !/^([124])d6(?:\/2(?:向上取整)?)?$/.test(item.humanityDice ?? '')))) throw new Error('义体人性数据无效');
    const old = CREATION_CATALOG.find(old => old.id === item.id);
    if (old && (old.name !== item.name || old.category !== item.category)) throw new Error('旧装备ID映射冲突');
    ids.add(item.id);
    return { ...old, ...item };
  });
  const merged = [...CREATION_CATALOG.filter(old => !ids.has(old.id)), ...items];
  if (items.some(item => item.requiredBase && !merged.some(base => base.id === item.requiredBase && base.base))) throw new Error('义体前置组件不存在');
  return merged;
}

export async function loadLocalEquipmentCatalog(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('/api/local-sources/equipment', { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('本机装备索引不可用');
    const items = parseEquipmentCatalog(await response.json());
    CREATION_CATALOG.splice(0, CREATION_CATALOG.length, ...items);
    equipmentCatalogStatus.loaded = true;
    equipmentCatalogStatus.message = `已载入本机核心规则装备目录：${items.length} 个商品规格（包含品质、口径及时装款式）`;
  } catch {
    equipmentCatalogStatus.loaded = false;
    equipmentCatalogStatus.message = '完整装备目录未载入，当前为精选起始目录。请运行 npm run sources:equipment 后刷新。';
  } finally {
    clearTimeout(timer);
  }
}
