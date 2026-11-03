# SqueekRaid rebuild validation — 2026-11-03

Complete for the requested rebuild and four-defect recheck, within the limitations
below. This is a worker report, not independent certification or proof of a live
publication.

## Scope and provenance

Rebuilt upstream main at
[`14e45fea2f5a51dc9b5b58a5af74975659d8d74d`](https://github.com/Chiricato/squeek-raid/commit/14e45fea2f5a51dc9b5b58a5af74975659d8d74d),
whose parent is the supplied workspace revision `7701917`. GitHub's commit API
reported only `site/game.js` changed. The downloaded script, `site/game.js` and
`dist/game.js` have identical SHA-256:
`6d5b981f055a6bc87d478c13fdd6288097168d3852ee477a7211e5a4b868c60a`.

Game rules, balances, wallet implementation, public RPC, chain parameters and
claim payload are precisely that upstream revision. Supporting changes satisfy
the export, first-phone-screen, metadata, interface review and documentation
criteria. The dark arcade palette, game icons and panel treatment remain.
No package manifest, lockfile, dependency, contract or ignore file was changed.
The existing injected-wallet connector was retained under “No other changes”;
the wallet reference was read but no connector migration was made.

The current site name from the supplied project history is
`squeekraid.identitymd.eth`. Publishing the next version is performed by the
hosting system from `dist/`; no publication or chain transaction ran here.

## Four reported findings

| Finding / source in final revision | Implementation and actual evidence | Result |
| --- | --- | --- |
| Early fight freezes raid — `site/game.js:257`, `:264`, `:268`, `:302` | Cards and fight disabled before nights arrive. Calling `fight()` early did not set busy. Throwing once from the resolver cleared busy, displayed recovery text and allowed the selected tactic to be retried. Tested in Node VM and the exported page with deliberately held API requests. | Resolved in tested paths |
| Incomplete week runs out of data — `site/game.js:112` | 0–5 complete nights return the entire recorded seven-night dataset; six use API + average. Offline, current unfinished night and missing distance cases also return seven nights. Browser play with four supplied nights won on night seven, boss 0 HP, party 226 HP, 616 acorns. Final night is explicitly simulated. | Resolved |
| Claim can go to wrong chain — `site/game.js:139`, `:214`, `:218` | A 4902 response causes add, another switch and `eth_chainId` verification. Both known and newly added networks that remain on mainnet cause no transaction request. Successful request pins `0xaa36a7`, zero value and self recipient. Rejected switch, rejected transaction and a simulated chain change at send were tested. | Resolved with mocked providers |
| Morning wake selected — `site/game.js:99`, `:123` | Recorded October 28 input, including reversed bucket order, produces `wakeMinuteUtc=1260`, shown as 21:00 UTC. Before/after work remains 5223 / 5364. Real API browser walk also showed the evening wake in the chronicle. | Resolved |

`node --test test/site-regressions.test.cjs`: **17/17 pass**. Against the parent
script, **5/17 pass, 12 fail**, with failures in all four categories. Those parent
failures establish regression sensitivity rather than claiming the passing
checks alone prove absence of all possible faults.

## Required checks

| Command / check | Actual outcome |
| --- | --- |
| `node scripts/build.mjs` | Exit 0; complete four-file `dist/`, relative asset references validated. |
| `node --check site/game.js` and checks of all three `.mjs` scripts | Exit 0. |
| Strict `tsc --noEmit --strict --target ES2022 --module commonjs --skipLibCheck lib/raid.ts` | Exit 0 using the locked TypeScript installation. |
| Existing `tsx --test test/raid.test.ts` (`npm test` equivalent) | 9/9 pass. |
| New `node --test test/site-regressions.test.cjs` | 17/17 pass. |
| `node scripts/validate-browser.mjs` with external Playwright | 11/11 Chromium scenarios pass, production served at `/preview/`. WebKit cannot launch. |
| Pinned `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline` with external Playwright | 16 measurements completed; 12 pass, four scoped warnings below. Exit 0 means measured, not all checks passed. |
| Export parity and provenance comparisons | Source/export HTML, JS, favicon and PNG match; script matches upstream bytes. |

The locked tool installation was made in a temporary directory. No dependency
tree or browser download is part of the submission. Typechecking the original
test file as well as production code was also attempted: it reports three
existing errors at `test/raid.test.ts:102`–`104`, where partial cooldown records
are passed to a complete-record type. Those source files were preserved. The
legacy JavaScript UI is covered by syntax and interaction checks, not TypeScript.

## Better Interface coverage

Reviewed all six domains using the pinned Better Interface workflow and core
principles before the presentation corrections. One visual idea carries this
site: a compact dark arcade raid board with gold tactics and color-coded HP.

| Domain | Coverage / evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native buttons/links, one h1 followed by h2s, skip link into main, visible 2px keyboard ring, wallet status and chronicle live regions. Keyboard Tab → skip → tactic → Enter → Shift+Tab → fight → Enter resolved a night. Targets measured at 390; reduced motion tested with a spinning status. | No screen reader, forced-colors session or full accessibility audit. Live-region announcement quality is unverified. |
| Layout — Checked | Rendered 320, 390, 880, 881 and 1440. No horizontal overflow; probe reports no text collisions or clipping at 320/390/1440. Viewed mobile/desktop screenshots. At 390×844 fight is y=564–608 with product and cards visible. | No physical device or native zoom. Reflow widths are not a native zoom test. English LTR only; no RTL/localization adaptation claimed. |
| Writing — Checked | Product identified in one line, action instructions adjacent, visible bot disclosure, cooldown text and missing-wallet explanation; simulated Decision Night and recorded fallback labelled. Amount, network and gas explanation retained before optional claim. | Existing fallback wording says “API unreachable” even for a short response (`site/game.js:342`); existing success wording records transaction submission, not mined confirmation (`:219`). Left unchanged to preserve requested upstream script. |
| Typography — Checked | Existing sans prose / monospace title and data, weights 400/700/800. Final probe measured five text sizes per width; body line-height 1.5, card text 1.4, rules 1.55; changing counts use tabular numerals. Names and values wrap. | System fonts differ by platform. No claim that Segoe UI or Courier New exists on every device. |
| Colors — Checked | Original hex tokens retained. Probe reports all measured text at least 4.5:1 (3:1 large). Computed sRGB pairs: muted/card 5.50:1, muted/panel 5.89:1, primary text/gold 12.69:1, gold focus/card 11.49:1. Text labels supplement HP/status colors. | Disabled controls excluded from normal text contrast. No light theme exists. No full audit of every generated log state or system emoji colors. |
| UI — Checked | Selected, disabled, cooldown, loading, error/retry, completed and replay paths exercised. Existing borders and radii retained. Explicit property transition only; running wheel has no infinite animation with reduced motion. Viewed keyboard-focus screenshot. | No Animations-panel slow replay or native wallet UI inspection. Existing decorative conventions deliberately retained. |

## Findings, corrections and rechecks

| Severity / source | Observation and correction | Recheck |
| --- | --- | --- |
| High — `site/index.html:22`, `:93` | Original phone screen showed header, HP and party roster before any play control. Compact header; put tactics before roster and fight above its card grid. All six tactic explanations and rally controls remain. | Viewed final 390 screenshot and asserted fight bounds in browser. |
| Medium — `site/index.html:8` | Favicon and social title/image absent. Added local SVG icon and 1200×630 PNG share card with relative URLs and alt metadata. | Probe share check passes; assets HTTP 200 under `/preview/`. |
| Medium — `site/index.html:19`, `:43`, `:80`, `:118` | No explicit shared focus treatment; headings skipped h2 and dynamic status/log lacked landmarks for announcements. Reused gold for focus, made section headings h2, added status/log semantics and skip link. | Keyboard completion and inspected screenshot show the ring. Snapshot names/roles checked; no screen-reader claim. |
| Medium — `site/index.html:24`, `:66` | A running live wheel had no reduced-motion override. Disable wheel animation and HP transitions under the preference. | Mock SPINNING at 1440 with reduced motion: zero infinite animations running. |
| Low — `site/index.html:48`, `:52`, `:54` | Browser-default card sizing and short action targets. Kept existing card design, set 14px/1.4 text and a 44px minimum on primary/rally/wallet controls. | Final probe: five text sizes per width; all ten controls at least 44px. |

These corrections address the assignment's acceptance checks without adding
gameplay, accounts, wallet providers, routes or dependencies.

## Probe interpretation and retained scope

Raw baseline: **12/16**. Raw final: **12/16**. Share metadata changed from fail to
pass; putting the real card selector on the first screen makes the prose-budget
heuristic fail instead. Final passed checks: render, layout, targets, contrast,
tracking, eyebrows, type-sizes, type-faces, slogans, repetition, motion and share.

The four raw warnings were inspected rather than represented as passes:

- Casing, `site/index.html:85`: two uppercase boss/party labels are incumbent
  arcade labels. Preserved under the explicit “No other changes” constraint.
- Glyphs, `site/game.js:283` and `site/index.html:97`: the existing game's
  emoji identity and punctuation were retained, including its generated text.
- Chrome, `site/index.html:45` and `:57`: seven detected nested fighter/event
  surfaces belong to the established game layout. The selected tactic's gold
  ring is a state cue, not a new surface effect.
- Copy budget, `site/game.js:10` and `site/index.html:96`: 71 prose words at 390
  (bar 60), 130 at 1440 (bar 90), including visible tactic explanations and the
  opening raid log. Cutting rule explanations or moving the selector away
  would conflict with primary usability and the bounded rebuild.

These are scoped exceptions, not a claim of a clean 16/16 style score. The
probe did not measure the complete wallet or victory state; interaction tests
cover the stated paths separately.

## Evidence and limitations

The validation script writes `artifacts/browser-results.json` and screenshots
`artifacts/screenshots/chromium-390.png`, `chromium-1440.png`,
`chromium-keyboard-focus.png` and `chromium-victory.png`. Other generated evidence
is `artifacts/taste.json`, `taste-before-summary.json`, `regression-results.txt`,
`rules-results.txt`, `contrast.json` and `upstream.json`. The essential results
are repeated here and in README so the source documentation is self-contained.

A separate supplied-browser session loaded the real API successfully, selected
Deep Miner and activated fight by keyboard. It reached Night 2 / 7 with boss
5173 HP, party 1432 HP and 21:00 UTC in the October 28 chronicle, with no console
errors. That walk supplements the controlled responses in automation.

WebKit launch reported missing host runtime libraries (including GTK/GStreamer),
so Safari behavior remains unverified. No screen-reader, physical-device, native
zoom, on-chain signature or mined-transaction verification was performed. No
application behavior has been inferred from the path/size verifier. The
export is ready for the hosting system; publication and public domain resolution
were not performed here.

Guidance attribution: Jakub Krehel's Better Interface (MIT), pinned commit
`267330e1adfc66a718fb65fa6918c1f06d0a689e`; documentation method from Paul Bakaus's
Impeccable (Apache-2.0), pinned commit
`9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. The combined upstream license text is
retained in `artifacts/design-guidance-LICENSE.txt`.
