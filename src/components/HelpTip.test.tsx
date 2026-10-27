import { fireEvent,render,screen } from '@testing-library/react';
import { expect,it } from 'vitest';
import { HelpTip } from './HelpTip';

it('shows on hover/focus, supports touch-style clicks and closes with Escape',()=>{
  render(<HelpTip text="人性与共情的规则说明" label="人性说明">人性50</HelpTip>);
  const target=screen.getByRole('button',{name:'人性说明'});
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseEnter(target);expect(screen.getByRole('tooltip')).toBeVisible();
  fireEvent.mouseLeave(target);expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.click(target);expect(screen.getByRole('tooltip')).toBeVisible();
  fireEvent.keyDown(target,{key:'Escape'});expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.focus(target);expect(screen.getByRole('tooltip')).toBeVisible();
});
it('does not activate a surrounding form control when the explanation is tapped',()=>{
  render(<label><input type="checkbox"/>资金说明<HelpTip text="说明"/></label>);
  fireEvent.click(screen.getByRole('button',{name:'规则说明'}));
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});
