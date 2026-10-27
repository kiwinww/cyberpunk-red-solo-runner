import { useState } from 'react';
import { Unplug } from 'lucide-react';
import type { CharacterSheet, CyberSlot } from '../domain/types';
import { CREATION_CATALOG, getShopItem, SHOP_CATEGORY_LABELS, SLOT_LABELS, type ShopCategory, type ShopItem } from '../data/creationCatalog';
import { checkShopPurchase, creationUndoError, cyberSlotUsage, purchaseCatalogItem, undoCreationPurchase, uninstallCreationCyberware, type ShopBudget } from '../lib/characterShop';
import { equipmentCatalogStatus } from '../lib/equipmentCatalog';
import { armorPenalty, equipmentStats } from '../lib/equipmentStats';
import { HelpTip } from './HelpTip';
import { equipmentHelp } from '../lib/equipmentHelp';

type Props = {character: CharacterSheet; creation: boolean; onChange: (character: CharacterSheet) => void};
function BodyPartButton({character, slot, selected, onSelect}: {character:CharacterSheet;slot:CyberSlot;selected:CyberSlot;onSelect:(slot:CyberSlot)=>void}) {
  const usage=cyberSlotUsage(character,slot);
  const installed=usage.items.length+usage.unknownCount>0;
  return <button type="button" className={`cyber-map-slot${selected===slot?' selected':''}${installed?' installed':''}`}
    aria-pressed={selected===slot} onClick={()=>onSelect(slot)}
    title={`${SLOT_LABELS[slot]} · ${installed?usage.items.map(item=>`${item.name}：${item.detail??item.description}`).join('\n'):'未安装'}`}>
    <span>{SLOT_LABELS[slot]}</span>
    <small>{usage.unknownCount ? '待核对' : installed?`已装 ${usage.items.length} 件`:'空'}</small>
  </button>;
}

export function CyberBodyMap({character,selected,onSelect}: {character:CharacterSheet;selected:CyberSlot;onSelect:(slot:CyberSlot)=>void}) {
  const select=(slot:CyberSlot)=><BodyPartButton character={character} slot={slot} selected={selected} onSelect={onSelect}/>;
  return <div className="cyber-body-layout">
    <div className="cyber-body-guide">
      <strong>义体安装位置</strong>
      <small>正面示意 · 画面左边是角色右侧 · 点击部位查看义体</small>
    </div>
    <div className="cyber-body-graphic" aria-label="人体正面义体位置示意">
      <div className="cyber-body-head" aria-label="头部">
        {select('neural')}
        <div className="cyber-body-eyes">{select('rightEye')}{select('leftEye')}</div>
        {select('audio')}
      </div>
      <div className="cyber-body-upper" aria-label="双臂和躯干">
        <div className="cyber-body-arm">{select('rightArm')}</div>
        <div className="cyber-body-torso">{select('internal')}{select('external')}</div>
        <div className="cyber-body-arm">{select('leftArm')}</div>
      </div>
      <div className="cyber-body-legs" aria-label="双腿">
        <div className="cyber-body-leg">{select('rightLeg')}</div>
        <div className="cyber-body-leg">{select('leftLeg')}</div>
      </div>
      <div className="cyber-body-accessories" aria-label="其他义体分类">
        <small>其他组件（不限定单一身体部位）</small>
        <div>{select('fashion')}{select('borg')}</div>
      </div>
    </div>
    <div className="cyber-body-legend"><span><i className="cyber-legend-idle"/>未安装</span><span><i className="cyber-legend-installed"/>已安装</span><span><i className="cyber-legend-selected"/>当前选择</span></div>
  </div>;
}

