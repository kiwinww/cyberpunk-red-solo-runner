const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://127.0.0.1:5173/');
    const modules = await page.evaluate(async () => {
      const { moduleCatalog } = await import('/src/data/moduleCatalog.ts');
      return moduleCatalog.map(module => ({ id: module.id, title: module.title }));
    });
    for (const module of modules) {
      const audit = await page.evaluate(async moduleId => {
        const { moduleCatalog } = await import('/src/data/moduleCatalog.ts');
        const { createDefaultCampaign } = await import('/src/lib/state.ts');
        const { fillCreationPoints } = await import('/src/rulesets/cyberpunk-red/character.ts');
        const { startRunnerCampaign, selectRunnerScene, recordSceneResolution, createOfflineGmTurn } = await import('/src/lib/runner.ts');
        const { importCampaign, exportCampaign, STORAGE_KEY } = await import('/src/lib/storage.ts');
        const { retrieveLocalSources } = await import('/src/lib/localSources.ts');
        const module = moduleCatalog.find(item => item.id === moduleId);
        const base = createDefaultCampaign();
        base.character = fillCreationPoints(base.character);
        base.character.backgroundDetails = { motivation: '找到失散的姐姐', friends: '米娅：旧同事' };
        const campaign = startRunnerCampaign(base, { ...base.settings, selectedModuleId: module.id, starterSceneId: module.starterSceneId, runnerMode: 'offline' });
        const passages=await retrieveLocalSources('当前场景的委托与人物',module.id,undefined,undefined,undefined,module.starterSceneId);
        if(!passages.some(passage=>passage.sourceId==='red-streets-20261010' && !passage.gmOnly)) throw new Error(`本机故事索引缺失：${module.id}`);
        let checked = 0;
        for (const scene of module.scenes) {
          const moved = selectRunnerScene(campaign, module.id, scene.id);
          const saved = importCampaign(exportCampaign(recordSceneResolution(moved, '流程检查：未领取报酬或物品。', 'no-check')));
          if (saved.runner.sceneId !== scene.id || JSON.stringify(saved.character) !== JSON.stringify(campaign.character)) throw new Error(`存读错配：${scene.id}`);
          const reply = createOfflineGmTurn(saved, '观察眼前可见的线索');
          if (!reply.choices?.length || reply.choices.some(choice => choice.targetSceneId && !module.scenes.some(item => item.id === choice.targetSceneId))) throw new Error(`选项失效：${scene.id}`);
          checked++;
        }
        localStorage.clear();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
        return { scenes: checked, firstRoute: module.scenes.find(scene => scene.id === module.starterSceneId).nextSceneIds?.[0] };
      }, module.id);
      await page.reload();
      await page.getByRole('button', { name: '继续游戏', exact: true }).click();
      await page.getByLabel('你的行动', { exact: true }).fill('核实委托条件，暂不支付或领取欧币。');
      await page.getByRole('button', { name: '提交行动', exact: true }).click();
      await page.getByRole('button', { name: '场景进展', exact: true }).click();
      await page.getByLabel('本场景已确认的线索或后果').fill('已询问委托条件，尚未接受交易。');
      await page.getByRole('checkbox', { name: '我确认所选分支符合当前线索与进入条件' }).check();
      assert(audit.firstRoute, `${module.id}: missing opening route`);
      await page.locator('.scene-routes button').first().click();
      await page.getByLabel('本场景已确认的线索或后果').fill('已抵达当前场景，尚未取得物品。');
      await page.getByRole('button', { name: '记录场景结果', exact: true }).click();
      await page.getByRole('button', { name: '加入主持长期记忆', exact: true }).click();
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('cyberpunk-red-solo-runner:v1')));
      assert.equal(state.runner.sceneId, audit.firstRoute);
      assert(state.playerNotes.includes('尚未取得物品'));
      assert(state.runner.resolutions.some(item=>item.summary.includes('尚未接受交易')));
      assert.equal(state.runner.turns.filter(turn => turn.type === 'player' && turn.body.includes('核实委托条件')).length, 1);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${module.id}: mobile overflow`);
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log(`PASS ${module.id}: ${audit.scenes} scene roundtrips; action, progress, first route, mobile`);
    }
    await page.screenshot({ path: '.local-sources/module-review-desktop.png', fullPage: true });
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({ path: '.local-sources/module-review-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`PASS ${modules.length} module entries; no uncaught page errors. Offline/index regression, not complete AI adventure playthrough.`);
    if (process.argv.includes('--ai')) {
      for (const module of modules.filter(item => item.id.startsWith('streets-'))) {
        const result = await page.evaluate(async moduleId => {
          const { createDefaultCampaign } = await import('/src/lib/state.ts');
          const { moduleCatalog } = await import('/src/data/moduleCatalog.ts');
          const { startRunnerCampaign } = await import('/src/lib/runner.ts');
          const { generateGmResponse } = await import('/src/lib/ai.ts');
          const module=moduleCatalog.find(item=>item.id===moduleId);
          const base=createDefaultCampaign();
          base.character.handle='测试边缘行者';
          base.character.backgroundDetails={motivation:'寻找失散的姐姐',friends:'米娅：旧同事'};
          base.aiSettings={...base.aiSettings,enabled:true};
          const campaign=startRunnerCampaign(base,{...base.settings,selectedModuleId:moduleId,starterSceneId:module.starterSceneId,runnerMode:'ai'});
          const before=JSON.stringify(campaign.character);
          const answer=await generateGmResponse(campaign,'先观察眼前环境，再询问委托条件；不默认接受或支付。');
          return {id:moduleId,ok:answer.ok,choices:answer.choices?.length??0,sources:answer.sourceRefs?.length??0,characterUnchanged:before===JSON.stringify(campaign.character),preview:answer.text.slice(0,240)};
        }, module.id);
        console.log(JSON.stringify(result));
        if (!result.ok) { console.log('AI probe stopped after upstream failure; no automatic paid retries.'); break; }
        assert.equal(result.characterUnchanged,true);
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
