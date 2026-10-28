import { describe, expect, it } from "vitest";
import { moduleCatalog } from "../data/moduleCatalog";
import { createDefaultCampaign } from "./state";
import {
  advanceRunnerScene,
  buildOfflineChoices,
  createOfflineGmTurn,
  findModule,
  findScene,
  startRunnerCampaign,
} from "./runner";

describe("runner helpers", () => {
  it('does not reset to the opening or duplicate logs for an invalid or unchanged scene',()=>{
    const started=startRunnerCampaign(createDefaultCampaign(),createDefaultCampaign().settings);
    expect(advanceRunnerScene(started,'unknown-scene')).toBe(started);
    expect(advanceRunnerScene(started,started.runner.sceneId)).toBe(started);
  });
  it("starts a configured runner campaign from the selected module", () => {
    const campaign = createDefaultCampaign();
    const started = startRunnerCampaign(campaign, campaign.settings);

    expect(started.runner.configured).toBe(true);
    expect(started.runner.mode).toBe("offline");
    expect(started.runner.moduleId).toBe(moduleCatalog[0].id);
    expect(started.currentScene.title).toBe("背景与引入");
    expect(started.runner.turns.length).toBeGreaterThanOrEqual(2);
    expect(started.journal[0].title).toContain("载入模组场景");
  });

  it("creates short offline choices from scene index data", () => {
    const campaign = createDefaultCampaign();
    const module = findModule(campaign.settings.selectedModuleId);
    const scene = findScene(module, campaign.settings.starterSceneId);
    const choices = buildOfflineChoices(campaign, module, scene);

    expect(choices.length).toBeGreaterThanOrEqual(3);
    expect(choices.length).toBeLessThanOrEqual(5);
    expect(choices.some((choice) => choice.kind === "scene")).toBe(true);
    expect(choices.map((choice) => choice.label)).toContain("核实失踪线索");
    expect(choices.every(choice=>Boolean(choice.detail?.trim()))).toBe(true);
    expect(choices.every((choice) => choice.intent.length < 80)).toBe(true);
  });

  it("advances to an indexed scene without embedding long module text", () => {
    const started = startRunnerCampaign(createDefaultCampaign(), createDefaultCampaign().settings);
    const advanced = advanceRunnerScene(started, "opera-first-leads");
    const gmTurn = createOfflineGmTurn(advanced, "按索引推进到「第一批线索」。");

    expect(advanced.runner.sceneId).toBe("opera-first-leads");
    expect(advanced.currentScene.title).toBe("第一批线索");
    expect(advanced.journal[0].title).toContain("推进模组场景");
    expect(gmTurn.body.length).toBeLessThan(600);
    expect(gmTurn.sourceRefs?.length).toBeGreaterThan(0);
  });
  it('acknowledges the chosen action and saved motivation without inventing a successful outcome',()=>{
    const campaign=startRunnerCampaign(createDefaultCampaign(),createDefaultCampaign().settings);
    campaign.character.role='媒体人';
    campaign.character.backgroundDetails={motivation:'找到失散的姐姐'};
    const reply=createOfflineGmTurn(campaign,'联系售票员');
    expect(reply.body).toContain('联系售票员');
    expect(reply.body).toContain('找到失散的姐姐');
    expect(reply.body).toContain('尚未裁定行动结果');
    expect(reply.body).toContain('普通问答不需要掷骰');
    expect(reply.choices?.find(choice=>choice.kind==='talk')?.intent).toContain('媒体人');
  });
});
