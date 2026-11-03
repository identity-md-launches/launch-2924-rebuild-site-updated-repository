"use strict";
/* SqueekRaid — game logic + UI (port of lib/raid.ts, xem DESIGN.md).
   Chạy thẳng trên trình duyệt, không cần build. Dữ liệu đêm lấy từ api.squeekchain.com. */

// ---------------- constants & rules ----------------
const BOSS_MAX_HP = 6400, PARTY_MAX_HP = 1600, RAID_NIGHTS = 7, SHIELD_PER_GUARD = 250, COOLDOWN = 2;
const CARDS = {
  songkich: { emoji: "⚔️", vi: "Song Kích", desc: "Đòn ×2 nếu đêm ≥ 10 km, ×0.8 nếu dưới." },
  daosau:   { emoji: "⛏️", vi: "Thợ Đào Sâu", desc: "Đòn + blocks đêm đó × 0.15." },
  hove:     { emoji: "🛡️", vi: "Hộ Vệ", desc: "Đòn ×0.7, +250 khiên cho cả đội." },
  sandem:   { emoji: "🌙", vi: "Săn Đêm", desc: "Đòn ×1.6 nếu ≥ 50% work sau nửa đêm." },
  rinhmoi:  { emoji: "🐾", vi: "Rình Mồi", desc: "Đòn ×1.8 nếu đêm lười < 8.5 km, ×0.9 nếu không." },
  cuongno:  { emoji: "🔥", vi: "Cuồng Nộ", desc: "Đòn ×1.5, boss phản công +30% đêm đó." },
};
const RAIDERS = [
  { id: "you",  name: "Bạn",        emoji: "🦸", atk: 220, isBot: false, tendency: [] },
  { id: "gau",  name: "Gấu Thủ",    emoji: "🐻", atk: 180, isBot: true, tendency: ["hove", "daosau", "hove", "sandem"] },
  { id: "lieu", name: "Liều Ca",    emoji: "🦊", atk: 170, isBot: true, tendency: ["songkich", "cuongno", "songkich", "daosau"] },
  { id: "ba",   name: "Thợ Đào Ba", emoji: "🦫", atk: 160, isBot: true, tendency: ["daosau", "daosau", "sandem", "hove"] },
  { id: "cu",   name: "Cú Đêm",     emoji: "🦉", atk: 150, isBot: true, tendency: ["sandem", "sandem", "rinhmoi", "daosau"] },
  { id: "rinh", name: "Lão Rình",   emoji: "🐢", atk: 140, isBot: true, tendency: ["rinhmoi", "hove", "rinhmoi", "daosau"] },
];

function swingDamage(atk, night, card) {
  const base = atk * night.distanceKm / 10;
  switch (card) {
    case "songkich": return base * (night.distanceKm >= 10 ? 2.0 : 0.8);
    case "daosau": return base + night.blocks * 0.15;
    case "hove": return base * 0.7;
    case "sandem": {
      const t = night.workBeforeMidnight + night.workAfterMidnight;
      return base * (t > 0 && night.workAfterMidnight / t >= 0.5 ? 1.6 : 1.0);
    }
    case "rinhmoi": return base * (night.distanceKm < 8.5 ? 1.8 : 0.9);
    case "cuongno": return base * 1.5;
    default: return base;
  }
}
function bossPhase(hp) { const f = hp / BOSS_MAX_HP; return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; }
function bossCounter(night, phase, rage) {
  let d = night.snoozeHours * 22;
  if (phase === 2) d *= 1.15; if (phase === 3) d *= 1.3;
  if (night.distanceKm < 8) d += 150;
  if (rage) d *= 1.3;
  return Math.round(d);
}
function bossHeal(night, phase) { return phase === 3 && night.snoozeHours >= 19 ? 300 : 0; }

