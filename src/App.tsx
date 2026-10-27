import { AiSettingsFields } from './components/AiSettingsFields';
import { SceneProgressPanel } from './components/SceneProgressPanel';
import { SkillAnnotatedText } from './components/SkillAnnotatedText';
import { CharacterProfilesPanel } from './components/CharacterProfilesPanel';
import { gmNarration } from './lib/gmReply';
import { updateTrackedHp } from './lib/combatTracking';
import { STAT_NAMES as STAT_LABELS, extractCheckSuggestions, inferSourcedCheck, type CheckSuggestion } from './lib/skillAdvice';
import { changeCharacterGender, characterIdentitySummary, GENDER_LABELS } from './lib/characterIdentity';
import { retrieveLocalSources } from './lib/localSources';
import { equipmentStats } from './lib/equipmentStats';
import { saveCurrentCheckpoint } from './lib/storage';
import { HelpTip } from './components/HelpTip';
import { equipmentHelp } from './lib/equipmentHelp';
import { equipmentBonuses } from './lib/equipmentBonuses';
import {
  Archive,
  MoreHorizontal,
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  FileInput,
  ShoppingBag,
  BookMarked,
  Fingerprint,
  FileJson,
  HeartPulse,
  Import,
  ListChecks,
  NotebookText,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Skull,
  Swords,
  Upload,
  Zap,
  X,
  Send,
  LogOut,
  Info,
  Trash2,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { sourceEntries } from "./data/builtinSources";
import localSourceManifestRaw from "./data/localSourceManifest.json";
import localBooks from './data/localBooks.json';
import { moduleAliases, moduleChoices } from "./data/moduleCatalog";
import { getContextualWorldHooks } from "./data/lore";
import { woundPenalty } from './lib/checkContext';
import { registerWorldAction, resolveWorldAction } from "./lib/worldEvents";
import { buildManuscript } from "./lib/manuscript";
import { CharacterShop, CyberwarePanel, CyberwareOverview } from "./components/CharacterEquipment";
import { CREATION_CATALOG, getShopItem } from "./data/creationCatalog";
import { officialSources } from "./data/officialSources";
import { dataPackTemplate } from "./data/templates";
import {
  BeginnerGuideState,
  Campaign,
  CampaignSettings,
  CharacterSheet,
  Combatant,
  DataEntry,
  DataPack,
  LocalSourceManifest,
  ModuleScene,
  ModuleSource,
  SourceAsset,
  OracleRoll,
  RunnerChoice,
  RunnerMode,
  RunnerTurn,
  StatKey,
  WorldActionRecord,
  WorldOutcome,
} from "./domain/types";
import { generateGmResponse, testAiConnection } from "./lib/ai";
import { roleGuide, roleSkillBonus, ROLE_ALLOCATION_FIELDS, RED_ATTACK_SKILLS } from './rulesets/cyberpunk-red/roles';
import { actionHint, actionLabel, hostingPreferences } from './lib/hosting';
import { fieldHelp } from './data/ruleHelp';
import { mergePacks, parseDataPackJson, parseMarkdownAsPack } from "./lib/importer";
import { answerLabel, oracleAnswer } from "./lib/oracle";
import {
  advanceRunnerScene,
  createOfflineGmTurn,
  createRunnerTurn,
  findModule,
  findScene,
  startRunnerCampaign,
  selectRunnerScene,
} from "./lib/runner";
import { appendJournal, createDefaultCampaign } from "./lib/state";
import { clearPreparation, deleteSaveSlot, exportCampaign, importCampaign, listSaveSlots, loadCampaign, loadPreparation, rawCampaignBackup, clearCorruptedCampaign, saveCampaign, saveLocalCheckpoint, savePreparation } from "./lib/storage";
import { cyberpunkRedRuleset, RED_SKILLS } from "./rulesets/cyberpunk-red";
import { changeAttribute, effectiveEmpathy, fillCreationPoints, resetCreationAttributes, REQUIRED_SKILLS, validateCharacter } from './rulesets/cyberpunk-red/character';

const ODDS_LABELS: Record<OracleRoll["odds"], string> = {
  unlikely: "不太可能",
  even: "五五开",
  likely: "很可能",
};

const answerTone: Record<OracleRoll["answer"], string> = {
  "no-and": "danger",
  no: "danger",
  "no-but": "warn",
  "yes-but": "warn",
  yes: "good",
  "yes-and": "good",
};

const localSourceManifest = { ...localSourceManifestRaw, assets: [...localSourceManifestRaw.assets, ...localBooks] } as LocalSourceManifest;

type ActiveTab = "run" | "character" | "sources" | "modules" | "library" | "settings";
type ViewMode = "simple" | "full";

const activeAiRequests = new Map<string,AbortController>();

const VIEW_MODE_STORAGE_KEY = "cyberpunk-red-solo-runner:view-mode:v1";

const TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: "run", label: "跑团" },
  { id: "character", label: "角色" },
  { id: "sources", label: "资料源" },
  { id: "modules", label: "模组" },
  { id: "library", label: "资料库" },
  { id: "settings", label: "设置" },
];

const PHASE_LABELS: Record<ModuleScene["phase"], string> = {
  intro: "引入",
  investigation: "调查",
  access: "进入地点",
  escalation: "升级",
  finale: "收束",
  aftermath: "余波",
};


const DIFFICULTY_LABELS: Record<CampaignSettings["difficulty"], string> = {
  easy: "轻松",
  standard: "标准",
  hard: "硬核",
};

const PACE_LABELS: Record<CampaignSettings["pace"], string> = {
  slow: "慢速调查",
  standard: "标准节奏",
  fast: "快速推进",
};

const COMBAT_FREQUENCY_LABELS: Record<CampaignSettings["combatFrequency"], string> = {
  low: "低",
  medium: "中",
  high: "高",
};

function loadViewMode(): ViewMode {
  const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return raw === "full" ? "full" : "simple";
}

