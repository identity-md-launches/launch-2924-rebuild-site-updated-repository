import { test } from "node:test";
import assert from "node:assert/strict";
import {
  swingDamage, bossCounter, bossHeal, bossPhase, resolveNight, botPick, cardOnCooldown,
  chronicleNight, RAIDERS, BOSS_MAX_HP, PARTY_MAX_HP, type NightMetrics, type CardId,
} from "../lib/raid";
import fixture from "./fixtures/nights.json";

// The 6 most recent complete nights measured from the live API on 2026-11-03,
// plus a 7th "average" night (mean of the six) to complete a raid week.
const real = fixture as NightMetrics[];
const avg: NightMetrics = {
  date: "AVG",
  distanceKm: 9.17, snoozeHours: 19.0, wakeMinuteUtc: 1260,
  workBeforeMidnight: 4960, workAfterMidnight: 4150, blocks: 939,
};
const week = [...real, avg];

test("fixture is real API data: 6 nights, 55.02 km total, blocks per night present", () => {
  assert.equal(real.length, 6);
  assert.ok(Math.abs(real.reduce((a, n) => a + n.distanceKm, 0) - 55.02) < 0.05);
  assert.ok(real.every((n) => n.blocks > 700 && n.blocks < 1200));
});

test("swingDamage: card conditions respond to the night that actually happened", () => {
  const big = real[1]; // 2026-10-29: 11.67 km, 1141 blocks
  const lazy = real[3]; // 2026-10-31: 7.47 km
  assert.ok(swingDamage(200, big, "songkich") > swingDamage(200, big, null) * 1.9);
  assert.ok(swingDamage(200, lazy, "songkich") < swingDamage(200, lazy, null));
  assert.ok(swingDamage(200, lazy, "rinhmoi") > swingDamage(200, lazy, null) * 1.7);
  assert.ok(swingDamage(200, big, "daosau") > swingDamage(200, big, null));
  assert.ok(swingDamage(200, big, "hove") < swingDamage(200, big, null));
});

test("boss punishes snoozing, harder in later phases, and heals on long snoozes in phase 3", () => {
  const sleepy = real[3]; // 19.5 snooze hours, 7.47 km (lazy-night bonus applies)
  assert.ok(bossCounter(sleepy, 3, false) > bossCounter(sleepy, 1, false));
  assert.ok(bossCounter(sleepy, 1, true) > bossCounter(sleepy, 1, false));
  assert.equal(bossHeal(sleepy, 3), 300);
  assert.equal(bossHeal(sleepy, 1), 0);
  assert.equal(bossPhase(BOSS_MAX_HP), 1);
  assert.equal(bossPhase(BOSS_MAX_HP * 0.5), 2);
  assert.equal(bossPhase(BOSS_MAX_HP * 0.2), 3);
});

test("balance on the real week: a sensible mixed-card party wins on the last night", () => {
  const mix: Record<string, CardId> = {
    you: "songkich", gau: "hove", lieu: "daosau", ba: "sandem", cu: "rinhmoi", rinh: "hove",
  };
  let bossHp = BOSS_MAX_HP, partyHp = PARTY_MAX_HP, outcome = "";
  week.forEach((night, i) => {
    const res = resolveNight({ night, nightIndex: i, picks: mix, bossHp, partyHp });
    bossHp = res.bossHpAfter; partyHp = res.partyHpAfter; outcome = res.outcome;
  });
  assert.equal(outcome, "win");
  assert.ok(partyHp > 0);
});

test("balance: playing no cards at all gets the party wiped (defense matters)", () => {
  const none: Record<string, CardId | null> = Object.fromEntries(RAIDERS.map((r) => [r.id, null]));
  let bossHp = BOSS_MAX_HP, partyHp = PARTY_MAX_HP, outcome = "";
  week.forEach((night, i) => {
    if (outcome && outcome !== "ongoing") return;
    const res = resolveNight({ night, nightIndex: i, picks: none, bossHp, partyHp });
    bossHp = res.bossHpAfter; partyHp = res.partyHpAfter; outcome = res.outcome;
  });
  assert.equal(outcome, "party_wiped");
});

test("balance: an all-turtle party survives but cannot kill the boss in 7 nights", () => {
  const turtle: Record<string, CardId> = {
    you: "daosau", gau: "hove", lieu: "hove", ba: "hove", cu: "sandem", rinh: "rinhmoi",
  };
  let bossHp = BOSS_MAX_HP, partyHp = PARTY_MAX_HP, outcome = "";
  week.forEach((night, i) => {
    const res = resolveNight({ night, nightIndex: i, picks: turtle, bossHp, partyHp });
    bossHp = res.bossHpAfter; partyHp = res.partyHpAfter; outcome = res.outcome;
  });
  assert.equal(outcome, "time_up");
  assert.equal(partyHp, PARTY_MAX_HP); // untouched — but the boss lives
});

test("a killing blow skips the counter-attack; shields absorb counters", () => {
  const weak = resolveNight({
    night: week[0], nightIndex: 0, bossHp: 100, partyHp: PARTY_MAX_HP,
    picks: Object.fromEntries(RAIDERS.map((r) => [r.id, "cuongno" as CardId])),
  });
  assert.equal(weak.outcome, "win");
  assert.equal(weak.counterDamage, 0);
  const guarded = resolveNight({
    night: week[0], nightIndex: 0, bossHp: BOSS_MAX_HP, partyHp: PARTY_MAX_HP,
    picks: Object.fromEntries(RAIDERS.map((r) => [r.id, "hove" as CardId])),
  });
  assert.equal(guarded.counterDamage, 0); // 6 guards x 250 shield > any phase-1 counter
  assert.equal(guarded.partyHpAfter, PARTY_MAX_HP);
});

test("bot picks rotate through tendencies; player cards cool down for 2 nights", () => {
  const gau = RAIDERS[1];
  assert.equal(botPick(gau, 0), "hove");
  assert.equal(botPick(gau, 1), "daosau");
  assert.equal(cardOnCooldown({ songkich: 0 }, "songkich", 1), true);
  assert.equal(cardOnCooldown({ songkich: 0 }, "songkich", 2), true);
  assert.equal(cardOnCooldown({ songkich: 0 }, "songkich", 3), false);
});

test("chronicle narrates the real night (distance, blocks, outcome)", () => {
  const night = week[1];
  const res = resolveNight({
    night, nightIndex: 1, bossHp: BOSS_MAX_HP, partyHp: PARTY_MAX_HP,
    picks: Object.fromEntries(RAIDERS.map((r) => [r.id, "daosau" as CardId])),
  });
  const text = chronicleNight(night, res);
  assert.ok(text.includes("11.67"));
  assert.ok(text.length > 80);
});
