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


def bundles_of(pre: str):
    return sorted(b for b in bundles if b == pre or re.fullmatch(re.escape(pre) + r"_\d+(_[a-z0-9]+)?", b))


rows = []
for s in ships:
    cn = s["names"].get("cn") or ""
    pre = prefix(cn)
    if not pre:
        continue
    l2d = [k["name"] for k in s["skins"] if (k.get("info") or {}).get("live2dModel")]
    if not l2d:
        continue
    bs = bundles_of(pre)
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