function saveViewMode(mode: ViewMode): void {
  window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Panel(props: {
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${props.className ?? ""}`}>
      <header className="panel-header">
        <div className="panel-title">
          {props.icon}
          <h2>{props.title}</h2>
        </div>
        {props.actions}
      </header>
      {props.children}
    </section>
  );
}

function IconButton(props: {
  label: string;
  shortLabel?:string;
  icon: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "danger" | "quiet";
  disabled?: boolean;
}) {
  return (
    <button
      type={props.type ?? "button"}
      className={`icon-button ${props.variant ?? ""}`}
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.icon}
      <span>{props.shortLabel??props.label}</span>
    </button>
  );
}

function RuleHint({ text }: { text: string }) {
  return text ? <HelpTip text={text}/> : null;
}

function AiConnectionTest({ settings }: { settings: Campaign['aiSettings'] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [retryAt,setRetryAt]=useState(0);
  const [retrySeconds,setRetrySeconds]=useState(0);
  const lock = useRef(false);
  const revision = useRef(0);
  useEffect(() => { revision.current++; setResult('');setRetryAt(0); }, [settings.apiBase, settings.model, settings.apiKey]);
  useEffect(()=>{const tick=()=>setRetrySeconds(Math.max(0,Math.ceil((retryAt-Date.now())/1000)));tick();if(!retryAt)return;const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[retryAt]);
  return <div className="connection-test"><IconButton label={busy ? '测试中' : retrySeconds ? `${retrySeconds}秒后可重测` : '测试连接 / 测速'} icon={<Zap size={16} />} disabled={busy||retrySeconds>0} onClick={async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const testedRevision = revision.current;
    const response = await testAiConnection(settings);
    if (testedRevision === revision.current) {setResult(`${response.ok ? '连接成功' : '连接失败'} · ${response.elapsedMs} ms（整次请求耗时） · ${response.message}`);setRetryAt(response.retryAt??0);}
    setBusy(false); lock.current = false;
  }} /><p className="hint">一次短请求，不发送战役资料；可能产生少量 API 费用。</p>{result && <p role="status">{result}</p>}</div>;
}

function Field(props: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "password";
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      <span>{props.label} <RuleHint text={fieldHelp(props.label)} /></span>
      <input
        type={props.type ?? "text"}
        min={props.min}
        max={props.max}
        value={props.value}
        aria-label={props.label}
        title={fieldHelp(props.label) || undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field field-wide">
      <span>{props.label}</span>
      <textarea aria-label={props.label} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function getStarterScene(module: ModuleSource): ModuleScene {
  return module.scenes.find((scene) => scene.id === module.starterSceneId) ?? module.scenes[0];
}

function applyModuleScene(campaign: Campaign, module: ModuleSource, scene: ModuleScene): Campaign {
  return selectRunnerScene(campaign,module.id,scene.id);
}

function SourceLedger() {
  return (
    <Panel title="资料来源" icon={<Archive size={18} />}>
      <div className="source-grid">
        {sourceEntries.map((source) => (
          <article key={source.id} className="source-card">
            <div>
              <strong>{source.title}</strong>
              <p>{source.note}</p>
            </div>
            <div className="source-meta">
              <span>{source.licenseStatus}</span>
              {source.sourceUrl ? (
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  打开链接
                </a>
              ) : (
                <code>{source.localPath}</code>
              )}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function flattenAssets(assets: SourceAsset[]): SourceAsset[] {
  return assets.flatMap((asset) => [asset, ...(asset.assets ? flattenAssets(asset.assets) : [])]);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SourceManagerPanel() {
  const flatAssets = flattenAssets(localSourceManifest.assets);
  const topLevel = localSourceManifest.assets;
  return (
    <Panel
      title="资料源管理"
      icon={<Archive size={18} />}
      actions={
        <IconButton
          label="导出清单"
          icon={<Download size={16} />}
          onClick={() => downloadText("cyberpunk-red-local-source-manifest.json", JSON.stringify(localSourceManifest, null, 2))}
        />
      }
    >
      <div className="source-summary">
        <div>
          <strong>{topLevel.length}</strong>
          <span>顶层文件</span>
        </div>
        <div>
          <strong>{flatAssets.length}</strong>
          <span>含压缩包附件</span>
        </div>
        <div>
          <strong>{officialSources.length}</strong>
          <span>官方在线来源</span>
        </div>
      </div>

      <h3 className="subhead">官方在线来源</h3>
      <div className="source-grid">
        {officialSources.map((source) => (
          <article key={source.id} className="source-card">
            <div>
              <strong>{source.title}</strong>
              <p>{source.summary}</p>
            </div>
            <div className="source-meta">
              <span>{source.category}</span>
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                打开链接
              </a>
            </div>
          </article>
        ))}
      </div>

      <h3 className="subhead">本地资料目录</h3>
      <p className="hint">{localSourceManifest.root}</p>
      <div className="source-table">
        {topLevel.map((asset) => (
          <article key={asset.id} className="source-row">
            <div>
              <strong>{asset.title}</strong>
              <small>{asset.relativePath}</small>
              {asset.outlineLines?.length ? <p>{asset.outlineLines.slice(0, 4).join(" · ")}</p> : null}
            </div>
            <div className="source-badges">
              <span>{asset.kind}</span>
              <span>{asset.fileType}</span>
              <span>{asset.pageCount ? `${asset.pageCount} 页` : `${asset.assets?.length ?? 0} 附件`}</span>
              <span>{formatBytes(asset.sizeBytes)}</span>
              <span>{asset.licenseStatus}</span>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ModuleBackgroundPanel({ module }: { module: ModuleSource }) {
  const [tab, setTab] = useState("brief");
  const [showGmNotes, setShowGmNotes] = useState(false);
  return (
    <section className="module-background reading-background" aria-label={module.title + "故事背景"}>
      <nav className="workspace-tabs" aria-label="背景分页">{[["brief", "任务背景"], ["world", "世界背景"], ["sources", "来源与主持"]].map(([id, title]) => <button key={id} type="button" className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => setTab(id)}>{title}</button>)}</nav>
      <div hidden={tab !== "brief"} className="background-prose">
        <span className="game-eyebrow">BRIEFING / 玩家可读</span>
        <h3>{module.title}</h3>
        <p className="background-lead">{module.background.playerSummary}</p>
        <h4>事情从这里开始</h4><p>{module.background.openingHook}</p>
        <h4>你的第一步</h4><p>{module.background.missionPremise}</p>
        {module.background.playerNotes?.length ? <><h4>你已经知道的事</h4><ul>{module.background.playerNotes.map(note => <li key={note}>{note}</li>)}</ul></> : null}
      </div>
      <div hidden={tab !== "world"} className="background-prose">
        <span className="game-eyebrow">NIGHT CITY / 赤红时代</span><h3>一座仍在重建的城市</h3>
        <p>第四次企业战争改变了城市与社会秩序。城市中心的建设、企业高管的隔离生活、战区的暴力，以及拥挤郊区的难民营，同时存在于夜之城。</p>
        <h4>地盘与关系</h4><p>街区受到不同企业、帮派与势力的影响。一次跨区行动，也可能意味着安保、资源与人情规则的变化；你的身份、联系人与住处会影响能得到什么消息。</p>
        <h4>边缘行者的生活</h4><p>你靠技能接活，通过中间人获得委托。报酬、住房、装备和人脉都关系到生存。雇主的说法需要验证，不能代替证据。</p>
        <a href="/api/local-sources/red-core-20261010/pdf#page=295" target="_blank" rel="noreferrer">核心规则 · PDF 257、295 页 ↗</a>
      </div>
      <div hidden={tab !== "sources"} className="background-prose">
        <h3>资料与原文</h3>
        <div className="book-links">{module.background.sourceRefs.map((ref, index) => <p key={index}>{ref.sourceId.startsWith("red-") ? <a href={`/api/local-sources/${ref.sourceId}/pdf#page=${ref.page ?? 1}`} target="_blank" rel="noreferrer">{ref.label} ↗</a> : ref.label}</p>)}</div>
        {module.background.gmNotes?.length ? <div className="gm-note-box">
          <button type="button" onClick={() => setShowGmNotes(!showGmNotes)}>{showGmNotes ? "收起主持索引" : "显示主持索引 / 可能剧透"}</button>
          {showGmNotes ? <ul>{module.background.gmNotes.map(note => <li key={note}>{note}</li>)}</ul> : <p className="hint">主持索引可能涉及剧透。</p>}
        </div> : null}
      </div>
    </section>
  );
}

function ModuleRunnerPanel({
  campaign,
  onCampaign,
}: {
  campaign: Campaign;
  onCampaign: (campaign: Campaign) => void;
}) {
  const loadScene = (module: ModuleSource, scene: ModuleScene) => {
    if(campaign.runner.turns.some(turn=>turn.pending)){window.alert('请先回到主持台停止或完成当前 AI 行动，再载入场景。');return;}
    if(campaign.runner.configured && !window.confirm('载入这个场景？角色和历史记录会保留，主持与资料检索将一起切换。')) return;
    onCampaign(applyModuleScene(campaign, module, scene));
  };

  return (
    <Panel title="模组跑团" icon={<NotebookText size={18} />}>
      <div className="module-list">
        {moduleChoices.map((module) => (
          <article key={module.id} className="module-card">
            <div className="module-head">
              <div>
                <strong>{module.title}</strong>
                <p>{module.summary}</p>
              </div>
              <span>{module.licenseStatus}</span>
            </div>
            <ModuleBackgroundPanel module={module} />
            <div className="map-strip">
              {module.maps.map((map) => (
                <span key={map.id}>{map.title}</span>
              ))}
            </div>
            <div className="module-scenes">
              {module.scenes.map((scene) => (
                <article key={scene.id} className="scene-chip">
                  <div>
                    <strong>{scene.title}</strong>
                    <small>
                      {PHASE_LABELS[scene.phase]} · {scene.location} · 压力 {scene.pressure} · 热度 {scene.heat}
                    </small>
                    <p>{scene.objective}</p>
                    {scene.spoilerLevel === "gm-index" ? <em>需查阅本地原文确认秘密与数值</em> : null}
                  </div>
                  <IconButton label="载入" icon={<Play size={16} />} onClick={() => loadScene(module, scene)} />
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function CharacterSummaryPanel({
  campaign,
  onFullMode,
}: {
  campaign: Campaign;
  onFullMode: () => void;
}) {
  const character = campaign.character;
  return (
    <Panel
      title="角色摘要"
      icon={<HeartPulse size={18} />}
      actions={<IconButton label="完整角色卡" icon={<ChevronRight size={16} />} onClick={onFullMode} />}
    >
      <div className="character-summary">
        <div>
          <span>代号</span>
          <strong>{character.handle}</strong>
          <small>
            {character.role} · 身份等级 {character.rank}
          </small>
        </div>
        <div>
          <span>HP</span>
          <strong>
            {character.hp.current}/{character.hp.max}
          </strong>
          <small>重伤 {character.hp.seriouslyWoundedAt}</small>
        </div>
        <div>
          <span>人性</span>
          <strong>
            {character.humanity.current}/{character.humanity.max}
          </strong>
          <small>当前记录</small>
        </div>
        <div>
          <span>护甲</span>
          <strong>
            头 {character.armor.headSp} / 身 {character.armor.bodySp}
          </strong>
          <small>SP</small>
        </div>
      </div>
    </Panel>
  );
}

function CurrentMissionPanel({
  campaign,
  onFullMode,
}: {
  campaign: Campaign;
  onFullMode: () => void;
}) {
  const mission = campaign.missions[0];
  return (
    <Panel
      title="当前委托"
      icon={<Settings size={18} />}
      actions={<IconButton label="完整委托" icon={<ChevronRight size={16} />} onClick={onFullMode} />}
    >
      {mission ? (
        <article className="current-mission">
          <div>
            <span>标题</span>
            <strong>{mission.title}</strong>
          </div>
          <div className="mission-facts">
            <span>雇主：{mission.client}</span>
            <span>目标：{mission.target}</span>
            <span>报酬：{mission.reward}</span>
            <span>状态：{mission.status}</span>
          </div>
          <p>{mission.complication}</p>
        </article>
      ) : (
        <p className="hint">还没有委托。切到完整模式后可以新增。</p>
      )}
    </Panel>
  );
}

function WorkspaceModal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return <dialog className="workspace-modal" ref={ref} aria-label={title} onCancel={onClose} onClick={event => { if (event.currentTarget === event.target) onClose(); }}>
    <header><h2>{title}</h2><IconButton label="关闭窗口" icon={<X size={20} />} onClick={onClose} /></header>
    <div className="workspace-modal-body">{children}</div>
  </dialog>;
}

function CampaignSetupPanel({
  campaign, onCampaign, onFullMode,
}: {
  campaign: Campaign;
  onCampaign: (campaign: Campaign) => void;
  onFullMode: () => void;
}) {
  const [preparation] = useState(() => loadPreparation(campaign));
  const [settings, setSettings] = useState(preparation.settings);
  const [character, setCharacter] = useState(preparation.character);
  const [aiSettings, setAiSettings] = useState(preparation.aiSettings);
  const [campaignName, setCampaignName] = useState(preparation.name);
  const [modal, setModal] = useState<'background' | 'character' | null>(null);
  const [preparationError, setPreparationError] = useState('');
  useEffect(() => {
    try { savePreparation(campaign.id, { name: campaignName, settings, character, aiSettings }); setPreparationError(''); }
    catch { setPreparationError('开局选择未能保存，请检查浏览器本地存储。'); }
  }, [campaign.id, campaignName, settings, character, aiSettings]);
  const selectedModule = findModule(settings.selectedModuleId);
  const creation = campaign.runner.turns.length === 0;
  const creationErrors = validateCharacter(character, creation).errors;
  const ready = (!creation || creationErrors.length === 0) && (settings.runnerMode !== "ai" || Boolean(aiSettings.model.trim()));
  const enterGame = () => {
    clearPreparation();
    const next = startRunnerCampaign({ ...campaign, name: campaignName, character, aiSettings: { ...aiSettings, enabled: settings.runnerMode === "ai" } }, settings);
    const continuing = campaign.runner.turns.length > 0 && settings.selectedModuleId === campaign.runner.moduleId && settings.starterSceneId === campaign.settings.starterSceneId;
    onCampaign(continuing ? { ...next, currentScene: campaign.currentScene, journal: campaign.journal, runner: { ...campaign.runner, configured: true, mode: settings.runnerMode } } : next);
  };
  return (
    <section className="game-setup">
      <div className="setup-heading"><span className="game-eyebrow">NIGHT CITY / 2045</span><h2>你的下一单</h2><p>夜之城的故事，等你入场。</p></div>
      <div className="setup-essentials">
        <section className="setup-step">
          <span className="step-number">01 / 委托</span>
          <h3>选择剧本</h3>
          <label className="field"><span>剧本</span><select aria-label="剧本" value={moduleAliases[settings.selectedModuleId]??settings.selectedModuleId} onChange={event => {
            const module = findModule(event.target.value);
            setSettings({ ...settings, selectedModuleId: module.id, starterSceneId: module.starterSceneId });
          }}>{moduleChoices.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>
          <p className="setup-synopsis">{selectedModule.background.playerSummary}</p>
          <IconButton label="故事背景" icon={<BookOpen size={16} />} onClick={() => setModal('background')} />
        </section>
        <section className="setup-step">
          <span className="step-number">02 / 边缘行者</span><h3>确认角色</h3>
          <Field label="代号" value={character.handle} onChange={handle => setCharacter({ ...character, handle })} />
          <p className="character-line">{character.role} · {characterIdentitySummary(character)} · HP {character.hp.current}/{character.hp.max} · 人性 {character.humanity.current}</p>
          {creation && creationErrors.length > 0 && <p className="hint">角色尚未完成：请打开编辑角色分配属性与技能。</p>}
          <IconButton label="编辑角色" icon={<Shield size={16} />} onClick={() => setModal('character')} />
        </section>
        <section className="setup-step">
          <span className="step-number">03 / 主持</span><h3>选择主持</h3>
          <div className="mode-switch" role="group" aria-label="主持方式">
            <button type="button" aria-pressed={settings.runnerMode === "offline"} className={settings.runnerMode === "offline" ? "active" : ""} onClick={() => setSettings({ ...settings, runnerMode: "offline" })}>离线主持</button>
            <button type="button" aria-pressed={settings.runnerMode === "ai"} className={settings.runnerMode === "ai" ? "active" : ""} onClick={() => setSettings({ ...settings, runnerMode: "ai" })}>AI 主持</button>
          </div>
          <p className="setup-synopsis">{settings.runnerMode === "ai" ? "由 AI 描述现场、扮演人物，并回应你的行动。" : "使用场景索引、预言机和骰子，自己掌握故事。"}</p>
          {settings.runnerMode === "ai" && <details open><summary>AI 连接</summary>
            <AiSettingsFields settings={aiSettings} onChange={patch=>setAiSettings({...aiSettings,...patch})} />
            <AiConnectionTest settings={aiSettings} />
            <p className="hint">相关 PDF 片段及对话将发送至所选 AI 服务。</p>
          </details>}
        </section>
      </div>
      <details className="setup-advanced"><summary>高级设置</summary>
        <div className="form-grid two">
          <Field label="战役名" value={campaignName} onChange={setCampaignName} />
          <label className="field"><span>起始场景 <RuleHint text={fieldHelp("起始场景")} /></span><select value={settings.starterSceneId} onChange={event => setSettings({ ...settings, starterSceneId: event.target.value })}>{selectedModule.scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select></label>
          <label className="field"><span>节奏 <RuleHint text={fieldHelp("节奏")} /></span><select value={settings.pace} onChange={event => setSettings({ ...settings, pace: event.target.value as CampaignSettings["pace"] })}>{Object.entries(PACE_LABELS).map(([id, label]) => <option key={id} value={id} title={hostingPreferences({ ...settings, pace: id as CampaignSettings["pace"] })[1]}>{label}</option>)}</select></label>
          <label className="field"><span>难度 <RuleHint text={fieldHelp("难度")} /></span><select value={settings.difficulty} onChange={event => setSettings({ ...settings, difficulty: event.target.value as CampaignSettings["difficulty"] })}>{Object.entries(DIFFICULTY_LABELS).map(([id, label]) => <option key={id} value={id} title={hostingPreferences({ ...settings, difficulty: id as CampaignSettings["difficulty"] })[0]}>{label}</option>)}</select></label>
          <label className="field"><span>战斗频率 <RuleHint text={fieldHelp("战斗频率")} /></span><select value={settings.combatFrequency} onChange={event => setSettings({ ...settings, combatFrequency: event.target.value as CampaignSettings["combatFrequency"] })}>{Object.entries(COMBAT_FREQUENCY_LABELS).map(([id, label]) => <option key={id} value={id} title={hostingPreferences({ ...settings, combatFrequency: id as CampaignSettings["combatFrequency"] })[2]}>{label}</option>)}</select></label>
          <label className="field"><span>剧透级别 <RuleHint text={fieldHelp("剧透级别")} /></span><select value={settings.spoilerLevel} onChange={event => setSettings({ ...settings, spoilerLevel: event.target.value as CampaignSettings["spoilerLevel"] })}><option value="player">玩家可读</option><option value="gm-index">主持索引</option></select></label>
        </div>
        <label className="switch"><input type="checkbox" checked={settings.netrunningEnabled} onChange={event => setSettings({ ...settings, netrunningEnabled: event.target.checked })} />Netrunning <RuleHint text="应用开关控制可选网行线索；网行需要交互界面、设备与入口条件，并非任何身份都能进行。核心规则PDF147、198–209页。" /></label>
        {campaign.packs.map(pack => <label className="switch" key={pack.manifest.id}><input type="checkbox" checked={settings.enabledPackIds.includes(pack.manifest.id)} onChange={event => setSettings({ ...settings, enabledPackIds: event.target.checked ? [...settings.enabledPackIds, pack.manifest.id] : settings.enabledPackIds.filter(id => id !== pack.manifest.id) })} />{pack.manifest.name}</label>)}
        <div className="hosting-summary"><strong>当前主持偏好</strong><ul>{hostingPreferences(settings).map(line => <li key={line}>{line}</li>)}</ul></div>
        <IconButton label="完整工具" icon={<Settings size={16} />} onClick={onFullMode} />
      </details>
      <div className="setup-launch">
        <span>{ready ? "准备就绪" : creation && creationErrors.length ? "先完成角色，再进入故事" : "需要配置 .env.local 中的智谱密钥以使用 AI"}</span>
        <IconButton label="进入夜之城" icon={<Play size={18} />} variant="primary" disabled={!ready} onClick={enterGame} />
      </div>
      {preparationError && <p role="alert">{preparationError}</p>}
      <WorkspaceModal open={modal === 'background'} title={selectedModule.title} onClose={() => setModal(null)}><ModuleBackgroundPanel key={selectedModule.id} module={selectedModule} /></WorkspaceModal>
      <WorkspaceModal open={modal === 'character'} title="编辑边缘行者" onClose={() => setModal(null)}>{modal === 'character' && <CharacterPanel character={character} creation={creation} onChange={next => { setCharacter(next); setModal(null); }} />}</WorkspaceModal>
    </section>
  );
}

function RunnerTurnCard({ turn,character,campaign }: { turn: RunnerTurn;character:CharacterSheet;campaign:Campaign }) {
  const annotationCampaign={...campaign,runner:{...campaign.runner,moduleId:turn.moduleId??campaign.runner.moduleId,sceneId:turn.sceneId??campaign.runner.sceneId}};
  return (
    <article className={`runner-turn ${turn.type}`}>
      <div>
        <strong>{turn.speaker}</strong>
        <span>{{ system: "记录", player: "行动", gm: "主持", oracle: "预言", check: "判定", log: "日志" }[turn.type]}</span>
      </div>
      {turn.checkResult ? <><p>{turn.checkResult.skillName} · 总计 {turn.checkResult.total} / DV {turn.checkResult.dv}：{turn.checkResult.success?'成功':'失败'}</p><details><summary>判定明细</summary><p><SkillAnnotatedText text={turn.type==='gm'?gmNarration(turn.body):turn.body} character={character} campaign={annotationCampaign}/></p></details></> : <p><SkillAnnotatedText text={turn.type==='gm'?gmNarration(turn.body):turn.body} character={character} campaign={annotationCampaign}/></p>}
      {turn.checkRequest ? <small>需要判定：{turn.checkRequest.skillId && RED_SKILLS.some(skill=>skill.id===turn.checkRequest!.skillId)
        ? <><SkillAnnotatedText text={RED_SKILLS.find(skill=>skill.id===turn.checkRequest!.skillId)!.name} character={character} campaign={annotationCampaign}/> · </> : null}<SkillAnnotatedText text={turn.checkRequest.reason} character={character} campaign={annotationCampaign}/></small> : null}
      {turn.sourceRefs?.length ? (
        <details className="turn-sources"><summary>查阅依据 · {turn.sourceRefs.length}</summary><small>{turn.sourceRefs.map((ref, index) => (
          <span key={`${ref.sourceId}-${ref.page}-${index}`}>
            {index ? '、' : ''}
            {ref.sourceId.startsWith('red-') ? <a href={`/api/local-sources/${encodeURIComponent(ref.sourceId)}/pdf#page=${ref.page ?? 1}`} target="_blank" rel="noreferrer">{ref.label}</a> : ref.sourceId.startsWith('world-') && ref.note ? <a href={ref.note} target="_blank" rel="noreferrer">{ref.label}</a> : ref.label}
          </span>
        ))}</small></details>
      ) : null}
    </article>
  );
}

const WORLD_OUTCOME_LABELS: Record<WorldOutcome, string> = {
  progress: '有利进展', complication: '成功但有代价', setback: '受挫或失败',
};

/** Only the player confirms permanent world changes after the GM has narrated the result. */
function WorldEventReview({ campaign, event, onCampaign }: {
  campaign: Campaign;
  event: WorldActionRecord;
  onCampaign: (campaign: Campaign) => void;
}) {
  const [outcome, setOutcome] = useState<WorldOutcome>('progress');
  const [consequence, setConsequence] = useState('');
  const [factionId, setFactionId] = useState('');
  const [factionAttitudeDelta, setFactionAttitudeDelta] = useState<-1 | 0 | 1>(0);
  const [factionClockDelta, setFactionClockDelta] = useState<-1 | 0 | 1>(0);
  const [npcId, setNpcId] = useState('');
  const [npcDispositionDelta, setNpcDispositionDelta] = useState<-1 | 0 | 1>(0);
  const [heatDelta, setHeatDelta] = useState<-1 | 0 | 1>(0);
  const [notice, setNotice] = useState('');
  if (event.status === 'resolved') return <article className="world-resolution-item">
    <strong>{event.sceneTitle}</strong><p>{event.action}</p>
    <small>已结算 · {WORLD_OUTCOME_LABELS[event.outcome ?? 'progress']}</small>
    <p>{event.consequence}</p>
  </article>;
  const deltaOptions = <><option value={-1}>降低 1 级</option><option value={0}>无变化</option><option value={1}>提高 1 级</option></>;
  const apply = () => {
    const result = resolveWorldAction(campaign, event.id, {
      outcome, consequence,
      impact: {
        factionId: factionId || undefined,
        factionAttitudeDelta: factionId ? factionAttitudeDelta : 0,
        factionClockDelta: factionId ? factionClockDelta : 0,
        npcId: npcId || undefined,
        npcDispositionDelta: npcId ? npcDispositionDelta : 0,
        heatDelta,
      },
    });
    if (result.ok) onCampaign(result.campaign);
    else setNotice(result.message);
  };
  return <article className="world-resolution-item">
    <strong>{event.sceneTitle} · 待结算</strong>
    <p>{event.action}</p>
    <label>GM 判定结果 <select value={outcome} onChange={e => setOutcome(e.target.value as WorldOutcome)}>
      {Object.entries(WORLD_OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>实际发生了什么？ <textarea value={consequence} rows={3} maxLength={500} placeholder="根据 GM 的描述填写已确认的结果；不能把尝试当作成功。" onChange={e => setConsequence(e.target.value)}/></label>
    <details className="world-impact-details"><summary>确认长期后果（可选）</summary>
      <p className="hint">只调整战役中已存在的 NPC 和势力。每项最多变化 1 级，避免 AI 自动篡改角色状态。</p>
      <label>受影响势力 <select value={factionId} onChange={e => setFactionId(e.target.value)}>
        <option value="">无势力变化</option>{campaign.factions.map(f => <option key={f.id} value={f.id}>{f.name} · {f.attitude}</option>)}
      </select></label>
      {factionId && <><label>势力态度 <select value={factionAttitudeDelta} onChange={e => setFactionAttitudeDelta(Number(e.target.value) as -1|0|1)}>{deltaOptions}</select></label>
      <label>势力时钟 <select value={factionClockDelta} onChange={e => setFactionClockDelta(Number(e.target.value) as -1|0|1)}>{deltaOptions}</select></label></>}
      <label>受影响 NPC <select value={npcId} onChange={e => setNpcId(e.target.value)}><option value="">无 NPC 变化</option>{campaign.npcs.map(n => <option key={n.id} value={n.id}>{n.name} · {n.disposition}</option>)}</select></label>
      {npcId && <label>NPC 态度 <select value={npcDispositionDelta} onChange={e => setNpcDispositionDelta(Number(e.target.value) as -1|0|1)}>{deltaOptions}</select></label>}
      <label>当前场景热度 <select value={heatDelta} onChange={e => setHeatDelta(Number(e.target.value) as -1|0|1)}>{deltaOptions}</select></label>
    </details>
    <button type="button" disabled={!consequence.trim()} onClick={apply}>确认结果并保存影响</button>
    {notice && <p role="alert">{notice}</p>}
  </article>;
}

function RunnerConsolePanel({
  campaign,
  onCampaign,
  onFullMode,
  onSave,
  onExit,
  onResolvePending,
}: {
  campaign: Campaign;
  onCampaign: (campaign: Campaign) => void;
  onResolvePending: (campaignId: string, pendingId: string, reply: RunnerTurn) => void;
  onFullMode: () => void;
  onSave: (asNew?:boolean) => void;
  onExit: () => void;
}) {
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitSeconds,setWaitSeconds]=useState(0);
  const [streamPreview,setStreamPreview]=useState('');
  const [retrySeconds,setRetrySeconds]=useState(0);
  const [moreToolsOpen,setMoreToolsOpen]=useState(false);
  const [drawer, setDrawer] = useState<"character" | "mission" | "journal" | "background" | "settings" | "dice" | "life" | "market" | "novel" | "progress" | null>(null);
  const [showAllChoices,setShowAllChoices]=useState(false);
  const [actionsOpen,setActionsOpen]=useState(true);
  const sidePanelRef=useRef<HTMLElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const submissionLock = useRef(false);
  const unresolved = [...campaign.runner.turns].reverse().find(turn => turn.pending);
  const lastResponse = campaign.runner.turns[campaign.runner.turns.length - 1];
  const awaitingCheck = lastResponse?.type==='gm' && lastResponse.checkRequest ? lastResponse : undefined;
  const adviceTurn=lastResponse?.type==='gm' && (!lastResponse.moduleId||lastResponse.moduleId===campaign.runner.moduleId) && (!lastResponse.sceneId||lastResponse.sceneId===campaign.runner.sceneId) ? lastResponse : undefined;
  const checkSuggestions=adviceTurn?.checkSuggestions ?? (adviceTurn ? extractCheckSuggestions(adviceTurn.body) : []);
  const failedResponse = lastResponse?.responseState === 'failed' ? lastResponse : undefined;
  const failure = failedResponse ? { intent: failedResponse.pendingIntent ?? '', message: failedResponse.body } : null;
  useEffect(()=>{const tick=()=>setRetrySeconds(Math.max(0,Math.ceil(((failedResponse?.retryAt??0)-Date.now())/1000)));tick();if(!failedResponse?.retryAt)return;const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[failedResponse?.retryAt]);
  const aiRunning = busy || Boolean(unresolved);
  const actionBlocked = aiRunning || Boolean(failure) || Boolean(awaitingCheck);
  const cancelPending = () => {
    if(!unresolved) return;
    activeAiRequests.get(unresolved.id)?.abort();
    activeAiRequests.delete(unresolved.id);
    setStreamPreview('');
    onResolvePending(campaign.id,unresolved.id,{...unresolved,pending:false,responseState:'failed',speaker:'等待已停止',body:'已停止等待，行动已保留。可重试回应或改用离线主持。'});
    setBusy(false);submissionLock.current=false;
  };
  useEffect(()=>{
    if(!aiRunning || !unresolved || !activeAiRequests.has(unresolved.id)){setWaitSeconds(0);return;}
    const start=Date.parse(unresolved?.createdAt??'')||Date.now();
    const update=()=>setWaitSeconds(Math.max(0,Math.floor((Date.now()-start)/1000)));
    update();const timer=window.setInterval(update,1000);
    return ()=>window.clearInterval(timer);
  },[aiRunning,unresolved?.id,unresolved?.createdAt]);
  const resumePending = async (offline = false) => {
    const target = unresolved ?? failedResponse;
    if (!target?.pendingIntent || submissionLock.current || activeAiRequests.has(target.id)) return;
    if(!offline && (target.retryAt??0)>Date.now()) return;
    submissionLock.current = true;
    setBusy(true);
    const pending = { ...target, pending: true, responseState: undefined,retryAt:undefined,createdAt:new Date().toISOString() };
    const resumed = { ...campaign, runner: { ...campaign.runner, turns: campaign.runner.turns.map(turn => turn.id === target.id ? pending : turn) } };
    if (offline) {
      const reply = { ...createOfflineGmTurn(resumed, target.pendingIntent), id: target.id, sceneTitle: campaign.currentScene.title };
      onResolvePending(campaign.id, target.id, reply);
      updateMode('offline', { ...resumed, runner: { ...resumed.runner, turns: resumed.runner.turns.map(turn => turn.id === target.id ? reply : turn) } });
      setBusy(false); submissionLock.current = false;
      return;
    }
    onCampaign(resumed);
    await requestPending(resumed, pending);
  };
  useEffect(() => {
    if(sidePanelRef.current)sidePanelRef.current.scrollTop=0;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setDrawer(null);};
    document.addEventListener('keydown',close);
    return()=>document.removeEventListener('keydown',close);
  }, [drawer]);
  useEffect(()=>setShowAllChoices(false),[campaign.runner.turns.length,campaign.currentScene.id]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [campaign.runner.turns.length, busy]);
  useEffect(()=>{if(streamPreview && logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight;},[streamPreview]);
  useEffect(()=>{
    const node=logRef.current;
    if(!node || typeof ResizeObserver==='undefined') return;
    const observer=new ResizeObserver(()=>{node.scrollTop=node.scrollHeight;});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[]);
  const module = findModule(campaign.runner.moduleId || campaign.settings.selectedModuleId);
  const scene = findScene(module, campaign.runner.sceneId || campaign.settings.starterSceneId);
  const sceneWorldHooks = getContextualWorldHooks(campaign);
  const latestChoices =
    [...campaign.runner.turns].reverse().find((turn) => turn.choices?.length)?.choices ??
    createOfflineGmTurn(campaign).choices ??
    [];
  const primaryChoices=latestChoices.slice(0,3);
  const routeChoice=latestChoices.find(choice=>choice.kind==='scene');
  if(routeChoice && !primaryChoices.includes(routeChoice) && latestChoices.length>3)primaryChoices[2]=routeChoice;

  const updateMode = (mode: RunnerMode, base = campaign) => {
    onCampaign({
      ...base,
      settings: { ...base.settings, runnerMode: mode },
      aiSettings: { ...base.aiSettings, enabled: mode === 'ai' },
      runner: { ...base.runner, mode },
    });
  };

  const commitTurns = (
    nextCampaign: Campaign,
    turns: RunnerTurn[],
    logBody: string,
  ) => {
    const withLog = appendJournal(nextCampaign, {
      type: "note",
      title: "主持台行动",
      body: logBody,
    });
    onCampaign({
      ...withLog,
      runner: {
        ...withLog.runner,
        turns: [...withLog.runner.turns, ...turns],
      },
    });
  };

  async function requestPending(context: Campaign, pending: RunnerTurn) {
    const controller=new AbortController();
    activeAiRequests.set(pending.id,controller);
    setStreamPreview('');
    let reply: RunnerTurn;
    try {
      const request = { ...context, runner: { ...context.runner, turns: context.runner.turns.filter(turn => turn.id !== pending.id) } };
      const result = await generateGmResponse(request, pending.pendingIntent!,controller.signal, text=>{if(activeAiRequests.get(pending.id)===controller)setStreamPreview(text);});
      reply = result.ok ? { ...createRunnerTurn({ type: 'gm', speaker: 'AI GM', body: result.text, sourceRefs: result.sourceRefs,
        choices: result.choices?.length ? result.choices : createOfflineGmTurn(context, pending.pendingIntent).choices,
        checkRequest: result.checkRequest,
        checkSuggestions:result.checkSuggestions, logSummary:result.logSummary,
      }), id: pending.id, sceneTitle: context.currentScene.title,sceneId:context.runner.sceneId,moduleId:context.runner.moduleId }
        : { ...pending, pending: false, responseState: 'failed', speaker: '连接中断', body: result.text,retryAt:result.retryAt };
    } catch {
      reply = { ...pending, pending: false, responseState: 'failed', speaker: '连接中断', body: 'AI 请求发生异常，请重试或改用离线主持。' };
    }
    try { if(!controller.signal.aborted && activeAiRequests.get(pending.id)===controller) onResolvePending(context.id, pending.id, reply); }
    finally { if(activeAiRequests.get(pending.id)===controller){activeAiRequests.delete(pending.id);setStreamPreview('');setBusy(false);submissionLock.current=false;} }
  }

  const submitIntent = async (rawIntent: string, choice?: RunnerChoice, continuation?:'opening'|'check') => {
    const trimmed = rawIntent.trim();
    if (!trimmed || submissionLock.current || actionBlocked) return;
    submissionLock.current = true;
    setBusy(true);

    let nextCampaign = campaign;
    const playerTurn = createRunnerTurn({
      sceneId:campaign.runner.sceneId,moduleId:campaign.runner.moduleId,
      sceneTitle: nextCampaign.currentScene.title,
      type: continuation?'system':"player",
      speaker: continuation?'规则判定':campaign.character.handle,
      body: continuation==='opening'?'主持开场。':continuation?'判定完成，交由主持叙述后果。':trimmed,
    });
    const extraTurns: RunnerTurn[] = [];

    if (choice?.kind === 'world' && choice.worldHookId) {
      nextCampaign = registerWorldAction(nextCampaign, choice.worldHookId, trimmed);
    }

    if (choice?.kind === "scene" && choice.targetSceneId) {
      if (!module.scenes.some(scene => scene.id === choice.targetSceneId)) { setBusy(false); submissionLock.current = false; return; }
      if (!window.confirm('确认当前行动已经完成，且原模组允许进入这个场景？切换只更新场景索引，不代表检定成功、领取报酬或获得物品。')) { setBusy(false); submissionLock.current = false; return; }
      nextCampaign = advanceRunnerScene(nextCampaign, choice.targetSceneId);
    }

    if (choice?.kind === "oracle") {
      const question=window.prompt('你想问预言机什么？请输入一个具体的是非问题。','');
      if(!question?.trim()){setBusy(false);submissionLock.current=false;return;}
      const roll = oracleAnswer(question.trim(), "even");
      nextCampaign = {
        ...nextCampaign,
        oracleHistory: [roll, ...nextCampaign.oracleHistory],
      };
      extraTurns.push(
        createRunnerTurn({
          type: "oracle",
          speaker: "单人预言机",
          body: `${question.trim()}\n${answerLabel(roll.answer)}。1d10=${roll.die}${roll.twist ? `；转折：${roll.twist}` : ""}`,
        }),
      );
    }

    if (choice?.kind === "background") {
      extraTurns.push(
        createRunnerTurn({
          type: "gm",
          speaker: "资料索引",
          body: `${module.background.playerSummary}\n${module.background.missionPremise}\n具体秘密与正式正文请回到本地资料查看。`,
          sourceRefs: module.background.sourceRefs,
          choices: createOfflineGmTurn(nextCampaign, trimmed).choices,
        }),
      );
      setBusy(false);
      submissionLock.current = false;
      commitTurns(nextCampaign, [playerTurn, ...extraTurns], trimmed);
      setIntent("");
      return;
    }

    if (nextCampaign.runner.mode === 'ai') {
      const pending: RunnerTurn = { ...createRunnerTurn({ type: 'system', speaker: 'AI GM', body: '正在等待主持回复。行动已保存。' }), pending: true, pendingIntent: trimmed, pendingChoice: choice };
      const turns = [playerTurn, ...extraTurns, pending];
      const requested = { ...nextCampaign, runner: { ...nextCampaign.runner, turns: [...nextCampaign.runner.turns, ...turns] } };
      commitTurns(nextCampaign, turns, trimmed);
      setIntent('');
      await requestPending(requested, pending);
      return;
    }
    let gmTurn: RunnerTurn = { ...createOfflineGmTurn(nextCampaign, trimmed), sceneTitle: nextCampaign.currentScene.title };
    if (choice?.kind==='check' && choice.checkHint) gmTurn = { ...gmTurn, checkRequest: { reason: choice.checkHint } };
    setBusy(false);
    submissionLock.current = false;
    commitTurns(nextCampaign, [playerTurn, ...extraTurns, gmTurn], trimmed);
    setIntent('');
  };

  const resetSetup = () => {
    onCampaign({
      ...campaign,
      runner: { ...campaign.runner, configured: false },
    });
  };

  const lastTurn = campaign.runner.turns[campaign.runner.turns.length - 1];
  const hasStarted = campaign.runner.turns.some(turn => turn.type === "gm");
  const drawerTitles = { character: "角色与装备", mission: "当前委托", journal: "冒险记录", background: "故事与资料", settings: "游戏设置", dice: "掷骰判定", life: "人生路径", market: "街头商店", novel: "我的夜之城小说", progress:'场景进展' };
  return (
    <section className={`game-session${drawer?' has-side-panel':''}`}>
      <header className="game-status">
        <div><span className="game-eyebrow">{module.title}</span><h2>{campaign.currentScene.title}</h2></div>
        <div className="game-vitals"><span>{campaign.character.handle}</span><HelpTip label="生命值说明" text={fieldHelp('HP')}><span className="health-value">HP {campaign.character.hp.current}/{campaign.character.hp.max}</span></HelpTip><HelpTip label="人性说明" text={fieldHelp('人性')}>人性 {campaign.character.humanity.current}</HelpTip></div>
      </header>
      <nav className="game-toolbar" aria-label="游戏工具">
        <IconButton label="场景进展" shortLabel="进展" icon={<ChevronRight size={17}/>} disabled={aiRunning} onClick={()=>setDrawer('progress')} />
        <IconButton label="角色与装备" shortLabel="角色" icon={<Shield size={17} />} onClick={() => setDrawer("character")} />
        <IconButton label={`当前委托${campaign.worldHistory?.filter(event => event.status !== 'resolved').length ? ` · ${campaign.worldHistory.filter(event => event.status !== 'resolved').length}项待结算` : ''}`} shortLabel="委托" icon={<ListChecks size={17} />} onClick={() => setDrawer("mission")} />
        <IconButton label="人生路径" shortLabel="背景与记忆" icon={<Fingerprint size={17} />} onClick={() => setDrawer("life")} disabled={busy} />
        <details className="session-more-tools" open={moreToolsOpen}><summary aria-expanded={moreToolsOpen} title="更多游戏工具" onClick={event=>{event.preventDefault();setMoreToolsOpen(value=>!value);}}><MoreHorizontal size={18}/><span>更多</span></summary>{moreToolsOpen && <div onClick={event=>{if((event.target as HTMLElement).closest('button'))setMoreToolsOpen(false);}}>
        <IconButton label="冒险记录" icon={<NotebookText size={17} />} onClick={() => setDrawer("journal")} disabled={busy} />
        <IconButton label="小说手稿" icon={<BookMarked size={17} />} onClick={() => setDrawer("novel")} disabled={busy} />
        <IconButton label="街头商店" icon={<ShoppingBag size={17} />} onClick={() => setDrawer("market")} disabled={busy} />
        <IconButton label="故事与资料" icon={<BookOpen size={17} />} onClick={() => setDrawer("background")} disabled={busy} />
        <IconButton label="游戏设置" icon={<Settings size={17} />} onClick={() => setDrawer("settings")} disabled={busy} />
        <IconButton label="另存为新存档" icon={<Archive size={17}/>} onClick={()=>onSave(true)}/>
        </div>}</details>
        <div className="session-save-actions"><IconButton label="本地保存" icon={<Save size={17} />} onClick={()=>onSave()} /><IconButton label="保存并退出" icon={<LogOut size={17} />} onClick={()=>{cancelPending();onExit();}} /></div>
      </nav>
      <div className="game-story" ref={logRef} role="log" aria-label="故事记录" aria-live="polite" aria-busy={busy}>
        <div className="scene-intro"><span className="game-eyebrow">当前目标</span><p>{campaign.currentScene.objective}</p></div>
        <details className="world-situation" aria-label="当前场景中的世界要素">
          <summary>街区动态 · 可选行动</summary>
          <div className="world-situation-title"><span className="game-eyebrow">街区脉搏 · 正在影响这一幕</span><small>RED / 2045</small></div>
          {(campaign.worldHistory ?? []).some(event => event.status !== 'resolved') && <p className="hint">有尚未确认结果的街区行动；可在「当前委托」内结算，正式影响势力、NPC 与后续故事。</p>}
          <div className="world-situation-grid">
            {sceneWorldHooks.slice(0, 2).map(hook => <article className="world-hook" key={hook.id}>
              <div className="world-hook-header"><strong>{hook.title}</strong><span>{hook.era === '2045' ? '2045 设定' : '氛围参考'}</span></div>
              <p>{hook.detail}</p>
              <button type="button" disabled={actionBlocked} onClick={() => submitIntent(hook.action, { id: hook.id, label: hook.title, intent: hook.action, kind: 'world', worldHookId: hook.id })} title={`${hook.gmUse} 来源：${hook.sourceLabel}`}>尝试：{hook.action} <ChevronRight size={13}/></button>
            </article>)}
          </div>
          <details><summary>设定依据与年代说明</summary><p>RED 2045 为规则与时间线基准；2077 资料只启发街景和互动，不视为已发生的事件。</p>{sceneWorldHooks.slice(0, 2).map(hook => <a key={hook.id} href={hook.sourceUrl} target="_blank" rel="noreferrer">{hook.sourceLabel} ↗</a>)}</details>
        </details>
        {campaign.runner.turns.filter(turn => turn.type !== "system").map(turn => <RunnerTurnCard key={turn.id} turn={turn} character={campaign.character} campaign={campaign} />)}
        {busy && <p className="gm-thinking" role="status"><span />{streamPreview ? "主持正在续写…" : "正在检索资料并请求主持回应…"}</p>}
        {busy && streamPreview && <p className="gm-stream-preview" aria-label="正在生成的主持叙述">{gmNarration(streamPreview)}</p>}
      </div>
      <footer className="game-action-dock">
        {awaitingCheck && <div className="game-error" role="status"><span>等待判定：{awaitingCheck.checkRequest!.reason}</span><button type="button" onClick={()=>setDrawer('dice')}>进行这次判定</button><button type="button" onClick={()=>commitTurns(campaign,[createRunnerTurn({type:'log',speaker:campaign.character.handle,body:'你暂缓了这项行动，重新考虑下一步。'})],'暂缓待判定行动')}>暂缓行动</button></div>}
        {failure && <div className="game-error" role="alert"><span>{failure.message.startsWith('已停止等待')?'已停止等待，行动已保留。':/429|1302|1305/.test(failure.message)?'服务繁忙或限流，行动已保留；可稍后重试或切换离线。':/504|超时/.test(failure.message)?'主持响应超时，行动已保留。':'连接中断，行动已保留。'}</span>
          <details><summary>{failure.message.startsWith('已停止等待')?'保留的行动':'错误详情'}</summary><p>{failure.message}</p></details>
          <button type="button" disabled={aiRunning||retrySeconds>0} onClick={() => resumePending()}>{retrySeconds?`${retrySeconds}秒后可重试`:'重试回应'}</button>
          <button type="button" disabled={busy} onClick={() => resumePending(true)}>切换离线</button>
        </div>}
        {unresolved && <div role="status" className="game-error"><span>{activeAiRequests.has(unresolved.id)?`行动已保留 · 已等待 ${waitSeconds} 秒`:'上次行动尚未获得回复，行动已保留。'}</span>
          {activeAiRequests.has(unresolved.id) && <button type="button" onClick={cancelPending}>停止等待</button>}
          {!activeAiRequests.has(unresolved.id) && <><button type="button" disabled={busy} onClick={() => resumePending()}>重新获取主持回复</button><button type="button" disabled={busy} onClick={() => resumePending(true)}>改用离线回应</button></>}</div>}
        {lastTurn?.type==='check' && <p role="status" className="hint">判定结果已记录。选择「交给主持继续」描述后果，无需重复掷骰。</p>}
        <form className="game-compose" onSubmit={event => { event.preventDefault(); submitIntent(intent); }}>
          <textarea aria-label="你的行动" value={intent} disabled={aiRunning} onChange={event => setIntent(event.target.value)} placeholder="输入你的行动…" rows={2}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submitIntent(intent); } }} />
          <IconButton label="提交行动" icon={<Send size={19} />} onClick={() => submitIntent(intent)} disabled={actionBlocked || !intent.trim()} variant="primary" />
        </form>
      </footer>
      <aside className="game-action-rail" aria-label="行动栏">
        <div className="action-prompt"><span>{aiRunning ? "等待主持" : failure ? "先恢复这条行动的回应" : awaitingCheck ? '先完成当前判定' : lastTurn?.type === "check" ? "判定已记录" : "你准备怎么做？"}</span>
          <button type="button" className="choice-expand" aria-expanded={actionsOpen} aria-controls="runner-action-options" onClick={()=>setActionsOpen(value=>!value)}>{actionsOpen?'收起行动栏':'展开行动栏'}</button>
          {!actionBlocked && lastTurn?.type!=='check' && hasStarted && <small className="action-count">{latestChoices.length} 项行动</small>}
          {roleGuide(campaign.character.role) && <button className="role-action" type="button" title={`${roleGuide(campaign.character.role)?.summary} 核心规则 PDF ${roleGuide(campaign.character.role)?.page}页。`} disabled={actionBlocked} onClick={() => submitIntent(`使用身份能力：${roleGuide(campaign.character.role)?.action}`)}>{roleGuide(campaign.character.role)?.ability} · {campaign.character.rank}</button>}
          <IconButton label="掷骰判定" icon={<Zap size={16} />} onClick={() => setDrawer("dice")} disabled={busy} />
        </div>
        <div id="runner-action-options" className="game-options" role="group" aria-label="可选行动" hidden={!actionsOpen}>
          {awaitingCheck || aiRunning || failure?null:lastTurn?.type === "check" ? <button type="button" disabled={aiRunning} onClick={() => submitIntent("请根据刚才记录的真实判定结果描述后果并继续。",undefined,'check')}>交给主持继续 <ChevronRight size={16} /></button> :
            !hasStarted && campaign.runner.mode === "ai" ? <button className="opening-action" type="button" disabled={aiRunning} onClick={() => submitIntent(scene.starterPrompt ?? "请介绍开场和可选行动",undefined,'opening')}><Play size={17} />让主持人开场</button> :
            (showAllChoices?latestChoices:primaryChoices).map(choice => <button key={choice.id} type="button" aria-label={choice.label} title={actionHint(choice)} disabled={actionBlocked} onClick={() => submitIntent(choice.intent, choice)}><span className="choice-copy"><small className="action-kind">{actionLabel(choice)}</small><strong>{choice.label}</strong><small>{choice.detail || choice.intent}</small></span><ChevronRight size={16} /></button>)}
        </div>
        {actionsOpen && !actionBlocked && latestChoices.length>3 && lastTurn?.type!=='check' && <button type="button" className="choice-expand" aria-expanded={showAllChoices} onClick={()=>setShowAllChoices(value=>!value)}>{showAllChoices?'收起行动':`更多行动（${latestChoices.length-3}）`}</button>}
      </aside>
      <aside ref={sidePanelRef} className="game-drawer game-side-panel" hidden={!drawer} aria-label={drawer?drawerTitles[drawer]:undefined}>
        <header><h2>{drawer ? drawerTitles[drawer] : ""}</h2><IconButton label="关闭" icon={<X size={20} />} onClick={() => setDrawer(null)} /></header>
        <div className="drawer-body">
          {drawer === "character" && <>
            <h3>{campaign.character.handle}</h3><p className="hint">{campaign.character.role} · HP {campaign.character.hp.current}/{campaign.character.hp.max} · 人性 {campaign.character.humanity.current}</p>
            <div className="play-inventory-summary"><span><small>欧币</small><strong>{campaign.character.eurobucks} eb</strong></span><span><small>生命</small><strong>{campaign.character.hp.current}/{campaign.character.hp.max}</strong></span><span><small>人性 / 共情</small><strong>{campaign.character.humanity.current} / {effectiveEmpathy(campaign.character)}</strong></span><span><small>成长点</small><strong>{campaign.character.improvementPoints}</strong></span></div>
            <h4>武器</h4>
            {campaign.character.weapons.length > 0 ? <div className="play-inventory-list">{campaign.character.weapons.map((weapon, index) => { const item = CREATION_CATALOG.find(entry => entry.name === weapon); return <div key={`${weapon}-${index}`}><HelpTip label={`${weapon}说明`} text={item?equipmentHelp(item):'手动登记物品；请依据自有资料填写属性，当前未自动结算。'}><strong>{weapon}</strong></HelpTip><small>{item?.damage ? `伤害 ${item.damage} · ROF ${item.rof}` : '尚未映射数值'}</small></div>; })}</div> : <p className="hint">尚未登记武器</p>}
            <h4>防具与装备</h4><div className="play-armor-sp"><span>头部 SP <b>{campaign.character.armor.headSp}</b></span><span>身体 SP <b>{campaign.character.armor.bodySp}</b></span></div>
            {campaign.character.gear.length?<div className="play-inventory-list">{campaign.character.gear.map((name,index)=>{const purchase=campaign.character.purchases?.find(p=>p.title===name);const item=getShopItem(purchase?.catalogId??'')??CREATION_CATALOG.find(item=>item.name===name);return <HelpTip key={`${name}-${index}`} label={`${name}说明`} text={item?equipmentHelp(item):'手动登记物品；当前不自动赋予数值效果。'}>{name}</HelpTip>;})}</div>:<p>尚未登记装备</p>}
            <div className="play-stat-grid">{(Object.keys(STAT_LABELS) as StatKey[]).map(stat => <div key={stat} title={`基础${STAT_LABELS[stat]}：${campaign.character.stats[stat]}；显示当前有效值`}><small>{STAT_LABELS[stat]}</small><strong>{stat==='emp'?effectiveEmpathy(campaign.character):equipmentStats(campaign.character)[stat]}</strong></div>)}</div>
            <details><summary>技能一览</summary><div className="play-skill-list">{RED_SKILLS.filter(skill => (campaign.character.skills.find(s => s.skillId === skill.id)?.level ?? 0) > 0).map(skill => <span key={skill.id}><SkillAnnotatedText text={skill.name} character={campaign.character}/> {campaign.character.skills.find(s => s.skillId === skill.id)?.level}</span>)}</div></details>
            <h4>义体人体图</h4><CyberwareOverview character={campaign.character} />
            <details><summary>编辑角色</summary><CharacterPanel character={campaign.character} onChange={character => onCampaign({ ...campaign, character })} /></details>
          </>}
          {drawer === "life" && <section className="life-in-play">
            <h3>{campaign.character.handle} 的人生路径</h3>
            <p className="hint">AI 记忆来自本地存档：人物背景、最近10条对话、5条最近事件、8条AI剧情摘要和12条确认进展。AI摘要只是未确认的叙事参考；重要事实请检查后加入长期记忆并保存。每轮最多发送3000字长期记忆。</p>
            <TextAreaField label="主持长期记忆（已确认线索与当前阻碍）" value={campaign.playerNotes??''} onChange={playerNotes=>onCampaign({...campaign,playerNotes})}/>
            <details><summary>已登记联系人 · {campaign.npcs.length}</summary>{campaign.npcs.map(npc=><p key={npc.id}><strong>{npc.name}</strong> · {npc.role} · {{hostile:'敌对',cold:'冷淡',neutral:'中立',warm:'友善',loyal:'忠诚'}[npc.disposition]}</p>)}<p className="hint">存档关系不代表人物当前在场或已经同意帮助。</p></details>
            <h4>最近的 AI 剧情摘要（待确认）</h4>
            {campaign.journal.filter(item=>item.type==='ai' && item.moduleId===module.id).slice(0,6).map(entry=>{
              const notes=campaign.playerNotes??'';
              const alreadySaved=notes.includes(entry.body);
              const fits=notes.length+entry.body.length+1<=3000;
              return <div className="memory-recap" key={entry.id}><p>{entry.body}</p><button type="button" disabled={alreadySaved||!fits} onClick={()=>onCampaign({...campaign,playerNotes:[notes.trim(),entry.body].filter(Boolean).join('\n')})}>{alreadySaved?'已确认':'确认加入长期记忆'}</button>{!fits&&!alreadySaved?<small>记忆已接近3000字，请先整理旧笔记。</small>:null}</div>;
            })}
            {campaign.journal.some(item=>item.type==='ai' && !item.moduleId) && <details><summary>旧版摘要（未归属剧本）</summary>{campaign.journal.filter(item=>item.type==='ai' && !item.moduleId).slice(0,6).map(entry=><p key={entry.id}>{entry.body}</p>)}</details>}
            {[["culture", "文化背景与母语"], ["personality", "性格"], ["family", "家庭"], ["motivation", "人生目标"], ["friends", "朋友"], ["enemies", "敌人"], ["romance", "情感经历"], ["role", "身份经历"]].map(([id, label]) => <div className="life-fact" key={id}><strong>{label}</strong><p>{campaign.character.backgroundDetails?.[id]?.trim() || '尚未填写'}</p></div>)}
            <h4>其他故事</h4><p style={{whiteSpace:'pre-wrap'}}>{campaign.character.lifepathNotes || '暂无补充'}</p>
            <details><summary>编辑人生路径</summary><CharacterPanel character={campaign.character} onChange={character => onCampaign({ ...campaign, character })} /></details>
          </section>}
          {drawer === "market" && <section className="market-in-play">
            <h3>街头采购 · 余额 {campaign.character.eurobucks} eb</h3>
            <p className="hint">货物是否在售取决于当前场景、货源与身份门路；目录价格不代表现场一定买得到。</p>
            <CharacterShop character={campaign.character} creation={false} onChange={character=>onCampaign(appendJournal({...campaign,character},{type:'note',title:'装备采购',body:character.purchases?.slice(-1)[0]?.title??'采购已登记'}))}/>
          </section>}
          {drawer === "novel" && <section className="novel-in-play">
            <div className="novel-toolbar"><p className="hint">自动将主持叙述整理成可编辑的章节手稿；编辑不会覆盖原始跑团日志。</p><button type="button" onClick={() => downloadText(`${campaign.character.handle}-夜之城手稿.md`, buildManuscript(campaign))}><Download size={15}/> 导出 Markdown</button></div>
            <h3>{campaign.name}</h3><p className="hint">2045 · 主角 {campaign.character.handle}</p>
            {campaign.runner.turns.filter(turn => turn.type === 'gm').length === 0 && <p>开始跑团后，每次 GM 叙事都会收录在这里。</p>}
            {campaign.runner.turns.filter(turn => turn.type === 'gm').map((turn, index) => <article className="novel-entry" key={turn.id}>
              <h4>片段 {index+1} · {turn.sceneTitle || campaign.currentScene.title}</h4>
              <textarea aria-label={`编辑小说片段${index+1}`} rows={7} value={campaign.storyEdits?.[turn.id] ?? turn.body} onChange={event => onCampaign({ ...campaign, storyEdits: { ...(campaign.storyEdits ?? {}), [turn.id]: event.target.value } })}/>
            </article>)}
          </section>}
          {drawer==='mission' && <section className="drawer-entry"><h3>当前场景目标</h3><p>{campaign.currentScene.objective}</p><label className="field"><span>当前目标状态</span><select aria-label="当前目标状态" value={campaign.currentScene.status} onChange={event=>onCampaign(appendJournal({...campaign,currentScene:{...campaign.currentScene,status:event.target.value as Campaign['currentScene']['status']}},{type:'note',title:'场景目标状态',body:`${campaign.currentScene.title}：${event.target.value==='resolved'?'已达成':event.target.value==='failed'?'未能达成':'进行中'}`}))}><option value="open">进行中</option><option value="resolved">已达成</option><option value="failed">未能达成</option></select></label><TextAreaField label="已确认线索与当前阻碍" value={campaign.playerNotes??''} onChange={playerNotes=>onCampaign({...campaign,playerNotes})}/></section>}
          {drawer === 'mission' && !!campaign.worldHistory?.length && <section className="drawer-entry"><h3>街区行动与长期后果</h3><p className="hint">先依据 GM 描述或实际骰子判定确定结果，再确认势力、NPC 和热度变化；已结算事件会影响后续 AI 主持。</p>{[...campaign.worldHistory].reverse().slice(0, 12).map(event => <WorldEventReview key={event.id} campaign={campaign} event={event} onCampaign={onCampaign} />)}</section>}
          {drawer === "mission" && campaign.missions.map(mission => <section className="drawer-entry" key={mission.id}><h3>{mission.title}</h3><p>{mission.target}</p><p className="hint">雇主：{mission.client} · 报酬：{mission.reward}</p></section>)}
          {drawer === "journal" && campaign.journal.map(entry => <details className="drawer-entry" key={entry.id}><summary>{entry.title}</summary><p style={{ whiteSpace: "pre-wrap" }}>{entry.body}</p></details>)}
          {drawer === "background" && <><ModuleBackgroundPanel module={module} /><div className="book-links"><a href="/api/local-sources/red-core-20261010/pdf" target="_blank" rel="noreferrer">核心规则书 ↗</a><a href="/api/local-sources/red-sheet-20260507/pdf" target="_blank" rel="noreferrer">原版人物卡 ↗</a><a href="/api/local-sources/red-streets-20261010/pdf" target="_blank" rel="noreferrer">街头故事 ↗</a></div></>}
          {drawer === "settings" && <>
            <label className="field"><span>主持方式</span><select aria-label="主持方式" value={campaign.runner.mode} onChange={event => updateMode(event.target.value as RunnerMode)}><option value="offline">离线主持</option><option value="ai">AI 主持</option></select></label>
            {campaign.runner.mode === "ai" && <details open={!campaign.aiSettings.apiKey.trim()}><summary>AI 连接</summary>
              <AiSettingsFields settings={campaign.aiSettings} onChange={patch=>onCampaign({...campaign,aiSettings:{...campaign.aiSettings,...patch}})} />
              <AiConnectionTest settings={campaign.aiSettings} />
              <p className="hint">相关 PDF 片段及对话将发送至所选 AI 服务。</p>
            </details>}
            <p className="hint">压力 {campaign.currentScene.pressure} · 热度 {campaign.currentScene.heat}</p>
            <IconButton label="重设参数" icon={<RefreshCw size={16} />} onClick={resetSetup} />
            <IconButton label="完整工具" icon={<Settings size={16} />} onClick={onFullMode} />
          </>}
          {drawer === 'progress' && <SceneProgressPanel key={campaign.currentScene.id} campaign={campaign} onCampaign={onCampaign} />}
          {drawer === "dice" && <CheckPanel key={awaitingCheck?.id??adviceTurn?.id??'free-check'} request={awaitingCheck?.checkRequest} suggestions={checkSuggestions} adviceText={adviceTurn?.body} campaign={campaign} onCampaign={(next,checkResult) => {
            onCampaign({ ...next, runner: { ...next.runner, turns: [...next.runner.turns, createRunnerTurn({ type: "check", speaker: "规则判定", body: next.journal[0].body,checkResult,sceneId:campaign.runner.sceneId,sceneInstanceId:campaign.currentScene.id,moduleId:campaign.runner.moduleId,sceneTitle:campaign.currentScene.title })] } });
          }} />}
        </div>
      </aside>
    </section>
  );
}

function SimpleWorkspace({
  campaign,
  onCampaign,
  onResolvePending,
  onFullMode,
  page,
  onPage,
  onSave,
  onExit,
}: {
  campaign: Campaign;
  onCampaign: (campaign: Campaign) => void;
  onFullMode: () => void;
  onResolvePending: (campaignId: string, pendingId: string, reply: RunnerTurn) => void;
  page: 'home' | 'character' | 'setup' | 'play';
  onPage: (page: 'home' | 'character' | 'setup' | 'play') => void;
  onSave: (asNew?:boolean) => void;
  onExit: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [slotError, setSlotError] = useState("");
  const [, refreshSlots] = useState(0);
  let slots: ReturnType<typeof listSaveSlots> = [];
  let readError = "";
  try { slots = listSaveSlots(); } catch { readError = "存档列表无法读取，请先导出备份，不要覆盖。"; }
  const newCharacter = (profile?:CharacterSheet) => {
    try {
      // Preserve the active story before replacing its autosave with a new character.
      if (campaign.runner.configured) saveLocalCheckpoint(campaign, `${campaign.character.handle} · 新建前备份`);
      const next = createDefaultCampaign();
      if(profile)next.character={...structuredClone(profile),id:crypto.randomUUID()};
      next.aiSettings = { ...campaign.aiSettings };
      next.packs = campaign.packs;
      clearPreparation();
      saveCampaign(next);
      onCampaign(next);
      setSlotError('');
      onPage('character');
    } catch { setSlotError('新建未完成：请先备份现有存档并检查本地存储。当前角色未被替换。'); }
  };
  const removeSlot = (id: string) => {
    try { deleteSaveSlot(id); setPendingDelete(null); setSlotError(""); refreshSlots(value => value + 1); }
    catch { setSlotError("删除未完成，本地存储不可用。"); }
  };
  const saveSummary = (saved: Campaign, name = saved.name) => {
    const progress=saved.runner.resolutions?.filter(item=>item.moduleId===saved.runner.moduleId).slice(-1)[0];
    return <><h3>{name}</h3><p>{findModule(saved.runner.moduleId).title} · {saved.currentScene.title}</p><p className="hint">{saved.character.handle} · HP {saved.character.hp.current}/{saved.character.hp.max} · {saved.runner.turns.filter(turn => turn.type === 'player').length} 次行动{saved.runner.turns.some(turn=>turn.type==='check')?` · ${saved.runner.turns.filter(turn=>turn.type==='check').length} 次判定`:''}</p>{progress&&<p className="hint">最近确认：{progress.summary.slice(0,100)}</p>}<time dateTime={saved.updatedAt}>{new Date(saved.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}</time></>;
  };
  return (
    <section className="simple-workspace">
      {page === 'home' ? <section className="game-home"><span className="game-eyebrow">NIGHT CITY / 2045</span><h2>回到夜之城</h2><p className="hint">创建你的边缘行者，或读取存档继续故事。</p>
        <IconButton label="新建角色" icon={<Plus size={17} />} variant="primary" onClick={()=>newCharacter()} />
        <CharacterProfilesPanel onLoad={newCharacter}/>
        {!campaign.runner.configured && <IconButton label="继续开局准备" icon={<Shield size={17} />} onClick={() => onPage(validateCharacter(loadPreparation(campaign).character, true).errors.length ? 'character' : 'setup')} />}
        {slots.length===0 && !campaign.runner.configured && <p className="hint">暂无游戏存档。</p>}
        <div className="save-slot-list">
          {campaign.runner.configured && <article className="save-slot"><span className="game-eyebrow">自动进度</span>{saveSummary(campaign)}<IconButton label="继续游戏" icon={<Play size={17} />} variant="primary" onClick={() => onPage('play')} /></article>}
          {slots.map(slot => <article className="save-slot" key={slot.id}><span className="game-eyebrow">手动存档</span>{saveSummary(slot.campaign, slot.name)}
            <div className="save-slot-actions"><IconButton label="读取本地存档" icon={<Archive size={17} />} onClick={() => { onCampaign(slot.campaign); onPage('play'); }} />
            <IconButton label="删除存档" icon={<Trash2 size={16} />} onClick={() => setPendingDelete(slot.id)} /></div>
            {pendingDelete === slot.id && <div className="delete-save-confirm"><p>删除这份手动存档？当前自动进度不受影响。</p><button type="button" onClick={() => removeSlot(slot.id)}>确认删除</button><button type="button" onClick={() => setPendingDelete(null)}>取消</button></div>}
          </article>)}
        </div>
        {(readError || slotError) && <p role="alert">{readError || slotError}</p>}
        {campaign.runner.configured && <IconButton label="调整开局选择" icon={<Settings size={17} />} onClick={() => onPage('setup')} />}
        <p className="hint">存档保存在当前浏览器；跨浏览器或迁移设备可使用完整工具里的备份导出。</p>
      </section> : page === 'character' ? <section className="game-setup">
        <div className="setup-heading"><span className="game-eyebrow">01 / 边缘行者</span><h2>新建角色</h2></div>
        <IconButton label="返回主界面" icon={<LogOut size={16} />} onClick={() => onPage('home')} />
        <CharacterPanel key={campaign.id} character={loadPreparation(campaign).character} creation onChange={character=>{
          try {
            const draft=loadPreparation(campaign);
            savePreparation(campaign.id,{...draft,character});
            saveCampaign({...campaign,character});
            onCampaign({...campaign,character});setSlotError('');onPage('setup');
          } catch { setSlotError('角色未能完整保存，请检查本地存储后重试。'); }
        }} />
        {slotError && <p role="alert">{slotError}</p>}
      </section> : page === 'play' && campaign.runner.configured ? <RunnerConsolePanel campaign={campaign} onCampaign={onCampaign} onResolvePending={onResolvePending} onFullMode={onFullMode} onSave={onSave} onExit={onExit} /> : <>
        <IconButton label="返回主界面" icon={<LogOut size={16} />} onClick={() => onPage('home')} />
        <CampaignSetupPanel key={campaign.id} campaign={campaign} onCampaign={next => { onCampaign(next); if (next.runner.configured) onPage('play'); }} onFullMode={onFullMode} />
      </>}
    </section>
  );
}

function CharacterPanel({
  character: initialCharacter,
  creation = false,
  onChange,
}: {
  character: CharacterSheet;
  creation?: boolean;
  onChange: (character: CharacterSheet) => void;
}) {
  const [character, setCharacter] = useState<CharacterSheet>(() => ({
    ...initialCharacter,
    skills: [...RED_SKILLS.map(skill => initialCharacter.skills.find(s => s.skillId === skill.id) ?? { skillId: skill.id, level: creation && skill.id === "culture-language" ? 4 : 0 }), ...initialCharacter.skills.filter(s => !RED_SKILLS.some(entry => entry.id === s.skillId))],
  }));
  const [saved, setSaved] = useState(false);
  const [editorTab, setEditorTab] = useState("attributes");
  const [confirmReset,setConfirmReset]=useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [purchaseTitle, setPurchaseTitle] = useState('');
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [purchaseBudget, setPurchaseBudget] = useState<'general' | 'fashion'>('general');
  const guide = roleGuide(character.role);
  const generalSpent = (character.purchases ?? []).filter(p => p.budget === 'general').reduce((sum, p) => sum + p.cost, 0);
  const fashionSpent = (character.purchases ?? []).filter(p => p.budget === 'fashion').reduce((sum, p) => sum + p.cost, 0);
  const report = validateCharacter(character, creation);
  const updateDraft = (next: CharacterSheet) => { setCharacter(next); setSaved(false); };
  const updateStat = (key: StatKey, value: string) => updateDraft(changeAttribute(character, key, Number(value), creation));

  return (
    <Panel title="角色卡" icon={<HeartPulse size={18} />}>
      <p className="character-mode">{creation ? "完整定制 / 基础建卡" : "战役角色 / 状态维护"}</p>
      {creation && <div className="character-budget"><HelpTip text="完整定制总计62属性点，每项基础属性2–8。重置会回到每项2，保留技能、装备、义体与资金。" label="属性点说明"><strong>属性 {report.attributePoints}/62</strong></HelpTip><strong>技能 {report.skillPoints}/86</strong><IconButton label="重置属性点" icon={<RefreshCw size={16}/>} onClick={()=>setConfirmReset(true)}/><IconButton label="补齐未分配点数" icon={<Plus size={16} />} onClick={() => updateDraft(fillCreationPoints(character))} /></div>}
      {creation && confirmReset && <div role="group" aria-label="确认重置属性"><p>将所有基础属性重置为2（已用20点，剩余42点可分配）。HP和人性会按保留的义体重新计算；技能、身份、人生路径、装备和资金不变。</p><button type="button" onClick={()=>{updateDraft(resetCreationAttributes(character));setEditorTab('attributes');setConfirmReset(false);}}>确认重置属性</button><button type="button" onClick={()=>setConfirmReset(false)}>取消重置</button></div>}
      <details className="character-rule-note"><summary>规则依据与校验范围</summary><p className="hint">{creation ? "属性 62 点、技能 86 点。街头鼠辈和快速建卡不套用这套点数。" : "维护模式不套用初始点数。属性修改保留已受伤害，不自动回满。"} 装备价格、义体前置条件和人性上限损失尚需对照原书，本页不代表所有特殊能力已审核。</p><a href="/api/local-sources/red-core-20261010/pdf#page=78" target="_blank" rel="noreferrer">核心规则 · PDF 78–80、90、104–105、142 页 ↗</a></details>
      <nav className="workspace-tabs" aria-label="角色编辑分页">
        {[["attributes", "身份与属性"], ["ability", "身份能力"], ["skills", "技能分配"], ["funds", "装备商店"], ["cyberware", "义体人体图"], ["lifepath", "人生路径"]].map(([id, title]) => <button type="button" key={id} aria-pressed={editorTab === id} className={editorTab === id ? "active" : ""} onClick={() => setEditorTab(id)}>{title}</button>)}
      </nav>
      <section hidden={editorTab !== "attributes"} aria-label="身份与属性">
      <div className="form-grid two">
        <Field label="代号" value={character.handle} onChange={(handle) => updateDraft({ ...character, handle })} />
        <label className="field"><span>年龄 <HelpTip label="年龄与规则说明" text="可留空；用于角色时间线、称呼与背景叙述。未启用任何自制年龄或性别属性修正；正式属性仍按建卡规则分配。年龄不是等级，也不自动增加技能或人生经历。"/></span><input aria-label="年龄" type="number" min={1} step={1} value={character.age??''} onChange={event=>{const age=Number(event.target.value);if(event.target.value==='' || (Number.isSafeInteger(age)&&age>0))updateDraft({...character,age:event.target.value===''?undefined:age});}}/></label>
        <label className="field"><span>性别 <HelpTip label="性别与叙述说明" text="影响角色称呼与指代，结合你保存的人生路径参与叙述；不自动改变属性、技能、身份能力或正式剧情，也不预设性格和感情关系。"/></span><select aria-label="性别" value={character.gender??'unspecified'} onChange={event=>updateDraft(changeCharacterGender(character,event.target.value as NonNullable<CharacterSheet['gender']>))}>{Object.entries(GENDER_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <Field label="称谓偏好" value={character.pronouns??''} onChange={pronouns=>updateDraft({...character,pronouns:pronouns.slice(0,80)})}/>
        <label className="field">
          <span>身份 <RuleHint text={fieldHelp('身份')} /></span>
          <select aria-label="身份" value={character.role} onChange={(event) => updateDraft({ ...character, role: event.target.value, roleAllocations: {} })}>
            {cyberpunkRedRuleset.roles.map((role) => (
              <option key={role} value={role} title={`${roleGuide(role)?.ability}：${roleGuide(role)?.summary} 核心规则 PDF ${roleGuide(role)?.page}页。`}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="身份等级"
          type="number"
          value={character.rank}
          min={1}
          max={10}
          onChange={(rank) => updateDraft({ ...character, rank: Number(rank) || 1 })}
        />
        <Field
          label="欧币"
          type="number"
          value={character.eurobucks}
          onChange={(eurobucks) => updateDraft({ ...character, eurobucks: Number(eurobucks) || 0 })}
        />
      </div>

      <div className="stat-grid">
        {(Object.keys(STAT_LABELS) as StatKey[]).map((stat) => (
          <Field
            key={stat}
            label={STAT_LABELS[stat]}
            type="number"
            min={creation ? 2 : 0}
            max={creation ? 8 : undefined}
            value={character.stats[stat]}
            onChange={(value) => updateStat(stat, value)}
          />
        ))}
      </div>

      <div className="vital-grid">
        <div>
          <span>HP <RuleHint text={fieldHelp('HP')}/></span>
          <strong>
            {character.hp.current}/{character.hp.max}
          </strong>
          <small>重伤阈值 {character.hp.seriouslyWoundedAt}</small>
        </div>
        <div>
          <span>人性 <HelpTip label="人性说明" text={fieldHelp('人性')}/></span>
          <strong>
            {character.humanity.current}/{character.humanity.max}
          </strong>
          <small>基础共情 {character.stats.emp} · 当前有效共情 {effectiveEmpathy(character)}</small>
        </div>
        <div>
          <span>护甲 <RuleHint text={fieldHelp('护甲')}/></span>
          <strong>
            头 {character.armor.headSp} / 身 {character.armor.bodySp}
          </strong>
          <small>SP 记录</small>
        </div>
      </div>

      <div className="form-grid two">
        <Field
          label="当前 HP"
          type="number"
          value={character.hp.current}
          onChange={(value) =>
            updateDraft({ ...character, hp: { ...character.hp, current: Number(value) || 0 } })
          }
        />
        <Field
          label="当前人性"
          type="number"
          value={character.humanity.current}
          onChange={(value) =>
            updateDraft({ ...character, humanity: { ...character.humanity, current: Number(value) || 0 } })
          }
        />
        <Field
          label="头部 SP"
          type="number"
          value={character.armor.headSp}
          onChange={(value) =>
            updateDraft({ ...character, armor: { ...character.armor, headSp: Number(value) || 0 } })
          }
        />
        <Field
          label="身体 SP"
          type="number"
          value={character.armor.bodySp}
          onChange={(value) =>
            updateDraft({ ...character, armor: { ...character.armor, bodySp: Number(value) || 0 } })
          }
        />
      </div>

      </section>
      <section hidden={editorTab !== 'ability'} aria-label="身份能力">
        <h3>{character.role} · {guide?.ability} {character.rank}</h3>
        <p>{guide?.summary}</p><p className="hint">身份等级指专属能力的等级，不是通用人物等级；基础建卡默认4级，不会统一加到所有技能上。</p>
        <a href={`/api/local-sources/red-core-20261010/pdf#page=${guide?.page ?? 142}`} target="_blank" rel="noreferrer">官方依据 · PDF {guide?.page ?? 142} 页 ↗</a>
        {character.role === '网行者' && <p>交互界面每回合网络动作：{character.rank >= 10 ? 5 : character.rank >= 7 ? 4 : character.rank >= 4 ? 3 : 2}。设备、距离、节点与黑冰仍按网行规则处理。</p>}
        {ROLE_ALLOCATION_FIELDS[character.role] && <><h4>专长点数分配</h4><div className="form-grid two">{ROLE_ALLOCATION_FIELDS[character.role].map(([id, name]) => <Field key={id} label={`${name}（投入点数）`} type="number" min={0} max={character.rank} value={character.roleAllocations?.[id] ?? 0} onChange={value => updateDraft({ ...character, roleAllocations: { ...character.roleAllocations, [id]: Number(value) } })} />)}</div></>}
        <p className="hint">佣兵分配总点数不超过身份等级；技工分配2×等级且每项不超过等级；技医总分配等于等级。具体生效条件请悬停字段或查原文。</p>
        <p className="hint">判定台自动计入游民驾驶/载具技术、中间人交易、已分配的佣兵觉察/精准攻击与技工普通技术加值。其余能力、伤害效果、团队/载具选择及多重身份由主持按原文确认，未自动结算。</p>
      </section>
      <section hidden={editorTab !== 'funds'} aria-label="资金购置">
        <h3>欧币余额：{character.eurobucks} eb</h3>
        <p className="hint">{creation ? `通用预算2550eb：已登记支出 ${generalSpent}，现金 ${character.eurobucks}。时装专项800eb：已用 ${fashionSpent}，可用 ${Math.max(0, 800 - fashionSpent)}。专项未花完部分作废。` : '战役现金没有2550eb总上限；所有支出须有足够余额。初始时装专项不作为战役现金。'}</p>
        <a href="/api/local-sources/red-core-20261010/pdf#page=104" target="_blank" rel="noreferrer">购置与免费时装 · PDF 104–105页 ↗</a>
        <CharacterShop character={character} creation={creation} onChange={updateDraft} />
        <details className="manual-purchase"><summary>自定义支出（未收录商品）</summary>
        <p className="hint">仅登记金额和名称，不自动更新武器、义体及护甲属性。</p>
        <div className="form-grid two"><Field label="购置名称" value={purchaseTitle} onChange={setPurchaseTitle} /><Field label="支出金额" value={purchaseCost} type="number" min={0} onChange={value => setPurchaseCost(Number(value))} />
        {creation && <label className="field"><span>资金来源 <RuleHint text="通用资金2550eb；800eb专项仅用于时装或时尚赛博组件，不能转作现金。核心规则PDF104–105页。" /></span><select value={purchaseBudget} onChange={event => setPurchaseBudget(event.target.value as 'general' | 'fashion')}><option value="general">通用资金</option><option value="fashion">时装专项</option></select></label>}</div>
        <IconButton label="登记支出" icon={<Plus size={16} />} disabled={!purchaseTitle.trim() || !Number.isInteger(purchaseCost) || purchaseCost < 0 || (purchaseBudget === 'general' || !creation ? purchaseCost > character.eurobucks : fashionSpent + purchaseCost > 800)} onClick={() => {
          const budget = creation ? purchaseBudget : 'general';
          updateDraft({ ...character, eurobucks: character.eurobucks - (budget === 'general' ? purchaseCost : 0), purchases: [...character.purchases ?? [], { id: crypto.randomUUID(), title: purchaseTitle.trim(), cost: purchaseCost, budget }] });
          setPurchaseTitle(''); setPurchaseCost(0);
        }} />
        <p className="hint">按原书价格登记，登记支出不会自动创建武器属性或义体效果；时装专项的物品资格仍需核对原文。</p>
        </details>
      </section>
      <section hidden={editorTab !== "cyberware"} aria-label="义体人体图"><CyberwarePanel character={character} creation={creation} onChange={updateDraft} /></section>
      <section hidden={editorTab !== "skills"} className="character-skills" aria-label="技能分配">
        <div className="skill-search"><label className="field"><span>搜索技能</span><input type="search" value={skillSearch} onChange={event => setSkillSearch(event.target.value)} placeholder="名称或属性" /></label><label className="switch"><input type="checkbox" checked={requiredOnly} onChange={event => setRequiredOnly(event.target.checked)} />只看必修</label></div>
        <p className="hint">必修技能至少 2 级；文化背景语言免费 4 级。专门语言、科学领域与本地专家地区请写入备注。</p>
        {RED_SKILLS.filter(skill => (!requiredOnly || REQUIRED_SKILLS.includes(skill.id)) && (!skillSearch || `${skill.name} ${STAT_LABELS[skill.linkedStat]}`.includes(skillSearch.trim()))).map(skill => {
          const level = character.skills.find(s => s.skillId === skill.id)?.level ?? 0;
          return <label className="skill-editor-row" key={skill.id} title={`${skill.name}：关联${STAT_LABELS[skill.linkedStat]}，初始最高6级，×${skill.multiplier ?? 1}计费；文化背景语言免费4级。核心规则PDF81–90页。`}><span><SkillAnnotatedText text={skill.name} character={character}/>{REQUIRED_SKILLS.includes(skill.id) ? " · 必修" : ""}{skill.multiplier === 2 ? " · ×2" : ""}</span><input aria-label={skill.name + "等级"} type="number" min={creation && REQUIRED_SKILLS.includes(skill.id) ? 2 : 0} max={creation ? 6 : 10} disabled={creation && skill.id === "culture-language"} value={level} onChange={event => updateDraft({ ...character, skills: character.skills.map(s => s.skillId === skill.id ? { ...s, level: Number(event.target.value) } : s) })} /><small>基准 {(skill.linkedStat === "emp" ? effectiveEmpathy(character) : character.stats[skill.linkedStat]) + level}</small></label>;
        })}
      </section>
      <section hidden={editorTab !== "lifepath"} aria-label="人生路径">
        <p className="hint">已填写的背景会交给 AI 主持参考，影响相关人物对话、动机与选择，不自动赋予成功或数值加成。</p>
        <div className="form-grid two">{[["culture", "文化背景与母语"], ["personality", "性格与处事方式"], ["appearance", "外观与个人风格"], ["values", "看重的人与事"], ["family", "家庭与成长环境"], ["motivation", "目标与人生追求"], ["friends", "朋友与联系人"], ["enemies", "敌人与恩怨"], ["romance", "情感经历"], ["role", "身份经历与专长"]].map(([key, label]) => <TextAreaField key={key} label={label} value={character.backgroundDetails?.[key] ?? ""} onChange={value => updateDraft({ ...character, backgroundDetails: { ...character.backgroundDetails, [key]: value } })} />)}</div>
      <TextAreaField
        label="生命路径与备注"
        value={character.lifepathNotes}
        onChange={(lifepathNotes) => updateDraft({ ...character, lifepathNotes })}
      />
      </section>
      <footer className="character-save-bar">
      {report.errors.length > 0 && <details className="character-errors"><summary>还有 {report.errors.length} 项需要处理</summary><ul>{report.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></details>}
      <IconButton label="保存角色" icon={<Save size={16} />} variant="primary" disabled={report.errors.length > 0} onClick={() => { onChange(character); setSaved(true); }} />
      {saved && <p role="status">角色已保存。</p>}
      </footer>
      {creation&&<CharacterProfilesPanel character={character} canSave={report.errors.length===0} onLoad={loaded=>updateDraft({...loaded,id:character.id})}/>}
    </Panel>
  );
}

function CheckPanel({ campaign, onCampaign, request,suggestions=[],adviceText }: { campaign: Campaign; onCampaign: (campaign: Campaign,checkResult?:RunnerTurn['checkResult']) => void; request?:RunnerTurn['checkRequest'];suggestions?:CheckSuggestion[];adviceText?:string }) {
  const initial=request ?? (suggestions.length===1?suggestions[0]:undefined);
  const [applied,setApplied]=useState(initial);
  const [adviceOptions,setAdviceOptions]=useState(suggestions);
  const [selectedAdvice,setSelectedAdvice]=useState(suggestions.length===1?'0':'');
  const dirty=useRef(false);
  const dvDirty=useRef(false);
  const manualSkill=useRef(false);
  const [lookupRevision,setLookupRevision]=useState(0);
  const [sourceNotice,setSourceNotice]=useState('');
  const [skillId, setSkillId] = useState(RED_SKILLS.some(skill=>skill.id===initial?.skillId)?initial!.skillId!:"perception");
  const [skillOverride,setSkillOverride]=useState<string|null>(null);
  const [statOverride,setStatOverride]=useState<string|null>(null);
  const [modifier, setModifier] = useState(initial?.modifier??0);
  const [dv, setDv] = useState(initial?.dv===undefined?'':String(initial.dv));
  const [condition,setCondition]=useState<'standard'|'visual'|'auditory'>(initial?.condition??'standard');
  const [useTools,setUseTools]=useState(false);
  const [result, setResult] = useState<string>("尚未掷骰");
  const applySuggestion=(suggestion:CheckSuggestion,manual=true)=>{
    dvDirty.current=false;manualSkill.current=false;
    dirty.current=manual;setApplied(suggestion);setSkillId(suggestion.skillId??'perception');setSkillOverride(null);setStatOverride(null);setDv(suggestion.dv===undefined?'':String(suggestion.dv));setModifier(suggestion.modifier??0);setCondition(suggestion.condition??'standard');setUseTools(false);
  };
  useEffect(()=>{
    if(request?.dv!==undefined && !manualSkill.current)return;
    if(!request && suggestions.length && suggestions.every(s=>s.dv!==undefined) && !manualSkill.current)return;
    if(!request && !suggestions.length && !manualSkill.current && !lookupRevision){setSourceNotice('自由判定尚未指定行动依据；可选择技能后手动填写，或点击匹配本场景 DV。');return;}
    if(!request && !suggestions.length && campaign.runner.turns.slice(-1)[0]?.type==='check' && !manualSkill.current && !lookupRevision)return;
    const controller=new AbortController();
    const scene=findScene(findModule(campaign.runner.moduleId),campaign.runner.sceneId);
    const selected=manualSkill.current?{skillId,reason:`${scene.title}的${RED_SKILLS.find(s=>s.id===skillId)?.name}判定`}:request??(selectedAdvice!==''?suggestions[Number(selectedAdvice)]:suggestions.length===0?{skillId,reason:`${scene.title}的${RED_SKILLS.find(s=>s.id===skillId)?.name}判定`}:undefined);
    setSourceNotice('正在核对当前场景的 DV 来源…');
    retrieveLocalSources(`${scene.title} ${RED_SKILLS.find(s=>s.id===skillId)?.name} ${adviceText??request?.reason??''}`,campaign.runner.moduleId,undefined,undefined,controller.signal,campaign.runner.sceneId).then(passages=>{
      if(controller.signal.aborted) return;
      const verified=suggestions.map(item=>inferSourcedCheck(item,passages,scene.title));
      setAdviceOptions(verified);
      const found=selected?inferSourcedCheck(selected,passages,scene.title):undefined;
      if(found?.dv!==undefined){
        setApplied(found);
        if(!dvDirty.current)setDv(String(found.dv));
        setSourceNotice(dvDirty.current?`已保留手动 DV；原文候选 DV ${found.dv}（PDF ${found.sourcePage} 页）。`:`已匹配原文 DV ${found.dv} · PDF ${found.sourcePage} 页；进入条件仍以原文为准。`);
      }else setSourceNotice(selected?'当前技能未找到唯一且对应本场景的 DV，可手动填写。':'请选择一项判定建议，再核对其 DV。');
    }).catch(()=>{if(!controller.signal.aborted)setSourceNotice('本机资料暂不可用，未自动猜测 DV；可手动填写。');});
    return()=>controller.abort();
  },[adviceText,campaign.runner.moduleId,campaign.runner.sceneId,skillId,selectedAdvice,lookupRevision]);
  const skill = RED_SKILLS.find((entry) => entry.id === skillId) ?? RED_SKILLS[0];
  const stat = skill.linkedStat;
  const sheetLevel=campaign.character.skills.find(entry => entry.skillId === skill.id)?.level ?? 0;
  const skillLevel=skillOverride===null?sheetLevel:Number(skillOverride);
  const sheetStatValue = stat === 'emp' ? effectiveEmpathy(campaign.character) : equipmentStats(campaign.character)[stat];
  const statValue=statOverride===null?sheetStatValue:Number(statOverride);
  const validStat=(statOverride===null || statOverride.trim()!=='') && Number.isSafeInteger(statValue) && statValue>=0;
  const abilityBonus = roleSkillBonus(campaign.character, skill.id);
  const savedModifier=campaign.character.skills.find(entry=>entry.skillId===skill.id)?.modifier??0;
  const wound=woundPenalty(campaign.character);
  const equipment=equipmentBonuses(campaign.character,skill.id,condition,useTools);
  const validDv=dv.trim()!=='' && Number.isInteger(Number(dv)) && Number(dv)>0 && Number(dv)<=99;
  const validLevel=(skillOverride===null || skillOverride.trim()!=='') && Number.isInteger(skillLevel) && skillLevel>=0 && skillLevel<=10;

  const roll = () => {
    if(!validDv || !validLevel || !validStat || !Number.isInteger(modifier)) return;
    const ignoreCriticalFailure=campaign.character.role==='佣兵' && campaign.character.roleAllocations?.recovery===4 && RED_ATTACK_SKILLS.includes(skill.id);
    const check = cyberpunkRedRuleset.rollCheck({
      stat: statValue,
      skill: skillLevel,
      modifier: modifier + abilityBonus + savedModifier + equipment.total - wound,
      dv:Number(dv),
      ignoreCriticalFailure,
    });
    const critical = ignoreCriticalFailure && check.firstDie===1 ? '失手挽回：按1计算，不扣追加骰' : check.critical === "success" ? "掷出10，追加骰" : check.critical === "failure" ? "掷出1，扣除追加骰" : "普通";
    const line = `${statValue!==sheetStatValue?`本次临时属性值 ${statValue}（人物卡有效值 ${sheetStatValue}，未改写角色）；`:""}${applied?`行动：${applied.reason}；`:''}${skillLevel!==sheetLevel?`本次临时技能等级 ${skillLevel}（人物卡 ${sheetLevel}，未改写角色）；`:''}${STAT_LABELS[stat]} ${statValue} + ${skill.name} ${skillLevel} + 身份加值 ${abilityBonus} + 已存技能修正 ${savedModifier} + 装备加值 ${equipment.total}${equipment.sources.length?`（${equipment.sources.map(s=>`${s.name} PDF${s.page}`).join('、')}）`:''} + 修正 ${modifier} - 伤势惩罚 ${wound}，1d10=${check.firstDie}${check.extraDie ? ` / 追加=${check.extraDie}` : ""}，总计 ${check.total}，DV ${dv}，${check.success ? "成功" : "失败"}（必须严格超过DV），差值 ${check.margin}，${critical}`;
    setResult(line);
    onCampaign(
      appendJournal(campaign, {
        type: "note",
        title: "判定",
        body: line,
      }),
      {skillName:skill.name,total:check.total,dv:Number(dv),success:check.success===true},
    );
  };

  return (
    <Panel title="判定台" icon={<Zap size={18} />}>
      {adviceOptions.length>0 && <label className="field"><span>主持判定建议</span><select aria-label="主持判定建议" value={selectedAdvice} onChange={event=>{setSelectedAdvice(event.target.value);if(event.target.value!=='')applySuggestion(adviceOptions[Number(event.target.value)]);}}><option value="">手动选择技能</option>{adviceOptions.map((suggestion,index)=><option key={`${suggestion.skillId}-${index}`} value={index}>{RED_SKILLS.find(skill=>skill.id===suggestion.skillId)?.name??'待确认技能'}{suggestion.dv?` · DV ${suggestion.dv}`:' · DV待确认'}</option>)}</select></label>}
      {applied && <div className="check-prefill"><p><SkillAnnotatedText text={applied.reason} character={campaign.character}/>{applied.sourcePage?` · 来源 PDF ${applied.sourcePage} 页`:''}</p><button type="button" onClick={()=>applySuggestion(selectedAdvice!==''?adviceOptions[Number(selectedAdvice)]??applied:applied)}>重新带入建议</button></div>}
      <div className="form-grid two">
        <label className="field">
          <span>属性 <HelpTip label="关联属性说明" text="关联属性由所选技能确定，当前数值读取人物卡并计入适用的护甲惩罚；选择其他技能会同步切换属性，避免主持建议填错。"/></span>
          <select aria-label="属性" value={stat} disabled>
            {(Object.keys(STAT_LABELS) as StatKey[]).map((key) => (
              <option key={key} value={key}>
                {STAT_LABELS[key]}{key===stat?` · 当前 ${statValue}`:''}
              </option>
            ))}
          </select>
        </label>
        <Field label="本次属性值" type="number" min={0} value={statOverride??sheetStatValue} onChange={value=>{dirty.current=true;setStatOverride(value);}}/>
        <label className="field">
          <span>技能 · <SkillAnnotatedText text={skill.name} character={campaign.character}/></span>
          <select aria-label="技能" value={skillId} onChange={(event) => {dirty.current=true;manualSkill.current=true;dvDirty.current=false;setSkillId(event.target.value);setSkillOverride(null);setStatOverride(null);setDv('');setSelectedAdvice('');setApplied(undefined);}}>
            {RED_SKILLS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.multiplier === 2 ? " (x2)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field"><span>本次技能等级 <HelpTip label="本次技能等级说明" text="默认读取人物卡。手动修改只用于本次判定，不改写角色；临时调整会记入判定日志。"/></span><input aria-label="本次技能等级" type="number" min={0} max={10} value={skillOverride??String(sheetLevel)} onChange={event=>{dirty.current=true;setSkillOverride(event.target.value);}}/><small>人物卡：{sheetLevel} 级</small></label>
      <p className="hint">{roleGuide(campaign.character.role)?.ability}：身份加值 +{abilityBonus} · 已存技能修正 {savedModifier} · 伤势惩罚 -{wound}。护甲惩罚已计入属性；额外条件写入修正，勿重复扣除。</p>
        <Field label="修正" type="number" value={modifier} onChange={(value) => {dirty.current=true;setModifier(Number(value) || 0);}} />
        <label className="field"><span>检定情境</span><select aria-label="检定情境" value={condition} onChange={event=>{dirty.current=true;setCondition(event.target.value as typeof condition);}}><option value="standard">一般</option><option value="visual">视觉</option><option value="auditory">听觉</option></select></label>
        <label className="switch"><input type="checkbox" checked={useTools} onChange={event=>{dirty.current=true;setUseTools(event.target.checked);}}/>本次使用随身工具辅助</label>
        <p className="hint">装备加值 +{equipment.total}{equipment.sources.length?`：${equipment.sources.map(s=>`${s.name}（PDF${s.page}）`).join('、')}`:'，未启用适用装备效果'}。已计入的加值不要再填入修正。</p>
        <Field label="DV" type="number" value={dv} onChange={value=>{dirty.current=true;dvDirty.current=true;setDv(value);}} />
        <button type="button" onClick={()=>setLookupRevision(value=>value+1)}>匹配本场景 DV</button>
        {sourceNotice&&<p className="hint">{sourceNotice}</p>}
        {!validDv && <p className="hint">尚未确认目标DV，请依据当前场景或规则填写。</p>}
        {!validLevel && <p className="hint">本次技能等级需为 0–10 的整数。</p>}
        <p className="check-formula" aria-label="判定公式">{STAT_LABELS[stat]} {statValue} + {skill.name} {skillLevel} + 综合修正 {modifier+abilityBonus+savedModifier+equipment.total-wound} + 1d10 → {validDv?`必须大于 DV ${dv}`:'待确认 DV'}</p>
        {applied?.dv!==undefined && dv!==String(applied.dv) && <p className="hint">正在使用手动 DV {dv||'（未填写）'}；来源候选为 {applied.dv}。不会自动覆盖。</p>}
        <IconButton label="掷骰" icon={<Play size={16} />} onClick={roll} variant="primary" disabled={!validDv||!validLevel||!validStat||!Number.isInteger(modifier)} />
      </div>
      <p className="result-line">{result}</p>
      <p className="hint">具体 DV、技能 x2 成本、战斗例外和装备修正以你导入的正版资料为准。</p>
    </Panel>
  );
}

function ScenePanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const scene = campaign.currentScene;
  const update = (patch: Partial<typeof scene>) => onCampaign({ ...campaign, currentScene: { ...scene, ...patch } });
  return (
    <Panel title="当前场景" icon={<NotebookText size={18} />}>
      <div className="form-grid two">
        <Field label="标题" value={scene.title} onChange={(title) => update({ title })} />
        <Field label="地点" value={scene.location} onChange={(location) => update({ location })} />
        <Field
          label="压力"
          type="number"
          value={scene.pressure}
          min={0}
          max={6}
          onChange={(pressure) => update({ pressure: Number(pressure) || 0 })}
        />
        <Field
          label="热度"
          type="number"
          value={scene.heat}
          min={0}
          max={6}
          onChange={(heat) => update({ heat: Number(heat) || 0 })}
        />
      </div>
      <TextAreaField label="目标" value={scene.objective} onChange={(objective) => update({ objective })} />
      <TextAreaField
        label="悬而未决的问题"
        value={scene.threads.join("\n")}
        onChange={(threads) =>
          update({
            threads: threads
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean),
          })
        }
      />
    </Panel>
  );
}

function OraclePanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const [question, setQuestion] = useState("这个线索是真的吗？");
  const [odds, setOdds] = useState<OracleRoll["odds"]>("even");

  const ask = () => {
    const roll = oracleAnswer(question, odds);
    onCampaign(
      appendJournal(
        {
          ...campaign,
          oracleHistory: [roll, ...campaign.oracleHistory],
        },
        {
          type: "oracle",
          title: `预言机：${answerLabel(roll.answer)}`,
          body: `${roll.question}\n概率：${ODDS_LABELS[roll.odds]}，1d10=${roll.die}${roll.twist ? `\n转折：${roll.twist}` : ""}`,
        },
      ),
    );
  };

  return (
    <Panel title="单人预言机" icon={<BrainCircuit size={18} />}>
      <div className="form-grid two">
        <Field label="问题" value={question} onChange={setQuestion} />
        <label className="field">
          <span>概率</span>
          <select value={odds} onChange={(event) => setOdds(event.target.value as OracleRoll["odds"])}>
            {Object.entries(ODDS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <IconButton label="询问" icon={<ChevronRight size={16} />} onClick={ask} variant="primary" />
      <div className="oracle-list">
        {campaign.oracleHistory.slice(0, 5).map((roll) => (
          <article key={roll.id} className={`oracle-card ${answerTone[roll.answer]}`}>
            <strong>{answerLabel(roll.answer)}</strong>
            <span>{roll.question}</span>
            <small>
              {ODDS_LABELS[roll.odds]} · 1d10={roll.die}
              {roll.twist ? ` · ${roll.twist}` : ""}
            </small>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function CombatPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const combat = campaign.combat;
  const [enemyName,setEnemyName]=useState('');
  const [enemyHp,setEnemyHp]=useState('');
  const [enemyRef,setEnemyRef]=useState('');
  const [enemySource,setEnemySource]=useState('');
  const [enemyHead,setEnemyHead]=useState('');
  const [enemyBody,setEnemyBody]=useState('');
  const [enemySetup,setEnemySetup]=useState(false);
  const validEnemy=enemyName.trim() && enemySource.trim() && enemyHp.trim()!=='' && Number.isInteger(Number(enemyHp)) && Number(enemyHp)>0 && [enemyRef,enemyHead,enemyBody].every(value=>value.trim()!=='' && Number.isInteger(Number(value)) && Number(value)>=0);
  const addCombatant = (side: Combatant["side"]) => {
    if(side==='player' && combat.combatants.some(item=>item.side==='player'))return;
    if(side==='enemy' && !validEnemy)return;
    const next: Combatant = {
      id: crypto.randomUUID(),
      name: side === "enemy" ? enemyName.trim() : campaign.character.handle,
      side,
      initiative: Math.floor(Math.random() * 10) + 1 + (side==='player'?equipmentStats(campaign.character).ref+(campaign.character.role==='佣兵'?(campaign.character.roleAllocations?.initiative??0):0):Number(enemyRef)),
      hpCurrent: side === "player" ? campaign.character.hp.current : Number(enemyHp),
      hpMax: side === "player" ? campaign.character.hp.max : Number(enemyHp),
      headSp: side === "player" ? campaign.character.armor.headSp : Number(enemyHead),
      bodySp: side === "player" ? campaign.character.armor.bodySp : Number(enemyBody),
      notes: side==='enemy'?`来源：${enemySource.trim()}`:'先攻已计入有效反应与佣兵先攻反应；其他临时及装备效果须按实际条件调整。',
      active: true,
    };
    onCampaign({
      ...campaign,
      combat: {
        ...combat,
        active: true,
        combatants: [...combat.combatants, next].sort((a, b) => b.initiative - a.initiative),
      },
    });
    if(side==='enemy')setEnemySetup(false);
  };

  const updateCombatant = (id: string, patch: Partial<Combatant>) => {
    const currentId=combat.combatants[combat.turnIndex]?.id;
    const combatants=combat.combatants.map(entry=>entry.id===id?{...entry,...patch}:entry).sort((a,b)=>b.initiative-a.initiative);
    onCampaign({
      ...campaign,
      combat: {
        ...combat,
        combatants,turnIndex:Math.max(0,combatants.findIndex(entry=>entry.id===currentId)),
      },
    });
  };

  const nextTurn = () => {
    const nextIndex = combat.combatants.length ? (combat.turnIndex + 1) % combat.combatants.length : 0;
    onCampaign({
      ...campaign,
      combat: {
        ...combat,
        round: nextIndex === 0 ? combat.round + 1 : combat.round,
        turnIndex: nextIndex,
      },
    });
  };

  return (
    <Panel
      title="战斗追踪"
      icon={<Swords size={18} />}
      actions={
        <div className="button-row">
          <IconButton label="玩家" icon={<Plus size={16} />} disabled={combat.combatants.some(item=>item.side==='player')} onClick={() => addCombatant("player")} />
          <IconButton label="敌人" shortLabel={validEnemy?'加入敌人':'登记敌人'} icon={<Skull size={16} />} onClick={() => validEnemy?addCombatant("enemy"):setEnemySetup(true)} />
          <IconButton label="下一回合" icon={<ChevronRight size={16} />} disabled={!combat.combatants.length} onClick={nextTurn} />
        </div>
      }
    >
      <div className="combat-status">
        <span>第 {combat.round} 轮</span>
        <span>{combat.active ? "进行中" : "未开始"}</span>
      </div>
      <div className="combat-list">
        {combat.combatants.map((combatant, index) => (
          <article key={combatant.id} className={`combatant ${index === combat.turnIndex ? "current" : ""}`}>
            <div>
              <strong>{combatant.name}</strong>
              <small>
                {combatant.side} · 先攻 {combatant.initiative}
              </small>
            </div>
            <input
              aria-label={`${combatant.name} HP`}
              type="number"
              value={combatant.hpCurrent}
              min={0} max={combatant.hpMax}
              onChange={(event) => onCampaign(updateTrackedHp(campaign,combatant.id,Number(event.target.value)))}
            />
            <span>
              / {combatant.hpMax} HP · SP {combatant.headSp}/{combatant.bodySp}
            </span>
            <Field label={`${combatant.name}先攻`} type="number" value={combatant.initiative} onChange={value=>{if(Number.isInteger(Number(value)))updateCombatant(combatant.id,{initiative:Number(value)});}}/>
            <small>{combatant.notes}</small>
          </article>
        ))}
      </div>
      <details open={enemySetup} onToggle={event=>setEnemySetup(event.currentTarget.open)}><summary>敌人原文数值</summary><div className="form-grid two"><Field label="敌人名称" value={enemyName} onChange={setEnemyName}/><Field label="敌人最大 HP" type="number" min={1} value={enemyHp} onChange={setEnemyHp}/><Field label="敌人反应" type="number" min={0} value={enemyRef} onChange={setEnemyRef}/><Field label="敌人头部 SP" type="number" min={0} value={enemyHead} onChange={setEnemyHead}/><Field label="敌人身体 SP" type="number" min={0} value={enemyBody} onChange={setEnemyBody}/><Field label="敌人来源页或条目" value={enemySource} onChange={setEnemySource}/></div><IconButton label="按原文数值加入敌人" icon={<Plus size={16}/>} disabled={!validEnemy} onClick={()=>addCombatant('enemy')}/></details>
      <p className="hint">这里是状态追踪器，不替代正式规则中的攻击、护甲、伤害和重伤条目。</p>
    </Panel>
  );
}

function NetrunPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const netrun = campaign.netrun;
  const update = (patch: Partial<typeof netrun>) => onCampaign({ ...campaign, netrun: { ...netrun, ...patch } });
  return (
    <Panel title="Netrunning" icon={<Shield size={18} />}>
      <div className="form-grid two">
        <Field
          label="层级"
          type="number"
          min={1}
          value={netrun.floor}
          onChange={(floor) => update({ floor: Number(floor) || 1 })}
        />
        <Field
          label="警报"
          type="number"
          min={0}
          value={netrun.alarms}
          onChange={(alarms) => update({ alarms: Number(alarms) || 0 })}
        />
      </div>
      <TextAreaField label="目标" value={netrun.objective} onChange={(objective) => update({ objective })} />
      <TextAreaField
        label="Black ICE / 节点"
        value={netrun.blackIce.join("\n")}
        onChange={(blackIce) =>
          update({
            blackIce: blackIce
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean),
          })
        }
      />
      <TextAreaField label="笔记" value={netrun.notes} onChange={(notes) => update({ notes })} />
    </Panel>
  );
}

function ImportPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const [preview, setPreview] = useState<ReturnType<typeof parseDataPackJson> | null>(null);
  const [rawImport, setRawImport] = useState("");

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawImport(text);
    setPreview(file.name.toLowerCase().endsWith(".md") ? parseMarkdownAsPack(text, file.name) : parseDataPackJson(text));
  };

  const importPreview = () => {
    if (!preview?.ok || !preview.pack) return;
    onCampaign(
      appendJournal(
        {
          ...campaign,
          packs: mergePacks(campaign.packs, preview.pack),
        },
        {
          type: "import",
          title: `导入资料包：${preview.pack.manifest.name}`,
          body: `条目 ${preview.pack.entries.length} 个，随机表 ${preview.pack.randomTables?.length ?? 0} 个。`,
        },
      ),
    );
    setPreview(null);
    setRawImport("");
  };

  return (
    <Panel
      title="资料导入"
      icon={<Import size={18} />}
      actions={
        <IconButton
          label="模板"
          icon={<FileJson size={16} />}
          onClick={() =>
            downloadText("cyberpunk-red-datapack-template.json", JSON.stringify(dataPackTemplate, null, 2))
          }
        />
      }
    >
      <label className="drop-zone">
        <Upload size={24} />
        <span>选择 JSON 资料包或 Markdown 笔记</span>
        <input type="file" accept=".json,.md,.markdown,application/json,text/markdown" onChange={handleFile} />
      </label>
      <textarea
        className="import-text"
        placeholder="也可以直接粘贴 JSON 资料包，然后点击预览。"
        value={rawImport}
        onChange={(event) => setRawImport(event.target.value)}
      />
      <div className="button-row">
        <IconButton label="预览" icon={<Search size={16} />} onClick={() => setPreview(parseDataPackJson(rawImport))} />
        <IconButton label="确认导入" icon={<CheckCircle2 size={16} />} onClick={importPreview} variant="primary" disabled={!preview?.ok} />
      </div>
      {preview && (
        <div className={`import-preview ${preview.ok ? "ok" : "bad"}`}>
          <strong>{preview.ok ? "资料包可导入" : "资料包有错误"}</strong>
          {preview.pack && (
            <p>
              {preview.pack.manifest.name} · {preview.pack.entries.length} 条目 ·{" "}
              {preview.pack.randomTables?.length ?? 0} 随机表
            </p>
          )}
          {[...preview.errors, ...preview.warnings].map((message) => (
            <small key={message}>{message}</small>
          ))}
        </div>
      )}
      <div className="pack-list">
        {campaign.packs.map((pack) => (
          <article key={pack.manifest.id}>
            <div>
              <strong>{pack.manifest.name}</strong>
              <small>
                {pack.manifest.licenseStatus} · {pack.entries.length} 条目
              </small>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={pack.enabled ?? true}
                onChange={(event) =>
                  onCampaign({
                    ...campaign,
                    packs: campaign.packs.map((entry) =>
                      entry.manifest.id === pack.manifest.id ? { ...entry, enabled: event.target.checked } : entry,
                    ),
                  })
                }
              />
              <span>启用</span>
            </label>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function LibraryPanel({ campaign }: { campaign: Campaign }) {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => {
    const all = campaign.packs.filter((pack) => pack.enabled ?? true).flatMap((pack) => pack.entries);
    const normalized = query.trim().toLowerCase();
    if (!normalized) return all;
    return all.filter((entry) =>
      [entry.title, entry.category, entry.body, entry.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [campaign.packs, query]);

  return (
    <Panel title="资料库" icon={<Database size={18} />}>
      <label className="search-box">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索条目、标签、分类" />
      </label>
      <div className="library-list">
        {entries.map((entry: DataEntry) => (
          <article key={`${entry.packId}:${entry.id}`} className="library-entry">
            <div className="entry-head">
              <strong>{entry.title}</strong>
              <span>{entry.category}</span>
            </div>
            <p>{entry.body}</p>
            <small>
              {entry.source} · {entry.licenseStatus}
            </small>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function FactionPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  return (
    <Panel title="阵营时钟" icon={<RefreshCw size={18} />}>
      <div className="clock-list">
        {campaign.factions.map((faction) => (
          <article key={faction.id} className="clock-card">
            <div>
              <strong>{faction.name}</strong>
              <small>{faction.goal}</small>
            </div>
            <input
              type="range"
              min={0}
              max={faction.segments}
              value={faction.progress}
              onChange={(event) =>
                onCampaign({
                  ...campaign,
                  factions: campaign.factions.map((entry) =>
                    entry.id === faction.id ? { ...entry, progress: Number(event.target.value) } : entry,
                  ),
                })
              }
            />
            <span>
              {faction.progress}/{faction.segments} · {faction.attitude}
            </span>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function MissionPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const updateMission = (id: string, patch: Partial<Campaign["missions"][number]>) => {
    onCampaign({
      ...campaign,
      missions: campaign.missions.map((mission) => (mission.id === id ? { ...mission, ...patch } : mission)),
    });
  };

  const addMission = () => {
    onCampaign({
      ...campaign,
      missions: [
        {
          id: crypto.randomUUID(),
          title: "新委托",
          client: "未确认",
          target: "未确认",
          reward: "待谈",
          complication: "有一方在隐瞒真实目标。",
          status: "offered",
        },
        ...campaign.missions,
      ],
    });
  };

  return (
    <Panel
      title="委托"
      icon={<Settings size={18} />}
      actions={<IconButton label="新增" icon={<Plus size={16} />} onClick={addMission} />}
    >
      <div className="mission-list">
        {campaign.missions.map((mission) => (
          <article key={mission.id} className="mission-card">
            <div className="form-grid two">
              <Field label="标题" value={mission.title} onChange={(title) => updateMission(mission.id, { title })} />
              <label className="field">
                <span>状态</span>
                <select
                  value={mission.status}
                  onChange={(event) =>
                    updateMission(mission.id, {
                      status: event.target.value as Campaign["missions"][number]["status"],
                    })
                  }
                >
                  <option value="offered">offered</option>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                  <option value="burned">burned</option>
                </select>
              </label>
              <Field label="雇主" value={mission.client} onChange={(client) => updateMission(mission.id, { client })} />
              <Field label="目标" value={mission.target} onChange={(target) => updateMission(mission.id, { target })} />
              <Field label="报酬" value={mission.reward} onChange={(reward) => updateMission(mission.id, { reward })} />
            </div>
            <TextAreaField
              label="麻烦"
              value={mission.complication}
              onChange={(complication) => updateMission(mission.id, { complication })}
            />
          </article>
        ))}
      </div>
    </Panel>
  );
}

function AiPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const [intent, setIntent] = useState("根据当前场景给我三个下一步选择。");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("AI 未调用。");

  const updateSettings = (patch: Partial<typeof campaign.aiSettings>) => {
    onCampaign({ ...campaign, aiSettings: { ...campaign.aiSettings, ...patch } });
  };

  const askAi = async () => {
    setBusy(true);
    const result = await generateGmResponse(campaign, intent);
    setBusy(false);
    setMessage(result.text);
    onCampaign(
      appendJournal(campaign, {
        type: "ai",
        title: result.ok ? "AI GM" : "AI GM 降级",
        body: result.text,
      }),
    );
  };

  return (
    <Panel title="AI GM" icon={<Bot size={18} />}>
      <label className="switch large">
        <input
          type="checkbox"
          checked={campaign.aiSettings.enabled}
          onChange={(event) => updateSettings({ enabled: event.target.checked })}
        />
        <span>启用可选 AI 模式</span>
      </label>
      <AiSettingsFields settings={campaign.aiSettings} onChange={updateSettings} />
      <TextAreaField label="玩家意图" value={intent} onChange={setIntent} />
      <AiConnectionTest settings={campaign.aiSettings} />
      <IconButton label={busy ? "生成中" : "询问 AI"} icon={<Bot size={16} />} onClick={askAi} disabled={busy} variant="primary" />
      <p className="result-line">{message}</p>
    </Panel>
  );
}

function JournalPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const [note, setNote] = useState("");
  const addNote = () => {
    if (!note.trim()) return;
    onCampaign(appendJournal(campaign, { type: "note", title: "手动记录", body: note.trim() }));
    setNote("");
  };

  return (
    <Panel title="日志" icon={<NotebookText size={18} />}>
      <TextAreaField label="新记录" value={note} onChange={setNote} />
      <IconButton label="写入" icon={<Save size={16} />} onClick={addNote} variant="primary" />
      <div className="journal-list">
        {campaign.journal.slice(0, 12).map((entry) => (
          <article key={entry.id}>
            <div>
              <strong>{entry.title}</strong>
              <span>{entry.type}</span>
            </div>
            <p>{entry.body}</p>
            <small>{new Date(entry.createdAt).toLocaleString()}</small>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function BackupPanel({ campaign, onCampaign }: { campaign: Campaign; onCampaign: (campaign: Campaign) => void }) {
  const [raw, setRaw] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    try {
      saveLocalCheckpoint(campaign, `重置前备份 · ${campaign.character.handle}`);
      onCampaign(createDefaultCampaign());
      setConfirmReset(false);
      setResetError('');
    } catch { setResetError('无法创建重置前备份，已取消重置。请先导出战役 JSON。'); }
  };
  const restore = () => {
    try {
      onCampaign(importCampaign(raw));
      setRaw("");
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Panel title="备份" icon={<FileInput size={18} />}>
      <div className="button-row">
        <IconButton
          label="导出战役"
          icon={<Download size={16} />}
          onClick={() => downloadText("cyberpunk-red-campaign.json", exportCampaign(campaign))}
        />
        <IconButton
          label="重置"
          icon={<RefreshCw size={16} />}
          onClick={reset}
          variant="danger"
        />
      </div>
      {confirmReset && <div className="delete-save-confirm" role="alert"><p>即将重置「{campaign.name}」，当前进度会被新战役替换；系统将先建立本地快照。</p>
        <button type="button" onClick={reset}>确认重置并备份</button><button type="button" onClick={() => setConfirmReset(false)}>取消</button></div>}
      {resetError && <p role="alert">{resetError}</p>}
      <textarea
        className="import-text"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        placeholder="粘贴战役 JSON 备份"
      />
      <IconButton label="导入战役" icon={<Upload size={16} />} onClick={restore} />
    </Panel>
  );
}

export function App() {
  const [startup] = useState(() => {
    try { return { campaign: loadCampaign(), invalidRaw: null as string | null, error: '' }; }
    catch (error) { return { campaign: createDefaultCampaign(), invalidRaw: rawCampaignBackup(), error: error instanceof Error ? error.message : String(error) }; }
  });
  const [campaign, setCampaign] = useState<Campaign>(startup.campaign);
  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;
  const [invalidRaw, setInvalidRaw] = useState(startup.invalidRaw);
  const [recoveryError, setRecoveryError] = useState(startup.error);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("run");
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const [simplePage, setSimplePage] = useState<'home' | 'character' | 'setup' | 'play'>('home');
  const [saveNotice, setSaveNotice] = useState('');
  const [storageError, setStorageError] = useState('');
  const [savedAt,setSavedAt]=useState('');

  useEffect(() => {
    if (invalidRaw !== null) return; // Never overwrite an unreadable campaign automatically.
    try { saveCampaign(campaign); setStorageError('');setSavedAt(new Date().toLocaleTimeString('zh-CN',{hour12:false})); }
    catch { setStorageError('自动保存失败：本地存储不可用或已满，请在完整工具中导出备份。'); }
  }, [campaign, invalidRaw]);

  useEffect(() => {
    saveViewMode(viewMode);
  }, [viewMode]);

  const updateCampaign = (next: Campaign) => {
    const previous=campaignRef.current;
    const changed=next.id===previous.id && next.character.id===previous.character.id && (next.character.hp.current!==previous.character.hp.current || next.character.hp.max!==previous.character.hp.max || next.character.armor.headSp!==previous.character.armor.headSp || next.character.armor.bodySp!==previous.character.armor.bodySp);
    const updated = { ...next, combat:changed?{...next.combat,combatants:next.combat.combatants.map(entry=>entry.side==='player'?{...entry,hpCurrent:next.character.hp.current,hpMax:next.character.hp.max,headSp:next.character.armor.headSp,bodySp:next.character.armor.bodySp}:entry)}:next.combat, updatedAt: new Date().toISOString() };
    campaignRef.current = updated;
    // Persist pending player actions synchronously before starting the AI request.
    if (updated.runner.turns.some(turn => turn.pending)) {
      try { saveCampaign(updated); }
      catch { setStorageError('待处理行动未能写入本地存储，请立即导出备份。'); }
    }
    setCampaign(updated);
  };
  const resolvePending = (campaignId: string, pendingId: string, reply: RunnerTurn) => {
    const latest = campaignRef.current;
    if (latest.id !== campaignId || !latest.runner.turns.some(turn => turn.id === pendingId && (turn.pending || turn.responseState === 'failed'))) return;
    const updated: Campaign = { ...latest, runner: { ...latest.runner,
      turns: latest.runner.turns.map(turn => turn.id === pendingId ? reply : turn) } };
    const withRecap = reply.type==='gm' && reply.logSummary?.trim()
      ? appendJournal(updated,{type:'ai',title:'AI剧情摘要（待确认）',body:reply.logSummary.trim().slice(0,280),moduleId:reply.moduleId??latest.runner.moduleId,sceneId:reply.sceneId??latest.runner.sceneId}) : updated;
    updateCampaign(withRecap);
    try { saveCampaign(withRecap); } catch { setStorageError('AI 回复已显示但保存失败，请立即导出备份。'); }
  };
  const manualSave = (exit = false,asNew=false) => {
    try {
      const saved = saveCurrentCheckpoint(campaignRef.current,asNew);
      saveCampaign(saved);
      campaignRef.current=saved;
      setCampaign(saved);
      setSaveNotice(asNew?'已另存为新的本地存档。':'战役已保存到本机。');
      setStorageError('');
      if (exit) { setSimplePage('home'); setViewMode('simple'); }
    } catch { setStorageError('本地保存失败，尚未退出游戏。请导出备份后重试。'); }
  };
  useEffect(() => {
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);
  const switchMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "full") {
      setActiveTab("run");
    }
  };

  if (invalidRaw !== null) {
    return <main className="app-shell" style={{maxWidth: 760, margin: '4rem auto'}}>
      <Panel title="存档恢复模式" icon={<Shield size={18}/> }>
        <p role="alert">检测到本地自动存档无法读取：{recoveryError}。为了保护原始数据，已暂停自动保存，不会自动新建战役覆盖它。</p>
        <div className="button-row">
          <IconButton label="导出原始存档" icon={<Download size={16}/>} onClick={() => downloadText('cyberpunk-damaged-save.json', invalidRaw)} />
          <IconButton label="尝试载入最近手动存档" icon={<Archive size={16}/>} onClick={() => {
            try { const slots = listSaveSlots(); if (!slots.length) throw new Error('没有可恢复的手动存档。');
              const restored = slots[0].campaign; saveCampaign(restored); updateCampaign(restored); setInvalidRaw(null);
            } catch (error) { setRecoveryError(error instanceof Error ? error.message : String(error)); }
          }} />
        </div>
        <p>建议先导出原始数据，再尝试恢复手动存档。如确实不需要旧进度，可明确选择新建。</p>
        {confirmDiscard ? <div className="delete-save-confirm" role="alert"><p>这将丢弃损坏的自动存档（手动存档仍保留）。确认继续？</p>
          <button type="button" onClick={() => { clearCorruptedCampaign(); setInvalidRaw(null); updateCampaign(createDefaultCampaign()); }}>确认丢弃并新建</button>
          <button type="button" onClick={() => setConfirmDiscard(false)}>取消</button></div>
          : <IconButton label="丢弃损坏自动存档并新建" icon={<RefreshCw size={16}/>} onClick={() => setConfirmDiscard(true)} variant="danger"/>}
      </Panel>
    </main>;
  }
  return (
    <main className={`app-shell ${viewMode === "simple" ? "game-shell" : ""}`}>
      <header className="topbar">
        <div>
          <p>Cyberpunk RED Solo Runner</p>
          <h1>{campaign.name}</h1>
        </div>
        <div className="topbar-actions">
          <div className="mode-switch" role="group" aria-label="界面模式">
            <button
              type="button"
              className={viewMode === "simple" ? "active" : ""}
              onClick={() => switchMode("simple")}
            >
              简化
            </button>
            <button
              type="button"
              className={viewMode === "full" ? "active" : ""}
              onClick={() => switchMode("full")}
            >
              完整
            </button>
          </div>
          <a href="https://talsorianstore.com/" target="_blank" rel="noreferrer">
            官方资料入口
          </a>
          <span className="autosave-status" aria-label="存档状态" title={savedAt?`最近写入本地：${savedAt}`:undefined}>{invalidRaw!==null?'存档保护中':storageError?'保存失败':savedAt?'已自动保存':'尚未保存'}</span>
        </div>
      </header>

      {storageError ? <p className="save-notice error" role="alert">{storageError}</p> : saveNotice ? <p className="save-notice" role="status">{saveNotice}</p> : null}

      {viewMode === "full" ? (
        <section className="dashboard-band">
          <div className="status-tile red">
            <span>角色</span>
            <strong>{campaign.character.handle}</strong>
            <small>
              {campaign.character.role} · 身份等级 {campaign.character.rank}
            </small>
          </div>
          <div className="status-tile yellow">
            <span>场景压力</span>
            <strong>{campaign.currentScene.pressure}</strong>
            <small>热度 {campaign.currentScene.heat}</small>
          </div>
          <div className="status-tile green">
            <span>资料包</span>
            <strong>{campaign.packs.length}</strong>
            <small>{campaign.packs.filter((pack) => pack.enabled ?? true).length} 个启用</small>
          </div>
          <div className="status-tile blue">
            <span>AI GM</span>
            <strong>{campaign.aiSettings.enabled ? "ON" : "OFF"}</strong>
            <small>{campaign.aiSettings.model}</small>
          </div>
        </section>
      ) : null}

      {viewMode === "simple" ? (
        <SimpleWorkspace campaign={campaign} onCampaign={updateCampaign} onResolvePending={resolvePending} onFullMode={() => switchMode("full")} page={simplePage} onPage={setSimplePage} onSave={asNew => manualSave(false,asNew)} onExit={() => manualSave(true)} />
      ) : (
        <>
          <nav className="tab-nav" aria-label="工作区">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "run" && (
            <section className="workspace-grid">
              <div className="column wide">
                {campaign.runner.configured ? (
                  <RunnerConsolePanel campaign={campaign} onCampaign={updateCampaign} onResolvePending={resolvePending} onFullMode={() => switchMode("full")} onSave={asNew => manualSave(false,asNew)} onExit={() => manualSave(true)} />
                ) : (
                  <CampaignSetupPanel campaign={campaign} onCampaign={updateCampaign} onFullMode={() => switchMode("full")} />
                )}
                <ScenePanel campaign={campaign} onCampaign={updateCampaign} />
                <OraclePanel campaign={campaign} onCampaign={updateCampaign} />
                <CheckPanel campaign={campaign} onCampaign={updateCampaign} />
                <CombatPanel campaign={campaign} onCampaign={updateCampaign} />
                <NetrunPanel campaign={campaign} onCampaign={updateCampaign} />
              </div>
              <div className="column">
                <MissionPanel campaign={campaign} onCampaign={updateCampaign} />
                <FactionPanel campaign={campaign} onCampaign={updateCampaign} />
                <JournalPanel campaign={campaign} onCampaign={updateCampaign} />
              </div>
            </section>
          )}

          {activeTab === "character" && (
            <section className="single-workspace">
              <CharacterPanel
                character={campaign.character}
                onChange={(character) => updateCampaign({ ...campaign, character })}
              />
            </section>
          )}

          {activeTab === "sources" && (
            <section className="workspace-grid">
              <div className="column wide">
                <SourceManagerPanel />
              </div>
              <div className="column">
                <SourceLedger />
              </div>
            </section>
          )}

          {activeTab === "modules" && (
            <section className="workspace-grid">
              <div className="column wide">
                <ModuleRunnerPanel campaign={campaign} onCampaign={updateCampaign} />
              </div>
              <div className="column">
                <ScenePanel campaign={campaign} onCampaign={updateCampaign} />
                <JournalPanel campaign={campaign} onCampaign={updateCampaign} />
              </div>
            </section>
          )}

          {activeTab === "library" && (
            <section className="workspace-grid">
              <div className="column wide">
                <LibraryPanel campaign={campaign} />
              </div>
              <div className="column">
                <ImportPanel campaign={campaign} onCampaign={updateCampaign} />
              </div>
            </section>
          )}

          {activeTab === "settings" && (
            <section className="workspace-grid">
              <div className="column wide">
                <AiPanel campaign={campaign} onCampaign={updateCampaign} />
              </div>
              <div className="column">
                <BackupPanel campaign={campaign} onCampaign={updateCampaign} />
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
