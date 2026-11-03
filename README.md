# SqueekRaid 🐹👑

**▶ Play it now (GitHub Pages): https://chiricato.github.io/squeek-raid/site/**

A weekly **co-op boss raid** on **Squeekchain**: your party fights the **Snooze King**,
dealing damage from the real distance Squeektoshi runs every night, while the boss
counter-attacks with the hamster's own sleep. No predictions, no betting — pure co-op PvE.
Play points (Acorns 🌰), no real money. Optional wallet on **Sepolia**: connect to see
your Squeeks, and claim a won raid as a real on-chain transaction.

## The rules in short

- One raid = 7 nights. Boss: **6,400 HP**. Party of 6 (you + 5 bots in the MVP), **1,600 party HP**.
- Every night you play 1 of 6 tactic cards (2-night cooldown); bots play by personality:
  ⚔️ Double Strike · ⛏️ Deep Miner · 🛡️ Guardian · 🌙 Night Hunter · 🐾 Ambush · 🔥 Rage.
- Damage per fighter = `ATK × night's km / 10 × card multiplier`. Kill the boss and it never counters.
- Boss counter = `snooze hours × 22 × phase multiplier` (+150 on lazy nights, ×1.3 if anyone
  played Rage); in phase 3 the boss heals 300 HP on nights with ≥ 19 snooze hours.
  Shields (250 per Guardian) soak damage first.
- Night data comes from `api.squeekchain.com`: distance + snooze hours + work before/after
  midnight from `/v1/measurement/stats`, blocks from `/v1/settlements` (a night = 12:00 → 12:00 UTC).

## Wallet & Sepolia transactions

- **Connect Wallet** (injected provider, e.g. MetaMask): the site switches you to
  **Sepolia** (chain 11155111) and reads your Squeeks / power / claimable SQK from
  `GET /v1/accounts/{address}`.
- **Claim victory on-chain**: after a won raid, one click sends a real Sepolia
  transaction — **0 ETH to yourself**, with the raid result (nights, your damage,
  acorns, date) encoded in the calldata. Gas is paid in test ETH; the tx is publicly
  verifiable on Sepolia Etherscan. No contract, no custody, nothing is collected.

## Balance, verified on real data (Oct 28 – Nov 2, 2026)

- No cards at all → **party wiped on night 4**. All-turtle → party untouched but the
  **boss survives with 325 HP**. A balanced party → **boss dies on night 7**, 991 party HP left.
  See DESIGN.md §5 and the automated tests.

## Structure

- `DESIGN.md` — full game design: positioning, data foundation, rules, balance, production architecture.
- `lib/raid.ts` — pure rules (cards, damage, boss, resolution, bots, chronicler) shared by client, keeper and tests.
- `test/raid.test.ts` + `test/fixtures/` — unit tests + recorded real API data.
- `site/` — the playable static MVP (`index.html` + `game.js`, no build step): fetches live
  data from the API with a labelled recorded-data fallback. Deployed via GitHub Pages.

## Run the tests

```bash
npm install
npm test   # 9 tests
```

## Production roadmap

Next.js static + Supabase (`sr_*` RPCs, a pg_cron keeper that resolves each finished
night for every party at once, publicly auditable night data), real human parties via
invite links, a Discord/Telegram bot reminding players to pick cards, an `/overlay`
route for OBS, and an LLM-powered Chronicler with generated artwork.
