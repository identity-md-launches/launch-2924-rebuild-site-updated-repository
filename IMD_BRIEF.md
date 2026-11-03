# IMD Job Brief — SqueekRaid

Copy everything between the lines into a new IMD job. Reference implementation (port it faithfully — same rules, same numbers, same balance):

- Live site: https://chiricato.github.io/squeek-raid/site/
- Source: https://github.com/Chiricato/squeek-raid (see DESIGN.md, lib/raid.ts, test/fixtures/)

---

Build "SqueekRaid" — a co-op boss-raid game for Squeekchain: a party of 6 raiders fights the boss **Snooze King** over **7 nights**, where all damage comes from the hamster Squeektoshi's REAL recorded nightly output (distance run, blocks produced, hours snoozed). This is NOT a prediction or betting game: every night's data has already happened; the player wins through tactic choices, not guessing.

## Data sources (all public, CORS `*`, fetch directly from the browser)

1. `GET https://api.squeekchain.com/v1/measurement/stats?range=7d`
   - `activity.days[]`: `date`, `distanceMm`, `activeBuckets`, `buckets` (48 half-hour work-unit buckets per day)
2. `GET https://api.squeekchain.com/v1/settlements?range=7d`
   - `buckets[]` are 6-hour buckets (`startAt`, `completedBlockCount`); a night's block count = sum of buckets whose full 6h window lies inside the night
3. `GET https://api.squeekchain.com/v1/status`
   - `measurement.coreStatus` (SPINNING / IDLE), `rpmMilli`, `speedMmPerSecond`, `cumulativeWorkUnits`; `builder.anchor.blockHeight`, `builder.anchor.blockProgress` (divide by 1e9 for %)
4. `GET https://api.squeekchain.com/v1/accounts/{address}`
   - `tokenCounts.wallet` + `tokenCounts.staking` (Squeeks), `power.nftPower` + `power.sqkPower`, `rewards.claimableBaseUnits` (SQK, 18 decimals)

Night definition: 12:00 UTC → next 12:00 UTC. Per night derive: `distanceKm = distanceMm / 1e6`; `snoozeHours = 24 − activeBuckets × 0.5`; `afterMidnightShare` = work in buckets after 00:00 UTC ÷ total work; `wakeTime` = first active bucket's time. A raid uses the last 6 completed nights + a 7th "Decision Night" synthesized from the week's averages. If fewer than 7 days are available or any fetch fails, fall back to the recorded fixtures in the reference repo (`test/fixtures/`) and label the data source honestly on the page ("recorded data" vs "live · api.squeekchain.com"). Never show a blank page.

## Game rules (exact — do not rebalance)

- Boss: **Snooze King, 6,400 HP**. Party HP: **1,600**. Raid length: **7 nights**.
- Party (name, ATK): You 220 · Bear Guard 180 · Daredevil Fox 170 · Beaver Miner 160 · Night Owl 150 · Old Stalker 140. The 5 bots each pick a tactic card per night pseudo-randomly from a personality tendency list.
- Each night the player picks **1 of 6 tactic cards**; a played card is unavailable for the next 2 nights:
  - ⚔️ Double Strike — your damage ×2 if the night's distance ≥ 10 km, else ×0.8
  - ⛏️ Deep Miner — flat bonus of night blocks × 0.15 damage
  - 🛡️ Guardian — damage ×0.7, and +250 party shield
  - 🌙 Night Hunter — damage ×1.6 if ≥ 50% of the night's work happened after midnight, else ×1
  - 🐾 Ambush — damage ×1.8 if the night's distance < 8.5 km, else ×0.9
  - 🔥 Rage — damage ×1.5, but the boss counter-attack hits 30% harder that night
