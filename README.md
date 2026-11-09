# NIKKE & Brown Dust 2 Viewer

Gallery + viewer tương tác cho nhân vật NIKKE và Brown Dust 2 (Next.js 16, Spine 4.0/4.1). Chạy local, không cần tài khoản.

- `/` — NIKKE (giao diện tối, góc cạnh, sci-fi).
- `/bd2` — Brown Dust 2 (giao diện tối dịu, gọn và hiện đại: nền than chì xanh, bảng tối viền mảnh, màu nhấn chàm, chữ không chân).

Mỗi game có **layout gốc riêng** (route group `app/(nikke)` và `app/(bd2)`) nên phông, màu, header hoàn toàn khác nhau;
chuyển qua lại giữa hai game là tải trang mới. Phần dùng chung là engine viewer (Spine, zoom/kéo, toàn màn hình).

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

## Brown Dust 2

```bash
node scripts/fetch-bd2.mjs --list              # nhân vật/trang phục có thể tải
node scripts/fetch-bd2.mjs                     # tải toàn bộ (~0.45GB), ghi data/bd2.local.json, render thumbnail
node scripts/fetch-bd2.mjs --only blade,eris   # chỉ vài nhân vật (gộp vào dữ liệu có sẵn)
node scripts/fetch-bd2.mjs --no-posters        # bỏ qua bước render thumbnail (cần Chrome)
```

