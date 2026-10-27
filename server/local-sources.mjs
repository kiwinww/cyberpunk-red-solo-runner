import { readFileSync, createReadStream, existsSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { modulePeople } from './story-context.mjs';

const DEFAULT_PDF_FOLDER = resolve('private-books');
const OVERRIDE_KEYS = {
  'red-core-20261010': 'PDF_CORE_PATH',
  'red-sheet-20260507': 'PDF_SHEET_PATH',
  'red-streets-20261010': 'PDF_STREETS_PATH',
};

/** User-owned PDFs are resolved on the host, never packaged in the front-end. */
function locatePdf(doc, config = {}) {
  const override = config[OVERRIDE_KEYS[doc.id]];
  const booksDir = resolve(config.PDF_BOOKS_DIR || DEFAULT_PDF_FOLDER);
  const candidates = [override, join(booksDir, basename(doc.title))];
  if (existsSync(booksDir)) {
    const filenames = readdirSync(booksDir);
    const close = filenames.find(name => name.replace(/\(\d+\)(?=\.pdf$)/,'') === doc.title);
    if (close) candidates.push(join(booksDir, close));
  }
  // Backward compatibility if the same local path is still valid on this machine.
  if (doc.path) candidates.push(doc.path);
  return candidates.find(value => typeof value === 'string' && value.toLowerCase().endsWith('.pdf') && existsSync(value));
}

export function localSourcesPlugin(config = {}) {
  let documents;
  const load = () => documents ??= JSON.parse(readFileSync(resolve('.local-sources/documents.json'), 'utf8'));
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/local-sources')) return next();
    const json = (value, status = 200) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    try {
      if (url.pathname === '/api/local-sources/equipment') {
        res.setHeader('Cache-Control', 'private, no-store');
        return json(JSON.parse(readFileSync(resolve('.local-sources/equipment.json'), 'utf8')));
      }
      const docs = load();
      if (url.pathname === '/api/local-sources') {
        return json(docs.map(({ pages, path, ...info }) => ({ ...info, available: Boolean(locatePdf({ ...info, path }, config)) })));
      }
      if (url.pathname === '/api/local-sources/search') {
        const query = (url.searchParams.get('q') || '').slice(0, 300).toLowerCase();
        const tokens = query.match(/[a-z0-9]+|[\u4e00-\u9fff]{1,2}/g) || [];
        const moduleId = url.searchParams.get('module');
        const adventures=JSON.parse(readFileSync(resolve('src/data/streetAdventures.json'),'utf8'));
        const aliases={'opera-night-preview':'streets-1','desire-agent-preview':'streets-2'};
        const adventure=adventures.find(entry=>entry.id===(aliases[moduleId]??moduleId));
        const index=JSON.parse(readFileSync(resolve('src/data/streetSceneIndex.json'),'utf8'));
        const sceneId=(url.searchParams.get('scene')||'').replace(`${moduleId}-`, '');
        const indexedScene=(index[adventure?.id]||[]).find(scene=>scene.id===sceneId || scene.id===url.searchParams.get('scene'));
        // Never trust client-supplied page bounds or retrieve a future ending by keyword alone.
        const start = indexedScene?.page ?? adventure?.intro ?? 0;
        const end = indexedScene?.endPage ?? (adventure ? Math.min(adventure.end, Math.max(adventure.intro,...(index[adventure.id]||[]).slice(0,1).map(scene=>scene.page))) : 0);
        const intro = start;
        const hits = [];
        for (const doc of docs) {
          for (let i = 0; i < doc.pages.length; i++) {
            if (doc.id === 'red-streets-20261010' && (!adventure || i + 1 < start || i + 1 > end)) continue;
            const text = doc.pages[i];
            const lower = text.toLowerCase();
            const score = tokens.reduce((n, token) => n + (lower.includes(token) ? 1 : 0), 0)
              + (moduleId && doc.id === 'red-streets-20261010' && [intro, start + 1].includes(i + 1) ? 5 : 0);
            if (!score) continue;
            const position = doc.id==='red-streets-20261010' ? 0 : Math.max(0, lower.indexOf(tokens.find(token => lower.includes(token)) || ''));
            hits.push({ sourceId: doc.id, title: doc.title, page: i + 1, score, text: text.slice(Math.max(0, position - 200), position + (doc.id==='red-streets-20261010'?3600:1600)) });
          }
        }
        hits.sort((a, b) => b.score - a.score);
        const story = hits.filter(hit => hit.sourceId === 'red-streets-20261010').slice(0, 3);
        const rules = hits.filter(hit => hit.sourceId==='red-core-20261010' && ((hit.page>=44 && hit.page<=239)||(hit.page>=328 && hit.page<=411))).slice(0, 3);
        const rolePage = Number(url.searchParams.get('rolePage'));
        const core = docs.find(doc => doc.id === 'red-core-20261010');
        const world=hits.filter(hit=>hit.sourceId==='red-core-20261010' && hit.page>=257 && hit.page<=318).slice(0,1).map(hit=>({...hit,kind:'world'}));
        if(!world.length && core) world.push({sourceId:core.id,title:core.title,page:295,text:core.pages[294].slice(0,1400),score:0,kind:'world'});
        const streets=docs.find(doc=>doc.id==='red-streets-20261010');
        const people=adventure && streets?modulePeople(streets,adventure.title,query,story.map(hit=>hit.text).join('\n')):[];
        const roleText = core && Number.isInteger(rolePage) && rolePage >= 144 && rolePage <= 165 ? core.pages[rolePage - 1] : '';
        const ability = (url.searchParams.get('roleAbility') || '').slice(0, 40);
        const offset = ability ? Math.max(0, roleText.indexOf(ability)) : 0;
        const role = roleText ? [{ sourceId: core.id, title: core.title, page: rolePage, text: roleText.slice(offset, offset + 1800), score: 0 }] : [];
        return json([...story.slice(0,2),...people,...world,...role,...rules.filter(hit => hit.page !== rolePage && !(hit.page>=257 && hit.page<=318)).slice(0,2)]);
      }
      const match = url.pathname.match(/^\/api\/local-sources\/([^/]+)\/pdf$/);
      const doc = match && docs.find(doc => doc.id === match[1]);
      if (!doc) return json({ error: 'Unknown document' }, 404);
      const pdfPath = locatePdf(doc, config);
      if (!pdfPath) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><meta charset="utf-8"><title>请重新关联 PDF</title><main style="font:16px system-ui;max-width:720px;margin:60px auto;line-height:1.7"><h1>本机 PDF 尚未关联</h1><p>原索引中的 PDF 文件路径在当前电脑不可用。游戏资料索引仍可使用，但打开完整 PDF 前需要关联你合法持有的文件。</p><p>将 PDF 放入项目根目录的 <code>private-books</code> 文件夹，文件名按项目 <code>LOCAL-SOURCES.md</code> 中的说明；或者在 <code>.env.local</code> 中设置 PDF_CORE_PATH / PDF_SHEET_PATH / PDF_STREETS_PATH。</p><p>重启 <code>npm run dev</code> 后再打开此页面。</p></main>`);
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'private, no-store');
      const stream = createReadStream(pdfPath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch {
      json({ error: '本机资料索引不可用。请先设置 PDF 路径，然后运行 npm run sources:index。' }, 503);
    }
  };
  return { name: 'local-pdf-sources', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
