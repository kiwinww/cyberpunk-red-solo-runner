const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const ts = require('typescript');
(async () => {
  const source = readFileSync('src/lib/ai.ts','utf8');
  const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
  const start = compiled.indexOf('export async function testAiConnection(');
  const end = compiled.indexOf('function summarizePacks(', start);
  assert(start >= 0 && end > start);
  const moduleSource = compiled.slice(start,end);
  const {testAiConnection} = await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
  const oldFetch=global.fetch;
  const settings={model:'glm-4.7-flash'};
  const health=(configured=true)=>({ok:true,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>({service:'glm-local-proxy',configured,model:'glm-4.7-flash'})});
  try {
    let calls=0;
    global.fetch=async()=>{calls++;return {ok:false,status:404,headers:{get:()=> 'text/html'}}};
    let answer=await testAiConnection(settings);
    assert.equal(answer.ok,false);assert.match(answer.message,/本地 AI 代理未启动/);assert.equal(calls,1);
    calls=0;
    global.fetch=async()=>{calls++;return health(false)};
    answer=await testAiConnection(settings);
    assert.equal(answer.ok,false);assert.match(answer.message,/ZHIPU_API_KEY/);assert.equal(calls,1);
    calls=0;
    global.fetch=async()=>{calls++;return calls===1?health():{ok:false,status:401}};
    answer=await testAiConnection(settings);
    assert.equal(answer.ok,false);assert.match(answer.message,/401/);assert.equal(calls,2);
    calls=0;
    global.fetch=async()=>{calls++;return calls===1?health():{ok:true,json:async()=>({choices:[{message:{content:'OK'}}]})}};
    answer=await testAiConnection(settings);
    assert.equal(answer.ok,true);assert.match(answer.message,/连接成功/);assert.equal(calls,2);
    console.log('PASS: UI connection diagnosis for local 404, missing key, upstream 401, success');
  }finally{global.fetch=oldFetch}
})().catch(error=>{console.error(error);process.exitCode=1});
