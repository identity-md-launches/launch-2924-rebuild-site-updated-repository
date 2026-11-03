# SqueekRaid — Game Design Document

> A weekly co-op boss raid on Squeekchain: the whole party fights the boss
> **Snooze King**, dealing damage from the real distance Squeektoshi runs each
> night, while the boss counter-attacks with the hamster's own sleep.
> Play points (Acorns 🌰), no real money. Optional Sepolia wallet: connect to
> show your Squeeks, and claim a won raid as a real on-chain transaction.

## 1. Positioning — why this doesn't collide with anyone

The Genesis code board (scanned 2026-11-03, 10 shipped projects) is already
crowded with: prediction (Squeek or Sleep, SqueekBet, PolyHamster, SqueekPot),
racing, an endless runner, a looter shooter, dashboards, an NFT naming app and a
SqueekFi planner. SqueekRaid avoids all of them by changing the **verb of play**:

- You don't *predict* what the hamster will do (prediction), you don't *bet*
  (betting), you don't *race* (racing).
- You **cooperate against a boss (PvE)**: the hamster's data is the *engine of a
  fight that already happened*, not an answer to guess. Your decision is a
  **tactic card** committed before the night resolves — you optimize your party
  against the trend of previous nights and the boss's phase, trading attack for
  defense. There is no pool, no human opponent, no odds.
- This is exactly what the organizers themselves list under "Build this":
  *"weekly boss raids powered by its real distance"* and *"a living story every
  round moves forward"* — and no project on the board does it.

Categories hit: *Server games and bots* (primary), *Games powered by
Squeekchain*, *AI on the wheel* (the AI Chronicler), *Stream companions*
(overlay, roadmap).

## 2. The real-data foundation (measured from api.squeekchain.com, 2026-11-03)

Night metrics (12:00 UTC → 12:00 UTC) derived with PolyHamster's formulas:
distance from `/v1/measurement/stats` (`activity.days[].distanceMm`); snooze
hours = half-hour buckets with `workUnits = 0` × 0.5; blocks = sum of
`completedBlockCount` over the 6-hour buckets of `/v1/settlements` fully inside
the night; work before/after midnight from the buckets.

| Night | km | Snooze h | Blocks | Work after midnight |
|---|---|---|---|---|
| 2026-10-28 | 9.30 | 19.0 | 967 | 49% |
| 2026-10-29 | 11.67 | 18.0 | 1,141 | 47% |
| 2026-10-30 | 11.03 | 17.5 | 1,069 | 39% |
| 2026-10-31 | 7.47 | 19.5 | 769 | 52% |
| 2026-11-01 | 7.89 | 19.0 | 835 | 51% |
| 2026-11-02 | 7.66 | 19.5 | 853 | 27% |

A typical week: ~55 km over 6 nights (≈64 km over 7), ~19 snooze hours a night,
~940 blocks a night, wake-up around 21:00 UTC. Every balance number below is
**simulated and automatically tested against this exact data**
(test/raid.test.ts + fixtures).

## 3. The raid loop

- One raid = **7 nights** against the Snooze King 👑😴, **6,400 HP**. Party of 6
  (production: human players form parties; MVP: you + 5 bot raiders), **1,600 party HP**.
- Each night, in order:
  1. **Pick a card:** you play 1 of 6 tactic cards (a played card rests 2 nights —
     cooldown). Bots pick by personality. One **Rally** token per raid: +20% team
     damage that night *or* +400 shield.
  2. **The night happens:** the night's real data is revealed (km, blocks, snooze
     hours, wake-up time).
  3. **The party strikes:** each fighter deals `ATK × km/10 × card multiplier`.
     A kill here means **no counter-attack**.
  4. **The boss heals (phase 3 only):** +300 HP if the night had ≥ 19 snooze hours.
  5. **The boss counters:** `snoozeHours × 22 × phase multiplier`, +150 on lazy
     nights (< 8 km), ×1.3 if anyone played Rage; shields absorb before party HP.
- Win: the boss dies within 7 nights. Lose: party HP hits 0 (wipe), or 7 nights
  pass with the boss alive.

### Boss phases
- Phase 1 (HP > 66%): counter ×1.0
- Phase 2 (33–66%): counter ×1.15 — "the Snooze King stirs"
- Phase 3 (< 33%): counter ×1.3 + snooze healing — "drowsy fury"

