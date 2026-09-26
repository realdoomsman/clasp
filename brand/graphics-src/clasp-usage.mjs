import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { post, C, SHOTS, shotUrl } from './lib.mjs';
import { renderAll } from './render.mjs';

const TOKEN = '0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3';
const API = 'https://api.clasp.fun/api';

// 1. Live numbers.
const [coin, { lockers }] = await Promise.all([`${API}/coins/${TOKEN}`, `${API}/coins/${TOKEN}/lockers`].map(async (u) => (await fetch(u)).json()));
const M = (wei) => Number(BigInt(wei) / 10n ** 18n) / 1e6;
const lockedPct = (M(coin.totalLocked) / 1000) * 100;
const dev = lockers.find((l) => l.owner === '0x6866d127943f3c9417FC571eCDF82f6803738060');
const others = lockers.filter((l) => l !== dev);
const othersLocked = others.reduce((s, l) => s + M(l.amount), 0);
const othersShare = others.reduce((s, l) => s + l.sharePct, 0);
const ageMin = Math.round((Date.now() / 1000 - coin.createdAt) / 60);
const mcap = Number(BigInt(coin.marketCapEth) / 10n ** 15n) / 1000;
const nums = { lockers: coin.lockers, lockedPct, othersLocked, othersShare, ageMin, mcap };
console.log(nums);

// 2. Live screenshots of the $CLASP page.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-shot-'));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: profile, args: ['--no-first-run', '--disable-extensions'] });
try {
  const page = await browser.newPage();
  // Below the lg breakpoint the lockers table spans the full width, so rows don't wrap.
  await page.setViewport({ width: 700, height: 1000, deviceScaleFactor: 3 });
  await page.goto(`https://clasp.fun/coins/${TOKEN}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('Dev lock'), { timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise((r) => setTimeout(r, 1500));
  const lockersEl = await page.$('section[aria-label="Lockers and activity"]');
  await lockersEl.screenshot({ path: path.join(SHOTS, 'live-lockers.png') });
} finally {
  await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

// 3. Compose the card.
const big = (v, label, col = C.ink) => `<div><div class="display" style="font-size:66px;letter-spacing:-.03em;line-height:1;color:${col}">${v}</div><div style="font-size:19px;color:${C.ink2};margin-top:8px;line-height:1.35">${label}</div></div>`;
const img = (f) => `<div class="card" style="padding:12px"><img src="${shotUrl(f)}" style="display:block;width:100%;border-radius:12px" /></div>`;
const html = post({
  kicker: `$CLASP · ${ageMin} minutes in`,
  body: `
<div class="row" style="height:100%;gap:44px">
  <div style="width:560px;flex:none;display:flex;flex-direction:column">
    <h1 style="font-size:60px;line-height:1.05">People are <span class="a">locking $CLASP.</span></h1>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:34px 30px;margin-top:42px">
      ${big(String(nums.lockers), 'wallets locking')}
      ${big(`${lockedPct.toFixed(1)}%`, 'of all $CLASP locked', C.accent)}
      ${big(`${othersLocked.toFixed(1)}M`, 'CLASP locked by the community')}
      ${big(`${othersShare.toFixed(1)}%`, 'of the fee share now held by community lockers', C.accent)}
    </div>
    <p style="margin-top:auto;font-size:18px;color:${C.ink3};line-height:1.5">Live from clasp.fun. Market cap ${mcap.toFixed(1)} ETH. The dev lock’s share buys back and burns $CLASP.</p>
  </div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center">
    ${img('live-lockers.png')}
  </div>
</div>`,
});
await renderAll([{ out: path.resolve(import.meta.dirname, '../x/posts/clasp-usage.png'), w: 1600, h: 900, html, group: 'post' }]);
fs.writeFileSync(path.resolve(import.meta.dirname, 'work/usage-nums.json'), JSON.stringify(nums));
