import { describe, expect, it } from "vitest";
import localSourceManifest from "./localSourceManifest.json";
import { moduleCatalog } from "./moduleCatalog";
import { officialSources } from "./officialSources";

describe("source catalog", () => {
  it("indexes official sources", () => {
    expect(officialSources.length).toBeGreaterThanOrEqual(6);
    expect(officialSources.every((source) => source.official)).toBe(true);
    expect(officialSources.map((source) => source.id)).toContain("rtg-downloadable-content");
  });

  it("indexes local source assets and nested module files", () => {
    expect(localSourceManifest.ruleset).toBe("cyberpunk-red");
    expect(localSourceManifest.assets.length).toBeGreaterThanOrEqual(6);
    const archives = localSourceManifest.assets.filter((asset) => asset.fileType === "zip");
    expect(archives.length).toBeGreaterThanOrEqual(2);
    expect(archives.some((asset) => asset.assets?.some((child) => child.fileType === "docx"))).toBe(true);
    expect(archives.some((asset) => asset.assets?.some((child) => child.fileType === "jpg"))).toBe(true);
  });

  it("provides playable module scene skeletons", () => {
    expect(moduleCatalog.map((module) => module.id)).toEqual(
      expect.arrayContaining(["opera-night-preview", "desire-agent-preview"]),
    );
    expect(moduleCatalog.every((module) => module.scenes.length > 0)).toBe(true);
    expect(moduleCatalog.flatMap((module) => module.maps).length).toBeGreaterThanOrEqual(3);
  });

  it("keeps built-in module content as short index skeletons", () => {
    for (const module of moduleCatalog) {
      expect(module.scenes.some((scene) => scene.id === module.starterSceneId)).toBe(true);
      expect(module.background.playerSummary.length).toBeLessThanOrEqual(90);
      expect(module.background.openingHook.length).toBeLessThanOrEqual(90);
      expect(module.background.missionPremise.length).toBeLessThanOrEqual(90);
      expect(module.sourceRefs.length).toBeGreaterThan(0);

      for (const scene of module.scenes) {
        expect(scene.objective.length).toBeLessThanOrEqual(90);
        expect(scene.starterPrompt?.length ?? 0).toBeLessThanOrEqual(90);
        expect(scene.pageRefs.length).toBeGreaterThan(0);
        expect(scene.npcBlocks.length).toBeGreaterThan(0);
      }
    }
  });
});
