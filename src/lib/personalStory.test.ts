import { expect,it } from 'vitest';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { personalStoryReminder } from './personalStory';

it('uses relevant saved relationships without granting aid or changing mechanics',()=>{
  const c={...createBlankCharacter(),backgroundDetails:{friends:'米娅：旧同事',enemies:'灰狐：旧债',appearance:'银色夹克',motivation:'寻找姐姐'}};
  const before=JSON.stringify(c);
  expect(personalStoryReminder(c,'联系朋友帮忙')).toContain('米娅');
  expect(personalStoryReminder(c,'联系朋友帮忙')).not.toContain('灰狐');
  expect(personalStoryReminder(c,'威胁敌人')).toContain('灰狐');
  expect(personalStoryReminder(c,'整理衣着')).toContain('银色夹克');
  expect(personalStoryReminder(c,'联系售票员')).toContain('寻找姐姐');
  expect(personalStoryReminder(c,'联系朋友帮忙')).toContain('不表示相关人物已到场');
  expect(JSON.stringify(c)).toBe(before);
  expect(personalStoryReminder(createBlankCharacter(),'调查')).toBe('');
});
