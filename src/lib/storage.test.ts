import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultCampaign } from "./state";
import { exportCampaign, importCampaign, loadCampaign, loadLocalCheckpoint, saveLocalCheckpoint, saveCurrentCheckpoint, saveCampaign, loadPreparation, savePreparation, clearPreparation, listSaveSlots, deleteSaveSlot } from "./storage";

const STORAGE_KEY = "cyberpunk-red-solo-runner:v1";

describe("campaign storage migration", () => {
  it('roundtrips scoped and unscoped recap journals without assigning legacy stories',()=>{
    const c=createDefaultCampaign();
    c.journal=[{id:'new',type:'ai',title:'recap',body:'current',createdAt:'',moduleId:'streets-3',sceneId:'streets-3-intro'},{id:'legacy',type:'ai',title:'old recap',body:'old',createdAt:''}];
    const loaded=importCampaign(exportCampaign(c));
    expect(loaded.journal).toEqual(c.journal);
    expect(loaded.journal[1].moduleId).toBeUndefined();
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("fills campaign settings and runner state for old local saves", () => {
    const oldSave = createDefaultCampaign() as unknown as Record<string, unknown>;
    delete oldSave.settings;
    delete oldSave.runner;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(oldSave));
    const loaded = loadCampaign();

    expect(loaded.settings.runnerMode).toBe("offline");
    expect(loaded.settings.selectedModuleId).toBeTruthy();
    expect(loaded.runner.configured).toBe(false);
    expect(loaded.runner.mode).toBe("offline");
  });

  it("fills campaign settings and runner state when importing old backups", () => {
    const oldBackup = createDefaultCampaign() as unknown as Record<string, unknown>;
    delete oldBackup.settings;
    delete oldBackup.runner;

    const imported = importCampaign(JSON.stringify(oldBackup));

    expect(imported.settings.difficulty).toBe("standard");
    expect(imported.runner.turns).toEqual([]);
    expect(imported.runner.sceneId).toBe(imported.settings.starterSceneId);
  });

  it('stores a checkpoint without later auto saves overwriting it', () => {
    const campaign = createDefaultCampaign();
    saveLocalCheckpoint(campaign);
    saveCampaign({ ...campaign, name: 'Later progress' });
    expect(loadLocalCheckpoint()?.name).toBe(campaign.name);
    expect(loadCampaign().name).toBe('Later progress');
  });

  it('restores preparation only for its own campaign and can clear it', () => {
    const campaign = createDefaultCampaign();
    const draft = { name: 'Saved choices', character: campaign.character, settings: { ...campaign.settings, selectedModuleId: 'streets-5' }, aiSettings: campaign.aiSettings };
    savePreparation(campaign.id, draft);
    expect(loadPreparation(campaign).settings.selectedModuleId).toBe('streets-5');
    expect(loadPreparation(createDefaultCampaign()).name).not.toBe('Saved choices');
    clearPreparation();
    expect(loadPreparation(campaign).name).toBe(campaign.name);
  });

  it('does not overwrite malformed autosave bytes, and invalid JSON is rejected', () => {
    window.localStorage.setItem('cyberpunk-red-solo-runner:v1', '{broken');
    expect(() => loadCampaign()).toThrow();
    expect(window.localStorage.getItem('cyberpunk-red-solo-runner:v1')).toBe('{broken');
  });
  it('rejects nested invalid character fields instead of shallowly merging them', () => {
    const campaign = createDefaultCampaign();
    expect(() => importCampaign(JSON.stringify({...campaign, character: {...campaign.character, stats: null, skills: null}}))).toThrow('character.stats');
    expect(() => importCampaign(JSON.stringify({...campaign, character: {...campaign.character, hp: {current: 'none'}}}))).toThrow('character.hp');
  });
  it('migrates the Humanity ceiling of V1.3 cyberware saves', () => {
    const campaign = createDefaultCampaign();
    campaign.character.cyberwareInstallations = [{ purchaseId:'cyber-1', catalogId:'cybereye', slot:'leftEye', humanityLoss:7 }];
    campaign.character.humanity.current -= 7;
    const imported = importCampaign(JSON.stringify(campaign));
    expect(imported.character.humanity.max).toBe(campaign.character.humanity.max - 2);
    expect(imported.character.humanity.current).toBe(campaign.character.humanity.current);
  });
  it('ignores an unreadable checkpoint without damaging the active campaign', () => {
    const campaign = createDefaultCampaign();
    saveCampaign(campaign);
    window.localStorage.setItem('cyberpunk-red-solo-runner:checkpoint:v1', 'invalid');
    expect(loadLocalCheckpoint()).toBeNull();
    expect(loadCampaign().id).toBe(campaign.id);
  });
  it('keeps multiple independent snapshots and deletes only the selected one', () => {
    const campaign = createDefaultCampaign();
    saveLocalCheckpoint(campaign, 'First');
    saveLocalCheckpoint({ ...campaign, name: 'Later' }, 'Second');
    const slots = listSaveSlots();
    expect(slots.map(slot => slot.name)).toEqual(['Second', 'First']);
    deleteSaveSlot(slots[0].id);
    expect(listSaveSlots()).toHaveLength(1);
    expect(loadLocalCheckpoint()?.name).toBe(campaign.name);
  });
  it('updates only the selected slot and creates independent save-as branches',()=>{
    let campaign=saveCurrentCheckpoint(createDefaultCampaign());
    const firstId=campaign.activeSaveSlotId;
    campaign=saveCurrentCheckpoint({...campaign,name:'更新进度'});
    expect(listSaveSlots()).toHaveLength(1);
    expect(listSaveSlots()[0].id).toBe(firstId);
    const branch=saveCurrentCheckpoint(campaign,true);
    expect(branch.activeSaveSlotId).not.toBe(firstId);
    expect(listSaveSlots()).toHaveLength(2);
    const first=listSaveSlots().find(slot=>slot.id===firstId)!;
    saveCurrentCheckpoint({...first.campaign,name:'只改第一档'});
    expect(listSaveSlots().find(slot=>slot.id===branch.activeSaveSlotId)?.campaign.name).toBe('更新进度');
  });
  it('does not overwrite another campaign or resurrect a deleted slot on save',()=>{
    const first=saveCurrentCheckpoint(createDefaultCampaign());
    const other=createDefaultCampaign();other.activeSaveSlotId=first.activeSaveSlotId;
    const saved=saveCurrentCheckpoint(other);
    expect(saved.activeSaveSlotId).not.toBe(first.activeSaveSlotId);
    deleteSaveSlot(saved.activeSaveSlotId!);
    const afterDelete=saveCurrentCheckpoint(saved);
    expect(afterDelete.activeSaveSlotId).not.toBe(saved.activeSaveSlotId);
    expect(listSaveSlots()).toHaveLength(2);
  });
  it('migrates the old checkpoint and does not resurrect it after deletion', () => {
    const campaign = createDefaultCampaign();
    window.localStorage.setItem('cyberpunk-red-solo-runner:checkpoint:v1', JSON.stringify(campaign));
    expect(listSaveSlots()[0].id).toBe('legacy-checkpoint');
    deleteSaveSlot('legacy-checkpoint');
    expect(listSaveSlots()).toEqual([]);
    expect(loadLocalCheckpoint()).toBeNull();
  });
  it('migrates old failed replies into retryable records and retains pending choices', () => {
    const campaign=createDefaultCampaign();
    campaign.runner.turns=[
      {id:'p',type:'player',speaker:'玩家',body:'调查',createdAt:campaign.createdAt},
      {id:'f',type:'system',speaker:'连接中断',body:'失败',createdAt:campaign.createdAt},
    ];
    const migrated=importCampaign(JSON.stringify(campaign));
    expect(migrated.runner.turns[1].pendingIntent).toBe('调查');
    expect(migrated.runner.turns[1].responseState).toBe('failed');
    expect(importCampaign(exportCampaign(migrated)).runner.turns).toEqual(migrated.runner.turns);
  });
  it('scrubs legacy frontend secrets from manual saves and rejects corrupted recovery metadata', () => {
    const campaign=createDefaultCampaign();
    campaign.aiSettings.apiKey='test-secret';
    saveLocalCheckpoint(campaign);
    expect(listSaveSlots()[0].campaign.aiSettings.apiKey).toBe('');
    const rawSlots=window.localStorage.getItem('cyberpunk-red-solo-runner:slots:v1')!;
    expect(rawSlots).not.toContain('test-secret');
    campaign.runner.turns=[{id:'f',type:'system',speaker:'连接中断',body:'失败',responseState:'failed',createdAt:campaign.createdAt}];
    expect(()=>importCampaign(JSON.stringify(campaign))).toThrow('恢复信息');
  });
});
