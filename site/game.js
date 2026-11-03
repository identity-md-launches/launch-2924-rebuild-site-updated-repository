"use strict";
/* SqueekRaid — game logic + UI (port of lib/raid.ts, see DESIGN.md).
   Runs directly in the browser, no build step. Night data from api.squeekchain.com.
   Wallet: injected provider (MetaMask), Sepolia only. Victory claim = a real
   0-ETH Sepolia transaction to yourself with the raid result encoded in calldata. */

// ---------------- constants & rules ----------------
const BOSS_MAX_HP = 6400, PARTY_MAX_HP = 1600, RAID_NIGHTS = 7, SHIELD_PER_GUARD = 250, COOLDOWN = 2;
const CARDS = {
  songkich: { emoji: "⚔️", en: "Double Strike", desc: "Your swing ×2 if the night reaches ≥ 10 km, ×0.8 below that." },
  daosau:   { emoji: "⛏️", en: "Deep Miner", desc: "Your swing + the night's blocks × 0.15." },
  hove:     { emoji: "🛡️", en: "Guardian", desc: "Your swing ×0.7, but +250 shield for the whole party." },
  sandem:   { emoji: "🌙", en: "Night Hunter", desc: "Your swing ×1.6 if ≥ 50% of the night's work happens after midnight." },
  rinhmoi:  { emoji: "🐾", en: "Ambush", desc: "Your swing ×1.8 on a lazy night (< 8.5 km), ×0.9 otherwise." },
  cuongno:  { emoji: "🔥", en: "Rage", desc: "Your swing ×1.5, but the boss counter-attacks 30% harder that night." },
};
const RAIDERS = [
  { id: "you",  name: "You",           emoji: "🦸", atk: 220, isBot: false, tendency: [] },
  { id: "gau",  name: "Bear Guard",    emoji: "🐻", atk: 180, isBot: true, tendency: ["hove", "daosau", "hove", "sandem"] },
  { id: "lieu", name: "Daredevil Fox", emoji: "🦊", atk: 170, isBot: true, tendency: ["songkich", "cuongno", "songkich", "daosau"] },
  { id: "ba",   name: "Beaver Miner",  emoji: "🦫", atk: 160, isBot: true, tendency: ["daosau", "daosau", "sandem", "hove"] },
  { id: "cu",   name: "Night Owl",     emoji: "🦉", atk: 150, isBot: true, tendency: ["sandem", "sandem", "rinhmoi", "daosau"] },
  { id: "rinh", name: "Old Stalker",   emoji: "🐢", atk: 140, isBot: true, tendency: ["rinhmoi", "hove", "rinhmoi", "daosau"] },
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
  return { date: "Decision Night", distanceKm: +m("distanceKm").toFixed(2), snoozeHours: +m("snoozeHours").toFixed(1), wakeMinuteUtc: 1260, workBeforeMidnight: Math.round(m("workBeforeMidnight")), workAfterMidnight: Math.round(m("workAfterMidnight")), blocks: Math.round(m("blocks")), simulated: true };
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
      if (!(now > start + 24 * 3600e3)) continue; // night not finished yet
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
function wakeText(n) { return n.wakeMinuteUtc === null ? "never touched the wheel all night" : `hopped on the wheel at ${String(Math.floor(n.wakeMinuteUtc / 60)).padStart(2, "0")}:${String(n.wakeMinuteUtc % 60).padStart(2, "0")} UTC`; }
function chronicle(night, res) {
  const open = night.distanceKm >= 10 ? `Squeektoshi ${wakeText(night)} and tore off for ${night.distanceKm.toFixed(2)} km — a legendary night.`
    : night.distanceKm >= 8.5 ? `Squeektoshi ${wakeText(night)}, ran a solid ${night.distanceKm.toFixed(2)} km and mined ${night.blocks} blocks.`
    : `A lazy night — Squeektoshi managed only ${night.distanceKm.toFixed(2)} km and snoozed for ${night.snoozeHours} hours.`;
  const fight = `The raid dealt ${res.teamDamage} damage${res.bossHealed ? `, but the Snooze King healed ${res.bossHealed} HP off that long snooze` : ""}.`;
  const counter = res.outcome === "win" ? "The Snooze King collapsed before he could strike back!" : res.counterDamage > 0 ? `The boss countered for ${res.counterDamage} party HP${res.shield ? " (the shield soaked the rest)" : ""}.` : "The party's shield swallowed the counter-attack whole.";
  return `${open} ${fight} ${counter}`;
}

// ---------------- wallet (Sepolia) ----------------
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111
const wallet = { address: null };
const shortAddr = a => a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
function setWalletMsg(t) { const el = document.querySelector("#walletMsg"); if (el) el.textContent = t || ""; }

async function ensureSepolia() {
  const eth = window.ethereum;
  const current = await eth.request({ method: "eth_chainId" });
  if (current === SEPOLIA_CHAIN_ID) return true;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
    return true;
  } catch (e) {
    if (e && e.code === 4902) {
      await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID, chainName: "Sepolia", nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"] }] });
      return true;
    }
    throw e;
  }
}

