# SqueekRaid — Game Design Document

> Game raid co-op theo tuần trên Squeekchain: cả đội cùng đánh boss **Snooze King**,
> sát thương đến từ quãng đường thật Squeektoshi chạy mỗi đêm, boss phản công bằng
> chính giấc ngủ của hamster. Điểm chơi (Hạt Dẻ 🌰), không tiền thật, không cần ví.

## 1. Định vị & vì sao không trùng ai

Genesis code board (quét ngày 2026-11-03, 10 project đã ship) đã đông ở: prediction
(Squeek or Sleep, SqueekBet, PolyHamster, SqueekPot), racing, endless runner, looter
shooter, dashboard, app đặt tên NFT, SqueekFi planner. SqueekRaid né toàn bộ bằng
cách đổi **động từ chơi**:

- Không *đoán* hamster sẽ làm gì (prediction), không *cược* (betting), không *đua* (racing).
- Người chơi **hợp tác đánh boss (PvE)**: dữ liệu hamster là *động cơ đã xảy ra* của
  trận đánh, không phải đáp án để đoán. Quyết định của người chơi là chọn **lá bài
  chiến thuật** trước đêm — tối ưu hóa đội hình theo xu hướng các đêm trước và phase
  của boss, chấp nhận đánh đổi công/thủ. Không có pool, không có đối thủ người, không
  có tỉ lệ cược.
- Đây cũng là hướng ban tổ chức tự nêu trong "Build this": *"weekly boss raids
  powered by its real distance"* và *"a living story every round moves forward"* —
  và chưa project nào trên board làm.

Hạng mục ăn điểm: *Server games and bots* (chính), *Games powered by Squeekchain*,
*AI on the wheel* (AI Chronicler viết biên niên), *Stream companions* (overlay, roadmap).

## 2. Dữ liệu thật làm nền (đo từ api.squeekchain.com, 2026-11-03)

Chỉ số đêm (12:00 UTC → 12:00 UTC) suy ra đúng công thức của PolyHamster:
distance từ `/v1/measurement/stats` (`activity.days[].distanceMm`); giờ ngủ = số
bucket 30 phút có `workUnits = 0` × 0.5; blocks = tổng `completedBlockCount` các
bucket 6 giờ của `/v1/settlements` nằm trọn trong đêm; work trước/sau nửa đêm từ
các bucket.

| Đêm | km | Giờ ngủ | Blocks | Work sau nửa đêm |
|---|---|---|---|---|
| 2026-10-28 | 9.30 | 19.0 | 967 | 49% |
| 2026-10-29 | 11.67 | 18.0 | 1,141 | 47% |
| 2026-10-30 | 11.03 | 17.5 | 1,069 | 39% |
| 2026-10-31 | 7.47 | 19.5 | 769 | 52% |
| 2026-11-01 | 7.89 | 19.0 | 835 | 51% |
| 2026-11-02 | 7.66 | 19.5 | 853 | 27% |

Tuần điển hình: ~55 km / 6 đêm (≈64 km / 7 đêm), ngủ ~19 giờ/đêm, ~940 blocks/đêm,
thức dậy khoảng 21:00 UTC. Toàn bộ số cân bằng dưới đây được **mô phỏng và kiểm thử
tự động trên chính dữ liệu này** (test/raid.test.ts + fixtures).

## 3. Vòng lặp raid

- Một raid = **7 đêm** chống boss Snooze King 👑😴, **HP 6,400**. Đội 6 người
  (production: người thật lập đội; MVP: bạn + 5 bot đồng đội), **HP đội 1,600**.
- Mỗi đêm, theo thứ tự:
  1. **Chọn bài:** bạn chọn 1 trong 6 lá bài chiến thuật (bài đã dùng nghỉ 2 đêm —
     cooldown). Bot chọn theo cá tính. Có 1 token **Tập Hợp** mỗi raid: +20% damage
     đêm đó *hoặc* +400 khiên.
  2. **Đêm diễn ra:** công bố số liệu thật của đêm (km, blocks, giờ ngủ, giờ thức).
  3. **Đội ra đòn:** mỗi thành viên gây `damage = ATK × km/10 × hệ số lá bài`.
     Giết boss ở bước này thì **không bị phản công**.
  4. **Boss hồi phục (chỉ phase 3):** +300 HP nếu đêm đó ngủ ≥ 19 giờ.
  5. **Boss phản công:** `snoozeHours × 22 × hệ số phase`, +150 nếu đêm lười
     (< 8 km), ×1.3 nếu có người chơi Cuồng Nộ; khiên hút trước khi trừ HP đội.
- Thắng: boss chết trong 7 đêm. Thua: HP đội về 0 (wipe) hoặc hết 7 đêm boss còn sống.

### Phase của boss
- Phase 1 (HP > 66%): phản công ×1.0
- Phase 2 (33–66%): phản công ×1.15 — "Snooze King trở mình"
- Phase 3 (< 33%): phản công ×1.3 + hồi phục theo giấc ngủ — "Cuồng nộ ngái ngủ"