function resolveNight(night, nightIndex, picks, bossHp, partyHp, rally) {
  const perRaider = RAIDERS.map(r => ({ raiderId: r.id, card: picks[r.id] || null, damage: Math.round(swingDamage(r.atk, night, picks[r.id] || null)) }));
  let teamDamage = perRaider.reduce((a, p) => a + p.damage, 0);
  if (rally === "attack") teamDamage = Math.round(teamDamage * 1.2);
  const shield = perRaider.filter(p => p.card === "hove").length * SHIELD_PER_GUARD + (rally === "guard" ? 400 : 0);
  bossHp -= teamDamage;
  if (bossHp <= 0) return { teamDamage, perRaider, shield, counterDamage: 0, bossHealed: 0, bossHpAfter: 0, partyHpAfter: partyHp, outcome: "win" };
  const phase = bossPhase(bossHp);
  const healed = bossHeal(night, phase);
  bossHp = Math.min(BOSS_MAX_HP, bossHp + healed);
  const raw = bossCounter(night, phase, perRaider.some(p => p.card === "cuongno"));
  const counterDamage = Math.max(0, raw - shield);
  partyHp -= counterDamage;
  const outcome = partyHp <= 0 ? "party_wiped" : nightIndex + 1 >= RAID_NIGHTS ? "time_up" : "ongoing";
  return { teamDamage, perRaider, shield, counterDamage, bossHealed: healed, bossHpAfter: bossHp, partyHpAfter: Math.max(0, partyHp), outcome };
}

// ---------------- night data ----------------
const FALLBACK_NIGHTS = [
  { date: "2026-10-28", distanceKm: 9.30, snoozeHours: 19.0, wakeMinuteUtc: 1260, workBeforeMidnight: 5223, workAfterMidnight: 5364, blocks: 967 },
  { date: "2026-10-29", distanceKm: 11.67, snoozeHours: 18.0, wakeMinuteUtc: 1260, workBeforeMidnight: 7110, workAfterMidnight: 6187, blocks: 1141 },
  { date: "2026-10-30", distanceKm: 11.03, snoozeHours: 17.5, wakeMinuteUtc: 1260, workBeforeMidnight: 7606, workAfterMidnight: 4955, blocks: 1069 },
  { date: "2026-10-31", distanceKm: 7.47, snoozeHours: 19.5, wakeMinuteUtc: 1290, workBeforeMidnight: 4058, workAfterMidnight: 4447, blocks: 769 },
  { date: "2026-11-01", distanceKm: 7.89, snoozeHours: 19.0, wakeMinuteUtc: 1260, workBeforeMidnight: 4364, workAfterMidnight: 4620, blocks: 835 },
  { date: "2026-11-02", distanceKm: 7.66, snoozeHours: 19.5, wakeMinuteUtc: 1290, workBeforeMidnight: 6397, workAfterMidnight: 2328, blocks: 853 },
];
function averageNight(nights) {
  const m = k => nights.reduce((a, n) => a + n[k], 0) / nights.length;
  return { date: "Đêm Quyết Định", distanceKm: +m("distanceKm").toFixed(2), snoozeHours: +m("snoozeHours").toFixed(1), wakeMinuteUtc: 1260, workBeforeMidnight: Math.round(m("workBeforeMidnight")), workAfterMidnight: Math.round(m("workAfterMidnight")), blocks: Math.round(m("blocks")), simulated: true };
}
async function fetchJson(url, ms = 8000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, cache: "no-store" }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function loadNights() {
  try {
    const [stats, stl] = await Promise.all([
      fetchJson("https://api.squeekchain.com/v1/measurement/stats?range=7d"),
      fetchJson("https://api.squeekchain.com/v1/settlements?range=7d"),
    ]);
    const now = Date.now();
    const nights = [];
    for (const day of stats.activity.days) {
      const start = Date.parse(day.date + "T12:00:00Z");
      if (!(now > start + 24 * 3600e3)) continue; // đêm chưa kết thúc
      if (day.distanceMm == null) continue;
      let idle = 0, wake = null, before = 0, after = 0;
      const ordered = [...day.buckets].sort((a, b) => ((a.startMinuteUtc - 720) % 1440) - ((b.startMinuteUtc - 720) % 1440));
      for (const b of ordered) {
        const w = b.workUnits ? parseInt(b.workUnits, 10) : 0;
        if (w === 0) idle++; else if (wake === null) wake = b.startMinuteUtc;
        if (b.startMinuteUtc >= 720) before += w; else after += w;
      }
      let blocks = 0;
      if (stl.status === "available") for (const s of stl.buckets) {
        const a = Date.parse(s.startAt), e = Date.parse(s.endAt);
        if (a >= start && e <= start + 24 * 3600e3) blocks += parseInt(s.completedBlockCount, 10);
      }
      nights.push({ date: day.date, distanceKm: +(parseInt(day.distanceMm, 10) / 1e6).toFixed(2), snoozeHours: idle / 2, wakeMinuteUtc: wake, workBeforeMidnight: before, workAfterMidnight: after, blocks });
    }
    const last6 = nights.slice(-6);
    if (last6.length >= 4) return { nights: [...last6, averageNight(last6)], source: "api" };
    throw new Error("not enough complete nights");
  } catch (e) {
    return { nights: [...FALLBACK_NIGHTS, averageNight(FALLBACK_NIGHTS)], source: "fallback" };
  }
}

