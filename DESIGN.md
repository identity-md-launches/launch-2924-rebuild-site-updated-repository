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
   is unreachable or supplies fewer than six complete nights, the full recorded
   Oct 28 – Nov 2 dataset is used and labelled)
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
| Incomplete night data (coverage) | Current MVP: use the full recorded six nights + average if fewer than six completed nights are returned. A void-night extension is a future production proposal, not current behavior. |
| Players pick cards at random | There is no single "right answer" — every card deals damage; the difference is party composition and timing, and whether the boss dies is a shared result |
| Mistaken for a prediction game in disguise | Cards are never locked against an outcome you must guess to score; rewards are contribution XP, with no pool/odds/payout |

## 10. Implemented website interface

### Overview

The playable interface is plain HTML, inline CSS and browser JavaScript in
`site/index.html` and `site/game.js`. `scripts/build.mjs` copies its runtime files
to `dist/` without transforming the upstream game script. This revision keeps
the existing dark arcade character: gold title and actions, colored HP bars,
emoji fighters and tactics, compact numeric data and a raid chronicle.

The header identifies the game and offers the optional wallet. The HP board
precedes the tactic selector, followed by the party roster, result and rules.
The chronicle sits alongside at desktop widths and below on narrower screens.
The main action is above the cards so the game and action are on the first
390px screen. The party label explicitly identifies the five bot companions.

### Colors

The canonical hex custom properties live in `site/index.html`'s `:root` rule.
Reuse their existing names; this update adds no palette or theme.

| Token | Value | Implemented role |
| --- | --- | --- |
| `--bg` | `#0b0e1a` | Page background |
| `--panel` | `#12172b` | Board, panels, live and wallet surfaces |
| `--line` | `#232a47` | Surface outlines and separators |
| `--text` | `#e8ebff` | Primary text |
| `--muted` | `#8b93b8` | Descriptions, notes, numeric secondary data |
| `--gold` | `#ffd23f` | Brand, primary action fill, selection/focus, story border |
| `--blue` | `#57c7ff` | Night log borders, idle status, party HP start |
| `--red` | `#ff5d73` | Boss events, offline status, boss HP start |
| `--green` | `#52ffa8` | Running status and party HP end |

Existing literal component colors are `#171d36` for fighters/cards/log rows,
`#23203a` for selected tactics, `#1a2040` for empty HP tracks, `#1d2440` for
wallet button fill, `#262f55` for its hover, and `#1a1405` for text on gold.
Boss HP runs from red to gold, party HP from blue to green. Labels and numeric
HP accompany color; the status indicator also has running/snoozing/offline text.

Measured sRGB contrast: muted/card 5.50:1, muted/panel 5.89:1, primary action
text/gold 12.69:1, primary text/page 16.26:1, gold focus/card 11.49:1. The rendered
probe found no failing measured normal text pair. Disabled controls, platform
emoji and every possible generated state are outside that contrast claim.

### Typography

Prose uses `"Segoe UI", system-ui, sans-serif`; the title, live status and HP/data
rows use `"Courier New", monospace`. No font download is required. Rendering
uses system fallbacks when those named fonts are absent; their availability is
not assumed. Buttons inherit the prose family.

The six text sizes across the implementation are 12, 13, 14, 16, 24 and 34px:
12px captions/descriptions/fighter data; 13px wallet/claim detail and rally label;
14px tactic labels, HP rows, chronicle and explanatory rules; 16px body and
section headings/primary buttons; title 34px, becoming 24px below 600px. The
rendered entry state uses five text sizes at each tested width. Emoji are
decorative/icon sizes (20, 24, 30 and 44px), not additional prose roles.

Regular copy requests weight 400, labels 700, primary actions 800. Body
line-height is 1.5, tactic content 1.4, explanatory rules 1.55. The legacy
monospace title has 3px tracking, reduced to 1px below 600px; content uses natural
spacing. HP/night/totals use tabular numerals. Names and long account/log content
wrap, and no critical explanation is line-clamped. The desktop rules column
inherits the main column's roughly 640px content measure.

### Layout

`.wrap` is centered at a maximum 1060px including 14px horizontal padding;
its top/bottom padding is 18/60px. The header uses a flexible identity column
and an auto-sized wallet column; supporting text/status use the full row.
Its gaps are 8px vertically and 14px horizontally.

The established spacing is 8px within small grids, 16px between panels and
16px panel padding. Tactics form two columns, fighters three columns, with
8px gaps. The content grid uses `minmax(0, 1fr) 340px` and a 16px gap above
880px. At 880px and below it becomes one column. Main sections remain in DOM
order, with the controls before roster and rules. The log is independently
scrollable beyond 520px; other content stays in document flow.

