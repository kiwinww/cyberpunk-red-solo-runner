export type RulesetId = "cyberpunk-red";

export type LicenseStatus =
  | "official-link"
  | "user-owned"
  | "public-preview"
  | "index-only"
  | "unknown"
  | "homebrew";

export type ImportStatus = "index-only" | "ready" | "imported" | "needs-review";

export type DataCategory =
  | "rules-reference"
  | "role"
  | "skill"
  | "weapon"
  | "armor"
  | "gear"
  | "cyberware"
  | "netrunning"
  | "npc"
  | "enemy-template"
  | "mission"
  | "location"
  | "faction"
  | "random-table"
  | "module"
  | "map"
  | "character-sheet"
  | "source";

export type StatKey =
  | "int"
  | "ref"
  | "dex"
  | "tech"
  | "cool"
  | "will"
  | "luck"
  | "move"
  | "body"
  | "emp";

export type SkillCategory =
  | "awareness"
  | "body"
  | "control"
  | "education"
  | "fighting"
  | "performance"
  | "ranged"
  | "social"
  | "technique";

export interface SourceEntry {
  id: string;
  title: string;
  sourceUrl?: string;
  localPath?: string;
  licenseStatus: LicenseStatus;
  note: string;
  addedAt: string;
}

export interface OnlineSource {
  id: string;
  title: string;
  category: DataCategory | "errata" | "policy" | "store";
  sourceUrl: string;
  licenseStatus: LicenseStatus;
  official: boolean;
  summary: string;
  checkedAt: string;
}

export interface SourceAsset {
  id: string;
  title: string;
  kind: string;
  fileType: string;
  localPath?: string;
  relativePath?: string;
  archivePath?: string;
  entryName?: string;
  sizeBytes: number;
  modifiedAt?: string;
  licenseStatus?: LicenseStatus;
  importStatus?: ImportStatus;
  pageCount?: number | null;
  outlineLines?: string[];
  parser?: string;
  parseWarning?: string;
  assets?: SourceAsset[];
}

export interface LocalSourceManifest {
  schemaVersion: number;
  generatedAt: string;
  root: string;
  ruleset: RulesetId;
  ownershipNote: string;
  assets: SourceAsset[];
}

export interface PageRef {
  sourceId: string;
  label: string;
  page?: number;
  note?: string;
}

export interface MapAsset {
  id: string;
  title: string;
  sourceAssetId: string;
  entryName?: string;
}

export type ModuleScenePhase = "intro" | "investigation" | "access" | "escalation" | "finale" | "aftermath";

export type SpoilerLevel = "player" | "gm-index";

export interface ModuleBackground {
  playerNotes?: string[];
  playerSummary: string;
  openingHook: string;
  missionPremise: string;
  sourceRefs: PageRef[];
  gmNotes?: string[];
}

export interface ModuleScene {
  id: string;
  title: string;
  moduleId: string;
  phase: ModuleScenePhase;
  spoilerLevel: SpoilerLevel;
  location: string;
  objective: string;
  pressure: number;
  heat: number;
  pageRefs: PageRef[];
  maps: MapAsset[];
  npcBlocks: string[];
  nextSceneIds?: string[];
  starterPrompt?: string;
  gmSecret?: string;
}

export interface ModuleSource {
  id: string;
  title: string;
  sourceAssetId: string;
  licenseStatus: LicenseStatus;
  summary: string;
  background: ModuleBackground;
  starterSceneId: string;
  playTimeHint: string;
  sourceRefs: PageRef[];
  scenes: ModuleScene[];
  maps: MapAsset[];
}

export interface BeginnerGuideState {
  selectedModuleId: string;
  toolsExpanded: boolean;
  backgroundOpen: boolean;
}

export type RunnerMode = "ai" | "offline";

export type RunnerChoiceKind =
  | "investigate"
  | "talk"
  | "sneak"
  | "fight"
  | "oracle"
  | "check"
  | "scene"
  | "background"
  | "world"
  | "note";

export interface CampaignSettings {
  selectedModuleId: string;
  starterSceneId: string;
  difficulty: "easy" | "standard" | "hard";
  pace: "slow" | "standard" | "fast";
  combatFrequency: "low" | "medium" | "high";
  netrunningEnabled: boolean;
  spoilerLevel: SpoilerLevel;
  runnerMode: RunnerMode;
  enabledPackIds: string[];
}

