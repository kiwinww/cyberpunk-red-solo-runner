/** Portable smoke tests for core fixes when Vite/Rollup native binaries are unavailable. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const result = ts.transpileModule(source, {fileName:filename, compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true, resolveJsonModule:true}});
    module._compile(result.outputText, filename);
  };
}
const state = require('../src/lib/state.ts');
const storage = require('../src/lib/storage.ts');
const shop = require('../src/lib/characterShop.ts');
const char = require('../src/rulesets/cyberpunk-red/character.ts');
const { createRunnerTurn } = require('../src/lib/runner.ts');
const map = new Map();
global.window = {localStorage:{getItem:key=>map.has(key)?map.get(key):null,setItem:(key,val)=>map.set(key,String(val)),removeItem:key=>map.delete(key),clear:()=>map.clear()}};
const campaign=state.createDefaultCampaign();
assert.equal(storage.importCampaign(storage.exportCampaign(campaign)).id, campaign.id);
const legacyCampaign={...campaign};delete legacyCampaign.settings;delete legacyCampaign.runner;
assert.equal(storage.importCampaign(JSON.stringify(legacyCampaign)).runner.mode,'offline');
assert.throws(()=>storage.importCampaign('{"ruleset":"cyberpunk-red","character":{"stats":null,"skills":null}}'), /存档结构无效/);
assert.throws(()=>storage.importCampaign('{no'),SyntaxError);
window.localStorage.setItem(storage.STORAGE_KEY,'{broken');
assert.throws(()=>storage.loadCampaign());
assert.equal(storage.rawCampaignBackup(),'{broken');
assert.equal(window.localStorage.getItem(storage.STORAGE_KEY),'{broken');
window.localStorage.clear();
const origin = state.createDefaultCampaign();
let withEye = shop.purchaseCatalogItem(origin.character,'cybereye',{creation:true,slot:'leftEye',purchaseId:'l'});
assert(withEye.ok);
assert.equal(withEye.character.humanity.current,origin.character.humanity.current - 7);
assert.equal(withEye.character.humanity.max,origin.character.humanity.max - 2);
let withEye2 = shop.purchaseCatalogItem(withEye.character,'cybereye',{creation:true,slot:'rightEye',purchaseId:'r'});
assert.equal(withEye2.character.humanity.max,origin.character.humanity.max - 4);
assert.equal(shop.undoCreationPurchase(withEye2.character,'r').humanity.max,origin.character.humanity.max - 2);
const edited=char.changeAttribute(withEye.character,'emp',6,true);
assert.equal(edited.humanity.max,58);
assert.equal(edited.humanity.current,51);
const legacy={...origin,character:{...withEye.character,humanity:{...withEye.character.humanity,max:origin.character.humanity.max}}};
assert.equal(storage.importCampaign(JSON.stringify(legacy)).character.humanity.max, origin.character.humanity.max-2);
console.log('PASS: storage rejects corruption and preserves raw bytes; schema import; cyberware max and undo; EMP edit and legacy migration');