// ---------------- chronicle ----------------
function wakeText(n) { return n.wakeMinuteUtc === null ? "cả đêm không lên bánh xe" : `thức dậy lúc ${String(Math.floor(n.wakeMinuteUtc / 60)).padStart(2, "0")}:${String(n.wakeMinuteUtc % 60).padStart(2, "0")} UTC`; }
function chronicle(night, res) {
  const open = night.distanceKm >= 10 ? `Squeektoshi ${wakeText(night)} và lao đi ${night.distanceKm.toFixed(2)} km — một đêm huyền thoại.`
    : night.distanceKm >= 8.5 ? `Squeektoshi ${wakeText(night)}, chạy vững ${night.distanceKm.toFixed(2)} km, đào được ${night.blocks} blocks.`
    : `Một đêm lười — Squeektoshi chỉ chạy ${night.distanceKm.toFixed(2)} km và ngủ tới ${night.snoozeHours} giờ.`;
  const fight = `Đội raid gây ${res.teamDamage} sát thương${res.bossHealed ? `, nhưng Snooze King hồi ${res.bossHealed} HP nhờ cơn ngủ dài` : ""}.`;
  const counter = res.outcome === "win" ? "Snooze King gục ngã trước khi kịp phản đòn!" : res.counterDamage > 0 ? `Boss phản công trừ ${res.counterDamage} HP đội${res.shield ? " (khiên đã chặn phần còn lại)" : ""}.` : "Khiên của đội chặn đứng đòn phản công.";
  return `${open} ${fight} ${counter}`;
}

