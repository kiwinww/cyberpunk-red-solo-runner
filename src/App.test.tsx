import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as ai from "./lib/ai";
import * as storage from './lib/storage';
import * as localSources from './lib/localSources';
import { createDefaultCampaign } from "./lib/state";
import { startRunnerCampaign } from "./lib/runner";
import { fillCreationPoints } from './rulesets/cyberpunk-red/character';

function renderPreparedApp() {
  const view=render(<App />);
  const resume=screen.queryByRole('button',{name:'继续开局准备'});
  if (resume) fireEvent.click(resume);
  return view;
}

function startGame() {
  fireEvent.click(screen.getByRole("button", { name: "进入夜之城" }));
}
function openStory() {
  startGame();
}
describe("game experience", () => {
  beforeEach(() => {
    window.localStorage.clear(); vi.restoreAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const campaign = createDefaultCampaign();
    campaign.character = fillCreationPoints(campaign.character);
    window.localStorage.setItem('cyberpunk-red-solo-runner:v1', JSON.stringify(campaign));
  });
  it('collapses action choices without hiding the player input',()=>{
    renderPreparedApp();startGame();
    const actionRail=screen.getByLabelText('行动栏');
    expect(actionRail).toHaveClass('game-action-rail');
    expect(within(actionRail).queryByRole('textbox',{name:'你的行动'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('存档状态')).toHaveTextContent('已自动保存');
    fireEvent.click(screen.getByRole('button',{name:'收起行动栏'}));
    expect(screen.queryByRole('group',{name:'可选行动'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('你的行动')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'展开行动栏'}));
    expect(screen.getByRole('group',{name:'可选行动'})).toBeVisible();
  });
  it('locks the in-game character card in both the tool panel and full workspace',()=>{
    renderPreparedApp();startGame();
    fireEvent.click(screen.getByRole('button',{name:'角色与装备'}));
    const sheet=screen.getByLabelText('游戏角色卡');
    expect(within(sheet).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑角色')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'完整'}));
    fireEvent.click(screen.getByRole('button',{name:'角色'}));
    expect(screen.getByLabelText('游戏角色卡')).toBeVisible();
    expect(screen.queryByRole('button',{name:'保存角色'})).not.toBeInTheDocument();
  });
  it('shows nine unique module choices while preserving a legacy preparation selection',()=>{
    renderPreparedApp();
    const select=screen.getByLabelText('剧本',{exact:true});
    expect(within(select).getAllByRole('option')).toHaveLength(9);
    expect(select).toHaveValue('streets-1');
    expect(storage.loadCampaign().settings.selectedModuleId).toBe('opera-night-preview');
  });
  it('automatically collapses both rails below their breakpoints and permits reopening',()=>{
    const widen:Array<()=>void>=[];
    vi.stubGlobal('matchMedia',vi.fn((query:string)=>{
      const media={matches:true,media:query,addEventListener:(_event:string,listener:()=>void)=>{widen.push(()=>{media.matches=false;listener();});},removeEventListener:vi.fn()};
      return media;
    }));
    try {
      renderPreparedApp();startGame();
      expect(screen.getByRole('button',{name:'展开工具栏'})).toBeVisible();
      expect(screen.getByRole('button',{name:'展开行动栏'})).toBeVisible();
      expect(screen.getByLabelText('你的行动')).toBeEnabled();
      fireEvent.click(screen.getByRole('button',{name:'展开行动栏'}));
      expect(screen.getByRole('group',{name:'可选行动'})).toBeVisible();
      act(()=>widen.forEach(update=>update()));
      expect(screen.getByRole('button',{name:'收起工具栏'})).toBeVisible();
      expect(screen.getByRole('button',{name:'收起行动栏'})).toBeVisible();
    } finally {vi.unstubAllGlobals();}
  });
  it('renders the Executive teamwork action as a role ability, not a character editing field',()=>{
    const campaign=storage.loadCampaign();campaign.character.role='主管';
    storage.saveCampaign(campaign);
    renderPreparedApp();startGame();
    expect(screen.getByRole('button',{name:'团队协作 · 4'})).toHaveClass('role-action');
    expect(screen.getByRole('button',{name:'掷骰判定'})).toBeVisible();
  });
  it('does not claim autosave succeeded when local storage rejects the write',()=>{
    vi.spyOn(storage,'saveCampaign').mockImplementation(()=>{throw new Error('quota');});
    renderPreparedApp();
    expect(screen.getByLabelText('存档状态')).toHaveTextContent('保存失败');
    expect(screen.getByText(/自动保存失败：本地存储不可用或已满/)).toBeVisible();
  });
  it('saves gender and editable pronouns through character creation',()=>{
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button',{name:'编辑角色'}));
    expect(screen.getByLabelText('年龄',{exact:true})).toBeVisible();
    fireEvent.change(screen.getByLabelText('年龄',{exact:true}),{target:{value:'32'}});
    fireEvent.change(screen.getByLabelText('性别',{exact:true}),{target:{value:'female'}});
    expect(screen.getByLabelText('称谓偏好',{exact:true})).toHaveValue('她');
    fireEvent.change(screen.getByLabelText('称谓偏好',{exact:true}),{target:{value:'请称我夜莺'}});
    fireEvent.click(screen.getByRole('button',{name:'保存角色'}));
    startGame();
    expect(storage.loadCampaign().character.gender).toBe('female');
    expect(storage.loadCampaign().character.age).toBe(32);
    expect(storage.loadCampaign().character.pronouns).toBe('请称我夜莺');
  });
  it('offers memory directly on the toolbar and separates current, other and legacy recaps',()=>{
    const base=storage.loadCampaign();const c=startRunnerCampaign(base,base.settings);
    c.journal=[{id:'current',type:'ai',title:'recap',body:'当前剧本摘要',createdAt:'',moduleId:c.runner.moduleId},{id:'other',type:'ai',title:'recap',body:'其他剧本不可混入',createdAt:'',moduleId:'another-module'},{id:'old',type:'ai',title:'recap',body:'旧版摘要仍保留',createdAt:''}];
    storage.saveCampaign(c);render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(screen.getByRole('button',{name:'人生路径'})).toHaveTextContent('记忆');
    fireEvent.click(screen.getByRole('button',{name:'人生路径'}));
    fireEvent.click(screen.getByText('待确认摘要',{selector:'summary'}));
    expect(screen.getByText('当前剧本摘要')).toBeVisible();
    expect(screen.queryByText('其他剧本不可混入')).not.toBeInTheDocument();
    expect(screen.getByText('旧版摘要仍保留')).not.toBeVisible();
    fireEvent.click(screen.getByText('旧版摘要（未归属剧本）'));
    expect(screen.getByText('旧版摘要仍保留')).toBeVisible();
  });
  it('collapses extra actions while preserving a scene route and supports editable dice presets',()=>{
    const base=storage.loadCampaign();const c=startRunnerCampaign(base,base.settings);
    storage.saveCampaign(c);render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(within(screen.getByRole('group',{name:'可选行动'})).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button',{name:/推进到/})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:/更多行动/}));
    expect(screen.getByRole('group',{name:'可选行动'}).querySelectorAll('button').length).toBeGreaterThan(3);
    fireEvent.click(screen.getByRole('button',{name:'掷骰判定'}));
    fireEvent.change(screen.getByLabelText('本次属性值',{exact:true}),{target:{value:'8'}});
    fireEvent.change(screen.getByLabelText('DV',{exact:true}),{target:{value:'13'}});
    fireEvent.change(screen.getByLabelText('你的行动'),{target:{value:'先继续观察'}});
    expect(screen.getByRole('button',{name:'提交行动'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:/^掷骰$/}));
    expect(storage.loadCampaign().character.stats).toEqual(c.character.stats);
    expect(storage.loadCampaign().runner.turns.slice(-1)[0]?.body).toContain('本次临时属性值 8');
    expect(screen.getByRole('complementary',{name:'掷骰判定'})).toBeVisible();
  });
  it('cleans historical protocol noise only for display and preserves the saved original',()=>{
    const base=storage.loadCampaign();const c=startRunnerCampaign(base,base.settings);
    const raw='**旧主持说明**\n```json\n'+JSON.stringify({text:'旧回复中的可读场景',choices:[]})+'\n```';
    c.runner.turns.push({id:'legacy-json',type:'gm',speaker:'AI GM',body:raw,createdAt:''});
    storage.saveCampaign(c);render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(screen.getByText('旧回复中的可读场景')).toBeVisible();
    expect(screen.queryByText(/旧主持说明/)).not.toBeInTheDocument();
    expect(storage.loadCampaign().runner.turns.find(t=>t.id==='legacy-json')?.body).toBe(raw);
  });
  it('tracks player wounds and uses source-entered enemy stats rather than player REF or example HP',()=>{
    const base=storage.loadCampaign();base.character.roleAllocations={initiative:2};storage.saveCampaign(base);
    vi.spyOn(Math,'random').mockReturnValue(0);
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'完整'}));
    expect(screen.getByRole('button',{name:'下一回合'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'敌人'}));
    expect(screen.getByLabelText('敌人名称',{exact:true})).toBeVisible();
    expect(screen.getByRole('button',{name:'按原文数值加入敌人'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'玩家'}));
    expect(storage.loadCampaign().combat.combatants[0].initiative).toBe(base.character.stats.ref+3);
    expect(screen.getByRole('button',{name:'玩家'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText(`${base.character.handle} HP`),{target:{value:'1'}});
    expect(storage.loadCampaign().character.hp.current).toBe(1);
    for(const [label,value] of [['敌人名称','来源目标'],['敌人最大 HP','30'],['敌人反应','4'],['敌人头部 SP','0'],['敌人身体 SP','7'],['敌人来源页或条目','测试：用户确认的原文模板']])fireEvent.change(screen.getByLabelText(label,{exact:true}),{target:{value}});
    fireEvent.click(screen.getByRole('button',{name:'敌人'}));
    expect(storage.loadCampaign().combat.combatants.find(item=>item.side==='enemy')).toMatchObject({hpMax:30,initiative:5,bodySp:7});
    fireEvent.click(screen.getByRole('button',{name:'角色'}));
    fireEvent.change(screen.getByLabelText('当前 HP',{exact:true}),{target:{value:'10'}});
    fireEvent.click(screen.getByRole('button',{name:'保存角色'}));
    expect(storage.loadCampaign().combat.combatants.find(item=>item.side==='player')?.hpCurrent).toBe(10);
  });
  it('applies Solo Fumble Recovery only to weapon attacks and not perception',()=>{
    const base=storage.loadCampaign();base.character.roleAllocations={recovery:4};const c=startRunnerCampaign(base,base.settings);
    storage.saveCampaign(c);vi.spyOn(Math,'random').mockReturnValue(0);
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    fireEvent.click(screen.getByRole('button',{name:'掷骰判定'}));
    fireEvent.change(screen.getByLabelText('技能',{exact:true}),{target:{value:'handgun'}});
    fireEvent.change(screen.getByLabelText('DV',{exact:true}),{target:{value:'13'}});
    fireEvent.click(screen.getByRole('button',{name:/^掷骰$/}));
    expect(storage.loadCampaign().runner.turns.slice(-1)[0].body).toContain('失手挽回');
    fireEvent.change(screen.getByLabelText('技能',{exact:true}),{target:{value:'perception'}});
    fireEvent.change(screen.getByLabelText('DV',{exact:true}),{target:{value:'13'}});
    fireEvent.click(screen.getByRole('button',{name:/^掷骰$/}));
    expect(storage.loadCampaign().runner.turns.slice(-1)[0].body).toContain('扣除追加骰');
  });
  it('prefills optional GM advice without blocking actions and keeps manual overrides local to one roll',()=>{
    const base=storage.loadCampaign();
    const c=startRunnerCampaign(base,base.settings);
    const sheetLevel=c.character.skills.find(s=>s.skillId==='perception')!.level;
    c.runner.turns.push({id:'advice',type:'gm',speaker:'主持',body:'观察现场。',createdAt:'',checkSuggestions:[{skillId:'perception',reason:'观察可见的人群',dv:13,sourcePage:40,condition:'visual'}]});
    storage.saveCampaign(c);render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    fireEvent.change(screen.getByLabelText('你的行动'),{target:{value:'我先观察现场。'}});
    expect(screen.getByRole('button',{name:'提交行动'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'掷骰判定'}));
    expect(screen.getByLabelText('DV')).toHaveValue(13);
    expect(screen.getByLabelText('技能',{exact:true})).toHaveValue('perception');
    expect(screen.getByLabelText('检定情境')).toHaveValue('visual');
    expect(screen.getByLabelText('本次技能等级')).toHaveValue(sheetLevel);
    fireEvent.change(screen.getByLabelText('本次技能等级'),{target:{value:String(sheetLevel+1)}});
    fireEvent.change(screen.getByLabelText('DV'),{target:{value:'15'}});
    fireEvent.change(screen.getByLabelText('修正',{exact:true}),{target:{value:'2'}});
    fireEvent.click(screen.getByRole('button',{name:'掷骰'}));
    const saved=storage.loadCampaign();
    expect(saved.character.skills.find(s=>s.skillId==='perception')!.level).toBe(sheetLevel);
    expect(saved.runner.turns.slice(-1)[0].body).toContain('本次临时技能等级');
    expect(saved.runner.turns.slice(-1)[0].checkResult?.dv).toBe(15);
    expect(screen.getByLabelText('互动阶段')).toHaveTextContent('等待叙述后果');
    expect(screen.getByLabelText('你的行动')).toBeDisabled();
    expect(screen.getByRole('button',{name:'提交行动'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'关闭'}));
    fireEvent.click(screen.getByRole('button',{name:'掷骰判定'}));
    expect(screen.getByLabelText('DV')).toHaveValue(13);
    expect(screen.getByLabelText('DV依据')).toHaveTextContent('主持建议');
    expect(screen.queryByLabelText('主持判定建议')).not.toBeInTheDocument();
  });
  it('distinguishes conversation from a pending check and records abandonment without a success',()=>{
    const base=storage.loadCampaign();const c=startRunnerCampaign(base,base.settings);
    c.runner.turns.push({id:'required-boundary',type:'gm',speaker:'主持',body:'潜入有人看守的入口存在被发现的风险。',createdAt:'',checkRequest:{reason:'避开守卫进入后台',skillId:'stealth',dv:15}});
    storage.saveCampaign(c);render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(screen.getByLabelText('互动阶段')).toHaveTextContent('等待判定');
    expect(screen.getByLabelText('你的行动')).toBeDisabled();
    expect(screen.getByRole('button',{name:'提交行动'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'放弃本次尝试'}));
    expect(screen.getByLabelText('互动阶段')).toHaveTextContent('自由互动');
    expect(screen.getByLabelText('你的行动')).toBeEnabled();
    const saved=storage.loadCampaign();
    expect(saved.runner.turns[saved.runner.turns.length-1].body).toContain('未掷骰，不计为成功');
    expect(saved.runner.turns.some(turn=>turn.type==='check')).toBe(false);
    expect(saved.character).toEqual(c.character);
  });
  it('rolls and continues with exactly one saved result and no duplicate player action',()=>{
    const base=storage.loadCampaign();const c=startRunnerCampaign(base,base.settings);
    c.runner.turns.push({id:'required',type:'gm',speaker:'主持',body:'观察入口是否有危险。',createdAt:'',checkRequest:{reason:'观察入口是否有危险',skillId:'perception',dv:13}});
    const players=c.runner.turns.filter(turn=>turn.type==='player').length;
    storage.saveCampaign(c);render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    fireEvent.click(screen.getByRole('button',{name:'进行这次判定'}));
    expect(screen.getByText('本次行动')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'掷骰并继续'}));
    const saved=storage.loadCampaign();
    expect(saved.runner.turns.filter(turn=>turn.type==='check')).toHaveLength(1);
    expect(saved.runner.turns.filter(turn=>turn.type==='player')).toHaveLength(players);
    expect(saved.runner.turns[saved.runner.turns.length-1]?.type).toBe('gm');
    expect(screen.queryByRole('heading',{name:'掷骰判定'})).not.toBeInTheDocument();
  });
  it('verifies legacy prose advice without overwriting edits made while source lookup is pending',async()=>{
    const base=storage.loadCampaign();const c=startRunnerCampaign(base,{...base.settings,selectedModuleId:'streets-3',starterSceneId:'streets-3-index-1'});
    c.runner.turns.push({id:'legacy-advice',type:'gm',speaker:'主持',body:'判定建议：侦察对面的人群，进行 Perception（等级2）检定。依据 PDF40 页，观察可发现异常（DV13）。',createdAt:''});
    storage.saveCampaign(c);
    let finish:(value:localSources.LocalPassage[])=>void=()=>{};
    vi.spyOn(localSources,'retrieveLocalSources').mockImplementationOnce(()=>new Promise<localSources.LocalPassage[]>(resolve=>{finish=resolve;}));
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    fireEvent.click(screen.getByRole('button',{name:'掷骰判定'}));
    expect(screen.getByLabelText('技能',{exact:true})).toHaveValue('perception');
    fireEvent.change(screen.getByLabelText('DV'),{target:{value:'17'}});
    finish([{sourceId:'red-streets-20261010',title:'街头故事',page:40,text:'一次 DV13 觉察检定可发现异常。'}]);
    await waitFor(()=>expect(screen.getByRole('option',{name:'觉察 · DV 13'})).toBeInTheDocument());
    expect(screen.getByLabelText('DV')).toHaveValue(17);
    fireEvent.click(screen.getByRole('button',{name:'重新带入建议'}));
    expect(screen.getByLabelText('DV')).toHaveValue(13);
  });

  it('keeps full-mode scene loads synchronized with the GM and saves',()=>{
    const base=storage.loadCampaign();
    storage.saveCampaign(startRunnerCampaign(base,{...base.settings,selectedModuleId:'streets-9',starterSceneId:'streets-9-intro'}));
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    fireEvent.click(screen.getByRole('button',{name:'完整'}));
    fireEvent.click(screen.getByRole('button',{name:'模组'}));
    fireEvent.click(screen.getAllByRole('button',{name:'载入'})[1]);
    fireEvent.click(screen.getByRole('button',{name:'简化'}));
    const saved=storage.loadCampaign();
    expect(saved.currentScene.title).toBe('搞到门票');
    expect(saved.runner.moduleId).toBe('streets-1');
    expect(saved.settings.selectedModuleId).toBe(saved.runner.moduleId);
    expect(saved.runner.sceneId).toBe('streets-1-index-1');
  });

  it('records a scene result, follows an original route and preserves it on reload',()=>{
    const base=storage.loadCampaign();
    storage.saveCampaign(startRunnerCampaign(base,{...base.settings,selectedModuleId:'streets-3',starterSceneId:'streets-3-intro',pace:'slow'}));
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(screen.getByRole('button',{name:/推进到：对手小队/})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'场景进展'}));
    fireEvent.change(screen.getByLabelText('本场景已确认的线索或后果'),{target:{value:'已带好邀请卡，并决定观察仓库外的接近路线。'}});
    fireEvent.click(screen.getByRole('button',{name:'记录场景结果'}));
    fireEvent.click(screen.getByRole('checkbox',{name:'满足进入条件'}));
    fireEvent.click(screen.getByRole('button',{name:'对手小队'}));
    const saved=storage.loadCampaign();
    expect(saved.runner.sceneId).toBe('streets-3-index-1');
    expect(saved.runner.resolutions?.[0].summary).toContain('邀请卡');
    expect(storage.importCampaign(storage.exportCampaign(saved)).runner).toEqual(saved.runner);
  });

  it('keeps rate-limited retries disabled after reload and can continue offline once',async()=>{
    const base=storage.loadCampaign();
    const started=startRunnerCampaign(base,{...base.settings,runnerMode:'ai'});
    started.aiSettings.enabled=true;
    started.runner.turns.push({id:'player',type:'player',speaker:'玩家',body:'询问合同',createdAt:base.createdAt},{id:'failed',type:'system',speaker:'连接中断',body:'HTTP429 / 1302 账户限流',createdAt:base.createdAt,responseState:'failed',pendingIntent:'询问合同',retryAt:Date.now()+60000});
    storage.saveCampaign(started);
    const mock=vi.spyOn(ai,'generateGmResponse');
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(screen.getByRole('button',{name:/秒后可重试/})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'切换离线'}));
    await waitFor(()=>expect(storage.loadCampaign().runner.mode).toBe('offline'));
    expect(storage.loadCampaign().runner.turns.filter(turn=>turn.type==='player')).toHaveLength(1);
    expect(mock).not.toHaveBeenCalled();
  });

  it('starts from the main menu and completes create, play, save, exit and load in order', () => {
    window.localStorage.clear();
    render(<App />);
    expect(screen.getByRole('heading',{name:'回到夜之城'})).toBeVisible();
    expect(screen.queryByLabelText('剧本')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'新建角色'}));
    expect(screen.getByRole('heading',{name:'新建角色'})).toBeVisible();
    expect(screen.queryByRole('button',{name:'进入夜之城'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('代号'),{target:{value:'新角色测试'}});
    fireEvent.click(screen.getByRole('button',{name:'补齐未分配点数'}));
    fireEvent.click(screen.getByRole('button',{name:'保存角色'}));
    expect(screen.getByLabelText('剧本',{exact:true})).toBeVisible();
    startGame();
    expect(screen.getByRole('log',{name:'故事记录'})).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'保存并退出'}));
    const saved=storage.listSaveSlots()[0].campaign;
    expect(saved.character.handle).toBe('新角色测试');
    fireEvent.click(screen.getByRole('button',{name:'读取本地存档'}));
    expect(storage.loadCampaign().id).toBe(saved.id);
    expect(storage.loadCampaign().runner.turns).toEqual(saved.runner.turns);
  });

  it('backs up an existing story before creating an independent character and can load it again', () => {
    const original=startRunnerCampaign(storage.loadCampaign(),storage.loadCampaign().settings);
    storage.saveCampaign(original);
    render(<App />);
    fireEvent.click(screen.getByRole('button',{name:'新建角色'}));
    expect(storage.loadCampaign().id).not.toBe(original.id);
    expect(storage.loadCampaign().runner.configured).toBe(false);
    expect(storage.listSaveSlots()[0].campaign.id).toBe(original.id);
    fireEvent.click(screen.getByRole('button',{name:'返回主界面'}));
    fireEvent.click(screen.getByRole('button',{name:'读取本地存档'}));
    expect(screen.getByRole('log',{name:'故事记录'})).toBeVisible();
    expect(storage.loadCampaign().character).toEqual(original.character);
  });

  it('does not replace an existing campaign when the pre-new-game backup fails', () => {
    const original=startRunnerCampaign(storage.loadCampaign(),storage.loadCampaign().settings);
    storage.saveCampaign(original);
    vi.spyOn(storage,'saveLocalCheckpoint').mockImplementation(()=>{throw new Error('quota');});
    render(<App />);
    fireEvent.click(screen.getByRole('button',{name:'新建角色'}));
    expect(screen.getByRole('alert')).toHaveTextContent('当前角色未被替换');
    expect(storage.loadCampaign().id).toBe(original.id);
    expect(screen.getByRole('button',{name:'继续游戏'})).toBeVisible();
  });

  it('blocks an unfinished character and saves a valid creation draft', () => {
    window.localStorage.clear();
    render(<App />);
    expect(screen.queryByRole('button', { name: '进入夜之城' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新建角色' }));
    expect(screen.getByRole('button',{name:'保存角色'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '补齐未分配点数' }));
    expect(screen.getByRole('button', { name: '保存角色' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '进入夜之城' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存角色' }));
    expect(screen.getByRole('button', { name: '进入夜之城' })).toBeEnabled();
  });
  it('confirms attribute resets and keeps purchases while requiring reallocation',()=>{
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button',{name:'编辑角色'}));
    fireEvent.change(screen.getByLabelText('智力'),{target:{value:'8'}});
    fireEvent.click(screen.getByRole('button',{name:'重置属性点'}));
    fireEvent.click(screen.getByRole('button',{name:'取消重置'}));
    expect(screen.getByLabelText('智力')).toHaveValue(8);
    fireEvent.click(screen.getByRole('button',{name:'重置属性点'}));
    fireEvent.click(screen.getByRole('button',{name:'确认重置属性'}));
    expect(screen.getByLabelText('智力')).toHaveValue(2);
    expect(screen.getByText('属性 20/62')).toBeVisible();
    expect(screen.getByRole('button',{name:'保存角色'})).toBeDisabled();
  });

  it("shows three setup choices and keeps advanced controls collapsed", () => {
    renderPreparedApp();
    expect(screen.getByText("选择剧本")).toBeVisible();
    expect(screen.getByText("确认角色")).toBeVisible();
    expect(screen.getByText("选择主持")).toBeVisible();
    expect(screen.getByText("难度")).not.toBeVisible();
    expect(screen.queryByText("API Key")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "资料源" })).not.toBeInTheDocument();
  });

  it("keeps the local proxy and restores editable custom API settings", () => {
    renderPreparedApp();
    fireEvent.click(screen.getByRole("button", { name: "AI 主持" }));
    expect(screen.getByRole("button", { name: "进入夜之城" })).toBeEnabled();
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    expect(screen.getByText(/沿用服务器现有配置/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('AI 接口方式'),{target:{value:'custom'}});
    expect(screen.getByLabelText('API 地址')).toBeVisible();
    expect(screen.getByLabelText('模型名称')).toBeVisible();
    expect(screen.getByLabelText('API Key')).toHaveAttribute('type','password');
    fireEvent.click(screen.getByRole("button", { name: "离线主持" }));
    expect(screen.getByRole("button", { name: "进入夜之城" })).toBeEnabled();
  });

  it("starts the story and records a free action", () => {
    renderPreparedApp();
    openStory();
    expect(screen.getByRole("log", { name: "故事记录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /核实失踪线索/ })).toBeVisible();
    fireEvent.change(screen.getByLabelText("你的行动"), { target: { value: "我调查后台入口" } });
    fireEvent.click(screen.getByRole("button", { name: "提交行动" }));
    expect(screen.getByText("我调查后台入口", { exact: true })).toBeVisible();
    expect(screen.getByLabelText("你的行动")).toHaveValue("");
  });

  it("advances a scene and opens a character drawer on demand", () => {
    renderPreparedApp();
    openStory();
    fireEvent.click(screen.getByRole("button", { name: /推进到：搞到门票/ }));
    expect(screen.getByRole("heading", { name: "搞到门票" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "角色与装备" }));
    expect(screen.getByRole("complementary",{name:'角色与装备'})).toBeVisible();
    expect(screen.getByLabelText('你的行动')).toBeEnabled();
    expect(screen.getByText("尚未登记装备")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("complementary",{name:'角色与装备'})).not.toBeInTheDocument();
  });

  it('keeps the scene and conversation unchanged when a transition is cancelled',()=>{
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPreparedApp();openStory();
    const before=storage.loadCampaign();
    fireEvent.click(screen.getByRole('button',{name:/推进到：搞到门票/}));
    expect(screen.getByRole('heading',{name:'背景与引入'})).toBeVisible();
    expect(storage.loadCampaign().runner.turns).toEqual(before.runner.turns);
    expect(storage.loadCampaign().runner.sceneId).toBe(before.runner.sceneId);
  });

  it("records a dice result and offers to return it to the GM", () => {
    renderPreparedApp();
    startGame();
    fireEvent.click(screen.getByRole("button", { name: "掷骰判定" }));
    expect(screen.getByRole('complementary',{name:'掷骰判定'}).closest('.game-session')).toHaveClass('has-dice-panel');
    expect(screen.getByLabelText('行动栏')).toHaveAttribute('hidden');
    fireEvent.change(screen.getByLabelText('DV'),{target:{value:'13'}});
    fireEvent.click(screen.getByRole("button", { name: "掷骰" }));
    expect(within(screen.getByRole('complementary',{name:'掷骰判定'})).getByText('判定已记录')).toBeVisible();
    expect(screen.getByRole("button", { name: /交给主持继续/ })).toBeVisible();
  });
  it('waits for the requested check, prefills the skill/DV and includes wound and saved skill modifiers',async()=>{
    const campaign=storage.loadCampaign();
    campaign.settings.runnerMode='ai';campaign.aiSettings.enabled=true;
    const started=startRunnerCampaign(campaign,campaign.settings);
    started.character.hp.current=started.character.hp.seriouslyWoundedAt-1;
    started.character.skills=started.character.skills.map(skill=>skill.skillId==='persuasion'?{...skill,modifier:2}:skill);
    started.runner.turns.push({id:'requested-check',type:'gm',speaker:'AI GM',body:'售票员等待你的解释。',createdAt:'',checkRequest:{skillId:'persuasion',dv:13,reason:'说服售票员',sourcePage:128}});
    storage.saveCampaign(started);
    const mock=vi.spyOn(ai,'generateGmResponse').mockResolvedValue({ok:true,text:'主持按实际判定结果继续。'});
    render(<App />);
    fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(screen.getByRole('button',{name:'提交行动'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'进行这次判定'}));
    expect(screen.getByLabelText('DV')).toHaveValue(13);
    expect(screen.getByLabelText('技能')).toHaveValue('persuasion');
    fireEvent.click(screen.getByRole('button',{name:'掷骰'}));
    expect(storage.loadCampaign().runner.turns.slice(-1)[0].body).toContain('已存技能修正 2');
    expect(storage.loadCampaign().runner.turns.slice(-1)[0].body).toContain('伤势惩罚 2');
    fireEvent.click(screen.getByRole('button',{name:/交给主持继续/}));
    await screen.findByText('主持按实际判定结果继续。');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0].runner.turns.some(turn=>turn.type==='check')).toBe(true);
    expect(storage.loadCampaign().runner.turns.filter(turn=>turn.type==='player')).toHaveLength(0);
  });
  it('labels an ordinary free check as a recommendation and supports changing its difficulty',async()=>{
    vi.spyOn(localSources,'retrieveLocalSources').mockResolvedValue([]);
    renderPreparedApp();startGame();
    fireEvent.click(screen.getByRole('button',{name:'掷骰判定'}));
    expect(screen.getByRole('button',{name:'掷骰'})).toBeEnabled();
    expect(screen.getByLabelText('DV')).toHaveValue(13);
    expect(screen.getByLabelText('DV依据')).toHaveTextContent('主持建议');
    fireEvent.change(screen.getByLabelText('建议难度'),{target:{value:'professional'}});
    expect(screen.getByLabelText('DV')).toHaveValue(17);
    fireEvent.click(screen.getByRole('button',{name:'掷骰'}));
    expect(storage.loadCampaign().runner.turns.slice(-1)[0].body).toContain('主持建议（通用难度，非模组固定值）');
  });
  it('never fills generic DV for weapon attacks when weapon range or an opposed roll is missing',async()=>{
    vi.spyOn(localSources,'retrieveLocalSources').mockResolvedValue([]);
    renderPreparedApp();startGame();
    fireEvent.click(screen.getByRole('button',{name:'掷骰判定'}));
    fireEvent.change(screen.getByLabelText('技能',{exact:true}),{target:{value:'handgun'}});
    expect(screen.getByLabelText('DV')).toHaveValue(null);
    expect(screen.getByRole('button',{name:'掷骰'})).toBeDisabled();
    await screen.findByText('此类判定需距离、对抗值或专门规则，不能套用通用建议。');
  });
  it('does not count opening narration as a player action or offer the opening button again',async()=>{
    const campaign=storage.loadCampaign();campaign.settings.runnerMode='ai';campaign.aiSettings.enabled=true;
    storage.saveCampaign(startRunnerCampaign(campaign,campaign.settings));
    vi.spyOn(ai,'generateGmResponse').mockResolvedValue({ok:true,text:'雨中的门厅里有人等着你。',choices:[{id:'talk',label:'询问来意',intent:'询问来意',kind:'talk'}]});
    render(<App />);
    fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    expect(screen.getByRole('button',{name:'让主持人开场'})).toHaveTextContent('开始故事');
    expect(screen.queryByRole('button',{name:/更多行动/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'让主持人开场'}));
    await screen.findByText('雨中的门厅里有人等着你。');
    expect(storage.loadCampaign().runner.turns.filter(turn=>turn.type==='player')).toHaveLength(0);
    expect(screen.queryByRole('button',{name:'让主持人开场'})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'询问来意'})).toBeVisible();
  });

  it("prevents duplicate submissions and retries without duplicating the player turn", async () => {
    const campaign = createDefaultCampaign();
    campaign.settings.runnerMode = "ai";
    campaign.aiSettings.enabled = true;
    campaign.aiSettings.apiKey = "test";
    window.localStorage.setItem("cyberpunk-red-solo-runner:v1", JSON.stringify(startRunnerCampaign(campaign, campaign.settings)));
    let resolve!: (value: ai.AiGmResult) => void;
    const mock = vi.spyOn(ai, "generateGmResponse").mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', { name: '继续游戏' }));
    fireEvent.change(screen.getByLabelText("你的行动"), { target: { value: "检查大门" } });
    fireEvent.click(screen.getByRole("button", { name: "提交行动" }));
    expect(screen.getByRole("button", { name: "提交行动" })).toBeDisabled();
    expect(mock).toHaveBeenCalledTimes(1);
    resolve({ ok: false, text: "连接失败" });
    await screen.findByText("连接中断，行动已保留。");
    mock.mockResolvedValueOnce({ ok: true, text: "大门关闭着。" });
    fireEvent.click(screen.getByRole("button", { name: "重试回应" }));
    await screen.findByText("大门关闭着。");
    expect(screen.getAllByText("检查大门", { exact: true })).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
  it('cancels an AI wait and ignores late replies without disturbing a retry',async()=>{
    const campaign=storage.loadCampaign();campaign.settings.runnerMode='ai';campaign.aiSettings.enabled=true;
    storage.saveCampaign(startRunnerCampaign(campaign,campaign.settings));
    let first!:(value:ai.AiGmResult)=>void;let second!:(value:ai.AiGmResult)=>void;
    const mock=vi.spyOn(ai,'generateGmResponse').mockImplementationOnce(()=>new Promise(resolve=>{first=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{second=resolve;}));
    render(<App />);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    fireEvent.change(screen.getByLabelText('你的行动'),{target:{value:'检查门锁'}});
    fireEvent.click(screen.getByRole('button',{name:'提交行动'}));
    expect(screen.getByText(/已等待.*秒/)).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'停止等待'}));
    expect(mock.mock.calls[0][2]?.aborted).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('已停止等待');
    fireEvent.click(screen.getByRole('button',{name:'重试回应'}));
    await act(async()=>first({ok:true,text:'应忽略的迟到回复'}));
    expect(screen.queryByText('应忽略的迟到回复')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'停止等待'})).toBeVisible();
    await act(async()=>second({ok:true,text:'这次重试的回复'}));
    expect(screen.getByText('这次重试的回复')).toBeVisible();
    expect(storage.loadCampaign().runner.turns.filter(turn=>turn.type==='player')).toHaveLength(1);
  });
  it('saves and exits during an AI wait, preserving the action for later recovery',async()=>{
    const campaign=storage.loadCampaign();campaign.settings.runnerMode='ai';campaign.aiSettings.enabled=true;
    storage.saveCampaign(startRunnerCampaign(campaign,campaign.settings));
    let finish!:(value:ai.AiGmResult)=>void;
    vi.spyOn(ai,'generateGmResponse').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    render(<App />);fireEvent.click(screen.getByRole('button',{name:'继续游戏'}));
    fireEvent.change(screen.getByLabelText('你的行动'),{target:{value:'联系线人'}});
    fireEvent.click(screen.getByRole('button',{name:'提交行动'}));
    fireEvent.click(screen.getByRole('button',{name:'保存并退出'}));
    expect(screen.getByRole('heading',{name:'回到夜之城'})).toBeVisible();
    expect(storage.listSaveSlots()[0].campaign.runner.turns.slice(-1)[0].responseState).toBe('failed');
    await act(async()=>finish({ok:true,text:'退出后的旧回复'}));
    expect(storage.loadCampaign().runner.turns.some(turn=>turn.body==='退出后的旧回复')).toBe(false);
    fireEvent.click(screen.getByRole('button',{name:'读取本地存档'}));
    expect(screen.getByRole('button',{name:'重试回应'})).toBeVisible();
    expect(storage.loadCampaign().runner.turns.filter(turn=>turn.type==='player' && turn.body==='联系线人')).toHaveLength(1);
  });
  it('keeps notes and objective state with the saved campaign and updates the same slot',()=>{
    renderPreparedApp();startGame();
    expect(screen.queryByRole('button',{name:'冒险记录'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'当前委托'}));
    expect(screen.queryByLabelText('已确认线索与当前阻碍')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('当前目标状态'),{target:{value:'resolved'}});
    fireEvent.click(screen.getByRole('button',{name:'人生路径'}));
    fireEvent.click(screen.getByText('长期笔记',{selector:'summary'}));
    fireEvent.change(screen.getByLabelText('长期笔记'),{target:{value:'线人提到后台入口，门禁尚未解决。'}});
    fireEvent.click(screen.getByRole('button',{name:'关闭'}));
    fireEvent.click(screen.getByRole('button',{name:'本地保存'}));
    fireEvent.click(screen.getByRole('button',{name:'本地保存'}));
    expect(storage.listSaveSlots()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'保存并退出'}));
    expect(storage.listSaveSlots()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'读取本地存档'}));
    fireEvent.click(screen.getByRole('button',{name:'当前委托'}));
    expect(screen.getByLabelText('当前目标状态')).toHaveValue('resolved');
    fireEvent.click(screen.getByRole('button',{name:'人生路径'}));
    fireEvent.click(screen.getByText('长期笔记',{selector:'summary'}));
    expect(screen.getByLabelText('长期笔记')).toHaveValue('线人提到后台入口，门禁尚未解决。');
  });

  it("preserves the full tools and the mode preference", () => {
    renderPreparedApp();
    fireEvent.click(screen.getByRole("button", { name: "完整" }));
    expect(window.localStorage.getItem("cyberpunk-red-solo-runner:view-mode:v1")).toBe("full");
    fireEvent.click(screen.getByRole("button", { name: "资料源" }));
    expect(screen.getByText("资料源管理")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "简化" }));
    expect(screen.getByText("确认角色")).toBeVisible();
  });

  it('recovers a persisted pending action after repeated failures without replaying its effects', async () => {
    const campaign = createDefaultCampaign();
    campaign.runner = { configured: true, mode: 'ai', moduleId: campaign.settings.selectedModuleId, sceneId: campaign.settings.starterSceneId, turns: [
      { id: 'player-once', type: 'player', speaker: campaign.character.handle, body: '已完成现场调查', createdAt: campaign.createdAt },
      { id: 'pending-once', type: 'system', speaker: 'AI GM', body: '等待回复', pending: true, pendingIntent: '已完成现场调查', createdAt: campaign.createdAt },
    ] };
    campaign.aiSettings.enabled = true;
    const originalScene = campaign.currentScene.id;
    const originalJournal = campaign.journal.length;
    window.localStorage.setItem(storage.STORAGE_KEY, JSON.stringify(campaign));
    const mock = vi.spyOn(ai, 'generateGmResponse').mockResolvedValueOnce({ ok: false, text: '恢复时连接失败' });
    const view = renderPreparedApp();
    fireEvent.click(screen.getByRole('button', { name: '继续游戏' }));
    fireEvent.click(screen.getByRole('button', { name: '重新获取主持回复' }));
    await screen.findByText('连接中断，行动已保留。');
    expect(storage.loadCampaign().runner.turns.find(t => t.id === 'pending-once')?.responseState).toBe('failed');
    view.unmount();
    mock.mockResolvedValueOnce({ ok: true, text: '恢复后的正式回应' });
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', { name: '继续游戏' }));
    fireEvent.click(screen.getByRole('button', { name: '重试回应' }));
    await screen.findByText('恢复后的正式回应');
    const saved = storage.loadCampaign();
    expect(saved.runner.turns.filter(t => t.type === 'player')).toHaveLength(1);
    expect(saved.runner.turns).toHaveLength(2);
    expect(saved.currentScene.id).toBe(originalScene);
    expect(saved.journal).toHaveLength(originalJournal);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('can finish a saved failed action offline without submitting a second player action', async () => {
    const campaign = createDefaultCampaign();
    campaign.runner.configured = true; campaign.runner.mode = 'ai'; campaign.aiSettings.enabled = true;
    campaign.runner.turns = [
      { id: 'p', type: 'player', speaker: '玩家', body: '检查现场', createdAt: campaign.createdAt },
      { id: 'f', type: 'system', speaker: '连接中断', body: '连接失败', pendingIntent: '检查现场', responseState: 'failed', createdAt: campaign.createdAt },
    ];
    window.localStorage.setItem(storage.STORAGE_KEY, JSON.stringify(campaign));
    const mock = vi.spyOn(ai, 'generateGmResponse');
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', { name: '继续游戏' }));
    fireEvent.click(screen.getByRole('button', { name: '切换离线' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(storage.loadCampaign().runner.mode).toBe('offline');
    expect(storage.loadCampaign().runner.turns.filter(t => t.type === 'player')).toHaveLength(1);
    expect(mock).not.toHaveBeenCalled();
  });

  it('saves and exits, then reloads exactly the same scene and conversation', () => {
    const view = renderPreparedApp();
    startGame();
    fireEvent.click(screen.getByRole('button', { name: /推进到：搞到门票/ }));
    fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
    expect(screen.getByRole('heading', { name: '回到夜之城' })).toBeVisible();
    expect(screen.getByRole('button', { name: '读取本地存档' })).toBeVisible();
    const before = storage.loadLocalCheckpoint()!;
    view.unmount();
    renderPreparedApp();
    expect(screen.getByRole('button', { name: '继续游戏' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '读取本地存档' }));
    expect(screen.getByRole('heading', { name: '搞到门票' })).toBeVisible();
    expect(storage.loadCampaign().runner.turns).toEqual(before.runner.turns);
  });

  it('keeps the explicit checkpoint separate from later auto progress', () => {
    const view = renderPreparedApp();
    startGame();
    fireEvent.click(screen.getByRole('button', { name: '本地保存' }));
    fireEvent.change(screen.getByLabelText('你的行动'), { target: { value: '保存之后的新行动' } });
    fireEvent.click(screen.getByRole('button', { name: '提交行动' }));
    view.unmount();
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', { name: '读取本地存档' }));
    expect(screen.queryByText('保存之后的新行动', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps setup selections across reloads and uses wide tabbed editors', () => {
    const view = renderPreparedApp();
    fireEvent.change(screen.getByLabelText('剧本', { exact: true }), { target: { value: 'streets-4' } });
    fireEvent.click(screen.getByRole('button', { name: '编辑角色' }));
    fireEvent.click(screen.getByRole('button', { name: '技能分配' }));
    fireEvent.change(screen.getByLabelText('搜索技能'), { target: { value: '手枪' } });
    expect(screen.getByLabelText('手枪等级')).toBeVisible();
    expect(screen.queryByLabelText('觉察等级')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存角色' }));
    view.unmount();
    renderPreparedApp();
    expect(screen.getByLabelText('剧本', { exact: true })).toHaveValue('streets-4');
    fireEvent.click(screen.getByRole('button', { name: '故事背景' }));
    expect(screen.getByRole('dialog', { name: '“鼓手”与“鲸鱼”（街头故事）' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '世界背景' }));
    expect(screen.getByRole('heading', { name: '一座仍在重建的城市' })).toBeVisible();
  });

  it('does not exit when local checkpoint storage fails', () => {
    renderPreparedApp();
    startGame();
    vi.spyOn(storage, 'saveCurrentCheckpoint').mockImplementation(() => { throw new Error('quota exceeded'); });
    fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
    expect(screen.getByRole('alert')).toHaveTextContent('尚未退出游戏');
    expect(screen.getByRole('log', { name: '故事记录' })).toBeVisible();
  });
  it('shows a timed API connection result without starting the campaign', async () => {
    vi.spyOn(ai, 'testAiConnection').mockResolvedValue({ ok: true, elapsedMs: 125, message: '模型已回应：OK' });
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', { name: 'AI 主持' }));
    fireEvent.click(screen.getByRole('button', { name: '测试连接 / 测速' }));
    expect(await screen.findByText(/连接成功 · 125 ms/)).toBeVisible();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });
  it('preserves unreadable autosaves in recovery mode instead of overwriting them', () => {
    window.localStorage.setItem('cyberpunk-red-solo-runner:v1', '{broken');
    renderPreparedApp();
    expect(screen.getByText(/已暂停自动保存/)).toBeVisible();
    expect(window.localStorage.getItem('cyberpunk-red-solo-runner:v1')).toBe('{broken');
    fireEvent.click(screen.getByRole('button', { name: '丢弃损坏自动存档并新建' }));
    expect(window.localStorage.getItem('cyberpunk-red-solo-runner:v1')).toBe('{broken');
    fireEvent.click(screen.getByText('取消'));
    expect(window.localStorage.getItem('cyberpunk-red-solo-runner:v1')).toBe('{broken');
  });
  it('backs up and confirms before resetting a started campaign', () => {
    const original = startRunnerCampaign(createDefaultCampaign(), createDefaultCampaign().settings);
    window.localStorage.setItem('cyberpunk-red-solo-runner:v1', JSON.stringify(original));
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button',{name:'完整'}));
    fireEvent.click(screen.getByRole('button',{name:'设置'}));
    fireEvent.click(screen.getByRole('button',{name:'重置'}));
    expect(storage.loadCampaign().id).toBe(original.id);
    fireEvent.click(screen.getByText('确认重置并备份'));
    expect(storage.loadCampaign().id).not.toBe(original.id);
    expect(storage.listSaveSlots()[0].campaign.id).toBe(original.id);
  });
  it('keeps multiple snapshots and requires confirmation before deleting one', () => {
    renderPreparedApp();
    startGame();
    fireEvent.click(screen.getByRole('button', { name: '本地保存' }));
    fireEvent.click(screen.getByText('更多',{exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'另存为新存档'}));
    fireEvent.click(screen.getByRole('button', { name: '保存并退出' }));
    expect(screen.getAllByRole('button', { name: '读取本地存档' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: '删除存档' })[0]);
    expect(storage.listSaveSlots()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.getAllByRole('button', { name: '读取本地存档' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '继续游戏' })).toBeVisible();
  });
  it('shows a sourced role ability and refuses spending more than the cash balance', () => {
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', { name: '编辑角色' }));
    fireEvent.change(screen.getByLabelText('身份'), { target: { value: '游民' } });
    fireEvent.click(screen.getByRole('button', { name: '身份能力' }));
    expect(screen.getByRole('heading', { name: '游民 · 机车 4' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '装备商店' }));
    fireEvent.click(screen.getByText('自定义支出（未收录商品）'));
    fireEvent.change(screen.getByLabelText('购置名称'), { target: { value: '测试装备' } });
    fireEvent.change(screen.getByLabelText('支出金额'), { target: { value: '2600' } });
    expect(screen.getByRole('button', { name: '登记支出' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('支出金额'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: '登记支出' }));
    expect(screen.getByRole('heading', { name: '欧币余额：2050 eb' })).toBeVisible();
  });
});

describe('V1.3 可视化建卡功能', () => {
  beforeEach(() => {
    window.localStorage.clear();
    const campaign = createDefaultCampaign();
    campaign.character = fillCreationPoints(campaign.character);
    window.localStorage.setItem('cyberpunk-red-solo-runner:v1', JSON.stringify(campaign));
  });

  it('在建卡商店显示商品列表，购买后写入角色武器与资金', () => {
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', {name:'编辑角色'}));
    fireEvent.click(screen.getByRole('button', {name:'装备商店'}));
    expect(screen.getByText(/可用欧币/)).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', {name:'购买'})[0]);
    expect(screen.getByText('已购 / 资金流水')).toBeVisible();
    expect(screen.getByText(/已购入/)).toBeVisible();
  });

  it('角色创建可切到义体人体图并选择左赛博眼', () => {
    renderPreparedApp();
    fireEvent.click(screen.getByRole('button', {name:'编辑角色'}));
    fireEvent.click(screen.getByRole('button', {name:'义体人体图'}));
    fireEvent.click(screen.getByRole('button', {name:'左赛博眼 空'}));
    expect(screen.getByRole('region', {name:'所选义体部位'})).toBeVisible();
    expect(screen.getByText('赛博义眼')).toBeVisible();
  });
});
