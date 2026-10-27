import type { Campaign, RunnerTurn } from '../domain/types';

export function narrativeForTurn(turn: RunnerTurn, overrides: Record<string,string> = {}): string {
  if (turn.type === 'gm') return overrides[turn.id] ?? turn.body;
  if (turn.type === 'player') return `【玩家行动】${turn.body}`;
  return '';
}

/** Markdown manuscript is derived from persisted runner turns; never invents off-screen outcomes. */
export function buildManuscript(campaign: Campaign): string {
  const lines = [`# ${campaign.name}`, `主角：${campaign.character.handle} · 时间：2045`, ''];
  let chapter = '';
  for (const turn of campaign.runner.turns) {
    const prose = narrativeForTurn(turn, campaign.storyEdits);
    if (!prose.trim()) continue;
    const title = turn.sceneTitle || campaign.currentScene.title;
    if (title !== chapter) {
      chapter = title;
      lines.push(`## ${title}`, '');
    }
    lines.push(prose, '');
  }
  return lines.join('\n').trim() + '\n';
}
