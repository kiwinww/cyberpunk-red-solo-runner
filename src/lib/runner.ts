import { moduleCatalog } from "../data/moduleCatalog";
import {
  Campaign,
  CampaignSettings,
  ModuleScene,
  ModuleSource,
  RunnerChoice,
  RunnerTurn,
  Scene,
} from "../domain/types";
import { appendJournal } from "./state";
import { roleGuide } from '../rulesets/cyberpunk-red/roles';
import { hostingPreferences } from './hosting';
import { characterApproach, playProfile, profileChoices } from '../data/modulePlayProfiles';
import { sceneBriefing } from '../data/sceneBriefings';
import { personalStoryReminder } from './personalStory';

export function createRunnerTurn(
  input: Omit<RunnerTurn, "id" | "createdAt">,
): RunnerTurn {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export function findModule(moduleId: string): ModuleSource {
  return moduleCatalog.find((module) => module.id === moduleId) ?? moduleCatalog[0];
}

export function findScene(module: ModuleSource, sceneId: string): ModuleScene {
  return module.scenes.find((scene) => scene.id === sceneId) ?? getStarterScene(module);
}

export function getStarterScene(module: ModuleSource): ModuleScene {
  return module.scenes.find((scene) => scene.id === module.starterSceneId) ?? module.scenes[0];
}

export function sceneFromModule(module: ModuleSource, scene: ModuleScene): Scene {
  return {
    id: crypto.randomUUID(),
    title: scene.title,
    objective: scene.objective,
    location: scene.location,
    pressure: scene.pressure,
    heat: scene.heat,
    threads: [
      module.title,
      scene.starterPrompt ? `下一步：${scene.starterPrompt}` : "",
      ...scene.pageRefs.map((ref) => `查阅：${ref.label}`),
      ...scene.npcBlocks.map((npc) => `NPC：${npc}`),
    ].filter(Boolean),
    status: "open",
  };
}

export function createSceneJournalBody(scene: ModuleScene): string {
  return [
    `地点：${scene.location}`,
    `目标：${scene.objective}`,
    `地图：${scene.maps.map((map) => map.title).join("、") || "无"}`,
    `来源：${scene.pageRefs.map((ref) => ref.label).join("、") || "需查阅本地原文"}`,
    scene.starterPrompt ? `开局提示：${scene.starterPrompt}` : "",
    "提示：具体正文、秘密与数值请回到你的本地模组资料查看。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOfflineChoices(
  campaign: Campaign,
  module: ModuleSource,
  scene: ModuleScene,
): RunnerChoice[] {
  const choices: RunnerChoice[] = profileChoices(campaign, scene.title, scene.phase==='intro');
  choices.push({id:crypto.randomUUID(),label:'问预言机',detail:'围绕眼前未知提出一个是非问题；答案不代替正式技能判定。',intent:'向预言机提出一个具体的是非问题。',kind:'oracle'});

  const nextScenes = (scene.nextSceneIds ?? [])
    .map((id) => module.scenes.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ModuleScene => Boolean(candidate));
  const essential:RunnerChoice[]=[];
  for (const next of nextScenes.slice(0, 2)) {
    essential.push({
      id: crypto.randomUUID(),
      label: `推进到：${next.title}`,
      detail: `回看当前线索与行动结果，确认能否进入「${next.title}」。`,
      intent: `在当前行动结果与原文进入条件已确认后，前往「${next.title}」。`,
      kind: "scene",
      targetSceneId: next.id,
    });
  }

  if (campaign.settings.netrunningEnabled && scene.phase !== "intro") {
    choices.push({
      id: crypto.randomUUID(),
      label: "寻找可接入的网络入口",
      detail:'观察门禁、终端与可见接入点，确认设备和接入条件，暂不执行入侵。',
      intent: "寻找监控、门禁、数据或 NET Architecture 入口。",
      kind: "check",
      checkHint: "如涉及 Netrunning，具体节点与 ICE 请查本地资料。",
    });
  }

  if (campaign.settings.combatFrequency !== "low" || scene.pressure >= 4) {
    choices.push({
      id: crypto.randomUUID(),
      label: "侦察掩体与撤离路线",
      detail:'判断可见威胁、掩体和出口，准备应对冲突，暂不主动开火。',
      intent: "评估掩体、出口、敌意目标和开火条件。",
      kind: "fight",
      checkHint: "进入战斗前在完整模式确认正式数值。",
    });
  }

  choices.push({
    id: crypto.randomUUID(),
    label: "回看委托与已知背景",
    detail:'整理开局信息与任务前提，不提前揭示幕后秘密。',
    intent: "查看玩家可读背景和来源引用，不展开模组秘密。",
    kind: "background",
  });

  if (campaign.settings.combatFrequency === 'high') {
    const fight = choices.find(choice => choice.kind === 'fight');
    if (fight) choices.splice(2, 0, ...choices.splice(choices.indexOf(fight), 1));
  }
  const limit=campaign.settings.pace === 'slow' ? 4 : 5;
  return [...choices.slice(0,limit-essential.length),...essential];
}

export function createOfflineGmTurn(campaign: Campaign, playerIntent?: string): RunnerTurn {
  const module = findModule(campaign.runner.moduleId || campaign.settings.selectedModuleId);
  const scene = findScene(module, campaign.runner.sceneId || campaign.settings.starterSceneId);
  const ability = roleGuide(campaign.character.role);
  const profile = playProfile(module.id);
  if (playerIntent?.startsWith('使用身份能力：') && ability) return createRunnerTurn({
    type: 'gm', speaker: '离线主持',
    body: `${campaign.character.role} · ${ability.ability} ${campaign.character.rank}\n${ability.summary}\n请先核对适用条件，再进行原文要求的判定或分配；这里不会自动宣告能力成功。`,
    choices: buildOfflineChoices(campaign, module, scene), sourceRefs: [{ sourceId: 'red-core-20261010', page: ability.page, label: `身份能力 · PDF ${ability.page}页` }],
  });
  const lastCheck=[...campaign.runner.turns].reverse().find(turn=>turn.type==='check' && turn.sceneInstanceId===campaign.currentScene.id && turn.sceneId===scene.id && turn.moduleId===module.id);
  const resolvingCheck=lastCheck && playerIntent?.startsWith('请根据刚才记录的真实判定结果');
  const lead = resolvingCheck?`判定记录：${lastCheck.body}`:playerIntent
    ? `你提出行动：「${playerIntent.slice(0,140)}」\n当前目标：${scene.objective}`
    : scene.phase==='intro' ? `${module.background.playerSummary}\n\n${module.background.openingHook}` : `当前场景：${scene.title}\n${scene.objective}`;
  const personalContext=personalStoryReminder(campaign.character,playerIntent??'');
  const sourceLine = scene.spoilerLevel === "gm-index"
    ? "这一阶段的秘密与遭遇可在来源中查阅。"
    : "";

  return createRunnerTurn({
    type: "gm",
    speaker: campaign.runner.mode === "ai" ? "离线主持兜底" : "离线主持",
    body: [lead, scene.phase!=='intro'?sceneBriefing(module,scene):'', personalContext, playerIntent ? characterApproach(campaign) : '',
      resolvingCheck ? `${lastCheck.checkResult ? lastCheck.checkResult.success ? '本次行动检定成功。' : '本次行动检定失败，可换一种办法或承担原文规定的后果。' : '判定已记录。'}在「场景进展」记录本次证实的事实或阻碍，再选择符合条件的分支；单次成功不代表整个场景已完成。`
      : playerIntent ? scene.phase==='intro' && /询问|核实|条件|合同|委托|费用|安排/.test(playerIntent) ? `${profile.briefing}\n你可以接受、拒绝或继续追问；未替你作出决定或登记收支。` : `你尚未确定行动的结果。当前关注「${scene.title}」；先说明接触对象与风险，完成对应判定后记录线索或阻碍。`
      : scene.phase==='intro' ? module.background.missionPremise : '查阅本场景依据，完成当前行动后在「场景进展」记录结果，选择符合实际条件的后续场景。',
      sourceLine, campaign.settings.difficulty === 'easy' ? '先确认风险与退路；不因难度设置改变正式数值。' : '', campaign.settings.pace === 'slow' ? hostingPreferences(campaign.settings)[1] : ''].filter(Boolean).join("\n\n"),
    choices: resolvingCheck && lastCheck.checkResult?.success===false ? [
      {id:crypto.randomUUID(),label:'换一种调查办法',detail:'保留失败结果，寻找不同证据或接近路线，不重掷同一次行动。',intent:'保留刚才的失败结果，寻找其他可行的调查办法；不重复原检定。',kind:'investigate'},
      {id:crypto.randomUUID(),label:'尝试交涉或求助',detail:'先询问对方条件或联系已认识的人，不默认对方同意帮忙。',intent:'在现有关系范围内询问援助与交涉条件，不宣告已经获得帮助。',kind:'talk'},
      {id:crypto.randomUUID(),label:'评估退路与代价',detail:'确认安全撤离的条件和已经发生的后果，不自动免除代价。',intent:'根据刚才的失败结果评估撤离条件及实际代价，暂不跳转场景。',kind:'investigate'},
    ] : buildOfflineChoices(campaign, module, scene),
    sourceRefs: scene.pageRefs, sceneId:scene.id,moduleId:module.id,sceneInstanceId:campaign.currentScene.id,
  });
}

export function startRunnerCampaign(campaign: Campaign, settings: CampaignSettings): Campaign {
  const module = findModule(settings.selectedModuleId);
  const scene = findScene(module, settings.starterSceneId);
  const nextScene = sceneFromModule(module, scene);
  const configured: Campaign = {
    ...campaign,
    name: campaign.name.trim() || "Cyberpunk RED 单人战役",
    settings,
    currentScene: nextScene,
    packs: campaign.packs.map((pack) => ({
      ...pack,
      enabled: settings.enabledPackIds.includes(pack.manifest.id),
    })),
    aiSettings: {
      ...campaign.aiSettings,
      enabled: settings.runnerMode === "ai" ? campaign.aiSettings.enabled : false,
    },
    netrun: {
      ...campaign.netrun,
      active: settings.netrunningEnabled ? campaign.netrun.active : false,
    },
    runner: {
      configured: true,
      moduleId: module.id,
      sceneId: scene.id,
      mode: settings.runnerMode,
      turns: [
        createRunnerTurn({
          type: "system",
          speaker: "系统",
          body: `战役设置完成：${module.title} / ${scene.title}。主持模式：${
            settings.runnerMode === "ai" ? "AI 主持" : "离线主持"
          }。`,
        }),
      ],
    },
  };

  const withSceneLog = appendJournal(configured, {
    type: "scene",
    title: `载入模组场景：${module.title} / ${scene.title}`,
    body: createSceneJournalBody(scene),
  });

  return {
    ...withSceneLog,
    runner: {
      ...withSceneLog.runner,
      turns: settings.runnerMode === "ai" ? configured.runner.turns : [...configured.runner.turns, createOfflineGmTurn(withSceneLog)],
    },
  };
}

export function advanceRunnerScene(campaign: Campaign, targetSceneId: string): Campaign {
  const module = findModule(campaign.runner.moduleId || campaign.settings.selectedModuleId);
  const scene = module.scenes.find(candidate => candidate.id === targetSceneId);
  if (!scene || scene.id === campaign.runner.sceneId) return campaign;
  return selectRunnerScene(campaign,module.id,scene.id,false);
}

export function selectRunnerScene(campaign:Campaign,moduleId:string,sceneId:string,narrate=true):Campaign {
  const module=moduleCatalog.find(item=>item.id===moduleId);
  const scene=module?.scenes.find(item=>item.id===sceneId);
  if(!module || !scene || campaign.runner.turns.some(turn=>turn.pending)) return campaign;
  if(campaign.runner.moduleId===module.id && campaign.runner.sceneId===scene.id && campaign.currentScene.title===scene.title) return campaign;
  const next = appendJournal(
    {
      ...campaign,
      currentScene: sceneFromModule(module, scene),
      settings:{...campaign.settings,selectedModuleId:module.id,starterSceneId:scene.id},
      runner: {
        ...campaign.runner,
        configured:true,
        moduleId:module.id,
        sceneId: scene.id,
      },
    },
    {
      type: "scene",
      title: `推进模组场景：${module.title} / ${scene.title}`,
      body: createSceneJournalBody(scene),
    },
  );
  return narrate ? {...next,runner:{...next.runner,turns:[...next.runner.turns,createOfflineGmTurn(next)]}} : next;
}

export function repairRunnerScene(campaign:Campaign):Campaign {
  if(!campaign.runner.configured) return campaign;
  const currentModule=moduleCatalog.find(module=>module.id===campaign.runner.moduleId);
  const current=currentModule?.scenes.find(scene=>scene.id===campaign.runner.sceneId);
  if(current?.title===campaign.currentScene.title) return campaign.settings.selectedModuleId===currentModule!.id && campaign.settings.starterSceneId===current.id ? campaign : {...campaign,settings:{...campaign.settings,selectedModuleId:currentModule!.id,starterSceneId:current.id}};
  const candidates=moduleCatalog.flatMap(module=>module.scenes.filter(scene=>scene.title===campaign.currentScene.title && scene.objective===campaign.currentScene.objective).map(scene=>({module,scene})));
  const match=candidates.find(item=>item.module.id===campaign.settings.selectedModuleId) ?? candidates.find(item=>item.module.id.startsWith('streets-')) ?? candidates[0];
  if(!match) return campaign;
  const next={...campaign,settings:{...campaign.settings,selectedModuleId:match.module.id,starterSceneId:match.scene.id},runner:{...campaign.runner,moduleId:match.module.id,sceneId:match.scene.id}};
  // Preserve the visible scene, character and transcript; only repair recognized legacy pointers.
  return appendJournal({...next,runner:{...next.runner,turns:[...next.runner.turns,createOfflineGmTurn(next)]}},{type:'scene',title:'修复旧存档场景指向',body:`已同步为 ${match.module.title} / ${match.scene.title}；角色和历史记录保留。`});
}

export function recordSceneResolution(campaign:Campaign,summary:string,outcome:'success'|'failure'|'mixed'|'no-check'):Campaign {
  if(!summary.trim() || campaign.runner.turns.some(turn=>turn.pending)) return campaign;
  if(outcome==='success'||outcome==='failure') {
    const check=[...campaign.runner.turns].reverse().find(turn=>turn.type==='check' && turn.sceneInstanceId===campaign.currentScene.id && turn.sceneId===campaign.runner.sceneId && turn.moduleId===campaign.runner.moduleId);
    if(!check?.checkResult || check.checkResult.success!==(outcome==='success')) return campaign;
  }
  const resolution={moduleId:campaign.runner.moduleId,sceneId:campaign.runner.sceneId,sceneInstanceId:campaign.currentScene.id,summary:summary.trim().slice(0,2000),outcome,createdAt:new Date().toISOString()};
  const next=appendJournal({...campaign,currentScene:{...campaign.currentScene,status:outcome==='failure'?'failed':outcome==='mixed'?'open':'resolved'},runner:{...campaign.runner,resolutions:[...(campaign.runner.resolutions??[]),resolution]}},{type:'scene',title:`场景结果：${campaign.currentScene.title}`,body:resolution.summary});
  return {...next,runner:{...next.runner,turns:[...next.runner.turns,createRunnerTurn({type:'log',speaker:'场景进展',sceneId:resolution.sceneId,moduleId:resolution.moduleId,sceneTitle:campaign.currentScene.title,body:`已记录${outcome==='success'?'成功':outcome==='failure'?'失败':outcome==='mixed'?'部分进展':'无需掷骰的进展'}：${resolution.summary}\n未自动结算金钱、物品或伤害。`})]}};
}
