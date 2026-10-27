"""Build a private equipment index from the user's already indexed core PDF."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "red-core-20261010"


def compact(text):
    return re.sub(r"\s+", "", text).replace("®", "").replace("™", "")


def page_text(doc, page):
    return doc["pages"][page - 1].split("©")[0]


def import_equipment(doc):
    items = []

    def add(name, price, page, group, category="gear", **extra):
        name = compact(name)
        identity = hashlib.sha256((group + ":" + name).encode()).hexdigest()[:16]
        item = dict(id="core-" + identity, name=name, category=category,
                    price=price, page=page, group=group,
                    description=f"{group}；具体用途与限制见本机核心规则第{page}页。", **extra)
        items.append(item)
        return item

    # Only mechanical fields and page references are exported, never source paragraphs.
    melee = page_text(doc, 340).split("近战武器类型", 1)[1]
    for row in re.finditer(r"(轻型|中型|重型|超重型)近战武器[\s\S]*?(\dd6)\s+(\d)\s+[是否]\s+([\d,]+)eb", melee):
        add(row[1] + "近战武器", int(row[4].replace(",", "")), 340, "近战武器", "weapon", damage=row[2], rof=int(row[3]))
    ranged = page_text(doc, 341).split("可选射击模式与特殊功能")
    for row in ranged:
        match = re.search(r"([^\n]+)\s+(?:手枪|抵肩枪械|箭术|重型武器)\s+(\dd6)[\s\S]*?([\d,]+)eb", row)
        if match:
            rof = 2 if compact(match[1]) in ["中型手枪", "重型手枪"] else 1
            add(match[1], int(match[3].replace(",", "")), 341, "远程武器", "weapon", damage=match[2], rof=rof)
    assert len(items) == 15, f"Weapon rows: {len(items)}"
    for item in list(items):
        for quality, prices in [("劣质", {50: 20, 100: 50, 500: 100}), ("优良品质", {50: 100, 100: 500, 500: 1000})]:
            add(quality + "·" + item["name"], prices[item["price"]], 342, item["group"], "weapon",
                damage=item["damage"], rof=item["rof"], detail="品质修正及故障由判定时按第342页结算。")

    def price_table(text, page, group, category="gear"):
        text = re.sub(r"(?:物品|配件|武器|弹药类型) 价格", "", text)
        previous = 0
        result = []
        for match in re.finditer(r"([\d,]+)\s*eb\s*（[^）]*）", text):
            name = text[previous:match.start()].strip()
            previous = match.end()
            result.append(add(name, int(match[1].replace(",", "")), page, group, category))
        return result

    price_table(page_text(doc, 343).split("配件 价格", 1)[1].split("▶", 1)[0], 343, "武器配件")
    price_table(page_text(doc, 347).split("武器 价格", 1)[1].split("▶", 1)[0], 347, "异种武器", "weapon")
    price_table(page_text(doc, 351).split("装备总表", 1)[1], 351, "通用装备")

    ammo = price_table(page_text(doc, 345).split("弹药类型 价格", 1)[1].split("▶", 1)[0], 345, "弹药")
    for item in ammo:
        items.remove(item)
        name = item["name"]
        if name == "基础弹药": types = ["中型手枪弹", "重型手枪弹", "超重型手枪弹", "步枪弹", "独头弹", "霰弹", "箭矢"]
        elif name == "穿甲弹药": types = ["中型手枪弹", "重型手枪弹", "超重型手枪弹", "步枪弹", "独头弹", "箭矢", "榴弹", "火箭弹"]
        elif name in ["生物毒素弹药", "毒性弹药", "催眠弹药"]: types = ["箭矢", "榴弹"]
        elif name in ["扩张弹药", "橡胶弹药"]: types = ["中型手枪弹", "重型手枪弹", "超重型手枪弹", "步枪弹", "独头弹", "箭矢"]
        elif name == "燃烧弹药": types = ["中型手枪弹", "重型手枪弹", "超重型手枪弹", "步枪弹", "独头弹", "霰弹", "箭矢", "榴弹"]
        elif name == "智能弹药": types = ["中型手枪弹", "重型手枪弹", "超重型手枪弹", "步枪弹", "独头弹", "箭矢", "火箭弹"]
        else: types = ["榴弹"]
        for kind in types:
            unit = "1枚" if kind in ["榴弹", "火箭弹"] else "10发"
            add(name + "·" + kind + "（" + unit + "）", item["price"], 345, "弹药",
                detail="按所选口径和包装计价；特殊弹药效果与使用限制见344–347页，购买不自动装填或消耗。")

    armor = page_text(doc, 350).split("皮衣：", 1)[0].split("价格", 1)[1]
    for match in re.finditer(r"([^\n]+(?:\n®)?)\s+(\d+)\s+(无|-\d\s+反应、敏捷和移动)\s+([\d,]+)eb", armor):
        name, sp, penalty, price = compact(match[1]), int(match[2]), match[3], int(match[4].replace(",", ""))
        if name == "博维生命紧身服":
            add(name, price, 350, "护甲", "armor", armorSp=sp, armorZone="both")
        else:
            for zone, label in [("head", "头部"), ("body", "身体")]:
                extra = dict(armorPenalty=0 if penalty == "无" else abs(int(penalty.split()[0])))
                add(name + "（" + label + "）", price, 350, "护甲", "armor", armorSp=sp, armorZone=zone, **extra)
    add("防弹盾", 100, 350, "护甲", "armor", detail="盾牌生命值10；购买不增加人物护甲SP，持用与承伤按183页处理。")

    fashion = page_text(doc, 356)
    styles = ["流浪贵妇风", "帮派风", "大众潮流风", "波西米亚风", "休闲风", "游民皮革风", "亚洲流行风", "都市闪耀风", "商务风", "高级时装风"]
    parts = ["下装", "上衣", "夹克", "鞋", "饰品", "镜面墨镜", "眼镜", "隐形眼镜", "帽子"]
    for index, style in enumerate(styles):
        segment = fashion.split(style, 1)[1].split(styles[index + 1], 1)[0] if index < len(styles) - 1 else fashion.split(style, 1)[1]
        prices = re.findall(r"([\d,]+)\s*eb", segment)
        assert len(prices) == 9, f"Fashion columns: {style}"
        for part, price in zip(parts, prices):
            add(style + part, int(price.replace(",", "")), 356, "时装", "fashion")
    drug_table = page_text(doc, 357).split("每剂价格", 1)[1].split("▶", 1)[0]
    for match in re.finditer(r"([^\n]+?)\s+\d+小时\s+\d+\s+([\d,]+)eb", drug_table):
        add(match[1] + "（1剂）", int(match[2].replace(",", "")), 357, "街头药物",
            detail="购买仅登记物品；使用、人性损失、持续时间和成瘾检定需按357–358页结算。")

    # Preserve section markers to map installation positions, not narrative guesses.
    section = "fashion"
    cyber_count = 0
    for page in range(358, 368):
        text = page_text(doc, page)
        text = re.sub(r"^\d+\n新街头经济\n", "", text)
        text = text.replace("名称 安装 描述与数据 价格 人性 \n损失\n", "")
        text = re.sub(r"（1d6/2\s+向上取整）", "（1d6/2向上取整）", text)
        headings = list(re.finditer(r"▶[^\n]+", text))
        starts = list(re.finditer(r"(?m)^([^\n（）▶0-9][^\n]*?(?:\n[^\n（）▶0-9][^\n]*?)?)\s+(商场|诊所|医院|N/A)\s+", text))
        for index, match in enumerate(starts):
            for heading in headings:
                if heading.start() < match.start():
                    label = heading[0]
                    for title, value in [("时尚组件", "fashion"), ("神经组件", "neural"), ("赛博光学", "eye"), ("赛博音频", "audio"), ("体内赛博", "internal"), ("体外赛博", "external"), ("赛博义体", "limb"), ("赛博格组件", "borg")]:
                        if title in label: section = value
            body = text[match.end(): starts[index + 1].start() if index + 1 < len(starts) else len(text)]
            name = compact(match[1])
            name = re.sub(r"^▶.*?）", "", name)
            hl = re.search(r"(?:\n|）)\s*(\d+)\s*（((?:\dd6|N/A)[^）]*)）", body)
            prices = re.findall(r"([\d,]+)eb", body[:hl.start()] if hl else body)
            assert prices and hl, f"Cyberware parse failed p{page}: {name}"
            loss = int(hl[1])
            extra = dict(humanityLoss=loss)
            if loss: extra["humanityDice"] = compact(hl[2])
            if section == "eye": slots = ["leftEye", "rightEye"]
            elif section == "limb":
                slots = ["leftLeg", "rightLeg"] if "赛博义腿" in body or "义足" in name or name in ["抓地足", "跳跃助推器", "滑轮足", "利爪足", "蹼足"] else ["leftArm", "rightArm"]
                if name in ["强悍防护", "塑料外壳", "真实皮肤覆盖层", "超铬覆盖层"]: slots = ["leftArm", "rightArm", "leftLeg", "rightLeg"]
            else: slots = [section]
            if section == "neural" and match[2] == "N/A":
                extra["manualReason"] = "芯片需选择具体技能/芯片槽位并核对首次使用的人性损失，暂由GM登记。"
            elif section == "borg" or any(word in body for word in ["成对", "肉体", "自备", "体魄提升", "体魄提高", "SP7", "SP11", "可以安装多个", "安装多组"]):
                extra["manualReason"] = "涉及成对、特殊前置或额外效果；请核对原文并由GM登记，暂不自动安装。"
            if name == "赛博义眼": extra.pop("manualReason", None)
            if name in ["神经链接", "赛博义眼", "赛博音频套件", "赛博手臂", "赛博义腿"]:
                extra.pop("manualReason", None)
                extra.update(base=True, capacity={"神经链接": 5, "赛博义眼": 3, "赛博音频套件": 3, "赛博手臂": 4, "赛博义腿": 3}[name])
            elif section in ["neural", "eye", "audio", "limb"]:
                extra["requiredBase"] = {"neural": "neural-link", "eye": "cybereye", "audio": "audio-suite", "limb": "cyberleg" if slots == ["leftLeg", "rightLeg"] else "cyberarm"}[section]
            used = re.search(r"占用(\d)个", compact(body))
            if used: extra["slotsUsed"] = int(used[1])
            if "不占用" in body: extra["slotsUsed"] = 0
            if len(slots) == 4: extra["manualReason"] = "通用义肢组件需核对对应手臂/腿基础及覆层状态，暂由GM登记。"
            if name == "皮下握把": extra["manualReason"] = "同时涉及神经槽位与手部安装，暂由GM核对登记。"
            if name == "技能芯片": extra["manualReason"] = "按技能计价500/1000eb，需选择具体技能及芯片槽位后由GM登记。"
            if name == "荧光纹身": extra["manualReason"] = "可安装多份且涉及累计衣着加值，暂由GM核对登记。"
            flat = compact(body)
            if "成对" in flat and not extra.get("base") and len(slots)==2:
                extra.pop("manualReason", None)
                extra["paired"] = True
            if name in ["荧光纹身", "芯片槽位", "交互界面插口"]:
                extra.pop("manualReason", None)
                extra["repeatable"] = True
            if "肉体" in flat and section=="limb" and "自备" not in flat:
                extra.pop("manualReason", None)
                extra["allowMeat"] = True
            if name in ["强悍防护", "塑料外壳", "真实皮肤覆盖层", "超铬覆盖层"]:
                extra.pop("manualReason", None)
            if name == "技能芯片":
                extra["priceLabel"] = "500 / 1000eb（按技能类别）"
            weapon = re.search(r"(\dd6)伤害，攻击速度(\d)", flat)
            if weapon:
                extra.update(damage=weapon[1], rof=int(weapon[2]))
            if "manualReason" in extra:
                extra["manualReason"] = {
                    "皮下握把": "待配置：需同时指定手部安装方式与神经槽位，当前不自动安装。",
                    "技能芯片": "待配置：需选择具体技能和芯片槽位；普通技能500eb，双倍计费技能1000eb。",
                    "肉骨编织": "待配置：需核算体魄上限及生命值变化，当前不自动应用。",
                    "皮肤织甲": "待配置：需关联头身SP7及每日修复，当前不自动应用。",
                    "皮下护甲": "待配置：需关联头身SP11及每日修复，当前不自动应用。",
                }.get(name, "待配置：" + ("需配置基础属性、扩展肢体或新增槽位；当前不自动应用。" if section=="borg" else "需指定芯片槽、肉体/义肢安装方式或自备设备；当前不自动安装。"))
            item = add(name, int(prices[-1].replace(",", "")), page, "赛博组件", "cyberware", slots=slots, **extra)
            item["description"] = re.split(r"[。\n]", body.strip(), maxsplit=1)[0][:80] + "。具体限制见原文。"
            effect=re.sub(r"^(可选[^。]+组件。|芯片组件。)", "", flat)
            price_start=effect.rfind(prices[-1]+"eb")
            if price_start>=0: effect=effect[:price_start]
            item["detail"]=effect[:160]+("…" if len(effect)>160 else "")
            cyber_count += 1

    # Deck hardware and software have different purchase/install semantics from implants.
    hardware = page_text(doc, 368).split("赛博碟板硬件", 1)[1].split("程序\n▶", 1)[0]
    names = ["备份驱动器", "DNA锁", "强化电路", "绝缘导线", "崩溃屏障", "范围升级"]
    for name in names:
        start = hardware.index(name)
        price = re.search(r"([\d,]+)eb", hardware[start:])
        add(name, int(price[1].replace(",", "")), 368, "碟板硬件", detail="仅购入背包；安装时需手动核对碟板硬件槽位与效果。")
    for page in range(368, 372):
        text = page_text(doc, page)
        text = text[text.index("▶ 强化者"):] if page == 368 else text
        for match in re.finditer(r"(?m)^([^\n（）▶0-9][^\n]*?)\s+(强化者|防御者|反程序|反人员)\s+(?:(攻击者|黑冰)\s+)?((?:\d+\s+){2,4}\d+)", text):
            body = text[match.end():].split("图标：", 1)[0]
            price = re.search(r"([\d,]+)eb", body)
            assert price, f"Program price p{page} {match[1]}"
            name = "快枪手冈萨雷斯" if match[1] == "冈萨雷斯" else match[1]
            add(name, int(price[1].replace(",", "")), page, "黑冰" if match[3] == "黑冰" else "网行程序",
                detail="购入背包，不自动激活；碟板槽位、程序数据及运行效果请核对本页。")

    # Vehicles are indexed too; configurable cabins must never be sold at a unit price.
    vehicle_names = {190: ["公路摩托", "超级摩托", "紧凑型公路车", "高性能公路车", "超级公路车", "摩托艇", "快艇", "客舱巡航艇", "游艇"],
                     191: ["旋翼机", "直升机", "AV-4 多用途\n浮空车", "AV-9 超级浮空车", "飞艇"]}
    for page, names in vehicle_names.items():
        text = page_text(doc, page)
        for name in names:
            body = text[text.index(name):]
            price = re.search(r"([\d,]+)eb", body)
            extra = dict(minUnits=4 if name=="游艇" else 2, unitLabel="舱室") if name in ["客舱巡航艇", "游艇", "飞艇"] else {}
            add(name, int(price[1].replace(",", "")), page, "载具", **extra)

    for page in [373, 374, 375]:
        text = compact(page_text(doc, page))
        # Each defense row ends with its countermeasure DV; prices come from p373.
        # Names are anchored against the actual table's rows to exclude body continuations.
        names = {373: ["空中蜂群\n无人机云", "地面无人机", "大型空中无人机", "迷你空中无人机", "蜘蛛步行无人机"],
                 374: ["自动血雾群", "自动近战武器", "自动炮塔", "监控摄像头", "缠足地板", "电击地板"],
                 375: ["激光网格", "陷阱地板", "粘液", "天花板／墙壁重\n击器", "滑腻地板", "眩晕面板", "催眠瓦斯电梯"]}[page]
        assert len(re.findall(r"DV(?:9|13|17|21)\s*电子/安防技术", text)) == len(names), f"Defense rows p{page}"
        for name in names:
            body = text[text.index(compact(name)):]
            dv = re.search(r"DV(9|13|17|21)\s*电子/安防技术", body)[1]
            add(name, {"9": 500, "13": 1000, "17": 5000, "21": 10000}[dv], page, "住宅防御",
                detail="按373页控制节点设施价格购入；触发、控制节点、武器及网络空间需另行配置，不自动部署。")
    for name, price in re.findall(r"(?m)^([^\n]+?)\s+\d+\s+\d+\s+\d+\s+\d+\s+([\d,]+)eb", page_text(doc, 372)):
        add(name, int(price.replace(",", "")), 372, "网络恶魔", detail="购入后需人工配置到网络空间；不占用个人赛博碟板的程序槽。")

    for page in range(352,356):
        text=page_text(doc,page)
        definitions=list(re.finditer(r"(?m)^([^\n：]{1,45})：",text))
        for index,match in enumerate(definitions):
            name=compact(match[1])
            item=next((item for item in items if item["category"]=="gear" and item["name"]==name),None)
            if item:
                body=compact(text[match.end():definitions[index+1].start() if index+1<len(definitions) else len(text)])
                item["detail"]=body[:160]+("…" if len(body)>160 else "")

    for item in items:
        bonus=None
        if item["name"]=="智能代理" or item["name"]=="内置智能代理":
            bonus=dict(skills=["library-search"],value=2,condition="tool",group="agent",page=352)
        elif item["name"]=="医疗扫描仪":
            bonus=dict(skills=["first-aid","paramedic"],value=2,condition="tool",group="medical-scanner",page=354)
        elif item["name"]=="技术扫描仪":
            bonus=dict(skills=["basic-tech","cybertech","land-vehicle-tech","sea-vehicle-tech","air-vehicle-tech","electronics-security-tech","weaponstech"],value=2,condition="tool",group="tech-scanner",page=355)
        elif item["name"]=="听觉增强":
            bonus=dict(skills=["perception"],value=2,condition="auditory",group="hearing-boost",page=361)
        elif item["name"]=="图像增强":
            bonus=dict(skills=["perception","lip-reading","conceal-reveal-object"],value=2,condition="visual",group="image-enhance",page=360)
        if bonus: item["checkBonuses"]=[bonus]

    # Reuse all 38 historical IDs/names so existing purchases and undo remain valid.
    catalog_source = (ROOT / "src/data/creationCatalog.ts").read_text(encoding="utf-8")
    legacy = [dict(id=m[1], name=m[2], category=m[3]) for m in re.finditer(r"id:'([^']+)',name:'([^']+)',category:'([^']+)'", catalog_source)]
    assert len(legacy) == 38, "Historical catalog changed; review ID mappings."
    aliases = {"皮衣防护（头部）": "皮衣（头部）", "皮衣防护（身体）": "皮衣（身体）",
               "赛博碟板": "赛博碟板（标准品质）", "绳索（60米）": "绳索（60米）", "“狗粮”包（一餐）": "“狗粮”包",
               "基础手枪弹药（10发）": "基础弹药·中型手枪弹（10发）", "基础步枪弹药（10发）": "基础弹药·步枪弹（10发）"}
    for old in legacy:
        target = next((item for item in items if item["name"] == aliases.get(old["name"], old["name"]) and item["category"] == old["category"]), None)
        assert target, f"Unmapped legacy equipment: {old['name']}"
        target.update(id=old["id"], name=old["name"])
    assert cyber_count == 96, f"Cyberware rows: {cyber_count}"
    from collections import Counter
    expected = {"近战武器": 12, "远程武器": 33, "武器配件": 8, "异种武器": 14, "通用装备": 53,
                "弹药": 52, "护甲": 16, "时装": 90, "街头药物": 5, "赛博组件": 96, "碟板硬件": 6,
                "网行程序": 15, "黑冰": 12, "载具": 14, "住宅防御": 18, "网络恶魔": 3}
    assert Counter(item["group"] for item in items) == expected, "Equipment section coverage changed"
    assert len({item["id"] for item in items}) == len(items), "Duplicate IDs"
    assert all(item["name"] and "\n" not in item["name"] and item["price"] > 0 for item in items)
    assert all("图标" not in item["name"] and "名称类别" not in item["name"] for item in items)
    for name, category, price in [("追踪器", "cyberware", 100), ("独立供氧系统", "cyberware", 1000), ("回见", "gear", 20), ("博维生命紧身服", "armor", 1000)]:
        assert next(item for item in items if item["name"] == name and item["category"] == category)["price"] == price
    return dict(schemaVersion=1, sourceId=SOURCE, sourcePageCount=doc["pageCount"], items=items)


if __name__ == "__main__":
    documents = json.loads((ROOT / ".local-sources/documents.json").read_text(encoding="utf-8"))
    data = import_equipment(next(doc for doc in documents if doc["id"] == SOURCE))
    output = ROOT / ".local-sources/equipment.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    from collections import Counter
    print(json.dumps(dict(count=len(data["items"]), groups=Counter(item["group"] for item in data["items"])), ensure_ascii=False))
