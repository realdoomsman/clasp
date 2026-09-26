import path from 'node:path';
import { post, C } from './lib.mjs';
import { renderAll } from './render.mjs';

// Numbers from https://api.clasp.fun/api/coins/0x54dF…13a3, ~35 minutes after launch.
const R = 205; // ring radius
const S = 620; // wheel box
const node = (x, y, t, s, cls = '') => `<div class="fw ${cls}" style="left:${x}px;top:${y}px"><div class="t">${t}</div><div class="s">${s}</div></div>`;
const cx = S / 2, cy = S / 2;
// Arc arrows between the four nodes (clockwise), drawn on the ring.
const arc = (a0, a1) => {
  const p = (a) => [cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `<path d="M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}" stroke="${C.accent}" stroke-width="5" fill="none" stroke-linecap="round" marker-end="url(#ah)"/>`;
};

const stat = (big, label) => `<div><div class="display" style="font-size:52px;letter-spacing:-.03em;line-height:1">${big}</div><div style="font-size:18px;color:${C.ink3};margin-top:6px">${label}</div></div>`;

const html = post({
  kicker: 'The $CLASP flywheel',
  body: `<style>
.fw{position:absolute;transform:translate(-50%,-50%);width:236px;background:#fff;border:1.5px solid ${C.line};border-radius:18px;padding:16px 18px;text-align:center;box-shadow:0 6px 18px rgba(22,21,26,.06)}
.fw .t{font-family:Outfit;font-weight:600;font-size:25px;letter-spacing:-.01em;line-height:1.1}
.fw .s{font-size:16px;color:${C.ink3};margin-top:5px;line-height:1.35}
.fw.acc{background:${C.accentSoft};border-color:${C.lav}}
.fw.ink{background:${C.ink};border-color:${C.ink};color:#fff}.fw.ink .s{color:#c9c6d0}
</style>
<div class="row" style="height:100%;gap:40px;align-items:center">
  <div style="flex:1;min-width:0">
    <h1 style="font-size:64px;line-height:1.05">Every trade feeds <span class="a">the lockers.</span> The dev’s cut feeds <span class="a">the burn.</span></h1>
    <div class="row" style="gap:42px;margin-top:44px">
      ${stat('31.4<span style="font-size:26px;color:' + C.ink3 + ';margin-left:8px">ETH</span>', 'market cap')}
      ${stat('0.537<span style="font-size:26px;color:' + C.ink3 + ';margin-left:8px">ETH</span>', 'fees in the first 30 min')}
      ${stat('8.8%', 'of supply locked')}
    </div>
    <div style="margin-top:40px;font-size:19px;color:${C.ink2};line-height:1.5">Official CA <span style="font-family:Consolas,'Cascadia Mono',monospace;color:${C.ink}">0x54dFCA823a37Df628B573E7CAEdb2c02E24C13a3</span></div>
  </div>
  <div style="position:relative;width:${S}px;height:${S}px;flex:none;margin-right:34px">
    <svg width="${S}" height="${S}" style="position:absolute;inset:0">
      <defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="${C.accent}"/></marker></defs>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.accentSoft}" stroke-width="22"/>
      ${arc(-58, -32)}${arc(32, 58)}${arc(122, 148)}${arc(212, 238)}
    </svg>
    <div style="position:absolute;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);text-align:center">
      <svg width="64" height="64" viewBox="0 0 32 32"><path d="M7.5 26V13a6 6 0 0 1 12 0v4" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M24.5 6v13a6 6 0 0 1-12 0v-4" stroke="${C.accent}" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>
      <div class="display" style="font-size:30px;margin-top:4px">$CLASP</div>
    </div>
    ${node(cx, cy - R, 'Every trade', 'buys and sells of $CLASP')}
    ${node(cx + R, cy, 'ETH to the vault', 'trading fees, paid in ETH', 'acc')}
    ${node(cx, cy + R, 'Lockers split 90%', 'by amount × lock length', 'acc')}
    ${node(cx - R, cy, 'Dev lock’s share', 'buys back and burns $CLASP', 'ink')}
  </div>
</div>`,
});

await renderAll([{ out: path.resolve(import.meta.dirname, '../x/posts/clasp-flywheel.png'), w: 1600, h: 900, html, group: 'post' }]);