- Mô hình Spine (4.1) lấy từ [Zormolo/Brown-Dust-2-Assets](https://github.com/Zormolo/Brown-Dust-2-Assets); hạng sao và
  ngày ra mắt từ `CharInfo(Dropped).json` của [myssal/Brown-Dust-2-Asset](https://github.com/myssal/Brown-Dust-2-Asset)
  (có thể thiếu nhân vật mới). Chạy lại an toàn: file đã tải thì bỏ qua.
- Brown Dust 2 **không có tư thế ngắm/nấp** như NIKKE. Thay vào đó mỗi mô hình có chuyển động toàn thân (`idle`,
  `motion`, một số có `_feelingN`) và các biểu cảm khuôn mặt `_faceN` chạy ở track chồng lên idle, kèm bản nhép miệng
  `_faceN_talk`. Trong viewer: hàng "Chuyển động" và "Biểu cảm" ở dock; nhấp vào nhân vật để họ làm một cử động.
- Thumbnail BD2 render ở chế độ `portrait` (`scripts/render-posters.mjs`): căn khung quanh **khuôn mặt thật** của mô hình
  (tâm các attachment mắt/miệng/mũi/lông mày), chừa chỗ cho tai/mũ/sừng phía trên đầu và không bị vũ khí hay hiệu ứng lớn kéo
  lệch. NIKKE vẫn dùng chế độ `bust` cũ. Render lại: `node scripts/fetch-bd2.mjs` (hoặc xoá `thumb.webp` rồi chạy lại).
- Nén texture (tuỳ chọn, giảm khoảng 45% dung lượng mỗi lần xem): `node scripts/optimize-textures.mjs --all --game bd2 --quality 95`.
  Giữ nguyên PNG gốc, thêm `.webp` + `.webp.atlas` và trỏ `data/bd2.local.json` sang đó; `--revert --game bd2` để hoàn tác.
- **Cutscene kỹ năng** (cảnh cắt vào khi nhân vật tung chiêu; 171 trang phục của 69 nhân vật):
  `node scripts/fetch-bd2-cutscenes.mjs` (≈1.5GB mô hình + ≈0.3GB nền và hiệu ứng; `--dry-run` để xem trước, `--only blade,eris`),
  rồi nén texture bằng `optimize-textures.mjs --all --game bd2 --quality 95` (cutscene từ 1.3GB còn khoảng 0.5GB).
  Đây là **animation Spine ghép với ảnh nền, không phải file video** (game cũng dựng thế). Cutscene nằm ở tab **Ultimate** của viewer
  (không còn lớp phủ video riêng): nút "▶ Phát toàn bộ" chạy các pha A, B, C liên tiếp rồi giữ đoạn lặp cuối, nền và các khung hình
  hiệu ứng (đạn găm, mảnh vụn) đổi theo pha.
  **Tự phát:** vào nhân vật có Ultimate là viewer tự mở tab Ultimate và phát toàn bộ (mặc định bật; chỉ khi vào nhân vật, đổi trang
  phục thì không tự phát). Tắt/bật bằng công tắc "Tự phát Ultimate khi vào nhân vật" trong tab Ultimate; lưu trong trình duyệt.
  **Thứ tự chỉnh tay:** `node scripts/fetch-bd2-sequences.mjs` lấy thứ tự phát từng nhân vật (cut_all, cut_A_all, cut_B_all... cùng thời lượng
  từng pha, nhóm chạy song song, giữ/lặp) từ viewer [BD2-L2D-Viewer](https://github.com/jelosus2/BD2-L2D-Viewer) (MIT; đọc như dữ liệu,
  không chạy mã) vào `data/bd2.sequences.local.json` (gitignore). 155/171 trang phục có; "Phát toàn bộ" dùng `cut_all`, các chuỗi còn lại
  (cut_A_all...) hiện thành chip "▶ tên". Trang phục không có thì dùng bộ lập kế hoạch tự động bên dưới. Bỏ 14 bước dùng skeleton phụ
  (2 nhân vật) vì ta không tải skeleton đó.
  Mô hình không kèm nền nên mỗi pha ghép với một ảnh nền (back1, back2... của kho asset) và các khung hiệu ứng (back2-1, back2-2...)
  cùng hệ toạ độ. Tên animation khác nhau giữa các nhân vật (`cut_A`, `A_cut`, `cut_1`, `loop_2`...) nên `lib/bd2Cutscene.ts`
  nhận diện pha theo mẫu tên và chạy các lớp phụ (váy, lửa...) song song. Cách ghép nền/hiệu ứng với từng pha là suy ra từ dữ
  liệu nên có thể không giống hệt game. NIKKE không có dữ liệu cutscene.
- **Chế độ xem** (thẻ ở đầu dock, tham khảo [BD2-L2D-Viewer](https://jelosus2.github.io/BD2-L2D-Viewer/) của jelosus2): *Nhân vật* (tư thế
  đứng), *Ultimate* (cutscene kỹ năng, **chọn từng animation** `cut_A`, `B_cut`, `loop`... kèm các lớp phụ chạy song song, nền cutscene (bật bằng chip "Nền cutscene", mặc định tắt)
  đổi theo pha; nút "Phát toàn bộ" chạy cả chuỗi) và *Fated Guest* (tranh động toàn màn hình của cảnh hẹn hò: chọn cảnh `idleN`
  rồi các phản ứng `mixN_k`, đổi skin bên trong file Spine). Thẻ nào trang phục không có thì mờ đi.
- **So sánh trang phục:** nút "⇄ So sánh" (hoặc phím `S`) ở mục Trang phục chia viewer làm hai khung, A và B (trái/phải trên máy tính,
  trên/dưới trên điện thoại). Chọn trang phục B bằng hàng ảnh nhỏ phía trên khung B; mọi lệnh phát animation (chuyển động, tốc độ) chạy
  đồng thời cho cả hai, còn zoom/kéo của mỗi khung độc lập. Chỉ ở chế độ Nhân vật.
- Dock còn có **thanh tốc độ** 0.1x–2x (nhấp đúp để về 1x) và nút **Layers** (mở bảng bật/tắt từng lớp/slot của mô hình, có ô lọc).
- **Fated Guest** (20 tranh, 19 nhân vật; bỏ qua Angelica "Neon Savior" vì dùng định dạng mới chưa dựng đúng): `node scripts/fetch-bd2-dating.mjs` (≈0.5GB, `--dry-run`, `--only dalvi,yuri`), rồi nén texture
  như trên (≈0.43GB → 0.16GB). Tranh bao quanh bằng các mảng đen rất lớn nên renderer tự tìm phần hình thật để căn khung (`fitContent`).
- **Giọng nói** (câu "BattleReady", 3 câu mỗi trang phục, tiếng Nhật + Hàn; 204/205 trang phục, ≈40MB):
  `node scripts/fetch-bd2-voice.mjs` (nguồn: repo BD2-L2D-Viewer; `--dry-run`, `--only anastasia`). Nhấp vào nhân vật thì họ làm cử động
  `motion` **và** nói một câu (mô hình có `_faceN_talk` thì nhép miệng). Nút loa và nút JP/KR nằm ở thanh công cụ của khung. Chỉ phản ứng
  khi nhân vật đang đứng yên (nhấp chồng lên cử động đang chạy bị bỏ qua, như viewer gốc), lời thoại nằm ở
  `public/assets/bd2/<nhân vật>/<trang phục>/voice/<ja|ko>/touch_N.webm`. Câu đầu (`touch_1`) cũng là **lời chào khi vào trang** (tự phát khi vào
  nhân vật hoặc đổi trang phục; trình duyệt chặn tự phát thì phát ngay khi bạn chạm lần đầu).
- Một số mô hình (13 trang phục, ví dụ Luvencia, Scheherazade "Pool Party", Levia "Night of Jealousy") có animation biểu cảm `_faceN` đổi
  luôn attachment của cả thân, bật lên là mất 20–70% hình. Renderer tự thử từng biểu cảm lúc nạp và ẩn những cái làm mất hình.
- Texture BD2 không nhân sẵn alpha (khác NIKKE có `pma:true`); renderer đọc cờ `pma` của atlas để vẽ đúng.
- **Xem trước khi rê chuột** (cả NIKKE và BD2): dừng chuột trên một thẻ nhân vật ở gallery chừng 0,2 giây thì model Spine của thẻ đó hiện ra, chạy idle ngay trên thẻ (ảnh tĩnh mờ đi); rời chuột là gỡ. Chỉ một model chạy mỗi lúc, chỉ với chuột (không áp dụng cho cảm ứng) và tắt khi hệ thống bật giảm chuyển động. Nhấp vào thẻ vẫn mở trang chi tiết.
- Gallery `/bd2` có hai bộ lọc **Ultimate** và **Fated Guest** (kèm số nhân vật), kết hợp được với tìm kiếm và hạng sao; thẻ nhân vật dán nhãn tương ứng.
- Phím tắt: `←` `→` chuyển nhân vật, `C` đổi trang phục, `F` toàn màn hình, `B` đổi nền, `I` thông tin.

Asset thuộc bản quyền Neowiz / Neon Eyes; `data/bd2.local.json` và `public/assets/` đã nằm trong `.gitignore`.

## Chia sẻ tạm thời qua Cloudflare Tunnel

```bash
brew install cloudflared      # một lần
node scripts/share.mjs        # build + chạy bản production + mật khẩu ngẫu nhiên + link trycloudflare.com
```

In ra link `https://xxxx.trycloudflare.com` và mật khẩu (Basic Auth, tên đăng nhập gõ gì cũng được). Ctrl+C để đóng link.
Tuỳ chọn: `--password <mk>`, `--skip-build`, `--port <cổng>`. Chỉ nên chia sẻ cho người quen và trong thời gian ngắn vì
`public/assets` là asset game có bản quyền.

## Kỹ năng nhân vật

Mục **Skills** trong ngăn INFO (vũ khí, kỹ năng 1, kỹ năng 2, Burst, giá trị theo cấp 1–10) lấy từ mẫu `{{Skill table}}`
của wiki NIKKE (Fandom, CC BY-SA):

```bash
node scripts/fetch-skills.mjs                  # toàn bộ nhân vật; chạy lại an toàn
node scripts/fetch-skills.mjs --only rapi,neon # chỉ vài nhân vật (gộp vào dữ liệu có sẵn)
node scripts/fetch-skills.mjs --no-icons       # chỉ cập nhật chữ, không tải biểu tượng
```

Kết quả: `data/nikke.skills.local.json` và biểu tượng ở `public/assets/nikke/skill-icons/` (cả hai đã gitignore).
Chưa chạy script thì nhân vật không có mục Skills.

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
