import { beforeEach,expect,it,vi } from 'vitest';
import { fireEvent,render,screen } from '@testing-library/react';
import { createBlankCharacter } from '../rulesets/cyberpunk-red';
import { CharacterProfilesPanel } from './CharacterProfilesPanel';
import { listCharacterProfiles } from '../lib/characterProfiles';

beforeEach(()=>window.localStorage.clear());
it('saves, loads and confirms replacement of a character profile',()=>{
  const character={...createBlankCharacter(),handle:'夜莺'};const load=vi.fn();
  render(<CharacterProfilesPanel character={character} onLoad={load}/>);
  fireEvent.click(screen.getByRole('button',{name:'保存到人物档案 1'}));
  expect(listCharacterProfiles()[0]?.character.handle).toBe('夜莺');
  fireEvent.click(screen.getByRole('button',{name:'载入人物档案 1'}));
  expect(load).toHaveBeenCalledWith(expect.objectContaining({handle:'夜莺'}));
  fireEvent.click(screen.getByRole('button',{name:'保存到人物档案 1'}));
  expect(screen.getByRole('button',{name:'确认替换'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'取消'}));
  expect(screen.queryByRole('button',{name:'确认替换'})).not.toBeInTheDocument();
});
it('uses three compact selectors and only one save action for the selected slot',()=>{
  render(<CharacterProfilesPanel character={createBlankCharacter()} onLoad={vi.fn()}/>);
  expect(screen.getAllByRole('button',{name:/选择人物档案/})).toHaveLength(3);
  expect(screen.getAllByRole('button',{name:/保存到人物档案/})).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'选择人物档案 2'}));
  expect(screen.getByRole('button',{name:'选择人物档案 2'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:'保存到人物档案 2'}));
  expect(listCharacterProfiles()[0]).toBeNull();
  expect(listCharacterProfiles()[1]).not.toBeNull();
});
