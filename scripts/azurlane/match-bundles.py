"""
Ghép tàu (AzurAPI) với bundle Live2D trong danh sách của máy chủ: tên bundle = pinyin tên Trung của tàu (không dấu, liền nhau) + "_<số skin>"
(skin mặc định không có hậu tố; "_hx" là bản "hài hoà" của một skin, bỏ qua).

  tools/azl-venv/bin/python scripts/azurlane/match-bundles.py [EN]            # in bảng các tàu có Live2D và khớp được
  tools/azl-venv/bin/python scripts/azurlane/match-bundles.py EN --json out.json

Chỉ đọc dữ liệu đã lưu đệm ở ~/Developer/Personal/.azl-cache (azurapi-ships.json và hashes/<client>/L2D.csv do fetch-azurlane.mjs và list-bundles.py tạo).
"""
import json
import os
import re
import sys
from pathlib import Path

from pypinyin import lazy_pinyin

CACHE = Path(os.environ.get("AZL_CACHE", Path.home() / "Developer/Personal/.azl-cache"))
client = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "EN"
ships = json.loads((CACHE / "azurapi-ships.json").read_text())
bundles = [l.split(",")[0].split("/")[1] for l in (CACHE / "hashes" / client / "L2D.csv").read_text().splitlines() if l]
bundles = [b for b in bundles if not b.endswith("_hx")]


def prefix(cn: str) -> str:
    # "Z23" giữ nguyên; chữ Trung -> pinyin liền nhau; bỏ ký tự khác.
    out = "".join(p if re.fullmatch(r"[A-Za-z0-9]+", p) else "" for p in lazy_pinyin(cn))
    return out.lower()


# Tên bundle thường bỏ danh xưng ở cuối tên Trung (亲王 = Prinz, 伯爵 = Graf, 女王, 海军上将...) và đôi khi viết pinyin hơi khác, nên thử thêm vài biến thể.
SUFFIXES = ("亲王", "伯爵", "女王", "海军上将", "公爵", "元帅")
ALIASES = {  # pinyin trong game khác pypinyin
    "aimierbeierting": "aimierbeierding",  # Émile Bertin
    "baerdemo": "baerdimo",  # Baltimore
    "bideshitelasai": "shitelasai",  # Peter Strasser
}


def prefix_variants(cn: str):
    out = [prefix(cn)]
    for suf in SUFFIXES:
        if cn.endswith(suf):
            out.append(prefix(cn[: -len(suf)]))
    return [ALIASES.get(v, v) for v in dict.fromkeys(out)]


def bundles_of(pre: str):
    return sorted(b for b in bundles if b == pre or re.fullmatch(re.escape(pre) + r"_\d+(_[a-z0-9]+)?", b))


rows = []
for s in ships:
    cn = s["names"].get("cn") or ""
    pre = ""
    bs = []
    for v in prefix_variants(cn):
        bs = bundles_of(v)
        if bs:
            pre = v
            break
    if not pre:
        continue
    l2d = [k["name"] for k in s["skins"] if (k.get("info") or {}).get("live2dModel")]
    if not l2d:
        continue
    if not bs:
        continue
    rows.append({"id": s["id"], "en": s["names"]["en"], "cn": cn, "rarity": s["rarity"], "nation": s["nationality"], "hull": s["hullType"], "prefix": pre, "l2dSkins": l2d, "bundles": bs})

if "--json" in sys.argv:
    Path(sys.argv[sys.argv.index("--json") + 1]).write_text(json.dumps(rows, ensure_ascii=False, indent=1))
rank = {"Ultra Rare": 0, "Decisive": 1, "Priority": 2, "Super Rare": 3, "Elite": 4, "Rare": 5, "Normal": 6}
rows.sort(key=lambda r: (rank.get(r["rarity"], 9), r["en"]))
print(f"{len(rows)} tàu có skin Live2D và có bundle trong {client}")
for r in rows:
    flag = "OK " if len(r["l2dSkins"]) == len([b for b in r["bundles"]]) else "?  "
    print(f"{flag}{r['rarity']:10s} {r['en']:26s} {r['prefix']:18s} bundles={r['bundles']} | L2D skins={r['l2dSkins']}")


# ───────── chọn tàu "đáng chú ý" → selection.json ─────────
# Tiêu chí: mọi tàu từ Super Rare trở lên (Super Rare, Priority, Decisive, Ultra Rare) cộng một số tàu Elite được nhiều người thích. Sửa hai tập dưới đây
# (hoặc sửa thẳng selection.json) rồi chạy lại. Tên skin chính thức chỉ được gán khi số bundle bằng đúng số skin Live2D mà AzurAPI biết (bundle có số
# nhỏ hơn = skin đứng trước, đã đối chiếu bằng mắt); còn lại để null và đặt tên trung tính "Skin <số>", ảnh thẻ dựng từ chính Live2D.
# Bundle bị mã hoá (skin mới nhất của game): UnityPy báo "BundleFile is encrypted". Không thể tách nếu không có khoá, và dò khoá từ file của game là vượt qua
# cơ chế bảo vệ của game nên KHÔNG làm; bỏ qua các bundle này.
SKIP = {"chaijun_6"}
TOP = {"Ultra Rare", "Decisive", "Priority", "Super Rare"}
ELITE_PICK = {"Unicorn", "Gneisenau", "Glorious", "Vampire", "Black Prince", "Surcouf", "Dunkerque", "Fubuki", "Cleveland", "Kashino", "St. Louis", "Ark Royal"}

if "--select" in sys.argv:
    sel_file = Path(__file__).with_name("selection.json")
    current = json.loads(sel_file.read_text()) if sel_file.exists() else []
    have = {e["bundle"] for e in current}

    def natural(b):
        return [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", b)]

    added = 0
    for r in rows:
        if not (r["rarity"] in TOP or r["en"] in ELITE_PICK):
            continue
        bs = sorted(r["bundles"], key=natural)
        known = r["l2dSkins"]
        exact = len(bs) == len(known)
        for i, b in enumerate(bs):
            if b in have or b in SKIP:
                continue
            current.append({"bundle": b, "ship": r["en"], "skin": known[i] if exact else None})
            added += 1
    sel_file.write_text(json.dumps(current, ensure_ascii=False, indent=1) + "\n")
    print(f"selection.json: {len(current)} bundle ({added} mới)")
