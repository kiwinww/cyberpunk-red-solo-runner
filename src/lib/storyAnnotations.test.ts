import { expect,it } from 'vitest';
import { createDefaultCampaign } from './state';
import { storyMentions } from './storyAnnotations';

it('scopes public character and location notes to the selected adventure',()=>{
  const campaign=createDefaultCampaign();campaign.runner.moduleId='streets-2';
  const mentions=storyMentions('罗格在孤望酒吧等候，维克多未到。',campaign);
  expect(mentions.some(item=>item.label==='罗格')).toBe(true);
  expect(mentions.some(item=>item.label==='孤望酒吧')).toBe(true);
  expect(mentions.some(item=>item.label==='维克多')).toBe(false);
  expect(mentions.every(item=>item.help.includes('PDF 22 页'))).toBe(true);
  campaign.runner.moduleId='streets-3';
  expect(storyMentions('罗格',campaign)).toEqual([]);
});
