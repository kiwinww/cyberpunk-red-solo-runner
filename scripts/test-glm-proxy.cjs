// Independently verify GLM proxy middleware without platform-specific Vite/Rollup binaries.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const http = require('node:http');
(async () => {
  const source = readFileSync(resolve('server/glm-proxy.mjs'), 'utf8').replace("import { loadEnv } from 'vite';", 'const loadEnv = () => ({});');
  assert(!source.includes("import { loadEnv } from 'vite'"));
  const { glmProxyPlugin } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const nativeFetch = global.fetch;
  let fetchCount = 0;
  global.fetch = async (input, options) => {
    if (String(input).startsWith('https://open.bigmodel.cn/')) {
      fetchCount++;
      assert.equal(options.method, 'POST');
      const headers = options.headers;
      assert.equal(headers.Authorization, 'Bearer local-fake-test-key');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'glm-4.7-flash');
      return { status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'OK' } }] }) };
    }
    return nativeFetch(input, options);
  };
  const run = async (apiKey) => {
    if (apiKey === undefined) delete process.env.ZHIPU_API_KEY;
    else process.env.ZHIPU_API_KEY = apiKey;
    const plugin = glmProxyPlugin();
    plugin.configResolved({ mode: 'development', root: process.cwd(), logger: { warn() {} } });
    let handler;
    plugin.configureServer({middlewares:{use(fn){handler=fn}}});
    const server = http.createServer((req,res) => handler(req,res,() => {res.statusCode=404;res.end('Vite fallback')}));
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const get=path=>nativeFetch(base+path);
    const post=path=>nativeFetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
    const status = await get('/api/ai/status');
    assert.equal(status.status, 200);
    const payload = await status.json();
    assert.equal(payload.service,'glm-local-proxy');
    assert.equal(payload.configured,apiKey !== undefined && apiKey !== 'replace-with-your-new-key');
    assert.equal(payload.model,'glm-4.7-flash');
    assert(!JSON.stringify(payload).includes('local-fake-test-key'));
    const result = await post('/api/ai/chat/completions');
    if (payload.configured) {
      assert.equal(result.status,200);
      assert.deepEqual(await result.json(), {choices:[{message:{content:'OK'}}]});
    } else {
      assert.equal(result.status,503);
      assert.match((await result.json()).error.message,/密钥|ZHIPU_API_KEY/);
    }
    assert.equal((await get('/api/ai/unknown')).status,404);
    await new Promise(resolve=>server.close(resolve));
  };
  try {
    await run(undefined);
    await run('replace-with-your-new-key');
    await run('local-fake-test-key');
    assert.equal(fetchCount,1,'upstream called only after successful local configuration');
    console.log('PASS: proxy route /api/ai/status, missing/placeholder key, chat forwarding, unknown routes');
  } finally {
    global.fetch=nativeFetch;
    delete process.env.ZHIPU_API_KEY;
  }
})().catch(err=>{console.error(err);process.exit(1)});