export interface RunnerChoice {
  id: string;
  label: string;
  detail?: string;
  intent: string;
  kind: RunnerChoiceKind;
  targetSceneId?: string;
  checkHint?: string;
  worldHookId?: string;
}

export interface RunnerTurn {
  id: string;
  type: "system" | "player" | "gm" | "oracle" | "check" | "log";
  speaker: string;
  body: string;
  choices?: RunnerChoice[];
  checkRequest?: {
    stat?: StatKey;
    skillId?: string;
    dv?: number;
    reason: string;
    sourcePage?: number;
    modifier?: number;
    condition?: 'standard' | 'visual' | 'auditory';
  };
  checkSuggestions?: NonNullable<RunnerTurn['checkRequest']>[];
  checkResult?: { skillName:string; total:number; dv:number; success:boolean };
  sourceRefs?: PageRef[];
  /** AI-authored recap: narrative reference only until the player confirms it. */
  logSummary?: string;
  createdAt: string;
  sceneTitle?: string;
  sceneId?: string;
  sceneInstanceId?: string;
  moduleId?: string;
  retryAt?: number;
  /** Persisted while waiting for the GM; replaced by the real result. */
  pending?: boolean;
  pendingIntent?: string;
  responseState?: 'failed';
  pendingChoice?: RunnerChoice;
}

export interface RunnerState {
  configured: boolean;
  moduleId: string;
  sceneId: string;
  mode: RunnerMode;
  turns: RunnerTurn[];
  resolutions?: Array<{ moduleId: string; sceneId: string; sceneInstanceId?:string; summary: string; outcome: 'success' | 'failure' | 'mixed' | 'no-check'; createdAt: string }>;
}

export interface DataEntry {
  id: string;
  title: string;
  category: DataCategory;
  tags: string[];
  body: string;
  source: string;
  sourceUrl?: string;
  licenseStatus: LicenseStatus;
  ruleset: RulesetId;
  packId: string;
  schemaVersion: number;
  metadata?: Record<string, unknown>;
}

export interface RandomTableEntry {
  range: string;
  result: string;
  tags?: string[];
}

export interface RandomTable {
  id: string;
  title: string;
  category: DataCategory;
  dice: string;
  entries: RandomTableEntry[];
  source: string;
  packId: string;
}

export interface DataPackManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  ruleset: RulesetId;
  schemaVersion: number;
  language: string;
  sourceUrl?: string;
  ownershipNote: string;
  licenseStatus: LicenseStatus;
  categories: DataCategory[];
  importedAt?: string;
}

export interface DataPack {
  manifest: DataPackManifest;
  entries: DataEntry[];
  randomTables?: RandomTable[];
  enabled?: boolean;
}

export interface SkillEntry {
  id: string;
  name: string;
  category: SkillCategory;
  linkedStat: StatKey;
  multiplier?: 1 | 2;
  sourceEntryId?: string;
}

export interface StatBlock {
  int: number;
  ref: number;
  dex: number;
  tech: number;
  cool: number;
  will: number;
  luck: number;
  move: number;
  body: number;
  emp: number;
}

export interface CharacterSkill {
  skillId: string;
  level: number;
  modifier?: number;
}

export type CyberSlot = "neural" | "leftEye" | "rightEye" | "audio" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg" | "internal" | "external" | "fashion" | "borg";

export interface CharacterSheet {
  age?: number;
  gender?: 'unspecified' | 'male' | 'female' | 'nonbinary';
  pronouns?: string;
  roleAllocations?: Record<string, number>;
  purchases?: Array<{ id: string; title: string; cost: number; budget: 'general' | 'fashion'; catalogId?: string; slot?: CyberSlot; humanityLoss?: number; groupId?: string }>;
  cyberwareInstallations?: Array<{ purchaseId: string; catalogId: string; slot: CyberSlot; humanityLoss: number }>;
  armorPurchaseBaseline?: { headSp: number; bodySp: number };
  id: string;
  handle: string;
  role: string;
  rank: number;
  stats: StatBlock;
  hp: {
    current: number;
    max: number;
    seriouslyWoundedAt: number;
    deathSave: number;
  };
  humanity: {
    current: number;
    max: number;
  };
  armor: {
    headSp: number;
    bodySp: number;
  };
  skills: CharacterSkill[];
  weapons: string[];
  cyberware: string[];
  gear: string[];
  eurobucks: number;
  improvementPoints: number;
  lifepathNotes: string;
  backgroundDetails?: Record<string, string>;
  notes: string;
}

