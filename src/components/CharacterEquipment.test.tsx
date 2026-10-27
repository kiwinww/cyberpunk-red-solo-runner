import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterShop, CyberwarePanel } from './CharacterEquipment';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { CREATION_CATALOG, type ShopItem } from '../data/creationCatalog';
import { purchaseCatalogItem } from '../lib/characterShop';

const originalCatalog=[...CREATION_CATALOG];
afterEach(()=>CREATION_CATALOG.splice(0,CREATION_CATALOG.length,...originalCatalog));

function Shop() {
  const [character,setCharacter]=useState(createBlankCharacter);
  return <CharacterShop character={character} creation onChange={setCharacter} />;
}

function CyberEditor({initial=createBlankCharacter(),creation=true}:{initial?:ReturnType<typeof createBlankCharacter>;creation?:boolean}){
  const [character,setCharacter]=useState(initial);
  return <><CyberwarePanel character={character} creation={creation} onChange={setCharacter}/><output aria-label="人物状态">{JSON.stringify(character)}</output></>;
}
describe('equipment interaction', () => {
  it('installs then removes a creation eye from the body panel with a cancellable confirmation',()=>{
    render(<CyberEditor/>);
    const item=screen.getByLabelText('所选义体部位').querySelectorAll('.cyber-install-item');
    const eye=Array.from(item).find(element=>element.textContent?.includes('赛博义眼') && element.textContent?.includes('基础组件'))!;
    fireEvent.click(within(eye as HTMLElement).getByRole('button',{name:'安装'}));
    fireEvent.click(screen.getByRole('button',{name:'确认安装'}));
    expect(screen.getByLabelText('本部位已安装义体')).toHaveTextContent('赛博义眼');
    fireEvent.click(screen.getByRole('button',{name:'卸下赛博义眼'}));
    fireEvent.click(screen.getByRole('button',{name:'保留安装'}));
    expect(JSON.parse(screen.getByLabelText('人物状态').textContent!).cyberwareInstallations).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'卸下赛博义眼'}));
    fireEvent.click(screen.getByRole('button',{name:'确认卸下'}));
    const saved=JSON.parse(screen.getByLabelText('人物状态').textContent!);
    expect(saved.cyberwareInstallations).toHaveLength(0);
    expect(saved.eurobucks).toBe(createBlankCharacter().eurobucks);
    expect(saved.humanity).toEqual(createBlankCharacter().humanity);
  });
  it('shows dependency errors beside installed bases and does not offer free runtime removal',()=>{
    const base=purchaseCatalogItem(createBlankCharacter(),'cybereye',{creation:true,slot:'leftEye',purchaseId:'eye'}).character;
    const withAddon=purchaseCatalogItem(base,'chiron',{creation:true,slot:'leftEye',purchaseId:'addon'}).character;
    const view=render(<CyberEditor initial={withAddon}/>);
    expect(screen.getByRole('button',{name:'卸下赛博义眼'})).toBeDisabled();
    view.unmount();render(<CyberEditor initial={withAddon} creation={false}/>);
    expect(screen.queryByRole('button',{name:/卸下/})).not.toBeInTheDocument();
  });
  it('filters fashion funds, displays empty results and resets filters without changing funding', () => {
    render(<Shop />);
    fireEvent.change(screen.getByLabelText('商店资金来源'),{target:{value:'fashion'}});
    const catalog=screen.getByLabelText('起始装备目录');
    expect(within(catalog).queryByText('重型手枪')).not.toBeInTheDocument();
    expect(within(catalog).getByText('大众潮流风夹克')).toBeVisible();
    fireEvent.change(screen.getByLabelText('查找装备'),{target:{value:'not-found'}});
    expect(screen.getByText('没有符合当前筛选的商品。')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'清除筛选'}));
    expect(screen.getByLabelText('商店资金来源')).toHaveValue('fashion');
    fireEvent.click(screen.getAllByRole('button',{name:'购买'})[0]);
    expect(screen.getByRole('status')).toHaveTextContent('时装专项');
    expect(screen.getByText('2550 eb')).toBeVisible();
  });
  it('exposes product references and owned-only results after purchasing', () => {
    render(<Shop />);
    fireEvent.change(screen.getByLabelText('查找装备'),{target:{value:'重型手枪'}});
    fireEvent.click(screen.getAllByRole('button',{name:'购买'})[0]);
    fireEvent.change(screen.getByLabelText('商品状态'),{target:{value:'owned'}});
    expect(screen.getAllByRole('button',{name:'购买'})).toHaveLength(1);
    fireEvent.click(screen.getByText('商品详情 / 原文'));
    expect(screen.getByRole('link',{name:/查阅核心规则 PDF/})).toBeVisible();
  });
  it('does not silently charge general cash when fashion funds run out', () => {
    const character=createBlankCharacter();
    character.purchases=[{id:'f',title:'已购时装',cost:800,budget:'fashion'}];
    render(<CyberwarePanel character={character} creation onChange={()=>{ throw new Error('should not buy'); }} />);
    fireEvent.click(screen.getByRole('button',{name:'时尚组件 空'}));
    fireEvent.change(screen.getByLabelText('义体资金来源'),{target:{value:'fashion'}});
    for(const button of screen.getAllByRole('button',{name:'安装'})) expect(button).toBeDisabled();
    expect(screen.getAllByText(/余额不足/).length).toBeGreaterThan(0);
  });
  it('previews paired cost and humanity before a single atomic confirmation',()=>{
    const pair:ShopItem={id:'test-pair',name:'测试成对组件',category:'cyberware',price:100,page:360,description:'测试',paired:true,slots:['leftEye','rightEye'],requiredBase:'cybereye',humanityLoss:2,humanityDice:'1d6'};
    CREATION_CATALOG.push(pair);
    const left=purchaseCatalogItem(createBlankCharacter(),'cybereye',{creation:true,slot:'leftEye'}).character;
    const character=purchaseCatalogItem(left,'cybereye',{creation:true,slot:'rightEye'}).character;
    const onChange=vi.fn();
    render(<CyberwarePanel character={character} creation onChange={onChange}/>);
    fireEvent.click(screen.getByRole('button',{name:'成对安装'}));
    expect(screen.getByRole('group',{name:'确认义体安装'})).toHaveTextContent('总价 200eb');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'取消'}));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'成对安装'}));
    fireEvent.click(screen.getByRole('button',{name:'确认安装'}));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].cyberwareInstallations).toHaveLength(4);
  });
  it('opens actionable configuration information instead of a disabled GM-approval button',()=>{
    CREATION_CATALOG.push({id:'test-config',name:'测试配置组件',category:'cyberware',price:100,page:360,description:'测试',slots:['leftEye'],humanityLoss:0,manualReason:'待配置：需选择具体槽位'});
    const onChange=vi.fn();
    render(<CyberwarePanel character={createBlankCharacter()} creation onChange={onChange}/>);
    fireEvent.click(screen.getByRole('button',{name:'查看配置'}));
    expect(screen.getByText(/这是当前程序的自动结算范围，不需要他人批准/)).toBeVisible();
    expect(screen.queryByRole('button',{name:'需 GM 核对'})).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('shows configurable-unit totals and charges the configured total, not the unit price',()=>{
    CREATION_CATALOG.push({id:'test-cabin',name:'测试船舱',category:'gear',price:30000,page:190,description:'按舱室计价',minUnits:2,unitLabel:'舱室'});
    const onChange=vi.fn();
    render(<CharacterShop character={{...createBlankCharacter(),eurobucks:100000}} creation={false} onChange={onChange}/>);
    fireEvent.change(screen.getByLabelText('查找装备'),{target:{value:'测试船舱'}});
    fireEvent.change(screen.getByLabelText('测试船舱数量'),{target:{value:'3'}});
    expect(screen.getByText('90000 eb')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'购买'}));
    expect(onChange.mock.calls[0][0].eurobucks).toBe(10000);
  });
});