- Every fighter's damage = `ATK × (distanceKm / 10) × their card multiplier`, plus the Deep Miner flat bonus if their card is Deep Miner.
- **Rally token** (once per raid, player's choice): +20% team damage that night, OR +400 shield.
- Boss counter-attack (only if the boss survives the night; a killing blow skips it): `snoozeHours × 22 × phase multiplier`, +150 if the night's distance < 8 km, ×1.3 if the player played Rage. Phase by boss HP when countering: >66% Phase 1 ×1.0 · 33–66% Phase 2 "Enraged" ×1.15 · <33% Phase 3 "Desperate" ×1.3. Shields absorb damage before party HP.
- Phase 3 sustain: at the start of a night, if the boss is below 33% HP and that night's snooze ≥ 19 h, the boss heals 300 HP.
- Score ("acorns"): total party damage ÷ 10, rounded, +250 bonus on victory.
- Win: boss HP reaches 0 within 7 nights. Lose: party HP reaches 0, or the boss is still alive after night 7.
- After each resolved night, an **AI Chronicle** panel appends one short story paragraph generated from that night's real numbers (distance, snooze hours, blocks, wake time, cards played, outcome).

Balance that must hold (verified on the real week of 2026-10-28 → 2026-11-02): sensible card play wins on night 7 with party HP to spare; playing no cards gets the party wiped around night 4; playing Guardian every night leaves the party untouched but the boss alive at the end (loss on time).

## Page requirements

- Hero: game title, one-line pitch, and a live Squeektoshi panel (wheel status, RPM, speed, current block height + progress %) from `/v1/status`.
- Wallet bar (top right): "👛 Connect Wallet" button + status box + account panel + a read-only address lookup field (see Wallet section).
- Boss panel: Snooze King with HP bar and current phase label. Party panel: all 6 members with emoji, name, ATK and their total damage contribution so far.
- Night flow: show the night's real data (km, snooze hours, blocks, wake time), let the player pick 1 card (+ optional Rally), then a "⚔️ Fight Night N" button resolves the night into a combat log (each fighter's damage, boss counter, shields, heals).
- Raid Chronicle panel collecting the per-night story paragraphs.
- End screens: victory ("The Snooze King has fallen!") or defeat, with nights taken, total damage, your personal damage, acorns earned, the Claim button on victory, and Play Again.
- "How to play" section: rules summary, wallet/Sepolia explanation, faucet link, and a note that the game is fully playable without a wallet.
- Fully in English. Dark theme, rounded cards, restrained shadows. Responsive: at 390 px width there must be no horizontal scrolling. Thousands separators on big numbers; HP/damage shown as integers.

## Wallet (Ethereum Sepolia — real transactions, testnet only)

- Connect via the injected provider (`window.ethereum`): `eth_requestAccounts`, then ensure **Ethereum Sepolia** — `wallet_switchEthereumChain` to `0xaa36a7` (chainId 11155111); if the chain is unknown (error 4902), `wallet_addEthereumChain` with RPC `https://ethereum-sepolia-rpc.publicnode.com` and explorer `https://sepolia.etherscan.io`.
- After connecting show: shortened address, Sepolia ETH balance (`eth_getBalance`), and the Squeekchain account stats from `/v1/accounts/{address}` (Squeeks, power, claimable SQK). If that API call fails, say so honestly in the panel instead of inventing numbers.
- EVERY click on Connect must produce visible feedback in a prominent status box — states: connecting / waiting for approval / connected / rejected (code 4001, friendly wording) / timed out after 20 s / no wallet detected in this browser (explain that in-app browsers can't inject a wallet and to open the page in Chrome/Brave with MetaMask). Never fail silently.
- Read-only lookup: a text field where anyone can paste an address (validate `0x` + 40 hex chars) and see the same balance + Squeekchain stats without connecting a wallet.
- **Claim victory on Sepolia** (shown after a win): `eth_sendTransaction` sending **0 ETH to the player's own address** with `data` = UTF-8 hex of exactly:
  `SQUEEKRAID WIN | Snooze King slain | nights:<n> | your damage:<total> | acorns:<n> | <yyyy-mm-dd>`
  On success show the link `https://sepolia.etherscan.io/tx/<hash>`. On rejection (4001) show a friendly message; the game result is unaffected. If no wallet is connected, prompt to connect first.
- How to play must link a Sepolia faucet (https://sepoliafaucet.com) for gas.

## Technical requirements

- Pure static site, vanilla JS (single self-contained `index.html`, or the small static structure of the reference repo), zero build step, no frameworks, no chart libraries.
- All fetches go directly to the public APIs above; any failure degrades to the recorded fixtures with an honest on-page label — never a blank screen, never console errors.
- Footer credit: "Built by Chiricato".

## Deliverables

1. The runnable site.
2. README.md: concept, data-source table, rules summary, how to run/deploy, wallet instructions.

## Acceptance criteria (all must hold)

- Using the recorded week (2026-10-28 → 2026-11-02 fixtures): sensible play wins on night 7; no-cards play loses around night 4; Guardian-every-night loses on time with the boss still alive.
- Within 10 seconds of loading, the live panel and Night 1 data show real values (live API or the honestly labelled recorded fallback); browser console has zero errors.
- At 390 px width: no horizontal scroll; all 6 party members and all 6 cards reachable.
- With the network fully offline, the game still loads and plays end-to-end on recorded data, labelled as such.
- Wallet on Sepolia (MetaMask): connect shows address, ETH balance and Squeekchain stats; claiming after a win creates a real Sepolia transaction whose calldata decodes to the exact SQUEEKRAID WIN memo above; rejecting the signature shows a friendly message and the game continues.
- No non-English text anywhere in the UI.

## Do NOT

- No prediction/betting mechanics, no wagering, no real-money anything, no token sale or mint promises.
- No backend, no database, no user accounts/login, no custody — never ask for seed phrases or private keys.
- Do not change any game number or rule from the reference implementation (boss/party HP, ATKs, card effects, cooldowns, counter formula, phases, heal, scoring).
