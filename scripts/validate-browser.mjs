import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

// Optional validation tooling lives outside the site and is never bundled.
const pw = process.env.IMD_PLAYWRIGHT
  ? await import(pathToFileURL(process.env.IMD_PLAYWRIGHT).href)
  : await import('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const exportRoot = resolve(root, 'dist');
const out = resolve(root, 'artifacts');
const shots = resolve(out, 'screenshots');
await mkdir(shots, { recursive: true });
const stats = JSON.parse(await readFile(resolve(root, 'test/fixtures/stats-7d.json'), 'utf8'));
const settlements = JSON.parse(await readFile(resolve(root, 'test/fixtures/settlements-7d.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [], limitations = [];
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://preview').pathname);
    if (!path.startsWith('/preview/')) throw new Error('Outside preview');
    const file = resolve(exportRoot, path.slice('/preview/'.length) || 'index.html');
    if (!file.startsWith(exportRoot + sep)) throw new Error('Outside export');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;

async function check(name, run) {
  try { const evidence = await run(); checks.push({ name, passed: true, evidence }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, passed: false, error: String(error.stack || error) }); console.log('FAIL ' + name + ': ' + error.message); }
}

async function pageFor(browser, { width = 390, days = stats.activity.days, offline = false, gate, wallet, reduced = false, spinning = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  // Freeze data completeness only; native animation and interaction timers run normally.
  await context.addInitScript(() => {
    Date.now = () => Date.parse('2026-11-03T16:00:00Z');
  });
  if (wallet) {
    await context.addInitScript(({ options, address, hash }) => {
      let chain = '0x1', added = !options.unknown;
      window.walletCalls = [];
      window.ethereum = {
        on() {},
        async request(payload) {
          window.walletCalls.push(JSON.parse(JSON.stringify(payload)));
          if (payload.method === 'eth_requestAccounts') return [address];
          if (payload.method === 'eth_chainId') return chain;
          if (payload.method === 'eth_getBalance') return '0x0';
          if (payload.method === 'wallet_addEthereumChain') { added = true; return null; }
          if (payload.method === 'wallet_switchEthereumChain') {
            if (options.reject) throw Object.assign(new Error('Rejected'), { code: 4001 });
            if (!added) throw Object.assign(new Error('Unknown chain'), { code: 4902 });
            if (!options.stayWrong) chain = payload.params[0].chainId;
            return null;
          }
          if (payload.method === 'eth_sendTransaction') {
            if (options.rejectTransaction) throw Object.assign(new Error('Rejected'), { code: 4001 });
            if (payload.params[0].chainId !== chain) throw new Error('Wrong chain');
            return hash;
          }
          throw new Error('Unexpected method: ' + payload.method);
        },
      };
    }, { options: wallet, address: '0x' + randomBytes(20).toString('hex'), hash: '0x' + randomBytes(32).toString('hex') });
  }
  await context.route('https://api.squeekchain.com/**', async route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (gate && /measurement|settlements/.test(endpoint)) await gate;
    if (offline) return route.abort();
    const json = endpoint.endsWith('/measurement/stats') ? { ...clone(stats), activity: { ...clone(stats.activity), days: clone(days) } }
      : endpoint.endsWith('/settlements') ? settlements
      : endpoint.endsWith('/status') ? { measurement: { coreStatus: spinning ? 'SPINNING' : 'IDLE', rpmMilli: 60000, speedMmPerSecond: 500 }, builder: { anchor: { blockHeight: '7661', blockProgress: '910000000' } } }
      : { status: 'unavailable' };
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  const page = await context.newPage();
  const errors = [], failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(url) && response.status() >= 400) failures.push(response.url()); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, context, errors, failures };
}

async function ready(page) {
  await page.waitForFunction(() => state.nights.length === 7);
}
async function turn(page, card, nextNight) {
  assert.equal(await page.locator(`[data-card="${card}"]`).isDisabled(), false);
  await page.locator(`[data-card="${card}"]`).click();
  assert.equal(await page.locator('#fightBtn').isDisabled(), false);
  await page.locator('#fightBtn').click();
  await page.waitForFunction(index => state.nightIdx === index && !state.busy, nextNight);
}
async function win(page) {
  const cards = ['songkich', 'hove', 'sandem', 'songkich', 'hove', 'sandem', 'songkich'];
  for (let i = 0; i < cards.length; i++) {
    if (i === 5) await page.locator('[data-rally="guard"]').click();
    await turn(page, cards[i], i + 1);
  }
  assert.equal(await page.evaluate(() => state.over && state.bossHp === 0), true);
  assert.equal(await page.locator('#claimBtn').isVisible(), true);
}

try {
  for (const engine of ['chromium', 'webkit']) {
    let browser;
    try { browser = await pw[engine].launch({ headless: true }); }
    catch (error) { limitations.push({ engine, reason: 'Browser could not launch: missing host runtime libraries.', detail: error.message.split('\n')[0] }); continue; }
    try {
      await check(`${engine}: layouts, metadata and first-screen action`, async () => {
        const layouts = [];
        for (const width of [320, 390, 880, 881, 1440]) {
          const { page, context, errors, failures } = await pageFor(browser, { width });
          try {
            await ready(page);
            const layout = await page.evaluate(() => {
              const box = document.querySelector('#fightBtn').getBoundingClientRect();
              return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, fightTop: Math.round(box.top), fightBottom: Math.round(box.bottom), height: innerHeight, title: document.title, description: !!document.querySelector('meta[name="description"]')?.content, favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href'), ogTitle: !!document.querySelector('meta[property="og:title"]')?.content, ogImage: document.querySelector('meta[property="og:image"]')?.content, cardCount: document.querySelectorAll('[data-card]').length };
            });
            assert.ok(layout.scrollWidth <= width + 1);
            assert.ok(layout.title && layout.description && layout.favicon && layout.ogTitle && layout.ogImage);
            assert.equal(layout.cardCount, 6);
            for (const asset of [layout.favicon, layout.ogImage]) {
              assert.ok(asset.startsWith('./'));
              assert.equal((await page.request.get(new URL(asset, url).href)).status(), 200);
            }
            if (width === 390) {
              assert.ok(layout.fightTop >= 0 && layout.fightBottom <= layout.height);
              await page.locator('[data-card="songkich"]').click();
              await page.evaluate(() => scrollTo(0, 0));
              await page.screenshot({ path: resolve(shots, `${engine}-390.png`) });
            }
            if (width === 1440) await page.screenshot({ path: resolve(shots, `${engine}-1440.png`) });
            assert.deepEqual(errors, []); assert.deepEqual(failures, []);
            layouts.push(layout);
          } finally { await context.close(); }
        }
        return layouts;
      });

      await check(`${engine}: slow data, premature fight, exception and recovery`, async () => {
        let release;
        const gate = new Promise(done => { release = done; });
        const { page, context, errors } = await pageFor(browser, { gate });
        try {
          assert.equal(await page.locator('#fightBtn').isDisabled(), true);
          assert.equal(await page.locator('[data-card]:disabled').count(), 6);
          await page.evaluate(async () => { state.selected = 'daosau'; await fight(); });
          assert.equal(await page.evaluate(() => state.busy), false);
          release(); await ready(page);
          await page.evaluate(() => { window.savedResolve = resolveNight; resolveNight = () => { throw new Error('Injected resolver error'); }; });
          await page.locator('[data-card="daosau"]').click();
          await page.locator('#fightBtn').click();
          await page.waitForFunction(() => !state.busy && document.querySelector('#log').textContent.includes('Something glitched'));
          assert.equal(await page.locator('#fightBtn').isDisabled(), false);
          await page.evaluate(() => { resolveNight = window.savedResolve; });
          // Retry the still-selected tactic through the recovery control.
          await page.locator('#fightBtn').click();
          await page.waitForFunction(() => state.nightIdx === 1 && !state.busy);
          assert.deepEqual(errors, []);
          return 'Six cards and fight disabled while loading; premature invocation harmless; injected error returns to retry; retry resolves night one.';
        } finally { release(); await context.close(); }
      });

      await check(`${engine}: keyboard play and evening wake from recorded API buckets`, async () => {
        const { page, context, errors } = await pageFor(browser);
        try {
          await ready(page);
          // Begin at the first keyboard stop and reach the actual controls by Tab.
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
          await page.keyboard.press('Enter');
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.dataset.card), 'songkich');
          const focus = await page.locator('[data-card="songkich"]').evaluate(el => ({ style: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth }));
          assert.equal(focus.style, 'solid'); assert.equal(focus.width, '2px');
          await page.screenshot({ path: resolve(shots, `${engine}-keyboard-focus.png`) });
          await page.keyboard.press('Enter');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'fightBtn');
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => state.nightIdx === 1 && !state.busy);
          assert.match(await page.locator('#log').innerText(), /2026-10-28.*21:00 UTC/s);
          assert.equal(await page.locator('[data-card="songkich"]').isDisabled(), true);
          assert.deepEqual(errors, []);
          return { wake: await page.evaluate(() => state.nights[0].wakeMinuteUtc), focus, nightIndex: 1, cooldown: true };
        } finally { await context.close(); }
      });

      await check(`${engine}: short API week completes all seven nights and offers replay`, async () => {
        const { page, context, errors, failures } = await pageFor(browser, { days: stats.activity.days.slice(0, 4) });
        try {
          await ready(page);
          assert.match(await page.locator('#dataNote').textContent(), /recorded dataset/);
          await win(page);
          assert.match(await page.locator('#log').innerText(), /Decision Night.*simulated/s);
          await page.locator('#endBox').screenshot({ path: resolve(shots, `${engine}-victory.png`) });
          const result = await page.evaluate(() => ({ nightIndex: state.nightIdx, bossHp: state.bossHp, partyHp: state.partyHp, acorns: state.acorns, simulatedFinal: state.nights[6].simulated }));
          await page.getByRole('button', { name: /Raid again/ }).click();
          await ready(page);
          assert.equal(await page.evaluate(() => state.nightIdx), 0);
          assert.deepEqual(errors, []); assert.deepEqual(failures, []);
          return result;
        } finally { await context.close(); }
      });

      await check(`${engine}: unavailable API and missing wallet remain playable`, async () => {
        const { page, context, errors } = await pageFor(browser, { offline: true });
        try {
          await ready(page);
          assert.match(await page.locator('#dataNote').textContent(), /recorded dataset/);
          await page.locator('#walletBtn').click();
          assert.match(await page.locator('#walletPanel').innerText(), /No wallet detected/);
          await turn(page, 'hove', 1);
          assert.equal(await page.evaluate(() => state.busy), false);
          assert.deepEqual(errors, []);
          return 'Seven-night recorded fallback, visible no-wallet explanation, and a resolved night without a wallet.';
        } finally { await context.close(); }
      });

      for (const options of [{ unknown: true }, { stayWrong: true }, { unknown: true, stayWrong: true }, { reject: true }, { rejectTransaction: true }]) {
        await check(`${engine}: claim network safety ${JSON.stringify(options)}`, async () => {
          const { page, context, errors } = await pageFor(browser, { wallet: options });
          try {
            await ready(page);
            // Terminal-state rendering is covered by the complete raid above;
            // this isolates each wallet path without seven animation sequences.
            await page.evaluate(() => { state.nightIdx = 7; state.over = true; endRaid('win'); });
            await page.locator('#claimBtn').click();
            await page.waitForFunction(() => window.walletCalls.some(c => c.method === 'eth_sendTransaction') || document.querySelector('#walletMsg').textContent.includes('Could not connect') || document.querySelector('#walletMsg').textContent.includes('rejected'));
            if (options.rejectTransaction) await page.waitForFunction(() => document.querySelector('#claimResult').textContent.includes('rejected'));
            const calls = await page.evaluate(() => window.walletCalls);
            const txs = calls.filter(c => c.method === 'eth_sendTransaction');
            if (options.stayWrong || options.reject) {
              assert.equal(txs.length, 0);
              assert.equal(await page.locator('#claimBtn').isDisabled(), false);
            } else {
              assert.equal(txs.length, 1);
              const tx = txs[0].params[0];
              assert.equal(tx.chainId, '0xaa36a7'); assert.equal(tx.from, tx.to); assert.equal(tx.value, '0x0');
              assert.match(Buffer.from(tx.data.slice(2), 'hex').toString(), /SQUEEKRAID WIN/);
              if (options.unknown) assert.deepEqual(calls.slice(1, 6).map(c => c.method), ['eth_chainId', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain', 'eth_chainId']);
              if (options.rejectTransaction) assert.equal(await page.locator('#claimBtn').isDisabled(), false);
              else await page.waitForFunction(() => document.querySelector('#claimResult').textContent.includes('Victory recorded on Sepolia'));
            }
            assert.deepEqual(errors, []);
            return { methods: calls.map(c => c.method), transactionsRequested: txs.length, chainId: txs[0]?.params[0].chainId, mocked: true };
          } finally { await context.close(); }
        });
      }

      await check(`${engine}: reduced motion on a running wheel`, async () => {
        const { page, context } = await pageFor(browser, { width: 1440, reduced: true, spinning: true });
        try {
          await ready(page);
          await page.waitForFunction(() => document.querySelector('#wheel').classList.contains('spinning'));
          const moving = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length);
          assert.equal(moving, 0);
          return { infiniteAnimationsRunning: moving };
        } finally { await context.close(); }
      });
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }

const report = { checkedAt: new Date().toISOString(), upstream: '14e45fea2f5a51dc9b5b58a5af74975659d8d74d', export: 'dist/', subpath: '/preview/', checks, limitations, walletEvidence: 'All wallet requests were simulated. No real wallet was connected and no transaction was broadcast.' };
await writeFile(resolve(out, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${checks.filter(c => c.passed).length}/${checks.length} passed; ${limitations.length} browser limitation(s).`);
if (!checks.length || checks.some(c => !c.passed)) process.exitCode = 1;