### The 6 cards (attack/defense trade-offs, none strictly best)
| Card | Effect |
|---|---|
| ⚔️ Double Strike | Swing ×2 if the night reaches ≥ 10 km, ×0.8 below |
| ⛏️ Deep Miner | Swing + blocks × 0.15 |
| 🛡️ Guardian | Swing ×0.7, +250 shield for the party |
| 🌙 Night Hunter | Swing ×1.6 if ≥ 50% of work is after midnight |
| 🐾 Ambush | Swing ×1.8 on lazy nights < 8.5 km, ×0.9 otherwise |
| 🔥 Rage | Swing ×1.5, boss counters 30% harder that night |

## 4. Bot raiders & the AI Chronicler

- 5 bots with their own ATK and personality: 🐻 Bear Guard (plays Guardian),
  🦊 Daredevil Fox (Double Strike/Rage), 🦫 Beaver Miner, 🦉 Night Owl
  (Night Hunter), 🐢 Old Stalker (Ambush). In production they fill empty party
  slots and are characters that *remember* their players (greeting you by your
  past raid record).
- **AI Chronicler:** after each night, a chronicle paragraph is written from
  that night's real data plus the fight's events (MVP: rich conditional
  templates; production: LLM-written, with self-painting artwork — "artwork
  that paints itself from every run"). After 7 nights the chronicle is a
  complete shareable story chapter.

## 5. Balance results (automated tests on the real week)

- No cards at all: **party wiped on night 4** (boss at 2,374 HP) → defense is mandatory.
- Balanced party (1–2 Guardians + situational attack cards): **boss dies on
  night 7**, party at 991/1,600 HP → winning takes measuring every night.
- All-turtle (3 Guardians): party HP untouched, but the boss survives with
  325 HP → turtling loses, narrowly.
- The player's own swings (highest ATK, 220) vary by ±200/night with card
  choice — the human's decisions are the deciding factor at the win/lose line.

## 6. Wallet & Sepolia transactions (MVP)

- **Connect Wallet** via the injected provider (MetaMask etc.): the site
  requests Sepolia (chainId 11155111, switching/adding the network if needed)
  and displays the player's Squeeks, power and claimable SQK from
  `GET /v1/accounts/{address}`, plus their Sepolia ETH balance.
- **On-chain victory claim:** winning a raid unlocks a claim button that sends
  a real Sepolia transaction from the player's wallet: **0 ETH to their own
  address**, with a memo in the calldata — `SQUEEKRAID WIN | nights, damage,
  acorns, date`. Anyone can verify the win on Sepolia Etherscan. This keeps
  the game non-custodial with no custom contract to audit; a dedicated
  `SqueekRaidTrophies` contract (soulbound win badges, season leaderboards)
  is the production step.
- The game is fully playable without a wallet; the wallet only adds identity
  and the on-chain proof.

## 7. MVP modes

1. **⚔️ The 7-Night Raid (primary):** a full raid over the 6 most recent
   complete nights fetched live from the API when the page opens (if the API
   is unreachable, the recorded Oct 28 – Nov 2 dataset is used and labelled)
   + night 7, the "Decision Night", simulated from the weekly average and
   labelled as simulated. Each night: pick a card → watch the real night
   resolve → strikes, counter, chronicle.
2. **🔴 Live panel:** Squeektoshi's status right now from `/v1/status`
   (SPINNING/IDLE, RPM, km/h, block height + progress) and the real week's
   raid progress.

## 8. Production architecture (after the MVP)

Following PolyHamster's proven keeper pattern, without copying its code:
Next.js static + Supabase (`sr_*` RPCs), a pg_cron keeper (every minute) that
detects each finished night, resolves the raid for every party at once, and
publishes the night data for verification. Human parties via invite links; a
Discord/Telegram bot reminding players to pick cards before 20:00 UTC; an
`/overlay` route for OBS showing boss HP during streams.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| An unusually lazy hamster week (low km) | Seasonal bosses: next week's boss HP is calibrated to the trailing 4-week average; Ambush is the built-in comeback card for lazy nights |
| Incomplete night data (coverage) | Void night: no strikes, no counter, the raid extends by one night (PolyHamster's void rule) |
| Players pick cards at random | There is no single "right answer" — every card deals damage; the difference is party composition and timing, and whether the boss dies is a shared result |
| Mistaken for a prediction game in disguise | Cards are never locked against an outcome you must guess to score; rewards are contribution XP, with no pool/odds/payout |
