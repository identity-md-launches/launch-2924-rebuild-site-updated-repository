# SqueekRaid 🐹👑

**▶ Play it now (GitHub Pages): https://chiricato.github.io/squeek-raid/site/**

This export includes the fixes from upstream main, commit
[`14e45fea`](https://github.com/Chiricato/squeek-raid/commit/14e45fea2f5a51dc9b5b58a5af74975659d8d74d)
(“Fix 4 defects found by IMD design critic”). `site/game.js` is byte-for-byte that
revision. The publication artifact is `dist/`, ready for static hosting at a
subpath. The hosting system publishes the submitted export; this task does not
change a live deployment directly.

## Install, preview and rebuild

Use Node.js 22 or newer. The site is plain HTML, CSS and JavaScript and needs no
runtime dependencies or bundler. The existing package manifest and lockfile are
unchanged.

```bash
npm ci                       # install the existing test/typecheck tools
node scripts/build.mjs       # create the complete production export in dist/
node scripts/preview.mjs     # http://127.0.0.1:4173/; Ctrl+C to stop
```

Edit `site/index.html` (including its CSS), `site/game.js`, or `site/assets/`, then
rebuild. The build copies the runtime files without transforming the reviewed
game logic and checks that local asset URLs are relative and resolve. Publish
the contents of `dist/`, including `assets/`. No server rewrite is needed.
`site/assets/share.svg` is the editable original for the included 1200×630 PNG;
the PNG is already supplied and rebuilding does not require an image tool.

## Validation of this revision

The fidelity revision restores `site/index.html` to upstream `7701917` (the
HTML also used by `14e45fea`). Its CSS, visible copy, header and DOM order are
unchanged from upstream. Only the already-required favicon/social metadata and
relative `./game.js` URL remain as export additions. `site/game.js` and
`dist/game.js` still match the four-fix upstream script byte for byte.

```bash
npm test
node --test test/site-regressions.test.cjs
node --check site/game.js
./node_modules/.bin/tsc --noEmit --strict --target ES2022 --module commonjs --skipLibCheck lib/raid.ts
```

Actual results on 2026-11-03: production build, strict production-rules typecheck
and JavaScript syntax checks passed; **9/9 gameplay tests**, **17/17 browser-script
regressions** and **11/11 Chromium interaction scenarios** passed. The locked
TypeScript and tsx versions were installed outside the repository for this run;
the gameplay command above was run as its equivalent `tsx --test test/raid.test.ts`.
The legacy browser JavaScript is syntax checked and interaction tested, not
claimed to be statically typed.

| Check | Actual result |
| --- | --- |
| Reported interface redesign | Reproduced before editing at 390×844 and 1440×900, with the API blocked and seven recorded nights loaded. After restoration, both full-page screenshots and measured layouts match upstream exactly. |
| Fight loading and recovery | All tactics/fight disabled while loading; premature fight harmless; injected resolution error clears busy and retry resolves a night. |
| Short API week | 0–5 complete nights use all seven fallback nights; a four-night response was played through a night-seven win and replay. |
| Sepolia claim | Mocked add → switch → verify flow; ignored/rejected switches send no transaction; successful request pins `chainId: 0xaa36a7`. |
| Evening wake | Recorded October 28 buckets, including reversed order, produce 21:00 UTC; the live API browser walk also showed that wake. |

The export was served at `/preview/` and checked at 320, 390, 880, 881 and
1440px: no horizontal overflow, local resource failures or script errors in
the tested flows. Keyboard play, cooldowns, full raid/replay, offline fallback,
missing wallet and network errors were exercised. The supplied browser also
loaded the real API (HTTP 200) and resolved a night using only the keyboard.
All automated wallet requests were simulated; no transaction was broadcast.

For repeatable browser checks, install tooling outside the repository:

```bash
npm install --prefix /tmp/squeek-browser-tools --cache /tmp/squeek-npm-cache playwright@1.58.2
PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-browsers /tmp/squeek-browser-tools/node_modules/.bin/playwright install chromium webkit
PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-browsers IMD_PLAYWRIGHT=/tmp/squeek-browser-tools/node_modules/playwright/index.mjs node scripts/validate-browser.mjs
```

The pinned taste@1 probe completed on the final export: **13/16 checks passed**.
The retained warnings concern the original uppercase labels, emoji/punctuation
and nested fighter/event surfaces. The first 390×844 screen shows the product,
HP board and party; **fight remains below the fold**, as explicitly required by
the fidelity restoration. In the controlled API run its bounds were y=1405–1448.
The original running wheel also ignores reduced motion. These are documented
scope conflicts, not claimed acceptance passes or reasons for another redesign.
WebKit could not launch because host libraries were missing. Physical devices,
screen readers, native zoom, real wallet signing and mined confirmation remain
unverified. Some system emoji rendered as missing glyphs in this environment.

See [VALIDATION.md](VALIDATION.md) for reproduction, six-domain review and limits,
and [DESIGN.md](DESIGN.md#10-implemented-website-interface) for the restored
implementation. The current `dist/` is the static publication artifact; hosting
and public-domain updates are performed by the submission system.

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
- `site/` — the playable static MVP (`index.html` + `game.js` + local share/favicon assets):
  fetches live data with a labelled recorded-data fallback.
- `dist/` — complete production export, copied from source by `scripts/build.mjs`.
- `scripts/` — dependency-free build/preview and optional Playwright validation.
- `test/site-regressions.test.cjs` — regressions against the actual browser script.

## Run the tests

```bash
npm ci
npm test   # 9 tests
```

## Production roadmap

Next.js static + Supabase (`sr_*` RPCs, a pg_cron keeper that resolves each finished
night for every party at once, publicly auditable night data), real human parties via
invite links, a Discord/Telegram bot reminding players to pick cards, an `/overlay`
route for OBS, and an LLM-powered Chronicler with generated artwork.
