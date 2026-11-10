"""
Lấy DANH SÁCH bundle asset của Azur Lane (chỉ file văn bản "path,size,md5", không tải asset nào) rồi lưu vào thư mục dữ liệu ngoài dự án.
Dùng thư viện azlassets (cài trong tools/azl-venv). Server mặc định EN.

  tools/azl-venv/bin/python scripts/azurlane/list-bundles.py [EN|JP|CN|KR|TW]

Kết quả: <cache>/hashes/<client>/<LOẠI>.csv và bản tóm tắt in ra màn hình. Thư mục dữ liệu mặc định ~/Developer/Personal/.azl-cache
(đặt AZL_CACHE để đổi). Dữ liệu thô nằm NGOÀI dự án vì rất nặng: để trong dự án thì Tailwind/VS Code quét hết và máy lag.
"""
import asyncio
import os
import sys
from collections import Counter
from pathlib import Path

from azlassets import config, downloader, protobuf
from azlassets.classes import Client
from azlassets.versioncontrol import parse_version_string

CACHE = Path(os.environ.get("AZL_CACHE", Path.home() / "Developer/Personal/.azl-cache"))


async def main(client_name: str) -> None:
    os.chdir(CACHE)  # azlassets đọc config/userconfig.toml theo thư mục hiện tại
    userconfig = config.load_userconfig()
    clientconfig = config.load_client_config(Client[client_name])
    resp = protobuf.get_version_response(clientconfig.gateip, clientconfig.gateport)
    if not resp:
        sys.exit("Máy chủ không trả về thông tin phiên bản.")
    out = CACHE / "hashes" / client_name
    out.mkdir(parents=True, exist_ok=True)
    async with downloader.AzurlaneAsyncDownloader(clientconfig.cdnurl, useragent=userconfig.useragent) as session:
        for raw in resp.pb.version:
            if not raw.startswith("$"):
                continue
            try:
                v = parse_version_string(raw.strip())
            except NotImplementedError:
                print(f"  (bỏ qua loại phiên bản lạ: {raw.strip()})")
                continue
            text = await session.download_hashes(v)
            if not text:
                continue
            (out / f"{v.version_type.name}.csv").write_text(text)
            rows = [l.split(",") for l in text.splitlines() if l]
            top = Counter()
            size = Counter()
            for path, sz, _ in rows:
                d = path.split("/")[0]
                top[d] += 1
                size[d] += int(sz)
            print(f"{v.version_type.name} {v.version}: {len(rows)} file, {sum(size.values()) / 1e6:.0f} MB")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "EN"))
