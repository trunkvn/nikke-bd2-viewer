"""
Chọn tàu "đáng chú ý" cho viewer từ danh sách bundle Live2D của máy chủ và các bảng của game (AzurLaneData, bảng EN), ghi:
  scripts/azurlane/selection.json   [{ bundle, ship, skin: null }]   (skin để null: tên lấy từ bảng ship_skin_template lúc dựng dữ liệu)
  scripts/azurlane/ships.json       { "<tên tàu>": { rarity, nation, hull, stars } }   (từ bảng, dùng cho cả tàu mới hơn dữ liệu AzurAPI)

Cách ghép: bundle → dòng ship_skin_template có `painting` trùng tên bundle → `ship_group` → tàu trong ship_data_statistics/template (cùng nhóm).
Tiêu chí: mọi tàu Super Rare, Priority, Decisive, Ultra Rare cộng một số tàu Elite được nhiều người thích (sửa ELITE_PICK). Bundle bị mã hoá
(UnityPy báo "BundleFile is encrypted") không tách được và dò khoá là vượt qua cơ chế bảo vệ của game nên bỏ qua (SKIP).

  tools/azl-venv/bin/python scripts/azurlane/select.py [EN] [--dry-run]

Cần: danh sách bundle (list-bundles.py) và các bảng trong ~/Developer/Personal/.azl-cache (script tự tải các bảng còn thiếu từ AzurLaneData).
"""
import collections
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

CACHE = Path(os.environ.get("AZL_CACHE", Path.home() / "Developer/Personal/.azl-cache"))
HERE = Path(__file__).parent
client = next((a for a in sys.argv[1:] if re.fullmatch(r"[A-Z]{2}", a)), "EN")
dry = "--dry-run" in sys.argv

# Ý nghĩa của các mã trong bảng (suy ra bằng cách đối chiếu với các tàu đã biết).
NATIONS = {"1": "Eagle Union", "2": "Royal Navy", "3": "Sakura Empire", "4": "Iron Blood", "5": "Dragon Empery", "6": "Sardegna Empire",
           "7": "Northern Parliament", "8": "Iris Libre", "9": "Vichya Dominion", "96": "Tempesta", "97": "META", "98": "Universal",
           "101": "Neptunia", "104": "Kizuna AI", "105": "Hololive", "106": "Venus Vacation", "107": "The Idolmaster", "108": "SSSS", "109": "Atelier Ryza"}
HULLS = {"1": "Destroyer", "2": "Light Cruiser", "3": "Heavy Cruiser", "4": "Battlecruiser", "5": "Battleship", "6": "Light Carrier", "7": "Aircraft Carrier",
         "8": "Submarine", "12": "Repair", "13": "Monitor", "17": "Submarine Carrier", "18": "Large Cruiser", "19": "Munition Ship", "22": "Sailing Frigate"}
TOP = {"Ultra Rare", "Decisive", "Priority", "Super Rare"}
ELITE_PICK = {"Unicorn", "Gneisenau", "Glorious", "Vampire", "Black Prince", "Surcouf", "Dunkerque", "Fubuki", "Cleveland", "Kashino", "St. Louis", "Ark Royal"}
# Bundle bị mã hoá (skin mới nhất): xem docstring.
SKIP = {"chaijun_6"}

RAW = "https://raw.githubusercontent.com/AzurLaneTools/AzurLaneData/main"
TABLES = {"ship_skin_template": "EN/ShareCfg/ship_skin_template.json", "ship_data_statistics": "EN/sharecfgdata/ship_data_statistics.json", "ship_data_template": "EN/sharecfgdata/ship_data_template.json"}


def table(name):
    f = CACHE / "azl-data" / f"{name}.json"
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(f"{RAW}/{TABLES[name]}", headers={"User-Agent": "interactive-anime-local-fetch (personal fan project)"})
        f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return json.loads(f.read_text())


skins, stats, tpl = table("ship_skin_template"), table("ship_data_statistics"), table("ship_data_template")
sizes = {l.split(",")[0].split("/")[1]: int(l.split(",")[1]) for l in (CACHE / "hashes" / client / "L2D.csv").read_text().splitlines() if l}

ids_of_group = collections.defaultdict(list)
for i, t in tpl.items():
    ids_of_group[str(t["group_type"])].append(i)
ship_of_group = {}
for g, ids in ids_of_group.items():
    for i in sorted(ids):
        if i in stats:
            ship_of_group[g] = (stats[i], tpl[i])
            break
by_painting = collections.defaultdict(list)
for s in skins.values():
    by_painting[s["painting"].lower()].append(s)


def rarity_of(r):
    code, plan = str(r["rarity"]), "Plan-Class" in str(r.get("tag_list") or "")  # tàu nghiên cứu (PR, DR) mang thẻ Plan-Class
    return {"2": "Normal", "3": "Rare", "4": "Elite"}.get(code) or {"5": "Priority" if plan else "Super Rare", "6": "Decisive" if plan else "Ultra Rare"}.get(code, code)


ships = {}  # tên tàu -> { info..., bundles }
for bundle in sizes:
    if bundle.endswith("_hx") or bundle in SKIP:
        continue
    cand = [s for s in by_painting.get(bundle.lower(), []) if "{" not in s["name"] and str(s["ship_group"]) in ship_of_group]
    if not cand:
        continue
    r, t = ship_of_group[str(cand[0]["ship_group"])]
    name = r["name"].strip()
    if re.search(r"[぀-ヿ一-鿿]", name):  # tên chưa có bản tiếng Anh
        continue
    rarity = rarity_of(r)
    s = ships.setdefault(name, {"bundles": []})
    s["bundles"].append(bundle)
    s["info"] = {"rarity": rarity, "nation": NATIONS.get(str(r["nationality"]), "Other"), "hull": HULLS.get(str(r["type"]), "Other"), "stars": {"Normal": 4, "Rare": 4, "Elite": 5}.get(rarity, 6)}

sel_file, ships_file = HERE / "selection.json", HERE / "ships.json"
selection = json.loads(sel_file.read_text()) if sel_file.exists() else []
have = {e["bundle"] for e in selection}
added, chosen = 0, {}
for name, s in sorted(ships.items()):
    if not (s["info"]["rarity"] in TOP or name in ELITE_PICK):
        continue
    chosen[name] = s["info"]
    for b in sorted(s["bundles"], key=lambda x: [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", x)]):
        if b not in have:
            selection.append({"bundle": b, "ship": name, "skin": None})
            added += 1
# Tàu đã có trong selection.json nhưng không còn khớp tiêu chí/tên (ví dụ tên tự đặt) vẫn giữ metadata nếu bảng biết.
for e in selection:
    if e["ship"] in ships:
        chosen.setdefault(e["ship"], ships[e["ship"]]["info"])
    else:
        print(f"! {e['ship']} ({e['bundle']}): không thấy trong bảng của game, giữ nguyên")
mb = sum(sizes[e["bundle"]] for e in selection if e["bundle"] in sizes) / 1e6
print(f"{len(ships)} tàu có Live2D nhận diện được ở {client}; selection.json: {len(selection)} bundle, {len({e['ship'] for e in selection})} tàu ({added} bundle mới), {mb:.0f} MB bundle")
if not dry:
    sel_file.write_text(json.dumps(selection, ensure_ascii=False, indent=1) + "\n")
    ships_file.write_text(json.dumps(dict(sorted(chosen.items())), ensure_ascii=False, indent=1) + "\n")
