/** Read OpenAI-compatible chat completion streams; JSON responses remain supported. */
export function partialGmNarration(raw: string): string {
  const start = /"text"\s*:\s*"/.exec(raw);
  if (!start) return '';
  const value = raw.slice(start.index + start[0].length);
  let escaped = false;
  let content = '';
  for (let i=0; i<value.length; i++) {
    const char=value[i];
    if (escaped) {
      const map: Record<string,string> = { n:'\n', r:'\r', t:'\t', '"':'"', '\\':'\\', '/':'/' };
      if (char === 'u') {
        const hex=value.slice(i+1,i+5);
        if (!/^[a-f0-9]{4}$/i.test(hex)) break;
        content += String.fromCharCode(parseInt(hex,16));
        i += 4;
      } else content += map[char] ?? char;
      escaped = false;
    } else if (char === '\\') escaped = true;
    else if (char === '"') break;
    else content += char;
  }
  return content;
}

export async function readChatCompletion(
  response: Response,
  onProgress?: (narration:string)=>void,
): Promise<string> {
  const checkFinish=(reason:unknown)=>{
    if(reason && reason!=='stop') throw new Error(reason==='length'?'AI 回复超过长度限制，未完成本次行动，请重试回应。':'AI 回复未正常完成，行动已保留，请重试回应。');
  };
  if (!response.body || !response.headers?.get('content-type')?.includes('text/event-stream')) {
    const data = await response.json() as { choices?:Array<{message?:{content?:string};finish_reason?:string}> };
    checkFinish(data.choices?.[0]?.finish_reason);
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let raw = '';
  let lastUpdate = 0;
  let finished = false;
  function processEvent(event:string) {
    const data = event.split('\n').filter(line => line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if (!data) return;
    if (data === '[DONE]') {finished=true;return;}
    let chunk: { choices?:Array<{delta?:{content?:string};finish_reason?:string|null}> };
    try { chunk = JSON.parse(data); } catch { return; }
    checkFinish(chunk.choices?.[0]?.finish_reason);
    if (chunk.choices?.[0]?.finish_reason==='stop') finished=true;
    const text = chunk.choices?.[0]?.delta?.content;
    if (typeof text !== 'string' || !text) return;
    raw += text;
    const now = Date.now();
    if (onProgress && now-lastUpdate>=85) {onProgress(partialGmNarration(raw)); lastUpdate=now;}
  }
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');
      let split;
      while ((split=buffer.indexOf('\n\n'))!==-1) {
        processEvent(buffer.slice(0,split));
        buffer=buffer.slice(split+2);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) processEvent(buffer);
    if (!finished) throw new Error('AI 流式响应中途断开，请重试本次行动。');
    if (onProgress) onProgress(partialGmNarration(raw));
    return raw.trim();
  } finally { reader.releaseLock(); }
}
