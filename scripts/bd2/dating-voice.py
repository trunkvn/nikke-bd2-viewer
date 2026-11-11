"""
Lấy giọng cảnh hẹn hò (Fated Guest) của Brown Dust 2 để dùng LOCAL.

Mỗi tranh Fated Guest có một gói `Interaction_CharNNNNNN` trên CDN của game: một FMOD Bank (bundle Unity không mã hoá) chứa vài chục
tiếng ngắn (0,5–2 giây) tên theo cảm xúc, ví dụ `Char003402_Int_Sigh1_1`, `Int_Excitement2_3`, `Int_Surprise1_2`. Không có bảng ghép từng
chạm với từng tiếng trong gói này nên viewer phát ngẫu nhiên một tiếng khi chạm.

Các bước: (1) hỏi máy chủ game phiên bản bundle hiện hành (cùng cách công cụ ReDustX và chính client dùng), (2) tải gói của từng tranh Fated Guest trong
data/bd2.local.json theo mã `charNNNNNN` của skeleton, (3) trích bank bằng UnityPy, (4) giải mã bằng vgmstream-cli rồi nén Opus/WebM bằng ffmpeg:
    public/assets/bd2/<nhân vật>/<trang phục>/dating-voice/<Cảm xúc><n>_<k>.webm

Giọng nói thuộc Neowiz / Neon Eyes và các diễn viên lồng tiếng: chỉ dùng local, KHÔNG commit, KHÔNG deploy công khai (public/assets/ đã gitignore).
Chỉ đọc bundle không mã hoá; gói nào mã hoá hoặc lỗi thì bỏ qua, không dò khoá.

  tools/azl-venv/bin/python scripts/bd2/dating-voice.py [--only dalvi,yuri] [--dry-run]

Cần: tools/azl-venv (UnityPy), vgmstream-cli (brew install vgmstream), ffmpeg có libopus; chạy scripts/fetch-bd2.mjs và scripts/fetch-bd2-dating.mjs trước.
Chạy lại an toàn: file đã có thì bỏ qua.
"""
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import warnings
from pathlib import Path

import UnityPy

warnings.simplefilter("ignore")
UnityPy.config.FALLBACK_UNITY_VERSION = "2022.3.22f1"  # phiên bản Unity của client (theo UserAgent của game)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "bd2.local.json"
ASSETS = ROOT / "public" / "assets" / "bd2"
CACHE = Path(os.environ.get("BD2_CACHE", Path.home() / "Developer/Personal/.bd2-cache")) / "dating-voice"
UA = "UnityPlayer/2022.3.22f1 (UnityWebRequest/1.0, libcurl/8.5.0-DEV)"
argv = sys.argv[1:]
dry = "--dry-run" in argv
only = {s.strip() for s in argv[argv.index("--only") + 1].split(",")} if "--only" in argv else None

for tool in ("vgmstream-cli", "ffmpeg"):
    if not shutil.which(tool):
        sys.exit(f"Thiếu {tool}: brew install {'vgmstream' if tool == 'vgmstream-cli' else 'ffmpeg'}")


def varint(b, i):
    v = s = 0
    while True:
        c = b[i]
        i += 1
        v |= (c & 0x7F) << s
        s += 7
        if not c & 0x80:
            return v, i


def fields(b):
    """Đọc protobuf tối thiểu (varint và chuỗi) để khỏi cần cài thư viện protobuf."""
    i, out = 0, {}
    while i < len(b):
        k, i = varint(b, i)
        f, w = k >> 3, k & 7
        if w == 0:
            out[f], i = varint(b, i)
        elif w == 2:
            n, i = varint(b, i)
            out[f] = b[i : i + n]
            i += n
        else:
            break
    return out


def bundle_version():
    req = urllib.request.Request(
        "https://mt.bd2.pmang.cloud/MaintenanceInfo", data=b"EAQ=", method="PUT",
        headers={"accept": "*/*", "content-type": "multipart/form-data", "user-agent": UA},
    )
    raw = base64.b64decode(json.load(urllib.request.urlopen(req, timeout=30))["data"])
    return fields(fields(raw)[1])[3].decode()  # MaintenanceInfo.bundle_version


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


# Tranh Fated Guest của dữ liệu hiện có: mã charNNNNNN của skeleton đứng → thư mục đích.
jobs = []
for c in json.loads(DATA.read_text()):
    if only and c["slug"] not in only:
        continue
    for s in c["skins"]:
        m = re.search(r"char(\d+)", s["render"].get("skel", "")) if s.get("dating") else None
        if m:
            jobs.append((m.group(1), ASSETS / c["slug"] / s["id"] / "dating-voice", f"{c['slug']}/{s['id']}"))
print(f"{len(jobs)} tranh Fated Guest")
if dry:
    sys.exit(0)

version = bundle_version()
print("bundle_version", version)
CACHE.mkdir(parents=True, exist_ok=True)
total = 0
for code, dest, label in jobs:
    if dest.exists() and any(dest.glob("*.webm")):
        print(f"= {label}: đã có {len(list(dest.glob('*.webm')))} tiếng")
        continue
    bundle = CACHE / f"char{code}.bundle"
    if not bundle.exists():
        name = f"common-interactionvoice_assets_bundleinteractionvoice/interaction_char{code}.bytes.bundle"
        try:
            req = urllib.request.Request(f"https://cdn.bd2.pmang.cloud/ServerData/Android/HD/{version}/{name}", headers={"User-Agent": UA})
            bundle.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        except Exception as e:  # noqa: BLE001
            print(f"! {label}: không tải được ({e})")
            continue
    try:
        env = UnityPy.load(str(bundle))
        text = next(o.read() for o in env.objects if o.type.name == "TextAsset")
        raw = text.m_Script if isinstance(text.m_Script, (bytes, bytearray)) else text.m_Script.encode("utf-8", "surrogateescape")
    except Exception as e:  # noqa: BLE001
        print(f"! {label}: không mở được bundle ({type(e).__name__}), bỏ qua")
        continue
    with tempfile.TemporaryDirectory() as tmp:
        bank = Path(tmp) / "voice.bank"
        bank.write_bytes(bytes(raw))
        meta = run(["vgmstream-cli", "-m", str(bank)]).stdout
        count = int(re.search(r"stream count: (\d+)", meta).group(1)) if "stream count" in meta else 0
        dest.mkdir(parents=True, exist_ok=True)
        made = 0
        for i in range(1, count + 1):
            info = run(["vgmstream-cli", "-m", "-s", str(i), str(bank)]).stdout
            nm = re.search(r"stream name: (\S+)", info)
            short = re.sub(r"^Char\d+_Int_", "", nm.group(1)) if nm else f"{i}"
            wav = Path(tmp) / f"{i}.wav"
            if run(["vgmstream-cli", "-s", str(i), "-o", str(wav), str(bank)]).returncode:
                continue
            out = dest / f"{short}.webm"
            if run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-c:a", "libopus", "-b:a", "48k", str(out)]).returncode == 0:
                made += 1
        total += made
        print(f"+ {label}: {made}/{count} tiếng")
print(f"Xong: {total} tiếng mới")