// ---------------- UI ----------------
const $ = s => document.querySelector(s);
const state = { nights: [], source: "", nightIdx: 0, bossHp: BOSS_MAX_HP, partyHp: PARTY_MAX_HP, selected: null, rally: null, rallyUsed: false, lastUsed: {}, totals: {}, acorns: 0, busy: false, over: false };
RAIDERS.forEach(r => state.totals[r.id] = 0);
const fmt = n => n.toLocaleString("vi-VN");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function bar(el, val, max) { el.style.width = Math.max(0, Math.min(100, val / max * 100)) + "%"; }
function renderBars() {
  $("#bossHpText").textContent = `${fmt(Math.max(0, state.bossHp))} / ${fmt(BOSS_MAX_HP)} HP · Phase ${bossPhase(Math.max(1, state.bossHp))}`;
  bar($("#bossBar"), state.bossHp, BOSS_MAX_HP);
  $("#partyHpText").textContent = `${fmt(state.partyHp)} / ${fmt(PARTY_MAX_HP)} HP`;
  bar($("#partyBar"), state.partyHp, PARTY_MAX_HP);
  $("#nightText").textContent = state.over ? "Raid kết thúc" : `Đêm ${Math.min(state.nightIdx + 1, RAID_NIGHTS)} / ${RAID_NIGHTS}`;
}
function renderParty(last) {
  $("#party").innerHTML = RAIDERS.map(r => {
    const lr = last && last.perRaider.find(p => p.raiderId === r.id);
    return `<div class="fighter ${r.isBot ? "" : "me"}">
      <div class="f-emoji">${r.emoji}</div>
      <div class="f-name">${r.name}</div>
      <div class="f-atk">ATK ${r.atk}</div>
      <div class="f-card">${lr ? `${CARDS[lr.card]?.emoji || "·"} ${lr.damage ? "+" + fmt(lr.damage) : ""}` : ""}</div>
      <div class="f-total">Σ ${fmt(state.totals[r.id])}</div></div>`;
  }).join("");
}
function cardOnCooldown(card, idx) { const l = state.lastUsed[card]; return l !== undefined && idx - l <= COOLDOWN; }
function renderCards() {
  $("#cards").innerHTML = Object.entries(CARDS).map(([id, c]) => {
    const cd = cardOnCooldown(id, state.nightIdx);
    return `<button class="card ${state.selected === id ? "picked" : ""}" ${cd || state.busy || state.over ? "disabled" : ""} data-card="${id}">
      <span class="c-emoji">${c.emoji}</span><span class="c-name">${c.vi}</span>
      <span class="c-desc">${cd ? `⏳ Đang hồi — còn ${COOLDOWN - (state.nightIdx - state.lastUsed[id]) + 1} đêm` : c.desc}</span></button>`;
  }).join("");
  document.querySelectorAll(".card").forEach(b => b.onclick = () => { state.selected = b.dataset.card; renderCards(); });
  $("#rallyRow").style.display = state.rallyUsed ? "none" : "flex";
  document.querySelectorAll(".rally").forEach(b => b.onclick = () => { state.rally = state.rally === b.dataset.rally ? null : b.dataset.rally; document.querySelectorAll(".rally").forEach(x => x.classList.toggle("picked", x.dataset.rally === state.rally)); });
  $("#fightBtn").disabled = !state.selected || state.busy || state.over;
}
function log(html, cls = "") { const d = document.createElement("div"); d.className = "log-line " + cls; d.innerHTML = html; $("#log").prepend(d); }

async function fight() {
  if (!state.selected || state.busy) return;
  state.busy = true; renderCards(); $("#fightBtn").disabled = true;
  const night = state.nights[state.nightIdx];
  const picks = { you: state.selected };
  RAIDERS.filter(r => r.isBot).forEach(r => picks[r.id] = r.tendency[state.nightIdx % r.tendency.length]);
  const rally = state.rallyUsed ? null : state.rally;
  if (rally) { state.rallyUsed = true; state.rally = null; }
  state.lastUsed[state.selected] = state.nightIdx;
  const res = resolveNight(night, state.nightIdx, picks, state.bossHp, state.partyHp, rally);
  res.perRaider.forEach(p => state.totals[p.raiderId] += p.damage);
  state.acorns += Math.round((res.perRaider.find(p => p.raiderId === "you")?.damage || 0) / 10);

  log(`<b>🌙 Đêm ${state.nightIdx + 1} — ${night.date}</b>${night.simulated ? " (mô phỏng từ trung bình tuần)" : ""}: Squeektoshi chạy <b>${night.distanceKm.toFixed(2)} km</b> · ${fmt(night.blocks)} blocks · ngủ ${night.snoozeHours}h · ${wakeText(night)}`, "night");
  await sleep(650);
  for (const p of res.perRaider) {
    const r = RAIDERS.find(x => x.id === p.raiderId);
    log(`${r.emoji} ${r.name} dùng ${CARDS[p.card]?.emoji || ""} ${CARDS[p.card]?.vi || "đòn thường"} → <b>${fmt(p.damage)}</b> sát thương`);
    await sleep(260);
  }
  if (rally === "attack") log("🔥 TẬP HỢP CÔNG: damage đội +20%!");
  if (rally === "guard") log("🛡️ TẬP HỢP THỦ: +400 khiên!");
  state.bossHp = res.bossHpAfter; state.partyHp = res.partyHpAfter;
  renderBars(); renderParty(res);
  await sleep(400);
  if (res.bossHealed) log(`👑 Snooze King hồi <b>${res.bossHealed} HP</b> nhờ cơn ngủ dài (phase 3).`, "boss");
  if (res.outcome !== "win") log(res.counterDamage > 0 ? `👑 Boss phản công: <b>-${fmt(res.counterDamage)} HP</b> đội (khiên chặn ${fmt(res.shield)}).` : `👑 Boss phản công nhưng khiên chặn hết (${fmt(res.shield)}).`, "boss");
  log(`📖 ${chronicle(night, res)}`, "story");
  state.selected = null; state.nightIdx++; state.busy = false;

  if (res.outcome !== "ongoing") { state.over = true; endRaid(res.outcome); }
  renderBars(); renderCards();
}
function endRaid(outcome) {
  if (outcome === "win") state.acorns += 500;
  const title = outcome === "win" ? "🏆 SNOOZE KING ĐÃ GỤC!" : outcome === "party_wiped" ? "💀 ĐỘI BỊ QUÉT SẠCH..." : "⏰ HẾT 7 ĐÊM — BOSS VẪN SỐNG";
  const sub = outcome === "win" ? "Cả đội thắng! +500 🌰 thưởng hạ boss." : outcome === "party_wiped" ? `Boss còn ${fmt(state.bossHp)} HP. Cần thêm khiên và chọn bài theo đêm hơn.` : `Boss còn đúng ${fmt(state.bossHp)} HP — suýt soát! Đổi đội hình công mạnh hơn ở các đêm cuối.`;
  const rank = [...RAIDERS].sort((a, b) => state.totals[b.id] - state.totals[a.id]).map((r, i) => `<li>${["🥇", "🥈", "🥉"][i] || "·"} ${r.emoji} ${r.name} — ${fmt(state.totals[r.id])} sát thương</li>`).join("");
  $("#endBox").innerHTML = `<h2>${title}</h2><p>${sub}</p><p>Tổng đóng góp của bạn: <b>${fmt(state.totals.you)}</b> sát thương · Hạt Dẻ kiếm được: <b>${fmt(state.acorns)} 🌰</b></p><ol class="rank">${rank}</ol><button class="primary" onclick="location.reload()">↻ Raid lại</button>`;
  $("#endBox").style.display = "block";
  $("#endBox").scrollIntoView({ behavior: "smooth" });
}

