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

```bash
npm test
node --test test/site-regressions.test.cjs
node --check site/game.js
./node_modules/.bin/tsc --noEmit --strict --target ES2022 --module commonjs --skipLibCheck lib/raid.ts
```

Actual results on 2026-11-03: production build passed; production TypeScript
rules passed strict typecheck; JavaScript syntax checks passed; the existing
9 gameplay tests and all 17 browser-script regression tests passed. Running the
same regression tests against the parent revision produced 12 failures,
covering all four reported defects. The legacy JavaScript UI is syntax checked
and interaction tested, not claimed to be statically typed. An additional broad
typecheck including the old test file found three pre-existing partial-record
argument errors at `test/raid.test.ts:102`–`104`; that file and `lib/` are unchanged.

| Reported defect | Recheck result |
| --- | --- |
| Fight before data loads / stuck busy state | Six tactic cards and fight stay disabled while loading; premature invocation returns without setting busy; an injected resolution failure clears busy and the retry resolves night one. |
| Short API week strands a raid | 0–5 complete nights use all six recorded nights plus the simulated Decision Night. Six complete nights use API data plus the average. A four-night response was played through a night-seven victory, with 226 party HP remaining. |
| Claim on the wrong chain | Mocked unknown-network flow was add → switch → read chain ID. Ignored or rejected switches sent no transaction. A successful request pinned `chainId: 0xaa36a7`, with 0 ETH to the same address. Transaction rejection restored retry. |
| Incorrect wake time | The recorded October 28 buckets, also tested in reverse order, yielded minute 1260 / **21:00 UTC**. A live-data browser session showed the same evening wake. |

The production export was served under `/preview/` for 11 passing Chromium
interaction scenarios at widths 320, 390, 880, 881 and 1440. These exercised
loading, recovery, keyboard play, cooldowns, full raid/replay, offline fallback,
missing wallet, wallet network errors and reduced motion. At 390×844 the main
action occupied y=564–608, with the boss and tactic selector visible. Local
assets loaded without failures and no script errors occurred in the tested
flows. A separate browser-tool walk used the live Squeekchain API (HTTP 200)
and resolved the first night. Wallet requests in automated checks were doubles;
no real wallet was connected and no transaction was broadcast.

For the repeatable browser checks, install Playwright outside the repository
and keep its browser downloads outside the submission:

```bash
npm install --prefix /tmp/squeek-browser-tools --cache /tmp/squeek-npm-cache playwright@1
PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-browsers /tmp/squeek-browser-tools/node_modules/.bin/playwright install chromium webkit
PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-browsers IMD_PLAYWRIGHT=/tmp/squeek-browser-tools/node_modules/playwright/index.mjs node scripts/validate-browser.mjs
```

The pinned taste@1 probe ran on the final export at 320, 390 and 1440, including
reduced motion: **12/16 raw checks passed**. Render, layout, targets, contrast,
tracking, hierarchy labels, type scale/families, repetition, slogans, motion and
share metadata passed. Four retained warnings cover the established uppercase
game labels, emoji/punctuation, nested fighter/event surfaces and the probe's
prose budget (which includes necessary tactic descriptions). The request's
“No other changes” scope preserves those existing conventions. All ten measured
controls were at least 44px high; no overflow, overlapping text or clipped text
was measured. The six-domain review and source findings are in
[VALIDATION.md](VALIDATION.md); implemented visual rules are in
[DESIGN.md](DESIGN.md#10-implemented-website-interface).

WebKit was attempted but could not launch because host runtime libraries are
missing. Physical phones, screen readers, native browser zoom, an actual wallet
signature and transaction confirmation were not checked. The probe's offline
run verifies the recorded fallback; the browser scenarios separately use
controlled API responses. These results are local worker evidence, not an
independent behavior certification.

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