async function loadAccountPanel(address) {
  const panel = document.querySelector("#walletPanel");
  try {
    const [acct, balHex] = await Promise.all([
      fetchJson(`https://api.squeekchain.com/v1/accounts/${address}`, 8000),
      window.ethereum.request({ method: "eth_getBalance", params: [address, "latest"] }),
    ]);
    const ethBal = Number(BigInt(balHex)) / 1e18;
    let squeekInfo = "Squeekchain account data unavailable right now.";
    if (acct && acct.status === "available") {
      const inWallet = parseInt(acct.tokenCounts?.wallet || "0", 10);
      const staked = parseInt(acct.tokenCounts?.staking || "0", 10);
      const power = (parseInt(acct.power?.nftPower || "0", 10) + parseInt(acct.power?.sqkPower || "0", 10)).toLocaleString("en-US");
      const claimable = (Number(BigInt(acct.rewards?.claimableBaseUnits || "0")) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 });
      squeekInfo = `🐹 Squeeks: ${inWallet + staked} (${inWallet} in wallet · ${staked} staking) · Power: ${power} · Claimable: ${claimable} SQK`;
    }
    panel.innerHTML = `<div>👛 <b>${shortAddr(address)}</b> · ${ethBal.toFixed(4)} Sepolia ETH</div><div style="color:var(--muted);margin-top:2px">${squeekInfo}</div>`;
  } catch (e) {
    panel.innerHTML = `<div>👛 <b>${shortAddr(address)}</b> · connected on Sepolia</div>`;
  }
  panel.style.display = "block";
}

async function connectWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    setWalletMsg("⚠️ No wallet detected in this browser.");
    const p = document.querySelector("#walletPanel");
    if (p) {
      p.innerHTML = `<b>⚠️ No wallet detected.</b><br>To connect, open this page in a browser with a wallet extension installed (e.g. <b>MetaMask</b> on Chrome/Brave), then click Connect Wallet again.<br><span style="color:var(--muted)">Note: in-app browsers (inside chat/social apps) usually can't inject a wallet — that's why nothing popped up. The game itself plays fine without a wallet.</span>`;
      p.style.display = "block";
    }
    if (typeof log === "function") log("⚠️ <b>No wallet detected.</b> Open this page in Chrome/Brave with MetaMask installed to connect — in-app browsers can't inject a wallet.", "boss");
    return null;
  }
  try {
    setWalletMsg("Waiting for your wallet…");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts[0]) throw new Error("no account");
    await ensureSepolia();
    wallet.address = accounts[0];
    const btn = document.querySelector("#walletBtn");
    if (btn) btn.textContent = "👛 " + shortAddr(wallet.address);
    setWalletMsg("Connected on Sepolia ✓");
    loadAccountPanel(wallet.address);
    return wallet.address;
  } catch (e) {
    setWalletMsg(e && e.code === 4001 ? "Connection rejected in the wallet." : "Could not connect — make sure your wallet is unlocked and on Sepolia.");
    return null;
  }
}

