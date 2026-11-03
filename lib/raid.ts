// SqueekRaid — core raid rules. Pure logic, no I/O: shared by the MVP client,
// the (future) Supabase keeper and the tests.
// Night metrics come from api.squeekchain.com (see DESIGN.md §2 for derivation).

export type NightMetrics = {
  date: string; // night key: the UTC date whose 12:00 UTC starts the night
  distanceKm: number;
  snoozeHours: number; // half-hours with zero wheel turns x 0.5
  wakeMinuteUtc: number | null; // start minute of the first active half-hour bucket
  workBeforeMidnight: number;
  workAfterMidnight: number;
  blocks: number; // completed Squeek blocks settled during the night
};

export const BOSS_NAME = "Snooze King";
export const BOSS_MAX_HP = 6400;
export const PARTY_MAX_HP = 1600;
export const RAID_NIGHTS = 7;
export const SHIELD_PER_GUARD = 250;
export const CARD_COOLDOWN_NIGHTS = 2; // for the human player's cards

export type CardId = "songkich" | "daosau" | "hove" | "sandem" | "rinhmoi" | "cuongno";

export const CARDS: Record<CardId, { emoji: string; vi: string; desc: string }> = {
  songkich: { emoji: "⚔️", vi: "Song Kích", desc: "Đòn của bạn ×2 nếu đêm đó Squeektoshi chạy ≥ 10 km, ×0.8 nếu dưới." },
  daosau: { emoji: "⛏️", vi: "Thợ Đào Sâu", desc: "Đòn của bạn + số blocks đêm đó × 0.15." },
  hove: { emoji: "🛡️", vi: "Hộ Vệ", desc: "Đòn của bạn ×0.7, nhưng tạo 250 khiên cho cả đội đêm đó." },
  sandem: { emoji: "🌙", vi: "Săn Đêm", desc: "Đòn của bạn ×1.6 nếu phần lớn work của đêm rơi vào sau nửa đêm, ×1 nếu không." },
  rinhmoi: { emoji: "🐾", vi: "Rình Mồi", desc: "Đòn của bạn ×1.8 trong đêm lười (chạy < 8.5 km), ×0.9 trong đêm thường." },
  cuongno: { emoji: "🔥", vi: "Cuồng Nộ", desc: "Đòn của bạn ×1.5, nhưng boss phản công mạnh hơn 30% đêm đó (cả đội chịu)." },
};

/** One raider's damage ("swing") for a night, before party-wide effects. */
export function swingDamage(atk: number, night: NightMetrics, card: CardId | null): number {
  const base = (atk * night.distanceKm) / 10;
  switch (card) {
    case "songkich": return base * (night.distanceKm >= 10 ? 2.0 : 0.8);
    case "daosau": return base + night.blocks * 0.15;
    case "hove": return base * 0.7;
    case "sandem": {
      const total = night.workBeforeMidnight + night.workAfterMidnight;
      const afterShare = total > 0 ? night.workAfterMidnight / total : 0;
      return base * (afterShare >= 0.5 ? 1.6 : 1.0);
    }
    case "rinhmoi": return base * (night.distanceKm < 8.5 ? 1.8 : 0.9);
    case "cuongno": return base * 1.5;
    default: return base;
  }
}

export type BossPhase = 1 | 2 | 3;
export function bossPhase(bossHp: number): BossPhase {
  const frac = bossHp / BOSS_MAX_HP;
  if (frac > 0.66) return 1;
  if (frac > 0.33) return 2;
  return 3;
}

/** Boss counter-attack for a night, from how much the hamster snoozed. */
export function bossCounter(night: NightMetrics, phase: BossPhase, rageTonight: boolean): number {
  let dmg = night.snoozeHours * 22;
  if (phase === 2) dmg *= 1.15;
  if (phase === 3) dmg *= 1.3;
  if (night.distanceKm < 8) dmg += 150; // "Cái Ngáp Lớn" on lazy nights
  if (rageTonight) dmg *= 1.3; // someone played Cuồng Nộ
  return Math.round(dmg);
}

/** In phase 3 the Snooze King feeds on long snoozes and heals. */
export function bossHeal(night: NightMetrics, phase: BossPhase): number {
  return phase === 3 && night.snoozeHours >= 19 ? 300 : 0;
}

export type Raider = {
  id: string;
  name: string;
  emoji: string;
  atk: number;
  isBot: boolean;
  /** bot tendency: cards in rough order of preference */
  tendency: CardId[];
};

export const RAIDERS: Raider[] = [
  { id: "you", name: "Bạn", emoji: "🦸", atk: 220, isBot: false, tendency: [] },
  { id: "gau", name: "Gấu Thủ", emoji: "🐻", atk: 180, isBot: true, tendency: ["hove", "daosau", "hove", "sandem"] },
  { id: "lieu", name: "Liều Ca", emoji: "🦊", atk: 170, isBot: true, tendency: ["songkich", "cuongno", "songkich", "daosau"] },
  { id: "ba", name: "Thợ Đào Ba", emoji: "🦫", atk: 160, isBot: true, tendency: ["daosau", "daosau", "sandem", "hove"] },
  { id: "cu", name: "Cú Đêm", emoji: "🦉", atk: 150, isBot: true, tendency: ["sandem", "sandem", "rinhmoi", "daosau"] },
  { id: "rinh", name: "Lão Rình", emoji: "🐢", atk: 140, isBot: true, tendency: ["rinhmoi", "hove", "rinhmoi", "daosau"] },
];

