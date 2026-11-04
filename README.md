# NIKKE Viewer

Gallery + viewer tương tác cho nhân vật NIKKE (Next.js 16, Spine 4.0/4.1). Chạy local, không cần tài khoản.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Repo không kèm dữ liệu nhân vật. Để lấy asset từ cộng đồng (chỉ để dùng local):

```bash
node scripts/fetch-nikke.mjs --list              # nhân vật có thể tải (id, tên, số skin, dung lượng)
node scripts/fetch-nikke.mjs --all --dry-run     # xem trước: bao nhiêu nhân vật/skin/MB, ai bị loại và vì sao
node scripts/fetch-nikke.mjs --all               # tải toàn bộ (~1.9GB), ngắt rồi chạy lại sẽ tiếp tục
node scripts/fetch-nikke.mjs c010 c011           # chỉ vài nhân vật theo id
node scripts/render-posters.mjs --force          # render lại toàn bộ thumbnail (cần Chrome)
```

- Danh sách nhân vật/skin lấy từ repo Nikke-db; NPC và ảnh sự kiện bị loại bằng `filteredCharacterIds.json` của họ.
- Metadata (độ hiếm, class, nguyên tố, súng, hãng, mô tả, ngày phát hành) lấy từ infobox của
  [wiki NIKKE](https://nikke-goddess-of-victory-international.fandom.com) (nội dung CC BY-SA). Nhân vật chưa
  phát hành hoặc không tra được trên wiki sẽ bị bỏ qua (`--include-unmatched` để giữ lại).
- Mỗi skin còn có hai **tư thế chiến đấu**: `aim` (ngắm bắn) và `cover` (nấp), là các skeleton Spine riêng nằm trong
  `l2d/<skin>/aim|cover/`. Script tải cả hai (thêm khoảng 2.2GB, toàn bộ khoảng 4.1GB); dùng `--no-poses` để bỏ qua.
  Trong viewer: hàng "Tư thế" ở dock, phím `P`, hoặc URL `?pose=aim` / `?pose=cover`.
- Khi đã có `data/nikke.local.json` thì nhân vật mock được ẩn (đặt `SHOW_MOCKS=1` để hiện lại).

Asset thuộc bản quyền Shift Up / Level Infinite. `public/assets/` và `data/nikke.local.json` đã nằm trong
`.gitignore`: **đừng commit hay deploy công khai**.

## Giọng nói nhân vật

Giọng gốc của nhân vật, theo ngôn ngữ, đặt trong thư mục `voice/<lang>/` của nhân vật:

```
public/assets/nikke/<id>/voice/
  en/  enter_1.wav ... touch_1.wav ...  captions.json
  ja/  enter_1.mp3 ... touch_1.mp3 ...  captions.json
```

- `enter_*`: nói khi vào xem / đổi sang nhân vật này. `touch_*`: nói khi nhấp vào nhân vật.
- `captions.json` (tuỳ chọn): `{ "touch_1.wav": "Phụ đề hiển thị khi nói" }`.
- `<lang>` là mã 2 chữ cái (`en`, `ja`, `ko`, `zh`); định dạng wav/mp3/ogg/m4a/aac/webm.
- Có từ 2 ngôn ngữ thì khung viewer hiện nút chuyển ngôn ngữ (ưu tiên `ja`, lựa chọn được nhớ lại).
  Chỉ có 1 ngôn ngữ thì dùng ngôn ngữ đó.

Tải giọng tiếng Anh từ wiki cộng đồng (cần đã chạy `fetch-nikke.mjs` cho nhân vật đó):

```bash
node scripts/fetch-voice.mjs --all                # tất cả nhân vật (tiếng Anh); bỏ qua ai đã có voice, --force để tải lại
node scripts/fetch-voice.mjs --all --dry-run      # xem trước độ phủ
node scripts/fetch-voice.mjs c010                 # một nhân vật: 1 câu chào + 2 câu khi nhấp
node scripts/fetch-voice.mjs c010 --enter 3 --touch 6   # lấy nhiều câu hơn
# wiki/ngôn ngữ khác có cùng định dạng trang lời thoại:
node scripts/fetch-voice.mjs c010 --lang ja --api <URL api.php> --page "<Tên trang>"
```

Wiki Fandom quốc tế chỉ có bản tiếng Anh. Với tiếng Nhật/Hàn bạn cần tự có file rồi thả vào `voice/ja/`
theo quy ước trên. Âm thanh thuộc bản quyền Shift Up / Level Infinite và diễn viên lồng tiếng, cũng chỉ để
dùng local như các asset khác.

- Nút loa trong khung viewer để bật/tắt, lựa chọn được nhớ lại.
- Trình duyệt chặn tự phát khi tải thẳng/reload trang: khi đó hiện lời nhắc "Chạm vào khung", và câu chào
  được phát ngay ở lần chạm/nhấn phím đầu tiên. Điều hướng từ gallery thì phát bình thường.
- Khi nói, miệng nhân vật nhép bằng animation `talk_start`/`talk_end` có sẵn trong file Spine.
