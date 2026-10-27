import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultCampaign } from './state';
import { generateGmResponse, testAiConnection } from './ai';

afterEach(() => vi.unstubAllGlobals());

describe('PDF grounded AI GM', () => {
  it('fills omitted required and optional DVs from unique current-scene evidence',async()=>{
    const c=createDefaultCampaign();c.aiSettings.enabled=true;c.runner.moduleId='streets-3';c.runner.sceneId='streets-3-index-1';
    const passages=[{sourceId:'red-streets-20261010',title:'街头故事',page:40,text:'DV13觉察检定。'}];
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>passages}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({text:'你开始观察。',checkRequest:{skillId:'perception',reason:'观察'},checkSuggestions:[{skillId:'perception',reason:'观察'}]})}}]})}));
    const result=await generateGmResponse(c,'观察');
    expect(result.checkRequest).toMatchObject({dv:13,sourcePage:40});
    expect(result.checkSuggestions?.[0]).toMatchObject({dv:13,sourcePage:40});
  });
  it('accepts a prose-wrapped JSON envelope without displaying protocol or losing choices',async()=>{
    const c=createDefaultCampaign();c.aiSettings.enabled=true;
    const raw='**主持说明**\n```json\n'+JSON.stringify({text:'门口有人等待。',choices:[{label:'问候对方',intent:'先问候',kind:'talk'}]})+'\n```';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:raw}}]})}));
    const result=await generateGmResponse(c,'观察');
    expect(result.ok).toBe(true);expect(result.text).toBe('门口有人等待。');
    expect(result.choices?.[0].label).toBe('问候对方');
  });
  it.each([{},[],{text:12},{text:''}])('rejects invalid structured narration %j',async content=>{
    const c=createDefaultCampaign();c.aiSettings.enabled=true;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(content)}}]})}));
    expect((await generateGmResponse(c,'观察')).ok).toBe(false);
  });
  it('sends only current-module recaps and preserves unscoped legacy journals on disk',async()=>{
    const c=createDefaultCampaign();c.aiSettings.enabled=true;c.runner.moduleId='streets-3';c.runner.sceneId='streets-3-intro';
    c.journal=[['one','streets-1','other-story'],['three','streets-3','current-story'],['old',undefined,'legacy-unscoped']].map(([id,moduleId,body])=>({id:id!,moduleId,type:'ai',title:'recap',body:body!,createdAt:''}));
    const mock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:'{"text":"继续观察"}'}}]})});
    vi.stubGlobal('fetch',mock);
    expect((await generateGmResponse(c,'观察')).ok).toBe(true);
    const payload=JSON.parse(JSON.parse(mock.mock.calls[1][1].body).messages.find((m:{role:string})=>m.role==='user').content);
    expect(payload.unconfirmedNarrativeRecaps).toEqual(['current-story']);
    expect(c.journal).toHaveLength(3);
  });
  it('does not convert malformed structured replies into successful plain-text responses',async()=>{
    const c=createDefaultCampaign();c.aiSettings.enabled=true;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:'{"text":"unfinished'}}]})}));
    expect(await generateGmResponse(c,'观察')).toMatchObject({ok:false,text:expect.stringContaining('行动已保留')});
  });
  it('sends saved identity and returns sourced optional suggestions without requiring a roll',async()=>{
    const campaign=createDefaultCampaign();campaign.aiSettings.enabled=true;
    campaign.runner.moduleId='streets-3';campaign.runner.sceneId='streets-3-index-1';
    campaign.character.gender='female';campaign.character.pronouns='她';campaign.character.age=32;
    campaign.character.backgroundDetails={friends:'米娅：旧同事',values:'保护家人'};
    campaign.playerNotes='米娅尚未答应援助';
    const mock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[{sourceId:'red-streets-20261010',title:'街头故事',page:40,text:'DV13 的觉察检定可发现伏击。'}]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({text:'对方等你说明来意。',checkSuggestions:[{skillId:'perception',reason:'观察对面人群',dv:13,sourcePage:40,condition:'visual'},{skillId:'persuasion',reason:'询问接待',dv:17,sourcePage:40}]})}}]})});
    vi.stubGlobal('fetch',mock);
    const result=await generateGmResponse(campaign,'先观察');
    expect(result.checkRequest).toBeUndefined();
    expect(result.checkSuggestions?.[0]).toMatchObject({skillId:'perception',dv:13,condition:'visual'});
    expect(result.checkSuggestions?.[1].dv).toBeUndefined();
    const messages=JSON.parse(mock.mock.calls[1][1].body).messages;
    const payload=JSON.parse(messages.find((m:{role:string})=>m.role==='user').content);
    expect(payload.campaign.characterIdentity).toContain('32岁');
    expect(payload.campaign.personalStory).toMatchObject({age:32,facts:{friends:'米娅：旧同事',values:'保护家人'},confirmedMemory:'米娅尚未答应援助'});
    expect(payload.adjudicationPolicy).toContain('核心规则中的通用例子不是本次目标DV');
    expect(payload.adjudicationPolicy).toContain('判定失败后');
    expect(payload.campaign.savedContacts).toEqual(campaign.npcs.slice(0,20).map(({name,role,disposition})=>({name,role,disposition})));
    expect(payload.campaign.savedContacts.every((npc:Record<string,unknown>)=>!('want' in npc)&&!('leverage' in npc))).toBe(true);
    expect(messages.some((m:{content:string})=>m.content.includes('性别不是属性加成'))).toBe(true);
  });
  it('keeps useful option details and rejects empty AI buttons',async()=>{
    const campaign=createDefaultCampaign();campaign.aiSettings.enabled=true;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({text:'对方等你说明来意。',choices:[{label:'核实门票来源',detail:'询问售票渠道与入场条件，暂不支付欧币。',intent:'我向接洽人核实门票来源。',kind:'talk'},{label:' ',intent:'空标题',kind:'talk'},{label:'空行动',intent:' ',kind:'talk'}]})}}]})}));
    const result=await generateGmResponse(campaign,'询问门票');
    expect(result.choices).toHaveLength(1);
    expect(result.choices?.[0].detail).toContain('暂不支付欧币');
  });
  it('keeps generic advice nonblocking and rejects nonexistent skills and invalid scene choices',async()=>{
    const campaign=createDefaultCampaign();campaign.aiSettings.enabled=true;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({text:'你可以先问清合同。',checkHint:'考虑交谈或说服',checkRequest:{reason:'请选择路线',skillId:'invented-skill'},choices:[{label:'跳到结局',intent:'跳过调查',kind:'scene',targetSceneId:'missing'},{label:'错误类型',intent:'行动',kind:'win'},{label:'询问',intent:'询问合同',kind:'talk'}]})}}]})}));
    const result=await generateGmResponse(campaign,'开始');
    expect(result.checkRequest).toBeUndefined();
    expect(result.text).toContain('可选');
    expect(result.choices?.map(choice=>choice.kind)).toEqual(['talk']);
  });
  it('sends retrieved pages and recent turns, but not credentials in messages', async () => {
    const campaign = createDefaultCampaign();
    campaign.aiSettings = { enabled: true, apiKey: 'test-secret', apiBase: '/api/ai', model: 'test' };
    campaign.runner.moduleId = 'streets-3';
    campaign.runner.sceneId = 'streets-3-intro';
    campaign.character.backgroundDetails = { motivation: '寻找失散的姐姐', enemies: '欠债的旧雇主' };
    campaign.character.lifepathNotes = '不接受伤害平民的委托';
    campaign.playerNotes='售票员提到后台门禁，尚未取得通行许可。';
    campaign.settings.pace = 'slow';
    campaign.runner.turns = [{ id: 't1', speaker: '玩家', type: 'player', body: '我已经拿到门票', createdAt: '' }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ sourceId: 'red-streets-20261010', title: '街头故事', page: 40, text: '测试用本机资料' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ text: '主持回复', choices: [{ label: '观察', intent: '观察入口', kind: 'investigate' }] }) } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateGmResponse(campaign, '开始');
    expect(result.ok).toBe(true);
    expect(result.sourceRefs?.[0].page).toBe(40);
    const request = JSON.parse(fetchMock.mock.calls[1][1].body);
    const context=request.messages.find((m:{role:string})=>m.role==='user').content;
    expect(context).toContain('我已经拿到门票');
    expect(context).toContain('测试用本机资料');
    expect(context).not.toContain('test-secret');
    expect(context).toContain('寻找失散的姐姐');
    expect(context).toContain('不接受伤害平民的委托');
    expect(context).toContain('售票员提到后台门禁，尚未取得通行许可。');
    expect(context).toContain('战斗意识');
    expect(context).toContain('worldSituation');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/ai/chat/completions');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
    expect(context).toContain('放慢场景推进');
    expect(fetchMock.mock.calls[0][0]).toContain('start=38');
    expect(fetchMock.mock.calls[0][0]).toContain('rolePage=146');
  });

  it('returns a recoverable failure when retrieval or the network fails', async () => {
    const campaign = createDefaultCampaign();
    campaign.aiSettings.enabled = true;
    campaign.aiSettings.apiKey = 'test';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    const result = await generateGmResponse(campaign, '开始');
    expect(result.ok).toBe(false);
    expect(result.text).toContain('network unavailable');
  });
  it('keeps a skill request but never treats a generic core-book example as this action target',async()=>{
    const campaign=createDefaultCampaign();campaign.aiSettings.enabled=true;
    for(const [dv,expected] of [[13,undefined],[17,undefined]] as const) {
      vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[{sourceId:'red-core-20261010',title:'规则',page:128,text:'示例条件：进行 DV13 的说服检定。'}]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({text:'售票员没有立即让路。',checkRequest:{skillId:'persuasion',reason:'说服售票员',dv,sourcePage:128}})}}]})}));
      const result=await generateGmResponse(campaign,'和售票员交谈');
      expect(result.checkRequest?.skillId).toBe('persuasion');
      expect(result.checkRequest?.dv).toBe(expected);
      if(expected===undefined) expect(result.checkRequest?.reason).toContain('DV依据未核实');
    }
  });
  it('keeps backstage biography sources out of player-facing references while preserving GM context',async()=>{
    const campaign=createDefaultCampaign();campaign.aiSettings.enabled=true;
    const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[{sourceId:'red-streets-20261010',title:'人物传记',page:189,text:'测试用幕后信息',kind:'npc',gmOnly:true}]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:'{"text":"对方等你解释来意。"}'}}]})});
    vi.stubGlobal('fetch',fetchMock);
    const result=await generateGmResponse(campaign,'询问露西');
    const request=JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(request.messages.find((m:{role:string})=>m.role==='user').content).toContain('测试用幕后信息');
    expect(result.sourceRefs?.some(ref=>ref.page===189)).toBe(false);
  });
});

