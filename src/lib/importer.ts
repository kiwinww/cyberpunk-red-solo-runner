import {
  DataCategory,
  DataEntry,
  DataPack,
  DataPackManifest,
  LicenseStatus,
  RandomTable,
} from "../domain/types";

const VALID_CATEGORIES: DataCategory[] = [
  "rules-reference",
  "role",
  "skill",
  "weapon",
  "armor",
  "gear",
  "cyberware",
  "netrunning",
  "npc",
  "enemy-template",
  "mission",
  "location",
  "faction",
  "random-table",
  "module",
  "map",
  "character-sheet",
  "source",
];

const VALID_LICENSES: LicenseStatus[] = [
  "official-link",
  "user-owned",
  "public-preview",
  "index-only",
  "unknown",
  "homebrew",
];

export interface ImportPreview {
  ok: boolean;
  pack?: DataPack;
  errors: string[];
  warnings: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, field: string, errors: string[]): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  errors.push(`缺少或无效字段：${field}`);
  return "";
}

function parseCategory(value: unknown, field: string, errors: string[]): DataCategory {
  if (typeof value === "string" && VALID_CATEGORIES.includes(value as DataCategory)) {
    return value as DataCategory;
  }
  errors.push(`无效分类：${field}`);
  return "rules-reference";
}

function parseLicense(value: unknown, field: string, errors: string[]): LicenseStatus {
  if (typeof value === "string" && VALID_LICENSES.includes(value as LicenseStatus)) {
    return value as LicenseStatus;
  }
  errors.push(`无效版权状态：${field}`);
  return "unknown";
}

function validateManifest(input: unknown, errors: string[]): DataPackManifest {
  if (!isObject(input)) {
    errors.push("缺少 manifest 对象");
    input = {};
  }

  const record = input as Record<string, unknown>;
  const categories = Array.isArray(record.categories)
    ? record.categories.map((category, index) =>
        parseCategory(category, `manifest.categories[${index}]`, errors),
      )
    : [];

  if (!categories.length) {
    errors.push("manifest.categories 至少需要一个分类");
  }

  const schemaVersion = Number(record.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    errors.push("manifest.schemaVersion 必须是正数");
  }

  const ruleset = record.ruleset === "cyberpunk-red" ? "cyberpunk-red" : undefined;
  if (!ruleset) errors.push("manifest.ruleset 必须是 cyberpunk-red");

  return {
    id: parseString(record.id, "manifest.id", errors),
    name: parseString(record.name, "manifest.name", errors),
    version: parseString(record.version, "manifest.version", errors),
    author: parseString(record.author, "manifest.author", errors),
    ruleset: "cyberpunk-red",
    schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : 1,
    language: parseString(record.language, "manifest.language", errors),
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : undefined,
    ownershipNote: parseString(record.ownershipNote, "manifest.ownershipNote", errors),
    licenseStatus: parseLicense(record.licenseStatus, "manifest.licenseStatus", errors),
    categories,
    importedAt: new Date().toISOString(),
  };
}

function validateEntry(input: unknown, index: number, manifest: DataPackManifest, errors: string[]): DataEntry {
  if (!isObject(input)) {
    errors.push(`entries[${index}] 不是对象`);
    input = {};
  }

  const record = input as Record<string, unknown>;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  const entryPackId =
    typeof record.packId === "string" && record.packId.trim() ? record.packId.trim() : manifest.id;

  if (entryPackId !== manifest.id) {
    errors.push(`entries[${index}].packId 必须等于 manifest.id`);
  }

  return {
    id: parseString(record.id, `entries[${index}].id`, errors),
    title: parseString(record.title, `entries[${index}].title`, errors),
    category: parseCategory(record.category, `entries[${index}].category`, errors),
    tags,
    body: parseString(record.body, `entries[${index}].body`, errors),
    source: parseString(record.source, `entries[${index}].source`, errors),
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : manifest.sourceUrl,
    licenseStatus: parseLicense(record.licenseStatus, `entries[${index}].licenseStatus`, errors),
    ruleset: "cyberpunk-red",
    packId: manifest.id,
    schemaVersion: Number(record.schemaVersion) || manifest.schemaVersion,
    metadata: isObject(record.metadata) ? record.metadata : undefined,
  };
}

function validateRandomTable(
  input: unknown,
  index: number,
  manifest: DataPackManifest,
  errors: string[],
): RandomTable {
  if (!isObject(input)) {
    errors.push(`randomTables[${index}] 不是对象`);
    input = {};
  }

  const record = input as Record<string, unknown>;
  const rawEntries = Array.isArray(record.entries) ? record.entries : [];
  const entries = rawEntries.map((entry, entryIndex) => {
    if (!isObject(entry)) {
      errors.push(`randomTables[${index}].entries[${entryIndex}] 不是对象`);
      return { range: "", result: "" };
    }
    return {
      range: parseString(entry.range, `randomTables[${index}].entries[${entryIndex}].range`, errors),
      result: parseString(entry.result, `randomTables[${index}].entries[${entryIndex}].result`, errors),
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === "string")
        : undefined,
    };
  });

  return {
    id: parseString(record.id, `randomTables[${index}].id`, errors),
    title: parseString(record.title, `randomTables[${index}].title`, errors),
    category: "random-table",
    dice: parseString(record.dice, `randomTables[${index}].dice`, errors),
    entries,
    source: parseString(record.source, `randomTables[${index}].source`, errors),
    packId: manifest.id,
  };
}

export function parseDataPackJson(raw: string): ImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      errors: [`JSON 解析失败：${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }

  if (!isObject(parsed)) {
    return { ok: false, errors: ["资料包根节点必须是对象"], warnings };
  }

  const manifest = validateManifest(parsed.manifest, errors);
  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry, index) => validateEntry(entry, index, manifest, errors))
    : [];

  if (!entries.length) {
    warnings.push("资料包没有 entries。可以先导入空壳，但资料库不会新增条目。");
  }

  const randomTables = Array.isArray(parsed.randomTables)
    ? parsed.randomTables.map((table, index) => validateRandomTable(table, index, manifest, errors))
    : [];

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) warnings.push(`重复条目 id：${entry.id}`);
    ids.add(entry.id);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    pack: {
      manifest,
      entries,
      randomTables,
      enabled: true,
    },
  };
}

export function parseMarkdownAsPack(markdown: string, fileName: string): ImportPreview {
  const idBase = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-|-$/g, "");
  const title = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("#"))
    ?.replace(/^#+\s*/, "");

  const manifest: DataPackManifest = {
    id: idBase || `markdown-pack-${Date.now()}`,
    name: title || fileName,
    version: "0.1.0",
    author: "本地导入",
    ruleset: "cyberpunk-red",
    schemaVersion: 1,
    language: "zh-CN",
    ownershipNote: "用户本地导入的 Markdown 摘要或笔记。",
    licenseStatus: "user-owned",
    categories: ["rules-reference"],
    importedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    errors: [],
    warnings: ["Markdown 导入会作为单个规则速查条目保存；精细分类请使用 JSON 资料包。"],
    pack: {
      manifest,
      entries: [
        {
          id: `${manifest.id}-entry`,
          title: title || fileName,
          category: "rules-reference",
          tags: ["Markdown", "本地导入"],
          body: markdown,
          source: fileName,
          licenseStatus: "user-owned",
          ruleset: "cyberpunk-red",
          packId: manifest.id,
          schemaVersion: 1,
        },
      ],
      enabled: true,
    },
  };
}

export function mergePacks(existing: DataPack[], next: DataPack): DataPack[] {
  return [...existing.filter((pack) => pack.manifest.id !== next.manifest.id), next];
}