/** Real Sepolia transaction: 0 ETH to yourself, raid result encoded in the calldata. */
async function claimVictoryOnChain(result) {
  const address = wallet.address || (await connectWallet());
  if (!address) return;
  const btn = document.querySelector("#claimBtn");
  const out = document.querySelector("#claimResult");
  try {
    await ensureSepolia();
    const memo = `SQUEEKRAID WIN | Snooze King slain | nights:${state.nightIdx} | your damage:${state.totals.you} | acorns:${state.acorns} | ${new Date().toISOString().slice(0, 10)}`;
    const data = "0x" + Array.from(new TextEncoder().encode(memo)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Confirm in your wallet…"; }
    const hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from: address, to: address, value: "0x0", data }] });
    if (out) out.innerHTML = `✅ Victory recorded on Sepolia! Tx: <a href="https://sepolia.etherscan.io/tx/${hash}" target="_blank" rel="noreferrer" style="color:var(--gold)">${hash.slice(0, 18)}…</a> <span style="color:var(--muted)">(0 ETH sent to yourself — the raid result lives in the transaction data, anyone can verify it)</span>`;
    if (btn) btn.textContent = "⛓️ Victory claimed ✓";
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "⛓️ Claim victory on Sepolia"; }
    if (out) out.textContent = e && e.code === 4001 ? "Transaction rejected in the wallet — no problem, your win still counts here." : "Transaction failed — check you have a little Sepolia ETH for gas.";
  }
}

// ---------------- UI ----------------
const $ = s => document.querySelector(s);
const state = { nights: [], source: "", nightIdx: 0, bossHp: BOSS_MAX_HP, partyHp: PARTY_MAX_HP, selected: null, rally: null, rallyUsed: false, lastUsed: {}, totals: {}, acorns: 0, busy: false, over: false };
RAIDERS.forEach(r => state.totals[r.id] = 0);
const fmt = n => n.toLocaleString("en-US");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function bar(el, val, max) { el.style.width = Math.max(0, Math.min(100, val / max * 100)) + "%"; }
function renderBars() {
  $("#bossHpText").textContent = `${fmt(Math.max(0, state.bossHp))} / ${fmt(BOSS_MAX_HP)} HP · Phase ${bossPhase(Math.max(1, state.bossHp))}`;
  bar($("#bossBar"), state.bossHp, BOSS_MAX_HP);
  $("#partyHpText").textContent = `${fmt(state.partyHp)} / ${fmt(PARTY_MAX_HP)} HP`;
  bar($("#partyBar"), state.partyHp, PARTY_MAX_HP);
  $("#nightText").textContent = state.over ? "Raid over" : `Night ${Math.min(state.nightIdx + 1, RAID_NIGHTS)} / ${RAID_NIGHTS}`;
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
      <span class="c-emoji">${c.emoji}</span><span class="c-name">${c.en}</span>
      <span class="c-desc">${cd ? `⏳ Cooling down — ${COOLDOWN - (state.nightIdx - state.lastUsed[id]) + 1} night(s) left` : c.desc}</span></button>`;
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

  log(`<b>🌙 Night ${state.nightIdx + 1} — ${night.date}</b>${night.simulated ? " (simulated from the weekly average)" : ""}: Squeektoshi ran <b>${night.distanceKm.toFixed(2)} km</b> · ${fmt(night.blocks)} blocks · snoozed ${night.snoozeHours}h · ${wakeText(night)}`, "night");
  await sleep(650);
  for (const p of res.perRaider) {
    const r = RAIDERS.find(x => x.id === p.raiderId);
    log(`${r.emoji} ${r.name} played ${CARDS[p.card]?.emoji || ""} ${CARDS[p.card]?.en || "a plain swing"} → <b>${fmt(p.damage)}</b> damage`);
    await sleep(260);
  }
  if (rally === "attack") log("🔥 RALLY (ATTACK): team damage +20%!");
  if (rally === "guard") log("🛡️ RALLY (GUARD): +400 shield!");
  state.bossHp = res.bossHpAfter; state.partyHp = res.partyHpAfter;
  renderBars(); renderParty(res);
  await sleep(400);
  if (res.bossHealed) log(`👑 The Snooze King healed <b>${res.bossHealed} HP</b> off that long snooze (phase 3).`, "boss");
  if (res.outcome !== "win") log(res.counterDamage > 0 ? `👑 Boss counter-attack: <b>-${fmt(res.counterDamage)} party HP</b> (shield soaked ${fmt(res.shield)}).` : `👑 Boss countered, but the shield soaked it all (${fmt(res.shield)}).`, "boss");
  log(`📖 ${chronicle(night, res)}`, "story");
  state.selected = null; state.nightIdx++; state.busy = false;

  if (res.outcome !== "ongoing") { state.over = true; endRaid(res.outcome); }
  renderBars(); renderCards();
}
function endRaid(outcome) {
  if (outcome === "win") state.acorns += 500;
  const title = outcome === "win" ? "🏆 THE SNOOZE KING IS DOWN!" : outcome === "party_wiped" ? "💀 THE PARTY GOT WIPED..." : "⏰ SEVEN NIGHTS GONE — THE BOSS SURVIVES";
  const sub = outcome === "win" ? "The whole party wins! +500 🌰 boss bonus." : outcome === "party_wiped" ? `The boss still had ${fmt(state.bossHp)} HP. Bring more shields, and match your cards to the night.` : `The boss survived with just ${fmt(state.bossHp)} HP — so close! Push harder on the final nights.`;
  const rank = [...RAIDERS].sort((a, b) => state.totals[b.id] - state.totals[a.id]).map((r, i) => `<li>${["🥇", "🥈", "🥉"][i] || "·"} ${r.emoji} ${r.name} — ${fmt(state.totals[r.id])} damage</li>`).join("");
  const claim = outcome === "win" ? `<div style="margin-top:12px"><button id="claimBtn" class="primary" style="margin-top:0">⛓️ Claim victory on Sepolia</button><p id="claimResult" style="color:var(--muted);font-size:13px;margin:8px 0 0">Records this win as a real Sepolia transaction (0 ETH to yourself, result encoded in the tx data — you only pay a little testnet gas). ${wallet.address ? "" : "You'll be asked to connect your wallet first."}</p></div>` : "";
  $("#endBox").innerHTML = `<h2>${title}</h2><p>${sub}</p><p>Your total contribution: <b>${fmt(state.totals.you)}</b> damage · Acorns earned: <b>${fmt(state.acorns)} 🌰</b></p><ol class="rank">${rank}</ol>${claim}<button class="primary" onclick="location.reload()">↻ Raid again</button>`;
  $("#endBox").style.display = "block";
  const cb = document.querySelector("#claimBtn");
  if (cb) cb.onclick = () => claimVictoryOnChain(outcome);
  $("#endBox").scrollIntoView({ behavior: "smooth" });
}

async function pollLive() {
  try {
    const s = await fetchJson("https://api.squeekchain.com/v1/status", 4000);
    const m = s.measurement, spin = m.coreStatus === "SPINNING";
    $("#liveDot").className = "led " + (spin ? "on" : "idle");
    $("#liveText").textContent = spin ? `RUNNING · ${Math.round(m.rpmMilli / 1000)} RPM · ${(m.speedMmPerSecond * 3.6 / 1000).toFixed(1)} km/h` : "SNOOZING 💤";
    const bh = s.builder?.anchor;
    if (bh) $("#liveBlock").textContent = `Block #${fmt(parseInt(bh.blockHeight, 10) + 1)} · ${(parseInt(bh.blockProgress, 10) / 1e7).toFixed(0)}%`;
    $("#wheel").classList.toggle("spinning", spin);
  } catch (e) { $("#liveText").textContent = "API OFFLINE"; $("#liveDot").className = "led off"; }
}

