import { describe, expect, it } from 'vitest';
import { createDefaultCampaign } from './state';
import { buildManuscript } from './manuscript';

describe('manuscript export', () => {
  it('groups scenes and preserves authored edits without changing the log', () => {
    const c = createDefaultCampaign();
    c.runner.turns = [
      { id:'a', type:'gm', body:'原始文字', createdAt:'', speaker:'GM', sceneTitle:'第一幕' },
      { id:'b', type:'player', body:'敲门', createdAt:'', speaker:'玩家', sceneTitle:'第一幕' },
      { id:'c', type:'gm', body:'第二幕登场', createdAt:'', speaker:'GM', sceneTitle:'第二幕' },
    ];
    c.storyEdits = { a:'修改后的第一幕' };
    const markdown = buildManuscript(c);
    expect(markdown).toContain('## 第一幕');
    expect(markdown).toContain('修改后的第一幕');
    expect(markdown).not.toContain('原始文字');
    expect(markdown).toContain('## 第二幕');
    expect(markdown).toContain('【玩家行动】敲门');
  });
});
