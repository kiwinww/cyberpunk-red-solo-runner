import { describe, expect, it } from "vitest";
import { dataPackTemplate } from "../data/templates";
import { parseDataPackJson, parseMarkdownAsPack } from "./importer";

describe("data pack importer", () => {
  it("accepts the bundled json template", () => {
    const preview = parseDataPackJson(JSON.stringify(dataPackTemplate));
    expect(preview.ok).toBe(true);
    expect(preview.pack?.manifest.ruleset).toBe("cyberpunk-red");
    expect(preview.pack?.entries).toHaveLength(1);
  });

  it("rejects invalid ruleset manifests", () => {
    const invalid = {
      ...dataPackTemplate,
      manifest: {
        ...dataPackTemplate.manifest,
        ruleset: "other-game",
      },
    };
    const preview = parseDataPackJson(JSON.stringify(invalid));
    expect(preview.ok).toBe(false);
    expect(preview.errors.join("\n")).toContain("manifest.ruleset");
  });

  it("converts markdown notes into a local pack", () => {
    const preview = parseMarkdownAsPack("# 规则速查\n\n本地摘要。", "notes.md");
    expect(preview.ok).toBe(true);
    expect(preview.pack?.manifest.name).toBe("规则速查");
    expect(preview.pack?.entries[0].category).toBe("rules-reference");
  });
});
