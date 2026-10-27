import { expect, it, vi } from 'vitest';
import { partialGmNarration, readChatCompletion } from './aiStream';

it('shows only narrative text while JSON fields and escaped characters are incomplete',()=>{
  expect(partialGmNarration('{"text":"雨夜\\n招牌闪烁","choices":[')).toBe('雨夜\n招牌闪烁');
  expect(partialGmNarration('{"choices":[]')).toBe('');
  expect(partialGmNarration('{"text":"尚未完成\\')).toBe('尚未完成');
});

it('reads chunked event streams and preserves the final structured JSON',async()=>{
  const full='{"text":"街头下雨了。","choices":[{"label":"问候","intent":"问好","kind":"talk"}]}';
  const units=[full.slice(0,14),full.slice(14,25),full.slice(25)];
  const payload=units.map(part=>`data: ${JSON.stringify({choices:[{delta:{content:part}}]})}\r\n\r\n`).join('')+'data: [DONE]\r\n\r\n';
  const bytes=new TextEncoder().encode(payload);
  const breaks=[7, 23, 47, 59,bytes.length];
  let previous=0;
  const response=new Response(new ReadableStream({start(controller){for(const end of breaks){controller.enqueue(bytes.slice(previous,end));previous=end;}controller.close();}}),{headers:{'content-type':'text/event-stream'}});
  const update=vi.fn();
  const actual=await readChatCompletion(response,update);
  expect(actual).toBe(full);
  expect(update).toHaveBeenCalledWith('街头下雨了。');
});

it('supports JSON-only providers even when a stream is requested',async()=>{
  const response=new Response(JSON.stringify({choices:[{message:{content:'{"text":"正常回复"}'}}]}),{headers:{'content-type':'application/json'}});
  expect(await readChatCompletion(response)).toContain('正常回复');
});
it.each(['length','content_filter'])('rejects %s even when DONE follows or JSON content looks valid',async reason=>{
  const events=[{choices:[{delta:{content:'{"text":"unfinished"}'}}]},{choices:[{delta:{},finish_reason:reason}]}];
  const payload=events.map(item=>`data: ${JSON.stringify(item)}\n\n`).join('')+'data: [DONE]\n\n';
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(payload));c.close();}}),{headers:{'content-type':'text/event-stream'}});
  await expect(readChatCompletion(response)).rejects.toThrow(/重试/);
});
it('rejects truncated JSON-only completions and streams without a finish marker',async()=>{
  const response=new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"text":"partial'}}]}),{headers:{'content-type':'application/json'}});
  await expect(readChatCompletion(response)).rejects.toThrow(/长度限制/);
  const payload=`data: ${JSON.stringify({choices:[{delta:{content:'{"text":"partial'}}]})}\n\n`;
  await expect(readChatCompletion(new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(payload));c.close();}}),{headers:{'content-type':'text/event-stream'}}))).rejects.toThrow(/中途断开/);
});