export type NightResult = {
  nightIndex: number; // 0-based
  teamDamage: number;
  perRaider: { raiderId: string; card: CardId | null; damage: number }[];
  shield: number;
  counterDamage: number; // after shield absorption: what the party actually lost
  bossHealed: number;
  phaseAfter: BossPhase;
  bossHpAfter: number;
  partyHpAfter: number;
  outcome: "ongoing" | "win" | "party_wiped" | "time_up";
};

/**
 * Resolve one night of the raid.
 * Order matters: the party strikes first (a kill means no counter-attack),
 * then the boss heals (phase 3), then it counter-attacks through the shield.
 * rally: "attack" = +20% team damage, "guard" = +400 shield; usable once per raid.
 */
export function resolveNight(args: {
  night: NightMetrics;
  nightIndex: number;
  picks: Record<string, CardId | null>;
  bossHp: number;
  partyHp: number;
  rally?: "attack" | "guard" | null;
}): NightResult {
  const { night, nightIndex, picks } = args;
  let bossHp = args.bossHp;
  let partyHp = args.partyHp;

  const perRaider = RAIDERS.map((r) => {
    const card = picks[r.id] ?? null;
    return { raiderId: r.id, card, damage: Math.round(swingDamage(r.atk, night, card)) };
  });
  let teamDamage = perRaider.reduce((a, p) => a + p.damage, 0);
  if (args.rally === "attack") teamDamage = Math.round(teamDamage * 1.2);

  const guards = perRaider.filter((p) => p.card === "hove").length;
  let shield = guards * SHIELD_PER_GUARD + (args.rally === "guard" ? 400 : 0);

  bossHp -= teamDamage;
  if (bossHp <= 0) {
    return {
      nightIndex, teamDamage, perRaider, shield, counterDamage: 0, bossHealed: 0,
      phaseAfter: bossPhase(0), bossHpAfter: 0, partyHpAfter: partyHp, outcome: "win",
    };
  }

  const phase = bossPhase(bossHp);
  const healed = bossHeal(night, phase);
  bossHp = Math.min(BOSS_MAX_HP, bossHp + healed);

  const rage = perRaider.some((p) => p.card === "cuongno");
  const rawCounter = bossCounter(night, phase, rage);
  const counterDamage = Math.max(0, rawCounter - shield);
  partyHp -= counterDamage;

  const outcome: NightResult["outcome"] =
    partyHp <= 0 ? "party_wiped" : nightIndex + 1 >= RAID_NIGHTS ? "time_up" : "ongoing";

  return {
    nightIndex, teamDamage, perRaider, shield, counterDamage, bossHealed: healed,
    phaseAfter: phase, bossHpAfter: bossHp, partyHpAfter: Math.max(0, partyHp), outcome,
  };
}

/** Deterministic bot pick: rotate through the bot's tendency list by night. */
export function botPick(raider: Raider, nightIndex: number): CardId {
  return raider.tendency[nightIndex % raider.tendency.length];
}

/** Player card availability with cooldown (a used card rests CARD_COOLDOWN_NIGHTS nights). */
export function cardOnCooldown(lastUsedNight: Record<CardId, number>, card: CardId, nightIndex: number): boolean {
  const last = lastUsedNight[card];
  return last !== undefined && nightIndex - last <= CARD_COOLDOWN_NIGHTS;
}

// ---------- AI Chronicler (templated living story, DESIGN.md §4) ----------

const fmtKm = (n: NightMetrics) => n.distanceKm.toFixed(2);
const wakeText = (n: NightMetrics) =>
  n.wakeMinuteUtc === null
    ? "cả đêm không hề lên bánh xe"
    : `thức dậy lúc ${String(Math.floor(n.wakeMinuteUtc / 60)).padStart(2, "0")}:${String(n.wakeMinuteUtc % 60).padStart(2, "0")} UTC`;

export function chronicleNight(night: NightMetrics, res: NightResult): string {
  const opener =
    night.distanceKm >= 10
      ? `Đêm ${night.date.slice(5)}: Squeektoshi ${wakeText(night)} và lao đi ${fmtKm(night)} km — một đêm huyền thoại.`
      : night.distanceKm >= 8.5
        ? `Đêm ${night.date.slice(5)}: Squeektoshi ${wakeText(night)}, chạy vững ${fmtKm(night)} km, đào được ${night.blocks} blocks.`
        : `Đêm ${night.date.slice(5)}: một đêm lười — Squeektoshi chỉ chạy ${fmtKm(night)} km và ngủ tới ${night.snoozeHours} giờ.`;
  const fight = `Đội raid gây ${res.teamDamage} sát thương${res.bossHealed > 0 ? `, nhưng Snooze King hồi ${res.bossHealed} HP nhờ cơn ngủ dài` : ""}.`;
  const counter =
    res.outcome === "win"
      ? "Snooze King gục ngã trước khi kịp phản đòn!"
      : res.counterDamage > 0
        ? `Boss phản công trừ ${res.counterDamage} HP đội${res.shield > 0 ? ` (khiên đã chặn phần còn lại)` : ""}.`
        : "Khiên của đội chặn đứng đòn phản công.";
  return `${opener} ${fight} ${counter}`;
}
