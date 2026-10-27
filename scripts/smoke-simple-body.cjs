/** 简化义体示意图的真实 React DOM 交互测试；不依赖 Vite/Rollup 原生插件。 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:5173/'});
for(const key of ['window','document','navigator','HTMLElement','Node','Event','MutationObserver'])global[key]=dom.window[key];
global.IS_REACT_ACT_ENVIRONMENT=true;
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(mod,path)=>mod._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,path);
const React=require('react');
const {render,screen,fireEvent,cleanup}=require('@testing-library/react');
const {CyberBodyMap,CyberwarePanel}=require('../src/components/CharacterEquipment.tsx');
const {createDefaultCampaign}=require('../src/lib/state.ts');
const {cyberSlotUsage}=require('../src/lib/characterShop.ts');
const character=createDefaultCampaign().character;
const slots=['神经链路','左赛博眼','右赛博眼','音频组件','左赛博手臂','右赛博手臂','左赛博腿','右赛博腿','体内组件','外周组件','时尚组件','赛博格组件'];
let selected='leftEye';
let view=render(React.createElement(CyberBodyMap,{character,selected,onSelect:x=>selected=x}));
for(const label of slots){assert(screen.getByRole('button',{name:`${label} 空`}),`${label} is visible`);}
assert.equal(screen.getAllByRole('button').length,12,'exactly one button per body part');
fireEvent.click(screen.getByRole('button',{name:'右赛博手臂 空'}));
assert.equal(selected,'rightArm');
cleanup();
let latest={...character,eurobucks:700};
function Harness(){const [ch,setCharacter]=React.useState(latest);return React.createElement(CyberwarePanel,{character:ch,creation:true,onChange:next=>{latest=next;setCharacter(next);}});}
render(React.createElement(Harness));
fireEvent.click(screen.getByRole('button',{name:'左赛博眼 空'}));
assert(screen.getByText('赛博义眼'));
fireEvent.click(screen.getAllByRole('button',{name:'安装'})[0]);
assert.equal(cyberSlotUsage(latest,'leftEye').items.length,1);
assert.equal(latest.eurobucks,600);
assert(screen.getByRole('button',{name:'左赛博眼 已装 1 件'}));
assert(screen.getByRole('button',{name:'左赛博眼 已装 1 件'}).className.includes('installed'));
cleanup();
console.log('PASS: 12个直观部位、左右部位选择、购买联动、已安装高亮与资金扣款');