export function CyberwarePanel({character,creation,onChange}:Props) {
  const [selected,setSelected]=useState<CyberSlot>('leftEye');
  const [notice,setNotice]=useState('');
  const [budget,setBudget]=useState<ShopBudget>('general');
  const [search,setSearch]=useState('');
  const [confirm,setConfirm]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [removeId,setRemoveId]=useState<string|null>(null);
  const usage=cyberSlotUsage(character,selected);
  const installed=(character.cyberwareInstallations??[]).filter(install=>install.slot===selected);
  const items=CREATION_CATALOG.filter(i=>i.category==='cyberware' && i.slots?.includes(selected) && `${i.name} ${i.description}`.includes(search.trim()));
  const fashionSpent=(character.purchases??[]).filter(p=>p.budget==='fashion').reduce((s,p)=>s+p.cost,0);
  return <div className="cyber-install-layout">
    <CyberBodyMap character={character} selected={selected} onSelect={slot=>{setSelected(slot);setSearch('');setConfirm(null);setExpanded(null);setRemoveId(null);}}/>
    <section className="cyber-slot-content" aria-label="所选义体部位">
      <h3>{SLOT_LABELS[selected]} <small>{usage.total ? `${usage.used}/${usage.total} 槽` : '尚无可用升级槽'}</small></h3>
      <div className="cyber-resources"><div><small>通用欧币</small><strong>{character.eurobucks} eb</strong></div><div><small>人性 / 上限</small><strong>{character.humanity.current} / {character.humanity.max}</strong></div>{creation && <div><small>时装专项</small><strong>{Math.max(0,800-fashionSpent)} eb</strong></div>}</div>
      <section className="cyber-installed" aria-label="本部位已安装义体"><h4>已安装组件 <small>{installed.length} 件</small></h4>
        {installed.length===0 && <p className="hint">此部位尚未安装义体。</p>}
        {installed.map(install=>{
          const item=getShopItem(install.catalogId);
          const purchase=character.purchases?.find(p=>p.id===install.purchaseId);
          const error=purchase ? creationUndoError(character,purchase.id) : '此安装缺少对应购买记录，不能自动退款；原记录保留。';
          const group=purchase?.groupId ? character.purchases!.filter(p=>p.groupId===purchase.groupId) : purchase?[purchase]:[];
          const cash=group.filter(p=>p.budget==='general').reduce((sum,p)=>sum+p.cost,0);
          const fashion=group.filter(p=>p.budget==='fashion').reduce((sum,p)=>sum+p.cost,0);
          return <article className="cyber-installed-item" key={install.purchaseId}>
            <div>{item?<HelpTip label={`${item.name}已安装说明`} text={equipmentHelp(item)}><strong>{item.name}</strong></HelpTip>:<strong>未映射组件 · {install.catalogId}</strong>}<small>{SLOT_LABELS[install.slot]} · {item?.base?'基础组件':`占 ${item?.slotsUsed??1} 槽`} · HL {install.humanityLoss}{purchase?.groupId?' · 成对安装':''}</small></div>
            {creation && <button type="button" className="cyber-remove-button" disabled={!!error} aria-label={`卸下${item?.name??'未映射组件'}`} title={error??'撤销建卡安装，按原资金来源退款'} onClick={()=>{setRemoveId(install.purchaseId);setConfirm(null);}}><Unplug size={16}/>{purchase?.groupId?'成对卸下':'卸下'}</button>}
            {creation && error && <p className="cyber-install-error">{error}</p>}
            {creation && removeId===install.purchaseId && <div className="cyber-remove-confirm" role="group" aria-label="确认卸下义体"><p>撤销{purchase?.groupId?'两侧':''}安装：{item?.name}。{cash>0?`退回通用资金 ${cash}eb。`:''}{fashion>0?`退回时装专项 ${fashion}eb，不增加现金。`:''}恢复相关槽位与建卡人性损失。</p><div className="button-row"><button type="button" disabled={!!error} onClick={()=>{const result=uninstallCreationCyberware(character,install.purchaseId);setNotice(result.message);setRemoveId(null);if(result.ok)onChange(result.character);}}>确认卸下</button><button type="button" onClick={()=>setRemoveId(null)}>保留安装</button></div></div>}
          </article>;
        })}
      </section>
      {usage.unknownCount>0 && <p className="cyber-install-error">此部位还有 {usage.unknownCount} 条未映射记录，请先核对原文。</p>}
      {creation && <label className="field"><span>义体资金来源</span><select aria-label="义体资金来源" value={budget} onChange={event=>setBudget(event.target.value as ShopBudget)}><option value="general">通用现金：{character.eurobucks}eb</option><option value="fashion">时装专项：{Math.max(0,800-fashionSpent)}eb</option></select></label>}
      <label className="field"><span>查找本部位义体</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} /></label>
      <p className="hint">{equipmentCatalogStatus.message} · 此部位匹配 {items.length} 项</p>
      <h4>可安装组件</h4>
      <div className="cyber-install-list">
        {items.map(item=>{
          const activeBudget=creation?budget:'general';
          const error=checkShopPurchase(character,item.id,selected,activeBudget,creation);
          const count=item.paired?2:1;
          const cost=item.price*count;
          return <article key={item.id} className="cyber-install-item">
            <div><HelpTip label={`${item.name}说明`} text={equipmentHelp(item)}><b>{item.name}</b></HelpTip><small>{item.priceLabel??`${cost}eb`}{item.paired?` / 一对（单件 ${item.price}eb）`:''} · 建卡 HL {(item.humanityLoss??0)*count}{!creation && item.humanityDice ? ` · 游戏中${count===2?'两侧分别掷':'掷'}${item.humanityDice}`:''}</small><p>{item.description}</p><small>{item.manualReason?'安装方式与占槽待配置':item.base?`基础组件 · 容量 ${item.capacity} 槽`:`${item.paired?'每侧':'占用'} ${item.slotsUsed??1} 槽`}{item.repeatable?' · 可重复安装':''}{item.allowMeat?' · 支持肉体部位；肉体部位仅容一件非零槽组件':''}{item.damage?` · 伤害 ${item.damage} / ROF ${item.rof}`:''}</small></div>
            <button type="button" disabled={!item.manualReason && !!error} title={error??item.description} onClick={()=>{setRemoveId(null);item.manualReason?setExpanded(expanded===item.id?null:item.id):setConfirm(item.id);}}>{item.manualReason?'查看配置':item.paired?'成对安装':'安装'}</button>
            {expanded===item.id && <p className="cyber-install-error">{item.manualReason} 这是当前程序的自动结算范围，不需要他人批准；未完成配置前不会扣款或改动人物数值。</p>}
            {confirm===item.id && <div className="cyber-install-error" role="group" aria-label="确认义体安装"><p>安装位置：{(item.paired?item.slots!:[selected]).map(slot=>SLOT_LABELS[slot]).join('、')} · 总价 {cost}eb · {activeBudget==='fashion'?'时装专项（不扣现金）':'通用欧币'} · {creation?`人性损失 ${(item.humanityLoss??0)*count}`:`人性损失按骰结算`}{(item.humanityLoss??0)>0?` · 人性上限 -${count*(selected==='borg'?4:2)}`:''}。{item.paired?'任一侧条件不满足则整笔取消。':''}</p><button type="button" disabled={!!error} onClick={()=>{const result=purchaseCatalogItem(character,item.id,{slot:selected,budget:activeBudget,creation});setNotice(result.message);setConfirm(null);if(result.ok)onChange(result.character);}}>确认安装</button><button type="button" onClick={()=>setConfirm(null)}>取消</button></div>}
            <a href={`/api/local-sources/red-core-20261010/pdf#page=${item.page}`} target="_blank" rel="noreferrer">规则 PDF {item.page} 页 ↗</a>
            {error && !item.manualReason && <small className="cyber-install-error">{error}</small>}
          </article>;
        })}
        {items.length===0 && <p className="hint">此部位暂无经过规则核对的自动安装商品；可以在人物卡中保留人工备注。</p>}
      </div>
      {notice && <p role="status" className="shop-status">{notice}</p>}
      <p className="hint">创建角色扣固定 HL；跑团时按骰式结算。安装费用已含手术。这里只自动结算资金、安装槽位和人性，未接入判定的条件性加值请在掷骰时填写修正。</p>
      <a href="/api/local-sources/red-sheet-20260507/pdf#page=3" target="_blank" rel="noreferrer">查看参考人物卡 · 第3页 ↗</a>
    </section>
  </div>;
}

