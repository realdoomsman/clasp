import path from 'node:path';
import { post, C } from './lib.mjs';
import { renderAll } from './render.mjs';

// Numbers from https://api.clasp.fun/api/coins/0x54dF…13a3, ~30 minutes after launch.
const LOGO = 'https://api.clasp.fun/img/c50f31c8e1b12a405eb3aa0b0306776c5ddadc0e1ac1e134eb329f856a259180.jpg';
const stat = (big, label, sub, col = C.ink, fs = 74) => `<div class="card" style="flex:1 1 0;min-width:0;padding:34px 32px 30px;display:flex;flex-direction:column;justify-content:space-between;gap:30px">
  <div class="display" style="font-size:${fs}px;letter-spacing:-.03em;line-height:1;color:${col};white-space:nowrap">${big}</div>
  <div><div class="display" style="font-size:28px">${label}</div><div style="font-size:18px;color:${C.ink3};margin-top:6px;line-height:1.4">${sub}</div></div>
</div>`;
const eth = (n) => `${n}<span style="font-size:36px;margin-left:10px;color:${C.ink3}">ETH</span>`;

const html = post({
  kicker: '$CLASP · first 30 minutes',
  body: `
<div class="col" style="height:100%">
  <div class="row" style="align-items:center;gap:26px">
    <img src="${LOGO}" style="width:92px;height:92px;border-radius:50%;flex:none" />
    <h1 style="font-size:66px">$CLASP is off the curve <span class="a">and on Uniswap.</span></h1>
  </div>
  <div class="row" style="gap:22px;margin-top:40px;flex:1">
    ${stat('Graduated', 'to Uniswap', 'Left the Pons curve in its first half hour', C.accent, 58)}
    ${stat(eth('0.537'), 'in trading fees', 'Paid into the $CLASP vault so far')}
    ${stat(eth('22.9'), 'market cap', 'Live on Robinhood Chain')}
    ${stat('8.4%', 'of supply locked', 'Lockers split 90% of the fees, in ETH')}
  </div>
  <div class="row" style="margin-top:22px;align-items:center;justify-content:space-between;background:${C.ink};color:#fff;border-radius:18px;padding:18px 26px">
    <span style="font-size:19px;color:#c9c6d0;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Official CA</span>
    <span style="font-family:Consolas,'Cascadia Mono',monospace;font-size:25px">0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3</span>
    <span style="font-size:21px;color:${C.lav};font-weight:600">clasp.fun</span>
  </div>
</div>`,
});

await renderAll([{ out: path.resolve(import.meta.dirname, '../x/posts/clasp-day1.png'), w: 1600, h: 900, html, group: 'post' }]);
