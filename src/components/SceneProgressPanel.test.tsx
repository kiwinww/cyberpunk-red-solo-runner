import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createDefaultCampaign } from '../lib/state';
import { findModule, recordSceneResolution, startRunnerCampaign } from '../lib/runner';
import { SceneProgressPanel } from './SceneProgressPanel';

it('does not announce a saved result while the host response is pending',()=>{
  const base=createDefaultCampaign();
  const campaign=startRunnerCampaign(base,base.settings);
  campaign.runner.turns.push({id:'waiting',type:'system',speaker:'AI',body:'等待',createdAt:'',pending:true});
  const onCampaign=vi.fn();
  render(<SceneProgressPanel campaign={campaign} onCampaign={onCampaign}/>);
  fireEvent.change(screen.getByLabelText('本场景已确认的线索或后果'),{target:{value:'尚待主持确认'}});
  expect(screen.getByRole('button',{name:'记录场景结果'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'记录场景结果'}));
  expect(onCampaign).not.toHaveBeenCalled();
  expect(screen.queryByText(/已保存结果/)).not.toBeInTheDocument();
});
it('records a confirmed draft and moves in one action without changing character resources',()=>{
  const base=createDefaultCampaign();const campaign=startRunnerCampaign(base,base.settings);
  const module=findModule(campaign.runner.moduleId);
  const next=module.scenes.find(scene=>scene.id===campaign.runner.sceneId)!.nextSceneIds![0];
  const onCampaign=vi.fn();render(<SceneProgressPanel campaign={campaign} onCampaign={onCampaign}/>);
  fireEvent.change(screen.getByLabelText('本场景已确认的线索或后果'),{target:{value:'已询问条件；尚未收款。'}});
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getAllByRole('button',{name:/记录并前往/})[0]);
  const moved=onCampaign.mock.calls[0][0];
  expect(moved.runner.sceneId).toBe(next);
  expect(moved.runner.resolutions[0].summary).toContain('尚未收款');
  expect(moved.character).toEqual(campaign.character);
});
it('rejects an unsupported successful outcome before saving or moving',()=>{
  const base=createDefaultCampaign();const campaign=startRunnerCampaign(base,base.settings);
  const onCampaign=vi.fn();render(<SceneProgressPanel campaign={campaign} onCampaign={onCampaign}/>);
  fireEvent.change(screen.getByLabelText('本场景已确认的线索或后果'),{target:{value:'尝试调查'}});
  fireEvent.change(screen.getByLabelText('场景结果类型'),{target:{value:'success'}});
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getAllByRole('button',{name:/记录并前往/})[0]);
  expect(onCampaign).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('尚未记录或切换场景');
});
it('remembers confirmed progress once without overwriting existing memory',()=>{
  const base=createDefaultCampaign();base.playerNotes='保留的旧事实';
  const campaign=recordSceneResolution(startRunnerCampaign(base,base.settings),'门票尚未购买','no-check');
  const onCampaign=vi.fn();const ui=render(<SceneProgressPanel campaign={campaign} onCampaign={onCampaign}/>);
  fireEvent.click(screen.getByRole('button',{name:'加入主持长期记忆'}));
  const remembered=onCampaign.mock.calls[0][0];
  expect(remembered.playerNotes).toContain('保留的旧事实');
  expect(remembered.playerNotes).toContain('门票尚未购买');
  ui.rerender(<SceneProgressPanel campaign={remembered} onCampaign={onCampaign}/>);
  fireEvent.click(screen.getByRole('button',{name:'加入主持长期记忆'}));
  expect(onCampaign).toHaveBeenCalledTimes(1);
});
