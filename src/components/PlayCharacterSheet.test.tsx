import { fireEvent,render,screen } from '@testing-library/react';
import { expect,it } from 'vitest';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { PlayCharacterSheet } from './PlayCharacterSheet';

it('shows read-only values and reflects resolved state updates without editing the character',()=>{
  const character=createBlankCharacter();
  const before=JSON.stringify(character);
  const {rerender}=render(<PlayCharacterSheet character={character}/>);
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'保存角色'})).not.toBeInTheDocument();
  const next={...character,eurobucks:321,hp:{...character.hp,current:12}};
  rerender(<PlayCharacterSheet character={next}/>);
  expect(screen.getByRole('button',{name:'欧币说明'})).toHaveTextContent('321 eb');
  expect(screen.getByRole('button',{name:'生命值说明'})).toHaveTextContent(`12/${character.hp.max}`);
  expect(JSON.stringify(character)).toBe(before);
});

it('searches skills without changing ranks and distinguishes skill rank from base',()=>{
  const character=createBlankCharacter();const before=JSON.stringify(character);
  render(<PlayCharacterSheet character={character}/>);
  fireEvent.change(screen.getByRole('searchbox',{name:'搜索角色技能'}),{target:{value:'觉察'}});
  expect(screen.getByRole('region',{name:'角色技能'})).toHaveTextContent('等级');
  expect(screen.getByRole('region',{name:'角色技能'})).toHaveTextContent('基础');
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'不存在的技能'}});
  expect(screen.getByText('没有匹配的技能。')).toBeInTheDocument();
  expect(JSON.stringify(character)).toBe(before);
});

it('explains equipment and omits the redundant cyberware list without deleting legacy data',()=>{
  const character={...createBlankCharacter(),weapons:['重型手枪'],gear:['智能代理'],cyberware:['未知义体']};
  render(<PlayCharacterSheet character={character}/>);
  fireEvent.focus(screen.getByRole('button',{name:'重型手枪说明'}));
  expect(screen.getByRole('tooltip')).toHaveTextContent('3d6');
  fireEvent.blur(screen.getByRole('button',{name:'重型手枪说明'}));
  fireEvent.focus(screen.getByRole('button',{name:'智能代理说明'}));
  expect(screen.getByRole('tooltip')).toHaveTextContent('PDF');
  fireEvent.blur(screen.getByRole('button',{name:'智能代理说明'}));
  expect(screen.queryByText('所有义体（含旧存档手动登记）')).not.toBeInTheDocument();
  expect(character.cyberware).toEqual(['未知义体']);
});
