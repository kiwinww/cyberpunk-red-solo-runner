import { useState } from 'react';
import { Campaign } from '../domain/types';
import { findModule, findScene, recordSceneResolution, selectRunnerScene } from '../lib/runner';
import { sceneBriefing } from '../data/sceneBriefings';
import { SkillAnnotatedText } from './SkillAnnotatedText';

export function SceneProgressPanel({campaign,onCampaign}:{campaign:Campaign;onCampaign:(next:Campaign)=>void}) {
  const module=findModule(campaign.runner.moduleId);
  const scene=findScene(module,campaign.runner.sceneId);
  const lastCheck=[...campaign.runner.turns].reverse().find(turn=>turn.type==='check' && turn.sceneId===scene.id && turn.moduleId===module.id && turn.sceneInstanceId===campaign.currentScene.id);
  const [summary,setSummary]=useState('');
  const [outcome,setOutcome]=useState<'success'|'failure'|'mixed'|'no-check'>(lastCheck?.checkResult ? lastCheck.checkResult.success?'success':'failure' : 'no-check');
  const [target,setTarget]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [notice,setNotice]=useState('');
  const resolutions=(campaign.runner.resolutions??[]).filter(item=>item.moduleId===module.id && item.sceneId===scene.id && item.sceneInstanceId===campaign.currentScene.id);
  const recorded=resolutions[resolutions.length-1];
  const pending=campaign.runner.turns.some(turn=>turn.pending);
  const candidates=(scene.nextSceneIds??[]).map(id=>module.scenes.find(item=>item.id===id)).filter(item=>!!item);
  const save=()=>{
    if(pending){setNotice('请先完成或停止等待中的主持行动。');return;}
    if((outcome==='success'||outcome==='failure') && (!lastCheck?.checkResult || lastCheck.checkResult.success!==(outcome==='success'))){setNotice('请先完成对应判定；没有掷骰的交流请选择“无需掷骰”，复杂结果可选“部分进展”。');return;}
    onCampaign(recordSceneResolution(campaign,summary,outcome));setSummary('');setNotice('已保存结果。请选择符合已知条件的后续场景。');
  };
  const move=(id:string)=>{
    if((!recorded&&!summary.trim()) || !confirmed || pending){setNotice('请填写场景结果并确认进入条件；等待中的主持行动须先完成或停止。');return;}
    const resolved=summary.trim()?recordSceneResolution(campaign,summary,outcome):campaign;
    if(summary.trim() && resolved===campaign){setNotice('结果与本次判定不符；请核对结果类型，尚未记录或切换场景。');return;}
    onCampaign(selectRunnerScene(resolved,module.id,id));setSummary('');setTarget('');setConfirmed(false);setNotice('已载入下一场景。');
  };
  const remember=()=>{
    if(!recorded || pending) return;
    const line=`${module.title} / ${scene.title}：${recorded.summary}`;
    const notes=campaign.playerNotes??'';
    if(notes.includes(line)){setNotice('这条进展已在长期记忆中。');return;}
    const next=[notes.trim(),line].filter(Boolean).join('\n');
    if(next.length>3000){setNotice('长期记忆已满，请在“人生路径”中整理后再添加；原进展仍已保存。');return;}
    onCampaign({...campaign,playerNotes:next});setNotice('已加入主持长期记忆。');
  };
  return <section className="scene-progress">
    <h3>{scene.title} · 场景进展</h3>
    <p>{scene.objective}</p>
    <p><SkillAnnotatedText text={sceneBriefing(module,scene)} character={campaign.character}/></p>
    {lastCheck?.checkResult && <p>最近判定：{lastCheck.checkResult.skillName} {lastCheck.checkResult.total} / DV {lastCheck.checkResult.dv} · {lastCheck.checkResult.success?'成功':'失败'}</p>}
    <label className="field"><span>本场景已确认的线索或后果</span><textarea aria-label="本场景已确认的线索或后果" rows={3} maxLength={2000} value={summary} onChange={event=>setSummary(event.target.value)} /></label>
    <label className="field"><span>结果类型</span><select aria-label="场景结果类型" value={outcome} onChange={event=>setOutcome(event.target.value as typeof outcome)}><option value="no-check">无需掷骰的进展</option><option value="success">判定成功</option><option value="failure">判定失败</option><option value="mixed">部分进展 / 复杂后果</option></select></label>
    <button type="button" disabled={!summary.trim()||pending} onClick={save}>记录场景结果</button>
    {recorded && <p>已记录：{recorded.summary}</p>}
    {recorded && <button type="button" disabled={pending} onClick={remember}>加入主持长期记忆</button>}
    <label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} />我确认所选分支符合当前线索与进入条件</label>
    {candidates.length>0 && <div className="scene-routes"><h4>原文指向的后续场景</h4>{candidates.map(next=><button key={next.id} type="button" disabled={(!recorded&&!summary.trim())||!confirmed||pending} onClick={()=>move(next.id)}>{summary.trim()?'记录并前往：':''}{next.title}</button>)}</div>}
    <details><summary>其他场景索引（包含后续标题）</summary>
      <label className="field"><span>选择已满足条件的场景</span><select aria-label="后续场景索引" value={target} onChange={event=>setTarget(event.target.value)}><option value="">请选择</option>{module.scenes.filter(item=>item.id!==scene.id).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <button type="button" disabled={!target||(!recorded&&!summary.trim())||!confirmed||pending} onClick={()=>move(target)}>进入所选场景</button>
    </details>
    {scene.pageRefs.map(ref=>ref.page?<a key={`${ref.sourceId}-${ref.page}`} href={`/api/local-sources/${ref.sourceId}/pdf#page=${ref.page}`} target="_blank" rel="noreferrer">场景依据 · PDF {ref.page} 页</a>:null)}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
