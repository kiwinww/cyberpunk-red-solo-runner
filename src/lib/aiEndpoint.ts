import type { AiSettings } from '../domain/types';

export const isLocalAi = (settings: AiSettings) => settings.apiBase.trim().replace(/\/$/, '') === '/api/ai';
const credentialKey = (base: string) => `red-ai-key:${base.trim().replace(/\/$/, '')}`;
export function sessionAiKey(base: string): string {
  try { return sessionStorage.getItem(credentialKey(base)) ?? ''; } catch { return ''; }
}
export function rememberSessionAiKey(base: string, key: string): void {
  try {
    if (key) sessionStorage.setItem(credentialKey(base), key);
    else sessionStorage.removeItem(credentialKey(base));
  } catch { /* The entered key remains usable in memory if storage is unavailable. */ }
}
export function aiRequest(settings: AiSettings) {
  if (isLocalAi(settings)) return { url: '/api/ai/chat/completions', headers: { 'Content-Type': 'application/json' } as Record<string,string> };
  const url = new URL(settings.apiBase.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('API 地址需为 HTTP(S) 地址，且不能包含密码、查询参数或片段。');
  const key = settings.apiKey.trim() || sessionAiKey(settings.apiBase);
  if (!key) throw new Error('请填写自定义接口的 API Key。');
  url.pathname = url.pathname.replace(/\/$/, '');
  if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
  return { url: url.toString(), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` } as Record<string,string> };
}

/** Supported Qwen hybrid reasoning families only; do not send a vendor-only option to unrelated models. */
export function qwenFastOptions(settings:AiSettings): {enable_thinking:false}|Record<string,never> {
  return /^qwen3\.[678]-(?:flash|plus|max)(?:-|$)/i.test(settings.model.trim()) && settings.fastMode!==false
    ? {enable_thinking:false} : {};
}
