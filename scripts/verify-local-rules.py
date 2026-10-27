"""Read-only checks against the user's private indexed books; prints no book prose."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def compact(value):
    return re.sub(r'\s+', '', value)


books = read(ROOT / '.local-sources/documents.json')
core = next(book for book in books if book['id'] == 'red-core-20261010')
stories = next(book for book in books if book['id'] == 'red-streets-20261010')
checks = [
    (79, ['10+', '体魄与意志的平均值', '向上取整'], 'HP formula and rounding'),
    (90, ['86点技能点', '不能高于6级', '至少达到2级'], 'complete-package skill budgets'),
    (105, ['800eb', '没花完的钱直接作废'], 'separate fashion budget'),
    (146, ['先攻反应', '先攻检定+1', '失手挽回', '仍按1计算'], 'Solo initiative and fumble recovery'),
    (186, ['低于最大生命值的一半', '所有动作判定-2'], 'seriously wounded boundary'),
    (230, ['上限降低2点', '上限降低4点'], 'cyberware humanity ceilings'),
]
for page, phrases, label in checks:
    text = compact(core['pages'][page - 1])
    assert all(phrase in text for phrase in phrases), f'CHECK REQUIRED: PDF {page}: {label}'
    print(f'PASS core PDF {page}: {label}')

index = read(ROOT / 'src/data/streetSceneIndex.json')
adventures = read(ROOT / 'src/data/streetAdventures.json')
count = 0
for adventure in adventures:
    scenes = index[adventure['id']]
    ids = {scene['id'] for scene in scenes} | {adventure['id'] + '-intro'}
    for scene in scenes:
        assert adventure['start'] <= scene['page'] <= scene['endPage'] <= adventure['end']
        assert compact(scene['title']) in compact(''.join(stories['pages'][scene['page'] - 1:scene['endPage']])), scene['id']
        assert set(scene['nextSceneIds']) <= ids, scene['id']
        count += 1
    print(f"PASS {adventure['id']}: {len(scenes)} title/page references")
print(f'PASS {len(adventures)} adventures, {count} indexed headings. Not a full narrative or NPC-stat certification.')

equipment_path = ROOT / '.local-sources/equipment.json'
if equipment_path.exists():
    items = read(equipment_path)['items']
    assert len({item['id'] for item in items}) == len(items)
    assert all(isinstance(item['price'], int) and item['price'] >= 0
               and isinstance(item['page'], int) and 1 <= item['page'] <= len(core['pages'])
               and item['name'].strip() for item in items)
    print(f'PASS {len(items)} local equipment metadata records; prices/stat blocks are not individually certified.')
