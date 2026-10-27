"""Rebuild title/page metadata from the user's local adventure contents pages."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def outgoing(book, scene, scenes):
    text = re.sub(r'\s+', '', ''.join(book['pages'][scene['page'] - 1:scene['endPage']]))
    headings = []
    for candidate in scenes:
        pattern = r'引子' if candidate['title'] == '引子' else r'(?:可选)?(?:发展|悬念|高潮|结局)《' + re.escape(candidate['title']) + r'》'
        for match in re.finditer(pattern, text):
            prefix = text[max(0, match.start()-80):match.start()]
            reference = re.search(r'(?:前往|参见|转入|继续|进入)[^。！？《》]{0,60}$|》(或|和|以及|、)$', prefix)
            if not reference:
                headings.append((match.start(), candidate['id']))
    starts = [position for position, id_ in headings if id_ == scene['id']]
    if not starts:
        return []
    start = min(starts)
    end = min([position for position, id_ in headings if position > start and id_ != scene['id']] or [len(text)])
    section = text[start:end]
    titles = []
    for sentence in re.split(r'[。！？]', section):
        direction = re.search(r'前往|转入|进入|继续', sentence)
        if direction:
            titles.extend(re.findall(r'(?:可选)?(?:发展|悬念|高潮|结局)《(.+?)》', sentence[direction.end():]))
    return list(dict.fromkeys(candidate['id'] for title in titles for candidate in scenes
                              if candidate['title'] == title and candidate['id'] != scene['id']))


def main():
    documents = json.loads((ROOT / '.local-sources/documents.json').read_text(encoding='utf-8'))
    book = next(doc for doc in documents if doc['id'] == 'red-streets-20261010')
    adventures = json.loads((ROOT / 'src/data/streetAdventures.json').read_text(encoding='utf-8'))
    catalog = {}
    openings = {}
    for adventure in adventures:
        scenes = []
        for line in book['pages'][adventure['start'] - 1].splitlines():
            line = re.sub(r'\s+', '', line)
            match = re.fullmatch(r'(可选)?(发展|悬念|高潮|结局)(?:结局)?《(.+?)》\.+(\d+)', line)
            if not match:
                continue
            optional, kind, title, printed_page = match.groups()
            page = int(printed_page) + 1
            assert adventure['start'] <= page <= adventure['end'], adventure['id']
            assert title in re.sub(r'\s+', '', book['pages'][page - 1]), f"Missing heading: {title}, PDF {page}"
            scenes.append({'id': f"{adventure['id']}-index-{len(scenes) + 1}",
                           'title': title, 'page': page, 'optional': bool(optional),
                           'phase': {'发展': 'investigation', '悬念': 'escalation',
                                     '高潮': 'finale', '结局': 'aftermath'}[kind]})
        assert len(scenes) >= 7, f"Incomplete contents page: {adventure['id']}"
        for scene in scenes:
            following = [s['page'] for s in scenes if s['page'] > scene['page']]
            scene['endPage'] = min(following) if following else min(adventure['end'], scene['page'] + 1)
        intro = {'id': adventure['id'] + '-intro', 'title': '引子', 'page': adventure['intro'], 'endPage': scenes[0]['page']}
        for scene in [intro] + scenes:
            scene['nextSceneIds'] = outgoing(book, scene, [intro] + scenes)
        openings[adventure['id']] = intro['nextSceneIds']
        catalog[adventure['id']] = scenes
        print(f"{adventure['id']}: {len(scenes)} scene references verified")
    (ROOT / 'src/data/streetSceneIndex.json').write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'src/data/streetOpeningRoutes.json').write_text(
        json.dumps(openings, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
