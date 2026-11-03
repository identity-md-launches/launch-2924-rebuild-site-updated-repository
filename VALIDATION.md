# SqueekRaid fidelity revision — 2026-11-03

Complete for the reported fidelity revision and four-fix recheck. This report
records local worker evidence, not independent certification or a live publish.
The generic first-screen-action criterion conflicts with the explicit revision
request to restore upstream's layout; the original below-fold action is retained
and disclosed rather than claimed as a pass.

## Scope and provenance

GitHub's main-commit API returned
[`14e45fea2f5a51dc9b5b58a5af74975659d8d74d`](https://github.com/Chiricato/squeek-raid/commit/14e45fea2f5a51dc9b5b58a5af74975659d8d74d),
parent `7701917`, with only `site/game.js` changed. Its downloaded game script,
`site/game.js` and `dist/game.js` have the same SHA-256:
`6d5b981f055a6bc87d478c13fdd6288097168d3852ee477a7211e5a4b868c60a`.

The revision restores the upstream HTML/CSS, including the header, phone type,
wheel, full tagline and party → cards → rally → fight order. The only remaining
HTML differences from `git show 7701917:site/index.html` are the required existing
favicon/social metadata and relative `./game.js` URL. CSS is byte-identical;
the body is byte-identical after normalizing that script URL. The source and
export HTML, JavaScript, favicon and PNG match byte for byte.

No game logic, rules, balances, wallet connector, public RPC, chain parameters,
transaction payload, dependencies, package files, ignore files or protected
paths were changed. The existing browser validation script was updated to
exercise the restored ordering and record its limitations. Hosting follows
submission of `dist/` for `squeekraid.identitymd.eth`; no publishing command or
chain transaction ran here.

## Reopened finding: reproduced, fixed, rechecked

ID: `f2bc03d4338d280040cf46fd2ad716e3ab8661f0c39b628aedf711a0a6af1bc9`.

Before editing, served upstream HTML and the submitted HTML beside the same fixed
`game.js`. Chromium 145, device scale 1, 390×844 and 1440×900. Blocked all
`api.squeekchain.com` requests and waited for `state.nights.length === 7` on both.
The finding reproduced: grid rather than flex header, hidden phone wheel,
24px rather than 34px phone title, shortened tagline and reordered controls.

| Measurement, identical recorded fallback | Upstream | Before revision | Final export |
| --- | --- | --- | --- |
| Header, both widths | flex | grid | flex |
| Title at 390px | 34px | 24px | 34px |
| Wheel at 390px | visible (block) | none | visible (block) |
| Main content order | party, cards, rally, fight | fight, cards, rally, party | party, cards, rally, fight |
| Fight bounds at 390px | y=1407–1450 | y=567–611 | y=1407–1450 |
| Fight bounds at 1440px | y=1168–1211 | y=472–516 | y=1168–1211 |
| Full-page screenshot equality to upstream | reference | different at both widths | identical PNG bytes at both widths |

The full original tagline and section headings were restored. Pixel comparison
and exact CSS/body comparison independently confirm the restoration. Values can
vary with installed fonts/API status; comparisons above use the same browser,
viewport, game script and blocked transport. The result is also recorded in
`.imd-responses.json`.

## Four upstream game fixes

| Finding / source | Actual recheck | Result |
| --- | --- | --- |
| Early fight / stuck busy — `site/game.js:257`, `:264`, `:268`, `:302` | Before data, all six cards/fight disabled and a premature call leaves busy false. An injected resolver exception clears busy, shows recovery and allows retry to resolve night one. Node VM and exported-page checks. | Passed tested paths |
| Incomplete week — `site/game.js:112` | 0–5 complete nights use all six recorded nights plus simulated Decision Night. Six complete nights use API plus average. Offline, unfinished-night and missing-distance inputs retain seven nights. Four-night browser response played through night-seven win, boss 0, party 226, 616 acorns; replay resets to night one. | Passed |
| Wrong-chain claim — `site/game.js:139`, `:214`, `:218` | Mock 4902 flow adds, switches again and verifies chain ID. Known/new networks that ignore the switch send no transaction; rejection restores retry. Successful zero-value self-transaction pins `0xaa36a7`; memo retained. Node tests also cover a chain change at send time. | Passed with provider doubles |
| Morning wake — `site/game.js:99`, `:123` | Recorded October 28 buckets, including reverse order, yield minute 1260 / 21:00 UTC; work totals remain 5223/5364. Exported-page and live API keyboard walk also show 21:00 UTC. | Passed |

## Commands and actual outcomes

All commands ran after reading the pinned guides. The production export was
rebuilt after the last HTML change. Tool packages/browser downloads were installed
under temporary directories outside the repository; package files were untouched.

| Command / check | Result |
| --- | --- |
| `node scripts/build.mjs` | Exit 0; four runtime files, 87,838 bytes total, relative assets resolve. |
| `node --check site/game.js` and all three `scripts/*.mjs` | Exit 0. |
| TypeScript 5.9.3: `tsc --noEmit --strict --target ES2022 --module commonjs --skipLibCheck lib/raid.ts` | Exit 0. Production TypeScript rules only; legacy JavaScript UI is syntax/interaction checked. |
| Locked tsx 4.23.15: `tsx --test test/raid.test.ts` (existing `npm test` equivalent) | 9/9 passed. |
| `node --test test/site-regressions.test.cjs` | 17/17 passed. |
| External Playwright 1.58.2: `node scripts/validate-browser.mjs` | Exit 0; 11/11 Chromium scenarios, export served under `/preview/`. Two preserved upstream limitations plus unavailable WebKit recorded. |
| Pinned `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline` | Exit 0; all 16 checks measured, 13 passed and three retained warnings below. Exit 0 is not a clean style score. |
| Same fixed-script HTML comparison | Reproduced before edit; final full-page PNGs and layout objects identical to upstream at 390 and 1440. Exact CSS/body assertions passed. |
| Source/export and upstream-script parity | Passed for all four runtime files and upstream `game.js`. |
| `git diff --check` | Exit 0. |

The browser scenarios check 320, 390, 880, 881 and 1440px layouts, required
metadata, loading, recovery, keyboard play, cooldowns, seven-night completion,
replay, offline fallback, missing wallet, network rejection and transaction
rejection. Tested flows had no JavaScript errors or failed local resources.
Wallet requests are simulated; no wallet was connected or transaction broadcast.

The supplied browser also inspected mobile/desktop production screenshots,
loaded stats/settlements/status successfully (HTTP 200), selected Double Strike
using Tab/Enter and tabbed to fight. Night one resolved with boss 5359 HP,
party 1432 HP, busy false and October 28 wake 21:00 UTC. Console had zero errors
or warnings. The focus screenshot was inspected, not only its computed styles.

## Better Interface six-domain review

Read the pinned workflow, all six core domains and documentation method. The
scope rule preserves deliberate project conventions; the revision's explicit
“No other changes” and restoration request override proposals for a redesign.
The visual idea remains a dark arcade raid board with gold actions and HP bars.

| Domain | Coverage and evidence | Limits / retained upstream behavior |
| --- | --- | --- |
| Accessibility — Checked | Source review of native buttons/links, labels and disabled states; browser names/roles; keyboard wallet → tactic → selection → Tab through controls → fight/Enter; native visible focus; targets meet the probe's 24px/spacing bar. | Original h1→h3 hierarchy, no skip link/live regions, browser focus ring and no reduced-motion override are retained (`site/index.html:21`, `:87`, `:89`, `:111`). No screen reader, forced-colors or full accessibility audit. |
| Layout — Checked | Same-data upstream comparisons and screenshots at 390/1440; responsive validation at 320/390/880/881/1440; no measured horizontal overflow, text collisions or clipped text. | Main action below first 390 screen (`site/index.html:87`–`:99`). Explicit upstream restoration wins; this acceptance criterion is not marked passed. Native zoom, RTL and physical devices not tested. |
| Writing — Checked | Restored full tagline, headings, original cooldown/rally descriptions and original visible rules. Data-source/simulated labels, retry text and transaction cost/network explanation reviewed. | Original fallback text says “API unreachable” for short data too (`site/game.js:342`); claim success means a returned transaction hash, not mined confirmation (`:219`). No copy rewrite. |
| Typography — Checked | Source and computed 34px title at both widths; original body/button defaults and 12–16px supporting roles restored; viewed wrapping in mobile/desktop screenshots. Probe passes size/family/weight limits. | Seven sizes with one-offs; normal body/card line-height and original font requests retained (`site/index.html:18`, `:23`, `:46`, `:55`, `:59`). Some emoji display missing glyphs in the host fonts; no substitute assets or fonts added. |
| Colors — Checked | Original nine hex tokens; numeric/text status cues alongside color; probe reports measured solid-background text meets 4.5:1 (3:1 large). | Disabled controls, every possible generated log state, emoji colors and unspecified native focus contrast are not fully audited. No light theme is implemented. |
| UI — Checked | Resting/selected/disabled, loading/error/retry, cooldown, victory/replay and wallet rejection paths exercised. Original radii, borders, glows and explicit width transition preserved. | Controlled SPINNING status with reduced motion still runs one infinite wheel animation (`site/index.html:21`, `:36`). No slow Animations-panel replay or native wallet UI inspection. |

## Findings, resolution and retained diagnostics

High fidelity finding (`site/index.html:20`, `:23`, `:64`, `:87`): unauthorized
header/style/copy/order changes reproduced. Restored upstream CSS/body and rebuilt
`dist/`. Identical full-page images and layouts at 390/1440 confirm the fix.
The earlier documentation's compact-header, moved-action, custom-focus and
reduced-motion claims were removed. `DESIGN.md` now describes the final source.

Final taste@1 score: **13/16**. Passed: render, layout, targets, contrast,
tracking, eyebrows, type-sizes, type-faces, slogans, repetition, copy-budget,
motion (offline idle state only) and share. Three retained warnings:

- Casing — original uppercase HP labels, `site/index.html:79`, `:81`.
- Glyphs — original emoji and em dashes, `site/index.html:65`, `:68`, `:96`
  and generated game text.
- Chrome — seven original nested fighter/event surfaces, `site/index.html:43`,
  `:55`; retained as part of the requested upstream interface.

All ten measured controls met 24px/spacing; three were below the comfortable
44px height. The probe counted 26 first-screen prose words at 390 and 88 at
1440. Its offline wheel did not spin: the separate mocked-SPINNING test exposes
the reduced-motion limitation rather than treating the idle probe as proof.
These diagnostics are recorded, not corrected through another unauthorized
interface change.

## Evidence and limitations

The browser script writes `artifacts/browser-results.json` and mobile, desktop,
keyboard-focus and victory screenshots under `artifacts/screenshots/`.
Reproduction work and both full-page comparisons were made in
`test/scratch/fidelity/{before,after}/`; the probe writes `test/scratch/taste/`.
Scratch is removed before submission. The essential measurements and results
are recorded above so this report stands without temporary evidence.

WebKit launch was attempted and failed for missing host libraries, including
GTK, Graphene and GStreamer; Safari behavior remains unverified. There was no
physical-device, screen-reader, native zoom, real-signature or transaction-receipt
check. Hosting and public-name resolution happen after submission and were not
performed here. The path/size verifier does not certify behavior.

Guidance attribution: Jakub Krehel's Better Interface (MIT), pinned commit
`267330e1adfc66a718fb65fa6918c1f06d0a689e`; documentation method from Paul Bakaus's
Impeccable (Apache-2.0), pinned commit
`9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. Combined license text is retained in
`artifacts/design-guidance-LICENSE.txt`.