At 600px and below the decorative header wheel hides, the title becomes 24px,
wallet text 12px, supporting text 14px, live status 12px and board padding 12px.
Wallet and title remain in the top row. Board rows wrap rather than clip.
Viewed/checked at 320, 390, 880, 881 and 1440 CSS pixels. At 390×844 the fight
control is fully visible at y=564–608 with the boss and tactics on screen.
No horizontal overflow was measured. Native zoom, RTL and physical-device
behavior are not claimed by those viewport checks.

### Elevation & Depth

The site uses tonal panels with 1px borders. The title retains its gold text
glow and live LEDs retain status glows. A selected tactic retains its 1px gold
box-shadow in addition to the gold border as an existing selection cue. There
are no modal overlays, sticky action bars or new elevation layers. The
keyboard skip link uses `z-index: 1` only while brought into view.

### Shapes

Board/panels use 14px radii; live/wallet panels 12px; tactics, fighters and
primary actions 10px; HP tracks and log rows 8px; wallet/rally controls pill
radii of 999px. HP bars clip their fill inside rounded tracks. No text surface
uses hidden overflow to force a fit. Keep these established component shapes
rather than adding a second radius scale.

### Components

| Pattern / location | Implemented behavior and states |
| --- | --- |
| Header and `#walletBtn`, `site/index.html`; `connectWallet`, `site/game.js` | One optional injected-wallet action, connected short address, pending/status messages and visible missing-wallet help. Wallet stays usable independently of night loading. Minimum 44px height. No connector sheet is implemented. |
| `.board`, `renderBars` | Boss/party HP text, phase and night count, with clamped gradient bar widths. Data source text distinguishes API and recorded fallback. |
| `.tactics`, `renderCards` | Two-column native tactic buttons, full descriptions, gold `.picked` state. Six cards and fight unavailable before data loads; busy/finished/cooldown use native disabled. Two-night cooldown has text in the card. |
| `.primary`, `fight` | Gold full-width action, weight 800, minimum 44px high. Disabled until a tactic and data are available. Exceptions clear busy and show retry text. Selection stays available for retry through the fight control. |
| `.rally`, `#rallyRow` | Attack/guard choice, dashed pill at rest and red solid selected border. One token per raid; row disappears once used. Minimum 44px height. |
| `.fighter`, `renderParty` | Three-column roster, gold outline for the human, name, attack, last swing and total contribution. Five companions are bots. |
| `#log`, `log` | Prepended events in a bounded scroll area; night/boss/story border colors; role log with polite additions. No screen-reader announcement test was performed. |
| `#endBox`, `endRaid` | Win/wipe/time-up heading, contribution ranking, optional Sepolia claim only on a win, and replay through reload. Claim gas/network explanation remains visible. |
| `#claimBtn`, `claimVictoryOnChain` | Uses upstream add/switch/check and chain-pinned self-transaction; pending confirmation text, success link or rejection/retry. The success text denotes a submitted hash; no receipt polling exists. |

All actions are native buttons and links. `:focus-visible` uses a 2px gold
outline offset by 3px; a skip link targets the single main landmark. Section
headings use h2 below the h1. The wallet status is a polite status region, and
the chronicle is a labelled log. Selecting the first tactic by keyboard and
Shift+Tab back to the newly enabled fight button was exercised successfully.

The wheel's existing 1.1s continuous spin and 0.8s HP-width transition remain
for normal motion. Under `prefers-reduced-motion: reduce`, both are disabled.
The upstream result scroll call remains; native smooth-scroll behavior in all
engines is unverified. No `transition: all`, added entrance animation or font
asset is used.

Local share assets are `site/assets/favicon.svg` and `site/assets/share.png`.
The corresponding `share.svg` is the editable card source, not a runtime
dependency. Title, description, `og:title`, `og:image`, image dimensions and
image alt text live in the HTML head, with relative runtime asset URLs.

### Do's and Don'ts

- Start from `.wrap`, `.board`, `.layout` and `.panel` for compatible structure.
  Preserve tactic controls ahead of the roster in the phone reading order.
- Reuse existing hex tokens, system families and component shapes. Keep full
  tactic effects and consequential transaction explanations accessible.
- Use `.primary` for the main action, `.rally` for the once-per-raid choice and
  the existing gold outline for focus/selection. Keep disabled native controls
  tied to the real loading/cooldown state.
- Preserve the exact reviewed game script for this bounded rebuild. Additional
  game rules, provider migrations or receipt tracking need their own scope.
- If another static page is later requested, reuse the header/panel patterns,
  use relative assets, add it to the export's explicit file list and verify it
  at a hosting subpath. No second page is part of this revision.

The six-domain review, retained probe warnings and unperformed checks are
recorded in `VALIDATION.md`. Documentation method adapted from Paul Bakaus's
Impeccable (Apache-2.0), pinned `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`;
design guidance from Jakub Krehel's Better Interface (MIT), pinned
`267330e1adfc66a718fb65fa6918c1f06d0a689e`. License text is retained with the
validation artifacts.
