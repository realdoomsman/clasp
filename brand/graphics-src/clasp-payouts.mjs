import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { post, C, SHOTS, shotUrl } from './lib.mjs';
import { renderAll } from './render.mjs';

const API = 'https://api.clasp.fun/api';
const get = async (p) => (await fetch(API + p)).json();
const eth = (wei) => Number(BigInt(wei)) / 1e18;
const stats = await get('/stats');
const clasp = await get('/coins/0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3');
const nums = {
  fees: eth(stats.fees24hEth),
  claspFees: eth(clasp.vaultState.lifetimeInflow),
  claspStreaming: eth(clasp.vaultState.undistributed),
  collected: eth(stats.paidToLockersEth),
  coins: stats.coins,
  lockers: stats.lockers,
};
console.log(nums);

const { activity } = await get('/coins/0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3/activity?limit=100');
const claim = activity.find((r) => r.kind === 'claim');
const latest = {
  amount: eth(claim.amount).toFixed(4),
  who: `${claim.owner.slice(0, 6)}…${claim.owner.slice(-4)}`,
  tx: `${claim.txHash.slice(0, 18)}…${claim.txHash.slice(-6)}`,
  fullTx: claim.txHash,
};
console.log(latest);
// Live screenshot of the earners leaderboard.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-shot-'));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: profile, args: ['--no-first-run', '--disable-extensions'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 760, height: 1000, deviceScaleFactor: 3 });
  await page.goto('https://clasp.fun/leaderboard', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => /0x3953/i.test(document.body.innerText), { timeout: 60000 });
  await page.evaluate(() => document.querySelector('header')?.style.setProperty('display', 'none'));
  // Smallest block holding both earners: the leaderboard list itself.
  const table = await page.evaluateHandle(() => [...document.querySelectorAll('main *')]
    .filter((el) => /0x3953/i.test(el.innerText) && /0x026e/i.test(el.innerText) && el.getBoundingClientRect().width > 300)
    .sort((a, b) => a.innerText.length - b.innerText.length)[0]);
  await table.screenshot({ path: path.join(SHOTS, 'live-earners.png') });
} finally {
  await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

const big = (v, label, col = C.ink) => `<div><div class="display" style="font-size:62px;letter-spacing:-.03em;line-height:1;color:${col}">${v}</div><div style="font-size:18px;color:${C.ink2};margin-top:8px;line-height:1.35">${label}</div></div>`;
const unit = `<span style="font-size:28px;color:${C.ink3};margin-left:8px">ETH</span>`;
const html = post({
  kicker: 'Real ETH, from real trades',
  body: `
<div class="row" style="height:100%;gap:52px">
  <div style="width:560px;flex:none;display:flex;flex-direction:column">
    <h1 style="font-size:58px;line-height:1.05">Lockers are <span class="a">collecting ETH.</span></h1>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:34px 26px;margin-top:40px">
      ${big(`${nums.fees.toFixed(2)}${unit}`, 'trading fees paid into Clasp vaults in the last 24 hours', C.accent)}
      ${big('90%', 'of it goes to the people locking')}
      ${big(`${nums.claspFees.toFixed(2)}${unit}`, 'into the $CLASP vault alone', C.accent)}
      ${big(`${nums.claspStreaming.toFixed(2)}${unit}`, 'being paid out to $CLASP lockers over the next hour')}
    </div>
    <p style="margin-top:auto;font-size:18px;color:${C.ink3};line-height:1.5">Nothing minted. Every bit of it was paid by someone trading.</p>
  </div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:18px">
    <div class="row" style="justify-content:space-between;align-items:baseline">
      <span style="font-size:15px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3}">Top earners · live on clasp.fun/leaderboard</span>
    </div>
    <img src="${shotUrl('live-earners.png')}" style="display:block;width:100%;border-radius:20px;box-shadow:0 10px 30px rgba(22,21,26,.10)" />
    <div class="card" style="padding:22px 26px;background:${C.accentSoft};border-color:${C.lav};box-shadow:none">
      <div style="font-size:15px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${C.accentStrong}">Latest collect, on-chain</div>
      <div class="display" style="font-size:30px;margin-top:8px">${latest.amount} ETH <span style="font-size:20px;color:${C.ink2};font-family:Inter;font-weight:400">to ${latest.who} from locking $CLASP</span></div>
      <div style="font-family:Consolas,'Cascadia Mono',monospace;font-size:17px;color:${C.ink2};margin-top:8px">tx ${latest.tx}</div>
    </div>
  </div>
</div>`,
});
await renderAll([{ out: path.resolve(import.meta.dirname, '../x/posts/clasp-payouts.png'), w: 1600, h: 900, html, group: 'post' }]);