it('streams provisional narration and keeps final choices and recap structured', async()=>{
  const campaign=createDefaultCampaign();campaign.aiSettings.enabled=true;
  const text=JSON.stringify({text:'雨后的霓虹街道',choices:[{label:'询问线人',intent:'打听消息',kind:'talk'}],logSummary:'已与线人碰面，尚未成交'});
  const chunks=[text.slice(0,20),text.slice(20)];
  const stream=new ReadableStream({start(controller){for(const part of chunks)controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({choices:[{delta:{content:part}}]})}\n\n`));controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));controller.close();}});
  const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,headers:new Headers({'content-type':'text/event-stream'}),body:stream});
  vi.stubGlobal('fetch',fetchMock);
  const progress=vi.fn();
  const reply=await generateGmResponse(campaign,'探查街道',undefined,progress);
  expect(reply.ok).toBe(true);
  expect(reply.text).toBe('雨后的霓虹街道');
  expect(reply.choices?.[0].label).toBe('询问线人');
  expect(reply.logSummary).toContain('尚未成交');
  expect(progress).toHaveBeenCalledWith('雨后的霓虹街道');
  const request=JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(request.stream).toBe(true);
  expect(request.max_tokens).toBe(1800);
});

describe('API connection probe', () => {
  const settings = { enabled: false, apiKey: 'secret', apiBase: '/api/ai', model: 'example' };
  const health = () => ({ ok: true, headers: { get: () => 'application/json; charset=utf-8' }, json: async () => ({ service: 'glm-local-proxy', configured: true, model: 'glm-4.7-flash' }) });
  it('checks the proxy, then tests upstream without sending campaign data or credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(health()).mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'OK' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await testAiConnection(settings);
    expect(result.ok).toBe(true);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/status');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/ai/chat/completions');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages).toHaveLength(1);
    expect(result.message).not.toContain('secret');
  });
  it('identifies an old Vite config that returns a 404 or HTML instead of proxy status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => 'text/html' } });
    vi.stubGlobal('fetch', fetchMock);
    const result = await testAiConnection(settings);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('代理未启动');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('distinguishes an unconfigured proxy without sending a paid AI request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ service: 'glm-local-proxy', configured: false }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await testAiConnection(settings);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ZHIPU_API_KEY');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not treat HTTP200 without a message as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(health()).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }));
    expect((await testAiConnection(settings)).ok).toBe(false);
  });
  it('shows upstream authorization failures after proxy health succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(health()).mockResolvedValueOnce({ ok: false, status: 401 }));
    const result = await testAiConnection(settings);
    expect(result.message).toContain('401');
    expect(result.message).not.toContain('secret');
  });
  it('shows model-busy business codes instead of misreporting them as invalid credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(health()).mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: { code: '1305', message: '该模型当前访问量过大，请稍后再试' } }) }));
    const result = await testAiConnection(settings);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('1305');
    expect(result.message).toContain('访问量过大');
    expect(result.message).not.toContain('密钥无效');
    expect(result.retryAt).toBeGreaterThanOrEqual(Date.now()+29000);
  });
  it('does not send a request if the model is absent', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect((await testAiConnection({ ...settings, model: '' })).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