### 6 lá bài (đánh đổi công/thủ, không lá nào trội tuyệt đối)
| Bài | Hiệu ứng |
|---|---|
| ⚔️ Song Kích | Đòn ×2 nếu đêm ≥ 10 km, ×0.8 nếu dưới |
| ⛏️ Thợ Đào Sâu | Đòn + blocks × 0.15 |
| 🛡️ Hộ Vệ | Đòn ×0.7, +250 khiên cho đội |
| 🌙 Săn Đêm | Đòn ×1.6 nếu ≥ 50% work rơi sau nửa đêm |
| 🐾 Rình Mồi | Đòn ×1.8 nếu đêm lười < 8.5 km, ×0.9 nếu không |
| 🔥 Cuồng Nộ | Đòn ×1.5, boss phản công +30% đêm đó |

## 4. Bot đồng đội & AI Chronicler

- 5 bot có ATK và cá tính riêng: 🐻 Gấu Thủ (hay Hộ Vệ), 🦊 Liều Ca (Song Kích/Cuồng
  Nộ), 🦫 Thợ Đào Ba, 🦉 Cú Đêm (Săn Đêm), 🐢 Lão Rình (Rình Mồi). Trong production,
  bot lấp chỗ trống của đội người thật và là nhân vật "nhớ" người chơi (chào theo
  thành tích các raid trước).
- **AI Chronicler:** sau mỗi đêm, một đoạn biên niên được viết từ dữ liệu thật của
  đêm đó + diễn biến trận đánh (MVP: mẫu câu phong phú theo điều kiện; production:
  LLM viết, kèm minh họa tự sinh — "artwork that paints itself from every run").
  Cuối raid, biên niên 7 đêm thành một chương truyện hoàn chỉnh để chia sẻ.

## 5. Kết quả cân bằng (test tự động trên dữ liệu thật)

- Không chơi bài nào: **đội bị wipe đêm 4** (boss còn 2,374 HP) → thủ là bắt buộc.
- Đội hình cân bằng (1–2 Hộ Vệ + bài công theo tình huống): **giết boss đúng đêm 7**,
  HP đội còn 991/1,600 → chiến thắng phải "đo" từng đêm.
- Toàn thủ (3 Hộ Vệ): HP đội nguyên vẹn 1,600/1,600 nhưng boss còn 325 HP khi hết
  giờ → rùa là thua, dù chỉ suýt soát.
- Đòn của người chơi (ATK cao nhất, 220) dao động ±200/đêm theo lá bài — lựa chọn
  của người chơi là yếu tố quyết định ở lằn ranh thắng/thua.

## 6. Chế độ trong MVP

1. **⚔️ Raid 7 Đêm (chính):** chơi trọn một raid với 6 đêm thật gần nhất lấy trực
   tiếp từ API (fetch lúc mở trang; nếu API không tới được thì dùng bộ dữ liệu ghi
   sẵn 28/10–02/11 và ghi nhãn rõ) + đêm 7 là "Đêm Quyết Định" mô phỏng từ trung
   bình tuần (ghi nhãn mô phỏng). Mỗi đêm: chọn bài → xem đêm thật diễn ra → đòn,
   phản công, biên niên.
2. **🔴 Panel Live:** trạng thái Squeektoshi ngay lúc này từ `/v1/status` (SPINNING/
   IDLE, RPM, km/h, block height + tiến độ block) và tiến độ tuần raid thật.

## 7. Kiến trúc production (sau MVP)

Theo pattern keeper đã chứng minh của PolyHamster, không copy code: Next.js static +
Supabase (`sr_*` RPC), pg_cron mỗi phút → Edge Function đối chiếu đêm vừa kết thúc,
resolve raid cho mọi đội cùng lúc, lưu công khai số liệu đêm để kiểm chứng.
Đội người thật qua link mời; Discord/Telegram bot nhắc chọn bài trước 20:00 UTC;
route `/overlay` cho OBS hiển thị HP boss trong lúc stream.

## 8. Rủi ro & xử lý

| Rủi ro | Xử lý |
|---|---|
| Tuần hamster lười bất thường (ít km) | Boss theo mùa: HP boss tuần sau hiệu chỉnh theo trung bình 4 tuần; Rình Mồi là bài "comeback" cho đêm lười |
| Dữ liệu đêm thiếu (coverage) | Đêm void: không đòn, không phản công, raid kéo dài thêm 1 đêm (như luật void của PolyHamster) |
| Người chơi đoán mò bài | Không có "đáp án đúng" tuyệt đối — mọi bài đều cho damage; khác biệt nằm ở đội hình và thời điểm, và boss giết được hay không là kết quả chung |
| Bị coi là prediction đội lốt | Không khóa bài theo kết quả cần đoán để ăn điểm; điểm thưởng là XP đóng góp, không có pool/odds/payout |
