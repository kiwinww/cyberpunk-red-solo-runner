import { afterEach, expect, it, vi } from 'vitest';
import { aiRequest, rememberSessionAiKey, qwenFastOptions } from './aiEndpoint';
import { testAiConnection, generateGmResponse } from './ai';
import { createDefaultCampaign } from './state';
import { exportCampaign, importCampaign } from './storage';

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const settings={enabled:true,apiBase:'https://example.test/v1/',model:'custom-model',apiKey:'fake-key'};
it('normalizes a base or full completion URL without doubling the path',()=>{
  expect(aiRequest(settings).url).toBe('https://example.test/v1/chat/completions');
  expect(aiRequest({...settings,apiBase:'https://example.test/v1/chat/completions'}).url).toBe('https://example.test/v1/chat/completions');
  expect(()=>aiRequest({...settings,apiBase:'javascript:alert(1)'})).toThrow();
  expect(()=>aiRequest({...settings,apiKey:''})).toThrow('API Key');
});
it('preserves custom URL and model on save while keeping secrets outside backups',()=>{
  const campaign=createDefaultCampaign();campaign.aiSettings=settings;
  rememberSessionAiKey(settings.apiBase,settings.apiKey);
  const raw=exportCampaign(campaign);
  expect(raw).not.toContain('fake-key');
  const restored=importCampaign(raw);
  expect(restored.aiSettings.model).toBe(settings.model);
  expect(restored.aiSettings.apiBase).toBe(settings.apiBase);
  expect(aiRequest(restored.aiSettings).headers.Authorization).toBe('Bearer fake-key');
});
it('tests the configured provider directly without calling or requiring the local GLM proxy',async()=>{
  const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>({choices:[{message:{content:'OK'}}]})});
  vi.stubGlobal('fetch',mock);
  expect((await testAiConnection(settings)).ok).toBe(true);
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock.mock.calls[0][0]).toBe('https://example.test/v1/chat/completions');
  expect(mock.mock.calls[0][1].headers.Authorization).toBe('Bearer fake-key');
  expect(JSON.parse(mock.mock.calls[0][1].body).model).toBe('custom-model');
});
it('routes GM requests through the same custom configuration without putting the key in the prompt',async()=>{
  const campaign=createDefaultCampaign();campaign.aiSettings=settings;
  const mock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[]}).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:'主持回复'}}]})});
  vi.stubGlobal('fetch',mock);
  expect((await generateGmResponse(campaign,'观察入口')).ok).toBe(true);
  expect(mock.mock.calls[1][0]).toBe('https://example.test/v1/chat/completions');
  expect(mock.mock.calls[1][1].headers.Authorization).toBe('Bearer fake-key');
  expect(mock.mock.calls[1][1].body).not.toContain('fake-key');
});

it('only disables thinking on supported Qwen families, unless the user opts out',()=>{
  expect(qwenFastOptions({...settings,model:'qwen3.8-flash'})).toEqual({enable_thinking:false});
  expect(qwenFastOptions({...settings,model:'qwen3.8-flash',fastMode:false})).toEqual({});
  expect(qwenFastOptions({...settings,model:'some-other-provider'})).toEqual({});
});
