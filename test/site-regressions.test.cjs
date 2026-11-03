const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const vm = require('node:vm');

// Exercise the actual browser script, with transport/DOM doubles only. An
// alternate file lets the same regressions be demonstrated against the parent.
const source = readFileSync(process.env.SQUEEK_GAME_FILE || resolve(__dirname, '../site/game.js'), 'utf8');
const stats = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/stats-7d.json')));
const settlements = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/settlements-7d.json')));
const clone = value => JSON.parse(JSON.stringify(value));

function harness({ days = stats.activity.days, fetchError = false, request } = {}) {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {
      textContent: '', innerHTML: '', disabled: false, style: {}, children: [],
      prepend(child) { this.children.unshift(child); },
      scrollIntoView() {}, classList: { toggle() {} },
    });
    return nodes.get(key);
  };
  const document = {
    querySelector: node, querySelectorAll: () => [],
    createElement: () => node(Symbol()), addEventListener() {},
  };
  const fixedNow = Date.parse('2026-11-03T16:00:00Z');
  class Clock extends Date { static now() { return fixedNow; } }
  const context = vm.createContext({
    document, window: { ethereum: { request } }, Date: Clock,
    TextEncoder, AbortController, console, module: { exports: {} },
    setTimeout: fn => { queueMicrotask(fn); return 1; }, clearTimeout() {},
    fetch: async url => {
      if (fetchError) throw new Error('Simulated offline transport');
      return { ok: true, json: async () => url.includes('measurement/stats')
        ? { ...clone(stats), activity: { ...clone(stats.activity), days: clone(days) } }
        : clone(settlements) };
    },
  });
  vm.runInContext(source, context, { filename: 'game.js' });
  const game = vm.runInContext('({ state, wallet, loadNights, fight, renderCards, ensureSepolia, claimVictoryOnChain, FALLBACK_NIGHTS, averageNight, wakeText })', context);
  return { ...game, node, context };
}

test('1: premature fight leaves busy false and cards/fight unavailable until loaded', async () => {
  const g = harness();
  g.state.selected = 'daosau';
  await g.fight();
  assert.equal(g.state.busy, false);
  assert.equal(g.state.nightIdx, 0);
  g.renderCards();
  assert.equal(g.node('#fightBtn').disabled, true);
  assert.equal((g.node('#cards').innerHTML.match(/ disabled/g) || []).length, 6);
  g.state.nights = (await g.loadNights()).nights;
  g.renderCards();
  assert.equal(g.node('#fightBtn').disabled, false);
  await g.fight();
  assert.equal(g.state.busy, false);
  assert.equal(g.state.nightIdx, 1);
});

test('1: an exception during resolution clears busy and offers recovery', async () => {
  const g = harness();
  g.state.nights = [...g.FALLBACK_NIGHTS, g.averageNight(g.FALLBACK_NIGHTS)];
  g.state.selected = 'daosau';
  vm.runInContext('const originalResolve = resolveNight; resolveNight = () => { throw new Error("Injected resolver failure"); }', g.context);
  await g.fight();
  assert.equal(g.state.busy, false);
  assert.equal(g.node('#fightBtn').disabled, false);
  assert.match(g.node('#log').children[0].innerHTML, /hit Fight the Night again/);
  vm.runInContext('resolveNight = originalResolve', g.context);
  await g.fight();
  assert.equal(g.state.nightIdx, 1);
  assert.equal(g.state.busy, false);
});

for (const count of [0, 1, 2, 3, 4, 5, 6]) {
  test(`2: ${count} complete API nights yields a full seven-night dataset`, async () => {
    const g = harness({ days: stats.activity.days.slice(0, count) });
    const loaded = await g.loadNights();
    assert.equal(loaded.nights.length, 7);
    assert.equal(loaded.source, count === 6 ? 'api' : 'fallback');
    assert.equal(loaded.nights[6].simulated, true);
    assert.ok(loaded.nights.every(n => Number.isFinite(n.distanceKm) && Number.isFinite(n.blocks)));
    if (count < 6) assert.deepEqual(clone(loaded.nights.slice(0, 6)), clone(g.FALLBACK_NIGHTS));
  });
}

test('2: offline and incomplete-current-night inputs fall back without shortening the raid', async () => {
  const offline = await harness({ fetchError: true }).loadNights();
  assert.equal(offline.source, 'fallback');
  assert.equal(offline.nights.length, 7);
  const days = clone(stats.activity.days.slice(0, 6));
  days[5].date = '2026-11-03';
  const incomplete = await harness({ days }).loadNights();
  assert.equal(incomplete.source, 'fallback');
  assert.equal(incomplete.nights.length, 7);
  days[5].date = '2026-11-02';
  days[5].distanceMm = null;
  assert.equal((await harness({ days }).loadNights()).source, 'fallback');
});

