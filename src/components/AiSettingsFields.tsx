import type { AiSettings } from '../domain/types';
import { isLocalAi, rememberSessionAiKey, sessionAiKey } from '../lib/aiEndpoint';

export function AiSettingsFields({settings,onChange}: {settings:AiSettings;onChange:(patch:Partial<AiSettings>)=>void}) {
  const local=isLocalAi(settings);
  return <div className="ai-settings-fields">
    <label className="field"><span>AI 接口方式</span><select aria-label="AI 接口方式" value={local?'local':'custom'} onChange={event=>onChange({apiBase:event.target.value==='local'?'/api/ai':'https://open.bigmodel.cn/api/paas/v4',apiKey:''})}><option value="local">现有本地智谱代理</option><option value="custom">自定义 OpenAI 兼容接口</option></select></label>
    {local ? <p className="hint">沿用服务器现有配置，无需填写 Key。更换服务商请选择自定义接口。</p> : <>
      <label className="field"><span>API 地址</span><input type="url" value={settings.apiBase} placeholder="https://服务商地址/v1" onChange={event=>onChange({apiBase:event.target.value,apiKey:''})}/></label>
      <label className="field"><span>模型名称</span><input value={settings.model} onChange={event=>onChange({model:event.target.value})}/></label>
      <label className="field"><span>API Key</span><input type="password" autoComplete="off" spellCheck={false} value={settings.apiKey || sessionAiKey(settings.apiBase)} onChange={event=>{rememberSessionAiKey(settings.apiBase,event.target.value);onChange({apiKey:event.target.value});}}/></label>
      {/^qwen3\.[678]-(?:flash|plus|max)(?:-|$)/i.test(settings.model.trim()) && <label className="switch"><input aria-label="快速叙事模式" type="checkbox" checked={settings.fastMode!==false} onChange={event=>onChange({fastMode:event.target.checked})} />快速叙事（关闭 Qwen 深度思考，显著缩短开口等待；复杂推理可取消勾选）</label>}
      <p className="hint">地址和模型随存档保存；Key 仅保留在当前浏览器会话，不写入战役备份。请求直接发往所填地址；接口需支持浏览器跨域（CORS）。</p>
    </>}
  </div>;
}
