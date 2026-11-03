# SqueekRaid 🐹👑

Game raid co-op theo tuần trên **Squeekchain**: cả đội đánh boss **Snooze King**,
sát thương từ quãng đường thật Squeektoshi chạy mỗi đêm, boss phản công bằng chính
giấc ngủ của hamster. Không dự đoán, không cá cược — hợp tác PvE thuần.
Điểm chơi (Hạt Dẻ 🌰), không tiền thật, không cần ví.

## Luật tóm tắt

- Raid = 7 đêm, boss **6,400 HP**, đội 6 người (bạn + 5 bot trong MVP), **HP đội 1,600**.
- Mỗi đêm chọn 1 lá bài chiến thuật (cooldown 2 đêm), bot chọn theo cá tính:
  ⚔️ Song Kích · ⛏️ Thợ Đào Sâu · 🛡️ Hộ Vệ · 🌙 Săn Đêm · 🐾 Rình Mồi · 🔥 Cuồng Nộ.
- Damage mỗi người = `ATK × km đêm đó / 10 × hệ số bài`. Giết boss thì không bị phản công.
- Boss phản công = `giờ ngủ × 22 × hệ số phase` (+150 đêm lười, ×1.3 nếu có Cuồng Nộ);
  phase 3 boss hồi 300 HP khi đêm ngủ ≥ 19 giờ. Khiên (250/Hộ Vệ) hút sát thương trước.
- Số liệu đêm lấy từ `api.squeekchain.com`: distance + giờ ngủ + work trước/sau nửa
  đêm từ `/v1/measurement/stats`, blocks từ `/v1/settlements` (đêm = 12:00→12:00 UTC).

## Cân bằng đã kiểm chứng trên dữ liệu thật (28/10–02/11/2026)

- Không chơi bài → **wipe đêm 4**. Toàn thủ → sống nguyên nhưng **boss còn 325 HP**.
- Đội hình cân bằng → **giết boss đúng đêm 7**, HP đội còn 991. Xem DESIGN.md §5.

## Cấu trúc

- `DESIGN.md` — thiết kế đầy đủ: định vị, dữ liệu nền, luật, cân bằng, kiến trúc production.
- `lib/raid.ts` — luật thuần (bài, damage, boss, resolve, bot, biên niên) dùng chung
  cho client, keeper và test.
- `test/raid.test.ts` + `test/fixtures/` — unit test + dữ liệu API thật đã ghi lại.

## Chạy test

```bash
npm install
npm test   # 9 tests
```

## MVP

Bản MVP chơi được (raid 7 đêm bằng dữ liệu thật + panel live Squeektoshi)
là web app "SqueekRaid" trong thư viện Muse của Edward.

## Roadmap production

Next.js static + Supabase (`sr_*` RPC, keeper pg_cron resolve đêm cho mọi đội,
số liệu đêm công khai để kiểm chứng), đội người thật qua link mời, bot Discord/
Telegram nhắc chọn bài, route `/overlay` cho OBS, AI Chronicler bản LLM + minh họa.
