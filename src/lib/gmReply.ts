/** Extract an actual JSON object, allowing a provider's prose or code fence around it. */
export function parseGmEnvelope(raw:string):Record<string,unknown> {
  try {
    const value=JSON.parse(raw.trim());
    if(value && typeof value==='object' && !Array.isArray(value)) return value;
  } catch { /* Try a wrapped object without evaluating any generated code. */ }
  for(let start=0;start<raw.length;start++){
    if(raw[start]!=='{') continue;
    let depth=0,quoted=false,escaped=false;
    for(let end=start;end<raw.length;end++){
      const char=raw[end];
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
      if(char==='"')quoted=true;
      else if(char==='{')depth++;
      else if(char==='}' && --depth===0){
        try {const value=JSON.parse(raw.slice(start,end+1));if(typeof value.text==='string' && value.text.trim())return value;}catch{/* Not a complete GM envelope. */}
        break;
      }
    }
  }
  throw new Error('Invalid GM envelope');
}

export function gmNarration(raw:string):string {
  let text=raw;
  for(let i=0;i<2;i++){
    try {const value=parseGmEnvelope(text);if(typeof value.text!=='string')break;text=value.text;}catch{break;}
  }
  // Hide incomplete protocol fragments in old transcripts without modifying the saved original.
  text=text.replace(/```(?:json)?[\s\S]*$/i,'').replace(/\{\s*"text"\s*:[\s\S]*$/,'');
  return text.replace(/\*\*([^*\n]+)\*\*/g,'$1').replace(/^#{1,6}\s+/gm,'').replace(/`([^`\n]+)`/g,'$1').trim() || '这条旧回复格式异常；原始记录仍保留在存档中。';
}