test('2: a cooldown-valid strategy reaches a terminal win on night seven after a short API week', async () => {
  const g = harness({ days: stats.activity.days.slice(0, 4) });
  g.state.nights = (await g.loadNights()).nights;
  // Found by exploring legal tactics using the unchanged game rules.
  const strategy = ['songkich', 'hove', 'sandem', 'songkich', 'hove', 'sandem', 'songkich'];
  for (const [index, card] of strategy.entries()) {
    assert.equal(g.state.over, false);
    if (index === 5) g.state.rally = 'guard';
    g.state.selected = card;
    await g.fight();
    assert.equal(g.state.busy, false);
  }
  assert.equal(g.state.nightIdx, 7);
  assert.equal(g.state.over, true);
  assert.equal(g.state.bossHp, 0);
  assert.match(g.node('#endBox').innerHTML, /SNOOZE KING IS DOWN/);
});

function provider({ unknown = false, stayWrong = false, reject = false, race = false } = {}) {
  let chain = '0x1', added = !unknown;
  const calls = [];
  return {
    calls,
    async request(payload) {
      calls.push(clone(payload));
      if (payload.method === 'eth_chainId') return chain;
      if (payload.method === 'wallet_switchEthereumChain') {
        if (reject) throw Object.assign(new Error('Rejected'), { code: 4001 });
        if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
        if (!stayWrong) chain = payload.params[0].chainId;
        return null;
      }
      if (payload.method === 'wallet_addEthereumChain') { added = true; return null; }
      if (payload.method === 'eth_sendTransaction') {
        if (race) chain = '0x1';
        if (payload.params[0].chainId !== chain) throw new Error('Wallet rejects chain mismatch');
        return '0x' + randomBytes(32).toString('hex');
      }
      throw new Error('Unexpected wallet request: ' + payload.method);
    },
  };
}

test('3: unknown Sepolia is added, explicitly switched, then checked', async () => {
  const p = provider({ unknown: true });
  const g = harness({ request: p.request });
  assert.equal(await g.ensureSepolia(), true);
  assert.deepEqual(p.calls.map(c => c.method), ['eth_chainId', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain', 'eth_chainId']);
  assert.equal(p.calls[2].params[0].chainId, '0xaa36a7');
});

for (const unknown of [false, true]) {
  test(`3: silently ignored switch (unknown=${unknown}) blocks the claim transaction`, async () => {
    const p = provider({ unknown, stayWrong: true });
    const g = harness({ request: p.request });
    g.wallet.address = '0x' + randomBytes(20).toString('hex');
    await g.claimVictoryOnChain('win');
    assert.equal(p.calls.filter(c => c.method === 'eth_sendTransaction').length, 0);
    assert.equal(g.node('#claimBtn').disabled, false);
  });
}

test('3: successful claim pins Sepolia, sends zero to self, and preserves the result memo', async () => {
  const p = provider({ unknown: true });
  const g = harness({ request: p.request });
  g.wallet.address = '0x' + randomBytes(20).toString('hex');
  g.state.nightIdx = 7;
  g.state.totals.you = 2111;
  g.state.acorns = 711;
  await g.claimVictoryOnChain('win');
  const sent = p.calls.find(c => c.method === 'eth_sendTransaction');
  assert.ok(sent);
  const tx = sent.params[0];
  assert.equal(tx.chainId, '0xaa36a7');
  assert.equal(tx.value, '0x0');
  assert.equal(tx.from, g.wallet.address);
  assert.equal(tx.to, g.wallet.address);
  assert.match(Buffer.from(tx.data.slice(2), 'hex').toString(), /nights:7 \| your damage:2111 \| acorns:711/);
  assert.match(g.node('#claimResult').innerHTML, /Victory recorded on Sepolia/);
});

test('3: rejected switch and chain change at send time restore the claim control', async () => {
  for (const options of [{ reject: true }, { race: true }]) {
    const p = provider(options);
    const g = harness({ request: p.request });
    g.wallet.address = '0x' + randomBytes(20).toString('hex');
    await g.claimVictoryOnChain('win');
    assert.equal(g.node('#claimBtn').disabled, false);
    assert.match(g.node('#claimResult').textContent, /rejected|failed/i);
    if (options.reject) assert.equal(p.calls.filter(c => c.method === 'eth_sendTransaction').length, 0);
    if (options.race) assert.equal(p.calls.find(c => c.method === 'eth_sendTransaction').params[0].chainId, '0xaa36a7');
  }
});

test('4: recorded Oct 28 buckets yield the evening wake at 21:00 UTC, even when shuffled', async () => {
  for (const reverse of [false, true]) {
    const days = clone(stats.activity.days);
    if (reverse) days.forEach(d => d.buckets.reverse());
    const g = harness({ days });
    const loaded = await g.loadNights();
    assert.equal(loaded.source, 'api');
    const night = loaded.nights.find(n => n.date === '2026-10-28');
    assert.equal(night.wakeMinuteUtc, 1260);
    assert.match(g.wakeText(night), /21:00 UTC/);
    assert.equal(night.workBeforeMidnight, 5223);
    assert.equal(night.workAfterMidnight, 5364);
  }
});
