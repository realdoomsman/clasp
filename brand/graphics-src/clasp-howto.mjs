import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { post, C, SHOTS, shotUrl } from './lib.mjs';
import { renderAll } from './render.mjs';

const TOKEN = '0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3';

// Live screenshots: the lock panel with an example amount, and the vault's fixed rules.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-shot-'));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: profile, args: ['--no-first-run', '--disable-extensions'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 1000, deviceScaleFactor: 3 });
  await page.goto(`https://clasp.fun/coins/${TOKEN}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('Lock $CLASP'), { timeout: 60000 });
  // Smallest element holding the whole lock panel, without the trade panel next to it.
  const panel = await page.evaluateHandle(() => [...document.querySelectorAll('main div, main section')]
    .filter((el) => el.innerText.startsWith('Lock $CLASP') && el.innerText.includes('Sign in to lock') && !el.innerText.includes('You pay'))
    .sort((a, b) => a.innerText.length - b.innerText.length)[0]);
  const input = await panel.$('input');
  await input.click();
  await input.type('1000000');
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate((el) => {
    // No sticky header over the capture; no fee projection in an ad (honesty rules: no return figures).
    document.querySelector('header')?.style.setProperty('display', 'none');
    for (const n of el.querySelectorAll('*')) if (n.children.length === 0 && /a week at last week/.test(n.textContent)) n.style.display = 'none';
    el.scrollIntoView({ block: 'start' });
  }, panel);
  await new Promise((r) => setTimeout(r, 500));
  await panel.screenshot({ path: path.join(SHOTS, 'live-lockpanel.png') });
} finally {
  await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

const step = (n, t, s) => `<div class="row" style="gap:18px;align-items:flex-start">
  <span style="flex:none;width:46px;height:46px;border-radius:50%;background:${C.accent};color:#fff;font-family:Outfit;font-weight:600;font-size:24px;display:flex;align-items:center;justify-content:center">${n}</span>
  <div><div class="display" style="font-size:30px;line-height:1.15">${t}</div><div style="font-size:19px;color:${C.ink2};margin-top:6px;line-height:1.45">${s}</div></div>
</div>`;
const html = post({
  kicker: 'How to lock $CLASP',
  body: `
<div class="row" style="height:100%;gap:48px">
  <div style="width:600px;flex:none;display:flex;flex-direction:column">
    <h1 style="font-size:58px;line-height:1.05">Holding $CLASP? <span class="a">Put it to work.</span></h1>
    <div class="col" style="gap:30px;margin-top:40px">
      ${step(1, 'Choose how much', 'Any amount from 1 CLASP. Bigger locks (0.1%+ of supply) get a size boost.')}
      ${step(2, 'Choose how long', '4 hours to 1 year. A 1-year lock gets 4× the share of a 4-hour one.')}
      ${step(3, 'Collect ETH any time', 'Your share of every trade builds up in ETH. Your coins stay locked.')}
    </div>
    <p style="margin-top:auto;font-size:18px;color:${C.ink3};line-height:1.5">Rules are written into the vault and nobody can change them. Leaving early burns 5–25% of your coins.</p>
  </div>
  <div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">
    <img src="${shotUrl('live-lockpanel.png')}" style="display:block;max-width:100%;max-height:650px;border-radius:20px;box-shadow:0 10px 30px rgba(22,21,26,.10)" />
  </div>
</div>`,
});
await renderAll([{ out: path.resolve(import.meta.dirname, '../x/posts/clasp-howto.png'), w: 1600, h: 900, html, group: 'post' }]);