export function CharacterShop({character,creation,onChange}:Props) {
  const [category,setCategory]=useState<ShopCategory|'all'>('all');
  const [search,setSearch]=useState('');
  const [budget,setBudget]=useState<ShopBudget>('general');
  const [availability,setAvailability]=useState('all');
  const [sort,setSort]=useState('catalog');
  const [group,setGroup]=useState('all');
  const [limit,setLimit]=useState(24);
  const [notice,setNotice]=useState('');
  const [units,setUnits]=useState<Record<string,number>>({});
  const [expanded,setExpanded]=useState<string|null>(null);
  const purchases=character.purchases??[];
  const activeBudget=creation?budget:'general';
  const fashionSpent=purchases.filter(p=>p.budget==='fashion').reduce((n,p)=>n+p.cost,0);
  const query=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered=CREATION_CATALOG.filter(item=>item.category!=='cyberware'
    && (category==='all'||item.category===category)
    && (group==='all'||item.group===group)
    && query.every(token=>`${item.name} ${item.description} ${item.group??''} ${item.detail??''}`.toLocaleLowerCase().includes(token))
    && (activeBudget!=='fashion'||item.category==='fashion')
    && (availability!=='owned'||purchases.some(p=>p.catalogId===item.id))
    && (availability!=='buyable'||!checkShopPurchase(character,item.id,undefined,activeBudget,creation,units[item.id])));
  if(sort!=='catalog') filtered.sort((a,b)=>sort==='price-asc'?a.price-b.price:sort==='price-desc'?b.price-a.price:a.name.localeCompare(b.name,'zh-CN'));
  return <section className="character-shop" aria-label="装备商店">
    <header className="shop-balance"><div><small>可用欧币</small><strong>{character.eurobucks} eb</strong></div>{creation && <div><small>时装专项剩余</small><strong>{Math.max(0,800-fashionSpent)} eb</strong></div>}</header>
    <p className="hint">{equipmentCatalogStatus.message}。普通装备直接购买；变价商品先选择数量，义体按部位安装。“待配置”表示程序尚缺具体参数，不是需要人工批准。购买不自动激活程序、装配配件或使用消耗品。</p>
    <p className="hint">当前护甲惩罚 -{armorPenalty(character)}（头身不叠加）；有效反应 {equipmentStats(character).ref} / 敏捷 {equipmentStats(character).dex} / 移动 {equipmentStats(character).move}。护甲购买后沿用当前自动穿戴逻辑。</p>
    <div className="shop-controls">
      <label className="field"><span>查找装备</span><input value={search} onChange={e=>setSearch(e.target.value)} type="search" placeholder="名称或用途" /></label>
      <label className="field"><span>商品分类</span><select aria-label="商品分类" value={category} onChange={e=>{setCategory(e.target.value as ShopCategory|'all');setGroup('all');setLimit(24);}}><option value="all">全部</option>{(Object.keys(SHOP_CATEGORY_LABELS) as ShopCategory[]).filter(c=>c!=='cyberware').map(id=><option key={id} value={id}>{SHOP_CATEGORY_LABELS[id]}</option>)}</select></label>
      <label className="field"><span>目录分组</span><select aria-label="目录分组" value={group} onChange={e=>{setGroup(e.target.value);setLimit(24);}}><option value="all">全部分组</option>{Array.from(new Set(CREATION_CATALOG.filter(item=>item.category!=='cyberware' && (category==='all'||item.category===category)).map(item=>item.group).filter(Boolean))).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      {creation && <label className="field"><span>商店资金来源</span><select aria-label="商店资金来源" value={budget} onChange={e=>setBudget(e.target.value as ShopBudget)}><option value="general">通用资金</option><option value="fashion">时装专项</option></select></label>}
      <label className="field"><span>商品状态</span><select aria-label="商品状态" value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">全部商品</option><option value="buyable">可购买</option><option value="owned">已购记录</option></select></label>
      <label className="field"><span>商品排序</span><select aria-label="商品排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="catalog">原目录顺序</option><option value="price-asc">价格从低到高</option><option value="price-desc">价格从高到低</option><option value="name">名称</option></select></label>
    </div>
    <p className="hint">共 {filtered.length} 件 · 当前扣款：{activeBudget==='fashion'?'时装专项（不扣现金）':'通用欧币'}{activeBudget==='fashion'?' · 仅显示专项适用商品':''}</p>
    <div className="shop-catalog" aria-label="起始装备目录">{filtered.slice(0,limit).map(item=>{
      const quantity=units[item.id]??item.minUnits??1;
      const cost=item.price*quantity;
      const error=checkShopPurchase(character,item.id,undefined,activeBudget,creation,quantity);
      const owned=purchases.filter(p=>p.catalogId===item.id).length;
      return <article key={item.id} className="shop-product">
        <div><div className="shop-product-title"><HelpTip label={`${item.name}说明`} text={equipmentHelp(item)}><b>{item.name}</b></HelpTip>{owned>0 && <small>已购 {owned}</small>}</div><small>{SHOP_CATEGORY_LABELS[item.category]} · PDF {item.page} 页</small><p>{item.description}</p>
          <details className="shop-details" open={expanded===item.id?true:undefined}><summary>商品详情 / 原文</summary>
            <p>{item.detail??item.description}</p>
            {item.damage && <p>伤害 {item.damage} · ROF {item.rof}</p>}
            {item.armorSp && <p>{item.armorZone==='both'?'头部和身体':item.armorZone==='head'?'头部':'身体'} SP {item.armorSp}；护甲不叠加。</p>}
            {item.armorPenalty!==undefined && <p>穿戴惩罚：反应、敏捷、移动各 -{item.armorPenalty}，最低0；头身只取最重惩罚，基础属性不被改写。PDF96页。</p>}
            {item.manualReason && <p>{item.manualReason}。未配置前不扣款、不应用效果。</p>}
            <a href={`/api/local-sources/red-core-20261010/pdf#page=${item.page}`} target="_blank" rel="noreferrer">查阅核心规则 PDF {item.page} 页 ↗</a>
          </details>
        </div>
        {item.minUnits && <label className="field"><span>{item.unitLabel}数量（最低 {item.minUnits}）</span><input aria-label={`${item.name}数量`} type="number" min={item.minUnits} step={1} value={quantity} onChange={event=>setUnits({...units,[item.id]:Number(event.target.value)})}/><small>每{item.unitLabel} {item.price}eb · 合计 {Number.isFinite(cost)?cost:'—'}eb</small></label>}
        <div className="shop-product-buy"><strong>{Number.isFinite(cost)?cost:'—'} eb{item.manualReason?'（待配置）':''}</strong><button type="button" disabled={!item.manualReason && !!error} title={error??`购买 ${item.name}，扣除${activeBudget==='fashion'?'时装专项':'通用资金'} ${cost}eb`} onClick={()=>{if(item.manualReason){setExpanded(item.id);return;}const result=purchaseCatalogItem(character,item.id,{creation,budget:activeBudget,units:quantity});setNotice(result.message);if(result.ok)onChange(result.character);}}>{item.manualReason?'查看配置':'购买'}</button></div>
        {error && <small className="cyber-install-error">{error}</small>}
      </article>;
    })}</div>
    {filtered.length>limit && <button type="button" onClick={()=>setLimit(value=>value+24)}>显示更多（已显示 {Math.min(limit,filtered.length)}/{filtered.length}）</button>}
    {filtered.length===0 && <div className="shop-empty"><p>没有符合当前筛选的商品。</p><button type="button" onClick={()=>{setSearch('');setCategory('all');setGroup('all');setAvailability('all');setSort('catalog');setLimit(24);}}>清除筛选</button></div>}
    {notice && <p role="status" className="shop-status">{notice}</p>}
    <h4>已购 / 资金流水</h4>
    {purchases.length===0 && <p className="hint">尚无购买记录。</p>}
    <div className="shop-purchase-list">{purchases.map(p=>{
      const error=creationUndoError(character,p.id);
      return <div className="shop-purchase" key={p.id}><span>{p.title}{p.slot ? ` · ${SLOT_LABELS[p.slot]}`:''}<small>{p.cost} eb · {p.budget==='fashion'?'时装专项':'通用资金'}{p.groupId?' · 成对购买，撤销时两侧一起退回':''}</small>{error && <small>{error}</small>}</span>
        {creation && <button type="button" title={error??'撤销建卡购买，恢复原资金来源与对应物品；不会重复退款'} disabled={!!error} onClick={()=>{onChange(undoCreationPurchase(character,p.id));setNotice(`已撤销：${p.title}`);}}>撤销</button>}</div>;
    })}</div>
  </section>;
}

export function CyberwareOverview({character}: {character:CharacterSheet}) {
  const [selected,setSelected]=useState<CyberSlot>('leftEye');
  const slot=cyberSlotUsage(character,selected);
  return <section className="cyber-overview" aria-label="义体人体图">
    <CyberBodyMap character={character} selected={selected} onSelect={setSelected}/>
    <div className="cyber-overview-detail"><strong>{SLOT_LABELS[selected]}</strong>{slot.items.length?<ul>{slot.items.map((item,index)=><li key={`${item.id}-${index}`}><HelpTip label={`${item.name}说明`} text={equipmentHelp(item)}>{item.name}</HelpTip></li>)}</ul>:<p>该部位没有登记已购买的结构化义体。</p>}<small>槽位 {slot.used}/{slot.total} · 人性 {character.humanity.current}/{character.humanity.max}</small></div>
    {(character.cyberware ?? []).length>0 && <details><summary>所有义体（含旧存档手动登记）</summary><p>{character.cyberware.join('、')}</p></details>}
  </section>;
}
