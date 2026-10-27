import { fireEvent,render,screen } from '@testing-library/react';
import { expect,it } from 'vitest';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { SkillAnnotatedText } from './SkillAnnotatedText';

it('renders one annotation for each adjacent synonymous skill label',()=>{
  render(<p><SkillAnnotatedText text="【赛博技术】（cybertech）或【洞察人心】（洞察人心）" character={createBlankCharacter()}/></p>);
  expect(screen.getAllByRole('button',{name:'赛博技术技能说明'})).toHaveLength(1);
  expect(screen.getAllByRole('button',{name:'洞察人心技能说明'})).toHaveLength(1);
  expect(screen.queryByText('cybertech')).not.toBeInTheDocument();
});

it('shows Chinese names with explanations and distinguishes AI-written grades from the character sheet',()=>{
  const character=createBlankCharacter();character.skills=character.skills.map(s=>s.skillId==='perception'?{...s,level:2}:s);
  render(<p><SkillAnnotatedText text="建议 Perception（等级9）检定。" character={character}/></p>);
  fireEvent.mouseEnter(screen.getByRole('button',{name:'觉察技能说明'}));
  expect(screen.getByRole('tooltip')).toHaveTextContent('人物卡技能等级：2');
  expect(screen.getByRole('tooltip')).toHaveTextContent('主持文字提到等级9');
  expect(screen.getByRole('tooltip')).toHaveTextContent('关联属性：智力');
});
it('explains rule terms inside dialogue without nesting them in skill tooltips',()=>{
  render(<p><SkillAnnotatedText text="觉察检定 DV 13，人性与 HP 不会自动恢复。" character={createBlankCharacter()}/></p>);
  fireEvent.focus(screen.getByRole('button',{name:'DV规则说明'}));
  expect(screen.getByRole('tooltip')).toHaveTextContent('严格超过DV');
  fireEvent.blur(screen.getByRole('button',{name:'DV规则说明'}));
  fireEvent.click(screen.getByRole('button',{name:'人性规则说明'}));
  expect(screen.getByRole('tooltip')).toHaveTextContent('基础共情');
  expect(screen.getAllByRole('button',{name:'觉察技能说明'})).toHaveLength(1);
});
