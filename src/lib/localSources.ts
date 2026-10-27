import adventures from '../data/streetAdventures.json';

export interface LocalPassage {
  sourceId: string;
  title: string;
  page: number;
  text: string;
  kind?:string;
  gmOnly?:boolean;
}

export async function retrieveLocalSources(query: string, moduleId: string, rolePage?: number, roleAbility?: string, signal?:AbortSignal, sceneId?:string): Promise<LocalPassage[]> {
  const aliases: Record<string, string> = { 'opera-night-preview': 'streets-1', 'desire-agent-preview': 'streets-2' };
  const adventure = adventures.find(item => item.id === (aliases[moduleId] ?? moduleId));
  const params = new URLSearchParams({ q: query, module: moduleId });
  if (sceneId) params.set('scene', sceneId);
  if (rolePage) params.set('rolePage', String(rolePage));
  if (roleAbility) params.set('roleAbility', roleAbility);
  if (adventure) {
    params.set('start', String(adventure.start));
    params.set('end', String(adventure.end));
    params.set('intro', String(adventure.intro));
  }
  const response = await fetch(`/api/local-sources/search?${params}`, { signal: signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('本机 PDF 索引不可用，请运行 npm run sources:index');
  return response.json();
}