async function init() {
  renderBars(); renderParty(null); renderCards();
  const wb = document.querySelector("#walletBtn");
  if (wb) wb.onclick = connectWallet;
  if (typeof window !== "undefined" && window.ethereum) {
    window.ethereum.on?.("accountsChanged", accs => { wallet.address = accs && accs[0] ? accs[0] : null; if (wb) wb.textContent = wallet.address ? "👛 " + shortAddr(wallet.address) : "👛 Connect Wallet"; if (wallet.address) loadAccountPanel(wallet.address); });
  }
  const { nights, source } = await loadNights();
  state.nights = nights;
  $("#dataNote").textContent = source === "api" ? "Night data: api.squeekchain.com (live)" : "API unreachable — using the recorded dataset, Oct 28 – Nov 2";
  log("⚔️ The raid begins! Pick a card for the first night, then hit Fight the Night. Slay the Snooze King within 7 nights!", "night");
  renderCards();
  pollLive(); setInterval(pollLive, 5000);
}
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => { $("#fightBtn").onclick = fight; init(); });

// Lets the logic be unit-tested under node (no effect in the browser)
if (typeof module !== "undefined") module.exports = { resolveNight, swingDamage, bossCounter, bossHeal, RAIDERS, FALLBACK_NIGHTS, averageNight, BOSS_MAX_HP, PARTY_MAX_HP };
