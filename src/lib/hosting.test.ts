import { expect,it } from 'vitest';
import { actionLabel } from './hosting';

it('labels suggestions and scene tools without claiming a roll or outcome is guaranteed',()=>{
  const base={id:'choice',label:'行动',intent:'观察'};
  expect(actionLabel({...base,kind:'check'})).toContain('先确认条件');
  expect(actionLabel({...base,kind:'scene'})).toContain('确认条件后');
  expect(actionLabel({...base,kind:'talk'})).toContain('确认风险');
  expect(actionLabel({...base,kind:'fight'})).toContain('先确认判定');
});
