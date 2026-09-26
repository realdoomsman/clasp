import fs from 'node:fs';
import path from 'node:path';
import { post, C, esc } from './lib.mjs';
import { renderAll } from './render.mjs';

// Live platform numbers from https://api.clasp.fun at render time.
const API = 'https://api.clasp.fun/api';
const get = async (p) => (await fetch(API + p)).json();
const stats = await get('/stats');
const { coins } = await get('/coins?sort=new&limit=100');
const details = await Promise.all(coins.map((c) => get(`/coins/${c.token}`)));
const eth = (wei) => Number(BigInt(wei)) / 1e18;
const rows = details
  .map((d) => ({
    symbol: d.symbol, name: d.name, image: d.image, lockers: d.lockers,
    lockedPct: Number((BigInt(d.totalLocked) * 10000n) / BigInt(d.totalSupply)) / 100,
    fees: eth(d.vaultState.lifetimeInflow),
    official: d.token === '0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3',
  }))
  .sort((a, b) => b.lockedPct - a.lockedPct);
const firstLaunch = Math.min(...coins.map((c) => c.createdAt));
const minutes = Math.round((Date.now() / 1000 - firstLaunch) / 60);
const totalFees = rows.reduce((s, r) => s + r.fees, 0);
const nums = { coins: stats.coins, lockers: stats.lockers, lockedValue: eth(stats.lockedValueEth), totalFees, minutes, rows };
console.log(JSON.stringify(nums, null, 1));

const big = (v, label, col = C.ink) => `<div><div class="display" style="font-size:60px;letter-spacing:-.03em;line-height:1;color:${col}">${v}</div><div style="font-size:18px;color:${C.ink2};margin-top:8px;line-height:1.35">${label}</div></div>`;
const maxPct = Math.max(...rows.map((r) => r.lockedPct), 1);
const row = (r) => `<div class="row" style="align-items:center;gap:16px;padding:13px 0;border-top:1.5px solid ${C.line}">
  <img src="${r.image}" style="width:44px;height:44px;border-radius:50%;flex:none;object-fit:cover" />
  <div style="width:170px;flex:none;min-width:0">
    <div class="display" style="font-size:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">$${esc(r.symbol)}${r.official ? `<span class="chip acc" style="margin-left:8px;font-size:12px;padding:2px 8px;vertical-align:middle">Official</span>` : ''}</div>
    <div style="font-size:15px;color:${C.ink3}">${r.lockers} ${r.lockers === 1 ? 'locker' : 'lockers'}</div>
  </div>
  <div style="flex:1;height:14px;background:${C.paper2};border-radius:7px"><div style="width:${r.lockedPct > 0 ? Math.max(1.5, (r.lockedPct / maxPct) * 100) : 0}%;height:100%;background:${C.accent};border-radius:7px"></div></div>
  <div class="display num" style="width:92px;text-align:right;font-size:24px">${r.lockedPct.toFixed(1)}%</div>
  <div class="num" style="width:120px;text-align:right;font-size:17px;color:${C.ink2}">${r.fees.toFixed(3)} ETH</div>
</div>`;

const html = post({
  kicker: `${minutes} minutes since $CLASP launched`,
  body: `
<div class="row" style="height:100%;gap:52px">
  <div style="width:520px;flex:none;display:flex;flex-direction:column">
    <h1 style="font-size:58px;line-height:1.05">Coins are launching. <span class="a">Holders are locking.</span></h1>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:34px 26px;margin-top:40px">
      ${big(String(nums.coins), 'coins launched on Clasp', C.accent)}
      ${big(String(nums.lockers), 'wallets locking')}
      ${big(`${totalFees.toFixed(2)}<span style="font-size:28px;color:${C.ink3};margin-left:8px">ETH</span>`, 'in trading fees paid into vaults', C.accent)}
      ${big(`${nums.lockedValue.toFixed(2)}<span style="font-size:28px;color:${C.ink3};margin-left:8px">ETH</span>`, 'worth of coins locked')}
    </div>
  </div>
  <div class="card" style="flex:1;min-width:0;padding:22px 30px 10px;align-self:center">
    <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:6px">
      <span class="lab" style="font-size:15px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3}">Supply locked, per coin</span>
      <span style="font-size:15px;color:${C.ink3}">fees into vault</span>
    </div>
    ${rows.map(row).join('')}
  </div>
</div>`,
});
await renderAll([{ out: path.resolve(import.meta.dirname, '../x/posts/clasp-platform.png'), w: 1600, h: 900, html, group: 'post' }]);
fs.writeFileSync(path.resolve(import.meta.dirname, 'work/platform-nums.json'), JSON.stringify(nums));
