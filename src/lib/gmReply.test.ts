import { expect,it } from 'vitest';
import { gmNarration,parseGmEnvelope } from './gmReply';

it('extracts structured replies surrounded by prose, markdown and braces inside strings',()=>{
  const envelope={text:'他指着 {27} 号门：“先问清条件。”',choices:[{label:'询问',intent:'询问条件',kind:'talk'}]};
  const raw=`**你可以行动**\n\n\`\`\`json\n${JSON.stringify(envelope)}\n\`\`\`\n其他提示`;
  expect(parseGmEnvelope(raw)).toEqual(envelope);
  expect(gmNarration(raw)).toBe(envelope.text);
  expect(gmNarration(raw)).not.toContain('choices');
});
it('hides protocol fragments in historical replies without changing the source string',()=>{
  const raw='**现场描述**\n```json\n{"text":"broken';
  expect(()=>parseGmEnvelope(raw)).toThrow();
  expect(gmNarration(raw)).toBe('现场描述');
  expect(raw).toContain('```json');
  expect(gmNarration('普通的中文回复')).toBe('普通的中文回复');
});
