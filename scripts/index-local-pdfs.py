"""Create a private local PDF index using user-selected files.

Usage: python scripts/index-local-pdfs.py --dir "H:/PDF目录"
Or copy all three PDFs into project/private-books/, then run npm run sources:index.
Generated full text stays in .local-sources (ignored by git), not front-end source.
"""
import argparse
import json
import os
import re
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
KEYS = (
    ('red-core-20261010', 'PDF_CORE_PATH', '赛博朋克 红_核心规则书_简体中文_预览版_20261010.pdf'),
    ('red-sheet-20260507', 'PDF_SHEET_PATH', '赛博朋克红-人物卡-20260507.pdf'),
    ('red-streets-20261010', 'PDF_STREETS_PATH', '赛博朋克 红_赤红传说_街头故事_简体中文_预览版_20261010.pdf'),
)

def dotenv_paths():
    result = {}
    dotenv = ROOT / '.env.local'
    if dotenv.exists():
        for line in dotenv.read_text(encoding='utf-8-sig').splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            name, value = line.split('=', 1)
            if name.strip().startswith('PDF_'):
                result[name.strip()] = value.strip().strip('"\'')
    return result

def locate(folder, specified, filename):
    if specified:
        path = Path(specified).expanduser()
        if path.is_file():
            return path.resolve()
    target = folder / filename
    if target.is_file():
        return target.resolve()
    if folder.is_dir():
        for path in folder.iterdir():
            if path.is_file() and re.sub(r'\(\d+\)(?=\.pdf$)', '', path.name) == filename:
                return path.resolve()
    raise FileNotFoundError(f'找不到 {filename}。请将文件放到 {folder}，或通过 --core/--sheet/--streets 指定绝对路径。')

def main():
    args = argparse.ArgumentParser(description='生成本机三份 RED PDF 索引')
    args.add_argument('--dir', default=None, help='PDF 所在文件夹')
    args.add_argument('--core', default=None)
    args.add_argument('--sheet', default=None)
    args.add_argument('--streets', default=None)
    opts = args.parse_args()
    values = {**dotenv_paths(), **os.environ}
    folder = Path(opts.dir or values.get('PDF_BOOKS_DIR') or ROOT / 'private-books').expanduser()
    overrides = {'PDF_CORE_PATH': opts.core, 'PDF_SHEET_PATH': opts.sheet, 'PDF_STREETS_PATH': opts.streets}
    documents = []
    for source_id, key, filename in KEYS:
        path = locate(folder, overrides[key] or values.get(key), filename)
        reader = PdfReader(path)
        pages = [page.extract_text() or '' for page in reader.pages]
        outline = []
        def walk(items):
            for item in items:
                if isinstance(item, list):
                    walk(item)
                else:
                    try: outline.append({'title': item.title, 'page': reader.get_destination_page_number(item) + 1})
                    except Exception: pass
        walk(reader.outline)
        documents.append({'id': source_id, 'title': filename, 'path': str(path), 'pageCount': len(pages), 'outline': outline, 'pages': pages})
        print(f'{source_id}: {len(pages)} pages, {sum(bool(p.strip()) for p in pages)} searchable')
    private = ROOT / '.local-sources'
    private.mkdir(exist_ok=True)
    (private / 'documents.json').write_text(json.dumps(documents, ensure_ascii=False), encoding='utf-8')
    metadata = [{'id': d['id'], 'title': d['title'], 'kind': 'local-pdf', 'fileType': 'pdf',
                 'relativePath': 'private-books/' + d['title'], 'sizeBytes': 0, 'pageCount': d['pageCount'],
                 'licenseStatus': 'user-owned', 'importStatus': 'index-only', 'outlineLines': [o['title'] for o in d['outline'][:24]]}
                for d in documents]
    (ROOT / 'src/data/localBooks.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    streets = documents[2]
    titles = ['歌剧院之夜','欲望代理','一桶爆米花味“狗粮”','“鼓手”与“鲸鱼”','衣不蔽体','收割“死神”','保持警惕','浴血猩红','赤红之夜']
    starts = [6,20,38,52,74,92,112,128,150,172]
    adventures=[]
    for i, title in enumerate(titles):
        start,end=starts[i],starts[i+1]-1
        toc=re.sub(r'\s+','',streets['pages'][start-1])
        match=re.search(r'引子\.+(\d+)',toc)
        intro=int(match.group(1))+1 if match else start+1
        adventures.append({'id':f'streets-{i+1}','title':title,'start':start,'end':end,'intro':intro})
    (ROOT / 'src/data/streetAdventures.json').write_text(json.dumps(adventures, ensure_ascii=False,indent=2),encoding='utf-8')
    print('索引已更新。重启 npm run dev。PDF 原文件仍保存在你的指定目录。')

if __name__ == '__main__': main()
