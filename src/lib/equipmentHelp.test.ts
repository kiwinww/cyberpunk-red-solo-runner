import { expect,it } from 'vitest';
import { equipmentHelp } from './equipmentHelp';

it('explains prerequisites and does not invent zero humanity loss for an unmapped value',()=>{
  const text=equipmentHelp({id:'test-cyber',name:'测试组件',category:'cyberware',price:100,page:112,description:'测试说明',requiredBase:'neural-link',base:true});
  expect(text).toContain('安装前置：神经链接');
  expect(text).toContain('建卡人性损失 待确认');
  expect(text).toContain('损失方式需核对原文');
  expect(text).not.toMatch(/undefined|NaN/);
});