async function pollLive() {
  try {
    const s = await fetchJson("https://api.squeekchain.com/v1/status", 4000);
    const m = s.measurement, spin = m.coreStatus === "SPINNING";
    $("#liveDot").className = "led " + (spin ? "on" : "idle");
    $("#liveText").textContent = spin ? `ĐANG CHẠY · ${Math.round(m.rpmMilli / 1000)} RPM · ${(m.speedMmPerSecond * 3.6 / 1000).toFixed(1)} km/h` : "ĐANG NGỦ 💤";
    const bh = s.builder?.anchor;
    if (bh) $("#liveBlock").textContent = `Block #${fmt(parseInt(bh.blockHeight, 10) + 1)} · ${(parseInt(bh.blockProgress, 10) / 1e7).toFixed(0)}%`;
    $("#wheel").classList.toggle("spinning", spin);
  } catch (e) { $("#liveText").textContent = "API OFFLINE"; $("#liveDot").className = "led off"; }
}

async function init() {
  renderBars(); renderParty(null); renderCards();
  const { nights, source } = await loadNights();
  state.nights = nights;
  $("#dataNote").textContent = source === "api" ? "Dữ liệu đêm: api.squeekchain.com (trực tiếp)" : "Không gọi được API — đang dùng bộ dữ liệu ghi sẵn 28/10–02/11";
  log("⚔️ Raid bắt đầu! Chọn 1 lá bài cho đêm đầu tiên, rồi bấm Vào đêm. Giết Snooze King trong 7 đêm!", "night");
  renderCards();
  pollLive(); setInterval(pollLive, 5000);
}
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => { $("#fightBtn").onclick = fight; init(); });

// Cho phép kiểm thử logic bằng node (không ảnh hưởng trình duyệt)
if (typeof module !== "undefined") module.exports = { resolveNight, swingDamage, bossCounter, bossHeal, RAIDERS, FALLBACK_NIGHTS, averageNight, BOSS_MAX_HP, PARTY_MAX_HP };
