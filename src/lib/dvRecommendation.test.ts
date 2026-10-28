import { expect,it } from 'vitest';
import { recommendSkillDv } from './dvRecommendation';

it('provides a clearly marked ordinary-task estimate, independent of character skill or campaign difficulty',()=>{
  expect(recommendSkillDv('perception','观察房间')).toMatchObject({dv:13,label:'日常'});
  expect(recommendSkillDv('cybertech','检查芯片','difficult')?.dv).toBe(15);
  expect(recommendSkillDv('persuasion','交涉条件','professional')?.dv).toBe(17);
  expect(recommendSkillDv('perception','观察房间')?.explanation).toContain('不是模组固定值');
});
it.each(['handgun','autofire','brawling','melee-weapon','evasion','first-aid','unknown'])('does not substitute generic difficulty for %s',skill=>{
  expect(recommendSkillDv(skill,'执行行动')).toBeUndefined();
});
it.each(['侦察伏击者','进行对抗检定','投掷手雷','探索黑冰节点'])('does not suggest ordinary difficulty for %s',reason=>{
  expect(recommendSkillDv('perception',reason)).toBeUndefined();
});