export interface OracleRoll {
  id: string;
  question: string;
  odds: "unlikely" | "even" | "likely";
  die: number;
  answer: "no-and" | "no" | "no-but" | "yes-but" | "yes" | "yes-and";
  twist?: string;
  createdAt: string;
}

export interface Scene {
  id: string;
  title: string;
  objective: string;
  location: string;
  pressure: number;
  heat: number;
  threads: string[];
  status: "open" | "resolved" | "failed";
}

export interface FactionClock {
  id: string;
  name: string;
  goal: string;
  segments: number;
  progress: number;
  attitude: "hostile" | "wary" | "neutral" | "useful" | "allied";
}

export interface Npc {
  id: string;
  name: string;
  role: string;
  want: string;
  leverage: string;
  disposition: "hostile" | "cold" | "neutral" | "warm" | "loyal";
  sourceEntryId?: string;
}

export interface Mission {
  id: string;
  title: string;
  client: string;
  target: string;
  reward: string;
  complication: string;
  status: "offered" | "active" | "completed" | "burned";
}

export interface Combatant {
  id: string;
  name: string;
  side: "player" | "ally" | "enemy" | "neutral";
  initiative: number;
  hpCurrent: number;
  hpMax: number;
  headSp: number;
  bodySp: number;
  notes: string;
  active: boolean;
}

export interface CombatState {
  active: boolean;
  round: number;
  turnIndex: number;
  combatants: Combatant[];
}

export interface NetrunState {
  active: boolean;
  floor: number;
  objective: string;
  alarms: number;
  blackIce: string[];
  notes: string;
}

export interface JournalEntry {
  moduleId?: string;
  sceneId?: string;
  id: string;
  type: "scene" | "oracle" | "combat" | "netrunning" | "import" | "ai" | "note";
  title: string;
  body: string;
  createdAt: string;
}

export interface AiSettings {
  enabled: boolean;
  apiBase: string;
  model: string;
  apiKey: string;
  fastMode?: boolean;
}

/** GM-reviewed world event; the player confirms the outcome before permanent effects. */
export type WorldOutcome = "progress" | "complication" | "setback";
export interface WorldImpact {
  factionId?: string;
  factionAttitudeDelta?: -1 | 0 | 1;
  factionClockDelta?: -1 | 0 | 1;
  npcId?: string;
  npcDispositionDelta?: -1 | 0 | 1;
  heatDelta?: -1 | 0 | 1;
}
export interface WorldActionRecord {
  id: string;
  hookId: string;
  sceneId: string;
  sceneTitle: string;
  action: string;
  createdAt: string;
  /** Absent means pending, for compatibility with saves from the previous version. */
  status?: "pending" | "resolved";
  outcome?: WorldOutcome;
  consequence?: string;
  resolvedAt?: string;
  impact?: WorldImpact;
}

export interface Campaign {
  id: string;
  activeSaveSlotId?: string;
  playerNotes?: string;
  name: string;
  ruleset: RulesetId;
  createdAt: string;
  updatedAt: string;
  settings: CampaignSettings;
  character: CharacterSheet;
  currentScene: Scene;
  missions: Mission[];
  factions: FactionClock[];
  npcs: Npc[];
  combat: CombatState;
  netrun: NetrunState;
  oracleHistory: OracleRoll[];
  journal: JournalEntry[];
  packs: DataPack[];
  aiSettings: AiSettings;
  runner: RunnerState;
  /** Optional author edits; base GM/player transcript is retained for replay. */
  storyEdits?: Record<string, string>;
  worldHistory?: WorldActionRecord[];
}

export interface RedCheckInput {
  ignoreCriticalFailure?: boolean;
  stat: number;
  skill: number;
  modifier?: number;
  dv?: number;
}

export interface RedCheckResult {
  firstDie: number;
  extraDie?: number;
  total: number;
  critical: "success" | "failure" | "none";
  margin?: number;
  success?: boolean;
}

export interface RedRuleset {
  id: RulesetId;
  title: string;
  officialSourceUrl: string;
  sourceNotice: string;
  roles: string[];
  skills: SkillEntry[];
  rollCheck(input: RedCheckInput): RedCheckResult;
  createBlankCharacter(): CharacterSheet;
  deriveHp(stats: StatBlock): CharacterSheet["hp"];
  deriveHumanity(stats: StatBlock): CharacterSheet["humanity"];
}
