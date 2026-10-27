import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { glmProxyPlugin } from './glm-proxy.mjs';

vi.mock('vite', () => ({ loadEnv: () => ({ ZHIPU_API_KEY: 'proxy-test-secret', ZHIPU_MODEL: 'glm-4.7-flash' }) }));
afterEach(() => vi.unstubAllGlobals());

async function invoke(payload, onResponse) {
  const plugin = glmProxyPlugin();
  plugin.configResolved({ mode: 'test', root: '.', logger: { warn: vi.fn() } });
  let middleware;
  expect(plugin.configureServer({ middlewares: { use(fn) { middleware = fn; } } })).toBeUndefined();
  const req = Readable.from([JSON.stringify(payload)]);
  req.url = '/api/ai/chat/completions'; req.method = 'POST';
  let body;
  const res = Object.assign(new EventEmitter(),{ statusCode: 200, writableEnded:false, setHeader() {}, end(text) { this.writableEnded=true;body = JSON.parse(text); } });
  onResponse?.(res);
  await middleware(req, res, vi.fn());
  return { status: res.statusCode, body, middleware };
}

describe('GLM request diagnostics', () => {
  it('honors upstream cooldown without making another upstream request',async()=>{
    const fetchMock=vi.fn().mockResolvedValue({ok:false,status:429,headers:{get:()=> '60'},text:async()=>JSON.stringify({error:{code:'1302',message:'账户速率限制'}})});
    vi.stubGlobal('fetch',fetchMock);
    const first=await invoke({messages:[{role:'user',content:'开场'}]});
    let body;const headers={};
    const req=Readable.from([JSON.stringify({messages:[{role:'user',content:'重试'}]})]);req.url='/api/ai/chat/completions';req.method='POST';
    const res={setHeader(key,value){headers[key]=value;},end(text){body=JSON.parse(text);}};
    await first.middleware(req,res,vi.fn());
    expect(body.error.code).toBe('local-cooldown');
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('uses a small non-thinking probe without allowing browser model overrides', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'OK' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke({ purpose: 'connection-test', model: 'untrusted-model', messages: [{ role: 'user', content: 'OK' }] })).status).toBe(200);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('glm-4.7-flash');
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.max_tokens).toBe(64);
    expect(body.stream).toBe(false);
  });
  it('preserves upstream busy codes while redacting secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => JSON.stringify({ error: { code: '1305', message: '模型繁忙 proxy-test-secret' } }) }));
    const result = await invoke({ messages: [{ role: 'user', content: 'OK' }] });
    expect(result.status).toBe(429);
    expect(result.body.error.code).toBe('1305');
    expect(JSON.stringify(result.body)).not.toContain('proxy-test-secret');
  });
  it('distinguishes timeout from authentication and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')));
    const result = await invoke({ messages: [{ role: 'user', content: 'OK' }] });
    expect(result.status).toBe(504);
    expect(result.body.error.message).toContain('超时');
  });
  it('aborts upstream work when the browser closes its connection',async()=>{
    let response;
    const fetchMock=vi.fn().mockImplementation((_url,{signal})=>new Promise((_resolve,reject)=>{
      signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true});
      response.emit('close');
    }));
    vi.stubGlobal('fetch',fetchMock);
    const result=await invoke({messages:[{role:'user',content:'OK'}]},res=>{response=res;});
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(result.body).toBeUndefined();
  });
});
