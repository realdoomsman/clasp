import path from 'node:path';
import { doc, shot, multChart, burnChart, C, mark, MULT_POINTS } from './lib.mjs';
import { renderAll } from './render.mjs';

const OUT = path.resolve(import.meta.dirname, '../x/article');
const F = (name, w, h, html) => ({ out: path.join(OUT, `${name}.png`), w, h, html, group: 'article' });

const extra = `
.lab{font-size:15px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3}}
.big{font-family:Outfit;font-weight:600;letter-spacing:-.03em;line-height:1}
.p{font-size:19px;line-height:1.5;color:${C.ink2}}
.p b{color:${C.ink};font-weight:600}
.mono{font-family:Consolas,'Cascadia Mono',monospace}
.note{display:flex;gap:16px;align-items:flex-start}
.note .n{flex:none;width:34px;height:34px;border-radius:50%;background:${C.accent};color:#fff;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;margin-top:2px}
.note .t{font-family:Outfit;font-weight:600;font-size:23px;letter-spacing:-.01em}
.note .d{font-size:18px;line-height:1.5;color:${C.ink2};margin-top:4px}
.tick{flex:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:1px}
.tick.y{background:${C.goodSoft}}.tick.x{background:${C.badSoft}}.tick.w{background:${C.warnSoft}}
table{border-collapse:collapse}
`;
const Xm = () => `<span class="tick x"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="${C.bad}" stroke-width="2.4" stroke-linecap="round"/></svg></span>`;
const Vm = () => `<span class="tick y"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 7.5l3 3 6-7" stroke="${C.good}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
const Wm = () => `<span class="tick w"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 3v5M7 10.6v.4" stroke="${C.warn}" stroke-width="2.4" stroke-linecap="round"/></svg></span>`;
const li = (icon, html, fs = 19) => `<div class="row" style="gap:14px;align-items:flex-start;font-size:${fs}px;line-height:1.45;color:${C.ink}">${icon}<span>${html}</span></div>`;
const note = (n, t, d) => `<div class="note"><span class="n">${n}</span><div><div class="t">${t}</div><div class="d">${d}</div></div></div>`;

// Figure frame for article images.
const fig = ({ w = 1600, h, kicker, title, sub, body, foot = '' }) => doc(w, h, `<style>${extra}</style>
<div class="frame" style="width:${w}px;height:${h}px;padding:48px 72px 36px">
  <div class="top" style="margin-bottom:24px"><div class="brand" style="font-size:26px">${mark(32)}<span>Clasp</span></div><span class="kicker">${kicker}</span></div>
  <h2 style="font-size:48px;line-height:1.08">${title}</h2>
  ${sub ? `<p class="sub" style="font-size:21px;margin-top:12px;max-width:1300px">${sub}</p>` : ''}
  <div style="flex:1;min-height:0;position:relative;margin-top:32px">${body}</div>
  <div class="foot" style="margin-top:22px;border-top:1.5px solid ${C.line};padding-top:14px"><span>${foot}</span><span><b>clasp.fun</b> · @ClaspFun</span></div>
</div>`);

const pages = [];

// ---------- cover (1500×600) ----------
const pillC = (t, style) => `<div class="pill" style="position:absolute;font-size:19px;color:${C.ink};font-weight:500;box-shadow:0 8px 24px -12px rgba(22,21,26,.25);${style}">${t}</div>`;
pages.push(F('cover', 1500, 600, doc(1500, 600, `
<div class="frame" style="width:1500px;height:600px;padding:0 100px;flex-direction:row;align-items:center;justify-content:space-between">
  <div style="width:780px">
    <div class="brand" style="font-size:34px">${mark(44)}<span>Clasp</span></div>
    <h1 style="font-size:64px;margin-top:34px;line-height:1.04">Lock a coin you believe in.<br><span class="a">Earn a share of every trade.</span></h1>
    <p class="sub" style="margin-top:22px;font-size:23px">Trading fees paid in ETH to the people who lock. On Robinhood Chain.</p>
  </div>
  <div style="position:relative;width:470px;height:470px;flex:none">
    <div style="position:absolute;inset:50px;border-radius:50%;background:#fff;border:1.5px solid ${C.line};box-shadow:0 30px 60px -30px rgba(22,21,26,.25)"></div>
    <div style="position:absolute;inset:120px;border-radius:50%;background:${C.accentSoft}"></div>
    <div style="position:absolute;left:175px;top:175px">${mark(120)}</div>
    ${pillC('Earn ETH from every trade', 'left:-10px;top:40px')}
    ${pillC('Up to 4× for a 1-year lock', 'right:-40px;top:300px')}
    ${pillC('Collect any time', 'left:20px;top:380px')}
  </div>
</div>`)));

// ---------- fig-money-flow ----------
const srcCard = (t, d, top) => `<div class="card" style="position:absolute;left:0;top:${top}px;width:400px;height:200px;padding:24px 26px"><div class="display" style="font-size:26px">${t}</div><div class="p" style="margin-top:8px;font-size:18px">${d}</div></div>`;
const dstCard = (big, col, t, d, top) => `<div class="card" style="position:absolute;right:0;top:${top}px;width:460px;height:150px;padding:20px 24px;display:flex;gap:22px;align-items:center">
  <div class="big" style="font-size:62px;color:${col};width:120px;flex:none">${big}</div><div><div class="display" style="font-size:24px">${t}</div><div class="p" style="font-size:17px;margin-top:4px">${d}</div></div></div>`;
const curve = (x1, y1, x2, y2, col = C.accent) => `<path d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2 - 10},${y2}" stroke="${col}" stroke-width="3" fill="none"/><path d="M${x2 - 14},${y2 - 7} l10,7 -10,7" stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
pages.push(F('fig-money-flow', 1600, 930, fig({
  h: 930, kicker: 'Money flow',
  title: 'Where the ETH comes from and where it goes',
  sub: 'Every Clasp coin has one vault. Two streams of ETH arrive; everything that arrives is split the same way, and the split is frozen into the vault when it is created.',
  foot: 'Example: a 1 ETH buy through Clasp pays a 0.02 ETH fee → 0.018 ETH to lockers, 0.002 ETH to the treasury.',
  body: `<div style="position:relative;width:1456px;height:560px">
  <svg width="1456" height="560" style="position:absolute;left:0;top:0">
    ${curve(400, 160, 548, 250)}${curve(400, 400, 548, 310)}
    ${curve(908, 280, 996, 105)}${curve(908, 280, 996, 280, C.ink)}${curve(908, 280, 996, 455, C.ink3)}
  </svg>
  ${srcCard('Pons creator fees', 'The coin’s Pons <span class="mono">creatorFeeRecipient</span> is its vault. <span class="mono">harvest()</span> pulls them in: anyone can call it; Clasp’s keeper does it regularly.', 60)}
  ${srcCard('Clasp trading fee: 2%', 'Of the ETH side of every buy and sell through the Clasp router. The site always uses the router.', 300)}
  <div class="card" style="position:absolute;left:548px;top:90px;width:360px;height:380px;padding:28px 28px;background:${C.accentSoft};border-color:${C.lav}">
    <div class="lab" style="color:${C.accentStrong}">One per coin</div>
    <div class="display" style="font-size:36px;margin-top:6px">The coin’s vault</div>
    <div class="p" style="margin-top:14px;font-size:18px">Rules written in at creation and never changed.</div>
    <div style="margin-top:22px;border-top:1.5px solid ${C.lav};padding-top:18px">
      <div class="display" style="font-size:23px">Released over 1 hour</div>
      <div class="p" style="margin-top:6px;font-size:17px">Each arrival streams out linearly, so nobody can lock right after a big fee and take it.</div>
    </div>
  </div>
  ${dstCard('90%', C.accent, 'Lockers', 'By weight: amount × duration × size. Collect any time.', 30)}
  ${dstCard('10%', C.ink, 'Clasp treasury', 'Also gets the lockers’ share while no one is locked.', 205)}
  ${dstCard('0%', C.ink3, 'Creator', 'A creator earns only by locking, like anyone.', 380)}
</div>`,
})));

// ---------- fig-multiplier-curve ----------
const insetOverlay = ({ X, Y }) => {
  const bx = X(2700), by = Y(1.25);
  const rows = MULT_POINTS.slice(0, 3).reverse();
  return `<g>
    <rect x="${bx}" y="${by - 30}" width="240" height="118" rx="12" fill="#fff" stroke="${C.line}" stroke-width="1.5"/>
    ${rows.map(([n, hh, v], i) => `<line x1="${X(hh) + 8}" y1="${Y(Number(v))}" x2="${bx}" y2="${by - 6 + i * 34}" stroke="${C.lav}" stroke-width="1.5"/>
      <text x="${bx + 16}" y="${by + i * 34}" font-size="19" font-weight="600" fill="${C.ink}" class="num">${v}×<tspan fill="${C.ink3}" font-weight="500"> ${n}</tspan></text>`).join('')}
  </g>`;
};
pages.push(F('fig-multiplier-curve', 1600, 1000, fig({
  h: 1000, kicker: 'Duration multiplier',
  title: 'Longer locks get a bigger share: 1.0× at 4 hours, 4.0× at 1 year',
  sub: 'Square-root curve, computed on-chain in integer basis points. Frozen into each vault at creation.',
  foot: 'Size bonus multiplies this: +10% at ≥0.1% of supply, +25% at ≥0.5%, +50% at ≥1% in one lock. Max combined 6.0×.',
  body: `<div class="row" style="gap:28px;height:100%">
    <div class="card" style="flex:1;padding:22px 20px 10px">${multChart({ w: 1010, h: 610, labels: 'big', fs: 18, overlay: insetOverlay })}</div>
    <div class="col" style="width:380px;flex:none;gap:16px">
      <div class="card" style="padding:22px 24px">
        <div class="lab">Formula</div>
        <div class="mono" style="font-size:20px;margin-top:10px;line-height:1.55">m(t) =<br>1 + 3·√((t−4h) / (1y−4h))</div>
        <div class="p" style="font-size:16px;margin-top:8px">t = lock length, 4 hours to 365 days</div>
      </div>
      <div class="card" style="padding:8px 24px">
        <table style="width:100%;font-size:19px">
          ${MULT_POINTS.map(([n, , v], i) => `<tr style="${i ? `border-top:1.5px solid ${C.line}` : ''}"><td style="padding:8px 0;color:${C.ink2}">${n}</td><td class="num" style="padding:8px 0;text-align:right;font-weight:700;${n === '1 year' ? `color:${C.accent}` : ''}">${v}×</td></tr>`).join('')}
        </table>
      </div>
      <div class="card" style="padding:18px 24px;flex:1;background:${C.paper2};box-shadow:none">
        <div class="lab">Size bonus, one lock</div>
        <div class="row num" style="justify-content:space-between;margin-top:10px;font-size:18px"><span>≥ 0.1% of supply</span><b>× 1.10</b></div>
        <div class="row num" style="justify-content:space-between;margin-top:6px;font-size:18px"><span>≥ 0.5%</span><b>× 1.25</b></div>
        <div class="row num" style="justify-content:space-between;margin-top:6px;font-size:18px"><span>≥ 1%</span><b>× 1.50</b></div>
      </div>
    </div>
  </div>`,
})));

// ---------- fig-early-exit ----------
pages.push(F('fig-early-exit', 1600, 1000, fig({
  h: 1000, kicker: 'Early exit',
  title: 'Leaving early burns part of the lock, less the closer you are to the end',
  sub: 'Burn = max(5%, 25% × time remaining ÷ lock length). Burned coins go to 0x…dEaD and are gone for good.',
  foot: 'When a lock ends there is no burn: anyone can press unlock, and coins + ETH go only to the owner.',
  body: `<div class="row" style="gap:28px;height:100%">
    <div class="card" style="flex:1;padding:22px 20px 10px">${burnChart({ w: 960, h: 610, fs: 18 })}</div>
    <div class="col" style="width:430px;flex:none;gap:16px">
      <div class="card" style="padding:22px 26px">
        <div class="lab">Worked example</div>
        <div class="p" style="margin-top:10px">1,000,000 coins locked for <b>1 year</b>, exited after <b>3 months</b>.</div>
        <div class="mono" style="font-size:18px;margin-top:14px;line-height:1.75;color:${C.ink}">
          time left = 9 ÷ 12 = 75%<br>burn = 25% × 0.75 = 18.75%<br>burned &nbsp;&nbsp;= 187,500<br>returned = 812,500
        </div>
      </div>
      <div class="card" style="padding:22px 26px">
        <div class="lab">What happens to ETH</div>
        <div class="col" style="gap:10px;margin-top:12px">
          ${li(Vm(), 'ETH you already collected is always yours.')}
          ${li(Xm(), 'Uncollected ETH is forfeited back to the other lockers.')}
        </div>
      </div>
      <div class="card" style="padding:18px 26px;background:${C.paper2};box-shadow:none">
        <div class="lab">Mainnet test</div>
        <div class="p" style="margin-top:6px;font-size:18px">A minutes-old 4-hour lock burned <b>~24.8%</b> on early unlock, matching the rule.</div>
      </div>
    </div>
  </div>`,
})));

// ---------- fig-worked-example ----------
const mrow = (l, r, strong) => `<div class="row" style="justify-content:space-between;padding:8px 0"><span style="color:${C.ink3}">${l}</span><span class="num" style="color:${C.ink};${strong ? 'font-weight:700' : ''}">${r}</span></div>`;
const locker = (name, chip, chipCls, rows, w) => `<div class="card" style="flex:1;padding:26px 30px">
  <div class="row" style="justify-content:space-between;align-items:center"><span class="display" style="font-size:30px">${name}</span><span class="chip ${chipCls}" style="font-size:16px">${chip}</span></div>
  <div class="mono" style="font-size:20px;margin-top:12px">${rows}<div style="border-top:1.5px solid ${C.line};margin-top:4px"></div>${mrow('weight', w, true)}</div></div>`;
pages.push(F('fig-worked-example', 1600, 1010, fig({
  h: 1010, kicker: 'Worked example',
  title: 'Two lockers, one fee: how shares are computed',
  sub: 'Weight = amount × duration multiplier × size bonus. Each locker’s share of every arrival = their weight ÷ total weight.',
  foot: 'Illustrative example on a coin with 1,000,000,000 supply. Multipliers from the vault rules, shown to 3 decimals.',
  body: `<div class="col" style="gap:20px">
    <div class="row" style="gap:20px">
      ${locker('Locker A', '0.2% of supply · 1 year', 'acc', mrow('amount', '2,000,000') + mrow('duration multiplier (1 year)', '× 4.000') + mrow('size bonus (≥ 0.1%)', '× 1.10'), '8,800,000')}
      ${locker('Locker B', '1% of supply · 1 week', 'warn', mrow('amount', '10,000,000') + mrow('duration multiplier (1 week)', '× 1.411') + mrow('size bonus (≥ 1%)', '× 1.50'), '21,165,000')}
    </div>
    <div class="card" style="padding:26px 30px">
      <div class="row" style="justify-content:space-between;align-items:baseline"><span class="lab">Shares</span><span class="mono num" style="font-size:20px">total weight = 8,800,000 + 21,165,000 = <b>29,965,000</b></span></div>
      <div style="display:flex;height:54px;border-radius:12px;overflow:hidden;margin-top:18px;font-weight:700;font-size:21px;color:#fff">
        <div style="width:29.37%;background:${C.accent};display:flex;align-items:center;padding-left:16px" class="num">A · 29.37%</div>
        <div style="flex:1;background:${C.ink};display:flex;align-items:center;padding-left:16px" class="num">B · 70.63%</div>
      </div>
      <div class="row mono num" style="justify-content:space-between;margin-top:14px;font-size:19px;color:${C.ink2}">
        <span>A = 8,800,000 ÷ 29,965,000 = 29.37%</span><span>B = 21,165,000 ÷ 29,965,000 = 70.63%</span>
      </div>
    </div>
    <div class="card" style="padding:24px 30px">
      <div class="lab">Per 1 ETH that arrives in the vault</div>
      <div class="row" style="align-items:center;gap:18px;margin-top:16px;font-size:21px">
        <div class="display num" style="font-size:34px">1 ETH</div><span style="color:${C.ink3}">→</span>
        <div class="card" style="padding:12px 18px;box-shadow:none;background:${C.paper2}"><span class="num"><b>0.10</b> treasury (10%)</span></div>
        <div class="card" style="padding:12px 18px;box-shadow:none;background:${C.accentSoft};border-color:${C.lav}"><span class="num"><b>0.90</b> lockers (90%)</span></div><span style="color:${C.ink3}">→</span>
        <div class="num">A <b style="color:${C.accent}">0.2643 ETH</b></div>
        <div class="num">B <b>0.6357 ETH</b></div>
      </div>
      <div class="p" style="margin-top:14px;font-size:18px">B locked 5× as many coins, but A’s 1-year lock still earns A 29.37% of everything the lockers receive.</div>
    </div>
  </div>`,
})));

// ---------- fig-architecture ----------
const box = (x, y, w, h, t, d, style = '') => `<div class="card" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;padding:18px 22px;${style}"><div class="display" style="font-size:23px">${t}</div><div class="p" style="font-size:16px;margin-top:5px;line-height:1.45">${d}</div></div>`;
const zone = (x, y, w, h, label, bg) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:1.5px dashed ${C.line};border-radius:22px;background:${bg}"><div class="lab" style="position:absolute;left:22px;top:14px">${label}</div></div>`;
const arrow = (pts, col = C.ink3, label = '', lx = 0, ly = 0, anchor = 'middle', both = false) => {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
  const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2];
  const ang = Math.atan2(ay - by, ax - bx);
  const head = (x, y, a) => `<path d="M${x - 12 * Math.cos(a - 0.45)},${y - 12 * Math.sin(a - 0.45)} L${x},${y} L${x - 12 * Math.cos(a + 0.45)},${y - 12 * Math.sin(a + 0.45)}" stroke="${col}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const [sx, sy] = pts[0], [tx, ty] = pts[1];
  return `<path d="${d}" stroke="${col}" stroke-width="2.5" fill="none"/>${head(ax, ay, ang)}${both ? head(sx, sy, Math.atan2(sy - ty, sx - tx)) : ''}
  ${label ? `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="15" font-weight="600" fill="${col === C.ink3 ? C.ink2 : col}" style="paint-order:stroke;stroke:${C.paper};stroke-width:6px">${label}</text>` : ''}`;
};
pages.push(F('fig-architecture', 1600, 1100, fig({
  h: 1100, kicker: 'Architecture',
  title: 'How the pieces fit together',
  sub: 'Locked coins and earned ETH live in the vault contracts. Clasp’s servers index the chain, run chores and, for Google accounts only, hold wallet keys.',
  foot: 'Transactions from browser wallets are built and signed in the browser. Google sign-in is custodial.',
  body: `<div style="position:relative;width:1456px;height:760px">
  ${zone(0, 0, 1456, 150, 'Your device', '#fffdf9')}
  ${zone(0, 250, 1456, 190, 'Clasp servers', C.paper2 + '99')}
  ${zone(0, 540, 1456, 220, 'Robinhood Chain mainnet · chain id 4663', '#f3f2ff')}
  ${box(40, 36, 380, 104, 'Your own wallet', 'Any browser wallet, auto-detected. It signs your transactions; Clasp never sees keys.')}
  ${box(560, 36, 420, 104, 'clasp.fun', 'Next.js site in your browser. Builds transactions.')}
  ${box(40, 290, 300, 132, 'API', 'Fastify. Serves coins, locks, history to the site.')}
  ${box(380, 290, 330, 132, 'Indexer + Postgres', 'Reads the chain, about 5 s behind the head.')}
  ${box(750, 290, 330, 132, 'Custodial signer', 'Google accounts only. Keys encrypted; withdraw or export any time.', `border-color:#f0dca8`)}
  ${box(1120, 290, 300, 132, 'Keeper bot', 'Harvest, unlock ended locks, send treasury share. Own gas only.')}
  ${box(40, 590, 700, 150, 'Clasp contracts · immutable', 'ClaspFactory · ClaspRouter (2% fee) · ClaspLauncher · one vault per coin holding locked coins and earned ETH.', `background:#fff;border-color:${C.lav}`)}
  ${box(900, 590, 520, 150, 'Pons v2 launchpad', 'The coins themselves. Creator fees for Clasp coins point at the coin’s vault.')}
  <svg width="1456" height="760" style="position:absolute;left:0;top:0;overflow:visible">
    ${arrow([[560, 88], [420, 88]], C.accent, 'sign request', 490, 78, 'middle', true)}
    ${arrow([[40, 110], [14, 110], [14, 665], [40, 665]], C.accent, 'signed tx', 26, 500, 'start')}
    ${arrow([[700, 140], [700, 200], [190, 200], [190, 290]], C.ink3, 'reads data', 440, 192)}
    ${arrow([[860, 140], [860, 290]], '#9a6b00', 'Google users: sign on request', 872, 210, 'start')}
    ${arrow([[915, 422], [915, 480], [620, 480], [620, 590]], '#9a6b00', 'signed tx', 770, 472)}
    ${arrow([[545, 590], [545, 422]], C.ink3, 'reads events', 535, 520, 'end')}
    ${arrow([[340, 356], [380, 356]], C.ink3)}
    ${arrow([[1270, 422], [1270, 518], [700, 518], [700, 590]], C.ink3, 'harvest · unlock · claimTreasury', 985, 510)}
    ${arrow([[740, 665], [900, 665]], C.accent, 'trades · creator fees', 820, 652, 'middle', true)}
  </svg>
</div>`,
})));

// ---------- fig-safety ----------
const col3 = (title, tint, items) => `<div class="card" style="flex:1;padding:26px 28px;${tint}"><div class="display" style="font-size:27px">${title}</div><div class="col" style="gap:14px;margin-top:18px">${items.join('')}</div></div>`;
pages.push(F('fig-safety', 1600, 900, fig({
  h: 900, kicker: 'Safety',
  title: 'What admins can and cannot do',
  sub: 'Clasp’s contracts are immutable: no proxies, no upgrade key. Every vault writes its rules into itself at creation.',
  foot: 'Not audited yet. Pons v2 is also unaudited. Memecoins can go to zero. Only lock what you can afford to lose.',
  body: `<div class="row" style="gap:22px;height:100%;align-items:stretch">
    ${col3('Nobody can, including Clasp', '', [
      li(Xm(), 'Move locked coins. They only go back to the wallet that locked them, or get burned by that wallet’s own early exit.'),
      li(Xm(), 'Move earned ETH. It is only paid to the lock’s owner.'),
      li(Xm(), 'Change an existing vault’s rules: lengths, boosts, exit cost, split.'),
      li(Xm(), 'Upgrade or swap the contract code.'),
      li(Xm(), 'Block payouts: a reverting receiver is credited to <span class="mono">owed</span> and can withdraw later.'),
    ])}
    ${col3('The factory owner can only', '', [
      li(Vm(), 'Change default rules for vaults created <b>later</b>, including the treasury address.'),
      li(Vm(), 'Pause the creation of <b>new</b> vaults.'),
      `<div class="p" style="font-size:17px;margin-top:6px">Neither reaches into a vault that already exists.</div>`,
      `<div style="border-top:1.5px solid ${C.line};padding-top:16px;margin-top:4px" class="col">
        <div class="lab">The keeper bot</div>
        <div class="p" style="font-size:17px;margin-top:6px">Runs permissionless chores anyone could call. It only spends its own gas.</div></div>`,
    ])}
    ${col3('Risks, stated plainly', `background:${C.warnSoft};border-color:#f0dca8;box-shadow:none`, [
      li(Wm(), '<b>Pons admin</b> can redirect a coin’s creator fees after a 3-day public timelock. Clasp shows a warning banner while one is pending. Clasp’s 2% fee and locked coins are unaffected.'),
      li(Wm(), '<b>Google sign-in is custodial.</b> Clasp holds that wallet’s key, encrypted.'),
      li(Wm(), '<b>Not audited yet</b>, and neither is Pons v2.'),
      li(Wm(), 'Memecoins can go to zero. A coin with no trading pays nothing.'),
    ])}
  </div>`,
})));

// ---------- fig-live-test ----------
const steps = [
  ['launch', 'Coin + vault created in one transaction.', '≈ 0.000245 ETH gas'],
  ['buy', 'Through the Clasp router; 2% fee to the vault.', '≈ 0.0000094 ETH gas'],
  ['lock', 'Coins locked by the two test wallets.', '≈ 0.0000101 ETH gas'],
  ['sell', 'Through the Clasp router.', ''],
  ['harvest', 'Creator fees pulled from Pons into the vault.', 'keeper also ran it'],
  ['claim', 'ETH collected without unlocking.', '≈ 0.000004–0.000006 ETH gas'],
  ['early unlock', 'Minutes-old 4-hour lock: ~24.8% burned.', 'matches the rule'],
  ['sell-all', 'Test wallets exited.', ''],
];
const stat = (v, u, t) => `<div class="card" style="padding:20px 24px"><div class="display num" style="font-size:44px">${v}<span style="font-size:22px;color:${C.ink3}"> ${u}</span></div><div class="p" style="font-size:17px;margin-top:6px">${t}</div></div>`;
pages.push(F('fig-live-test', 1600, 1040, fig({
  h: 1040, kicker: 'Mainnet test · 2026-09-25',
  title: 'End-to-end on mainnet with a throwaway test coin',
  sub: 'Clasp Test ($CLTEST), launched from two side wallets. Every action ran on Robinhood Chain mainnet and every step succeeded.',
  foot: 'A test coin, not an investment. Most fees came from launch-window tax paid by bots. Don’t buy $CLTEST.',
  body: `<div class="row" style="gap:28px;height:100%">
    <div class="card" style="width:720px;flex:none;padding:22px 30px">
      <div class="lab" style="margin-bottom:6px">Actions run</div>
      ${steps.map(([s, d, g], i) => `<div class="row" style="gap:18px;align-items:center;padding:11px 0;${i ? `border-top:1.5px solid ${C.line}` : ''}">
        <span style="flex:none;width:32px;height:32px;border-radius:50%;background:${C.goodSoft};color:${C.good};font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center">${i + 1}</span>
        <div style="flex:1"><div class="mono" style="font-size:19px;font-weight:700">${s}</div><div class="p" style="font-size:16px">${d}</div></div>
        ${g ? `<span class="chip ${g.includes('gas') ? 'acc' : 'good'}" style="font-size:14px;white-space:nowrap">${g}</span>` : ''}
      </div>`).join('')}
    </div>
    <div class="col" style="flex:1;gap:16px">
      <div class="row" style="gap:16px">
        <div style="flex:1">${stat('0.0879', 'ETH', 'into the vault in its first hours (lifetime inflow)')}</div>
        <div style="flex:1">${stat('0.001305', 'ETH', 'paid to the two lockers after only minutes locked')}</div>
      </div>
      <div class="card" style="padding:22px 26px">
        <div class="col" style="gap:14px">
          ${li(Vm(), '<b>About a dozen outside wallets</b> (launch bots) traded it within minutes. Their Pons launch-window taxes went into the vault.')}
          ${li(Vm(), '<b>The keeper acted on its own:</b> it ran <span class="mono">harvest()</span> and <span class="mono">claimTreasury()</span> with no human involved.')}
          ${li(Vm(), '<b>Early unlock</b> burned ~24.8% of a minutes-old 4-hour lock: 25% scaled by time left.')}
        </div>
      </div>
      <div class="card" style="padding:20px 26px">
        <div class="lab">Addresses</div>
        <div class="row" style="justify-content:space-between;margin-top:12px;font-size:17px"><span style="font-weight:600">Token $CLTEST</span><span class="mono" style="color:${C.ink2}">0x1fFBca055F0f0d1c5F81b456540DF1f395D9E173</span></div>
        <div class="row" style="justify-content:space-between;margin-top:10px;font-size:17px"><span style="font-weight:600">Vault</span><span class="mono" style="color:${C.ink2}">0x169cd26aFC77c04A78E0a9FA8908EFc071868978</span></div>
      </div>
      <div class="card" style="padding:20px 26px;background:${C.paper2};box-shadow:none">
        <div class="lab">What it shows, and what it doesn’t</div>
        <div class="p" style="margin-top:8px;font-size:17px">It shows the launcher, router, vault, keeper and site working end to end on mainnet. It says nothing about what a real coin will earn: most of these fees were launch-window tax paid by bots.</div>
      </div>
    </div>
  </div>`,
})));

// ---------- fig-addresses ----------
const arow = (n, role, a) => `<div class="row" style="align-items:center;gap:24px;padding:24px 0;border-top:1.5px solid ${C.line}">
  <div style="width:330px;flex:none"><div class="display" style="font-size:27px">${n}</div><div class="p" style="font-size:17px;margin-top:2px">${role}</div></div>
  <div style="flex:1"><div class="mono" style="font-size:23px;color:${C.ink}">${a}</div><div style="font-size:15px;color:${C.ink3};margin-top:6px">robinhoodchain.blockscout.com/address/${a.slice(0, 10)}…</div></div>
  <span class="chip good" style="font-size:15px">Sourcify verified</span></div>`;
pages.push(F('fig-addresses', 1600, 730, fig({
  h: 730, kicker: 'Verify it yourself',
  title: 'Clasp contract addresses',
  sub: 'Robinhood Chain mainnet (chain id 4663). Source verified on Sourcify. No proxies: this is the code that runs.',
  foot: 'Explorer: https://robinhoodchain.blockscout.com/address/&lt;address&gt;',
  body: `<div class="card" style="padding:6px 36px 0">
    ${arow('ClaspFactory', 'Creates one vault per coin', '0x82866AEAD0a590E5f9e7da74fC8c4FCAFFad60af')}
    ${arow('ClaspRouter', 'Buys and sells; sends the 2% fee to the coin’s vault', '0x2c2F23acbEd17827b7873Ce1Bc7430ADEB7Bf92A')}
    ${arow('ClaspLauncher', 'Launches a coin on Pons with its vault in one transaction', '0xE9E68B421dD2dE4F6825A9D5288D00732432A7af')}
  </div>`.replace('border-top:1.5px solid', 'border-top:0 solid'),
})));

// ---------- annotated screenshots ----------
const shotFig = ({ name, h, kicker, title, sub, shotHtml, notes, layout = 'side', foot = 'Real screenshot of clasp.fun.' }) =>
  F(name, 1600, h, fig({
    h, kicker, title, sub, foot,
    body: layout === 'side'
      ? `<div class="row" style="gap:48px;align-items:flex-start">${shotHtml}<div class="col" style="flex:1;gap:24px;padding-top:6px">${notes.join('')}</div></div>`
      : `<div class="col" style="gap:28px">${shotHtml}<div class="row" style="gap:32px">${notes.map((n) => `<div style="flex:1">${n}</div>`).join('')}</div></div>`,
  }));

pages.push(shotFig({
  name: 'shot-coin-page', h: 990, kicker: 'Screenshot · coin page', layout: 'below',
  title: 'A coin page: live numbers, and a button anyone can press',
  foot: 'Real screenshot of clasp.fun: the Clasp Test coin page after the mainnet test. A test coin, not an investment.',
  shotHtml: shot({ src: 'coin.png', crop: [300, 200, 2260, 920], width: 1400, radius: 18, style: 'margin-left:56px', marks: [
    { r: [323, 400, 905, 52], n: 1, pad: 8 },
    { r: [2152, 640, 296, 252], n: 2, pad: 4, pos: 'tr' },
    { r: [2330, 1000, 170, 74], n: 3, pad: 6, pos: 'tr' },
  ] }),
  notes: [
    note(1, 'Labelled as a test', 'The coin we used to test Clasp end to end says so on its page.'),
    note(2, 'Paid to lockers', '0.001305 ETH paid to the two test lockers after minutes locked.'),
    note(3, 'Pull it in', 'Creator fees waiting at Pons. Clasp’s keeper pulls them in regularly; anyone can press the button.'),
  ],
}));

pages.push(shotFig({
  name: 'shot-vault-rules', h: 1240, kicker: 'Screenshot · vault rules',
  title: 'Every coin page shows its vault’s rules',
  sub: 'Written into the vault when it was created. Nobody can change them.',
  shotHtml: shot({ src: 'coin-full.png', crop: [336, 2522, 1026, 1560], width: 620, radius: 22, style: 'margin-left:56px', marks: [
    { r: [368, 2797, 965, 110], n: 1, pad: 2 },
    { r: [368, 2919, 965, 110], n: 2, pad: 2 },
    { r: [368, 3040, 965, 232], n: 3, pad: 2 },
    { r: [368, 3366, 965, 112], n: 4, pad: 2 },
    { r: [368, 3489, 965, 110], n: 5, pad: 2 },
    { r: [384, 3801, 936, 185], n: 6, pad: 4 },
  ] }),
  notes: [
    note(1, 'Time boost', '1.0× for a 4-hour lock, rising to 4.0× at 1 year on a square-root curve.'),
    note(2, 'Size boost', '+10% from 0.1% of supply in one lock, +25% from 0.5%, +50% from 1%. Max combined 6.0×.'),
    note(3, 'Unlocking early', 'Burns max(5%, 25% × time left ÷ lock length). Uncollected ETH goes back to other lockers.'),
    note(4, 'Fee split', '90% to lockers, 10% to Clasp, 0% to the creator.'),
    note(5, 'Shared out over 1 hour', 'New fees stream to lockers over an hour, so a big fee can’t be sniped.'),
    note(6, 'One outside risk', 'Pons’s admin can redirect creator fees after a 3-day public wait. Clasp’s 2% fee, locked coins and earned ETH can’t be touched.'),
  ],
}));

pages.push(F('shot-launch', 1600, 1190, fig({
  h: 1190, kicker: 'Screenshot · launch',
  title: 'Launching a coin with its vault built in',
  sub: 'One transaction on Pons: create the coin, create its Clasp vault, point creator fees at the vault, make the first buy, lock part of it.',
  foot: 'Real screenshot of clasp.fun/launch. Launch gas measured on mainnet: ≈ 0.000245 ETH.',
  body: `<div class="row" style="gap:36px;align-items:flex-start">
    <div class="col" style="gap:30px;width:760px;flex:none">
      ${shot({ src: 'launch-full.png', crop: [765, 2240, 1355, 935], width: 700, radius: 18, style: 'margin-left:56px', marks: [
        { r: [803, 2458, 1125, 58], n: 1, pad: 5 },
        { r: [803, 2546, 1280, 204], n: 2, pad: 5 },
        { r: [803, 2796, 1280, 322], n: 3, pad: 5 },
      ] })}
      <div class="col" style="gap:20px">
        ${note(1, 'You buy first', 'In the same transaction, before anyone else can.')}
        ${note(2, 'Lock part of it', 'Optional. Locked coins earn like anyone else’s.')}
        ${note(3, 'Pick the length', '4 hours to 1 year. Time boost up to 4×.')}
        ${note(4, 'Rules frozen', 'Read from the factory and written into the vault. If defaults change before your launch confirms, the launch is cancelled.')}
      </div>
    </div>
    <div class="col" style="gap:30px">
    ${shot({ src: 'launch-full.png', crop: [765, 3190, 1355, 1800], width: 560, radius: 18, style: 'margin-left:56px', marks: [
      { r: [803, 3236, 1280, 150], n: 4, pad: 5 },
      { r: [803, 4405, 1302, 305], n: 5, pad: 5 },
    ] })}
    <div style="margin-left:56px;width:560px">${note(5, 'Total', 'Pons launch fee plus your first buy. The first buy doesn’t pay Clasp’s 2% fee.')}</div>
    </div>
  </div>`,
})));

pages.push(shotFig({
  name: 'shot-signin', h: 940, kicker: 'Screenshot · sign in',
  title: 'Two ways to sign in. One is custodial.',
  shotHtml: shot({ src: 'signin.png', crop: [1011, 479, 831, 840], width: 640, radius: 22, style: 'margin-left:56px', marks: [
    { r: [1056, 625, 739, 192], n: 1, pad: 12 },
    { r: [1056, 868, 739, 412], n: 2, pad: 12 },
  ] }),
  notes: [
    note(1, 'Continue with Google: custodial', 'Clasp creates a wallet for your Google account and holds its key, encrypted, on its servers. You can withdraw ETH or export the key any time. Protect the Google account with 2-step verification.'),
    note(2, 'Your own wallet: non-custodial', 'Any browser wallet, auto-detected. The site builds transactions and your wallet signs them. Clasp never sees your keys; it only learns your public address.'),
    `<div class="card" style="padding:22px 26px;background:${C.warnSoft};border-color:#f0dca8;box-shadow:none">
      <div class="lab" style="color:${C.warn}">What custodial means here</div>
      <div class="col" style="gap:10px;margin-top:12px">
        ${li(Wm(), 'Anyone who takes over your Google account can use that wallet.', 18)}
        ${li(Wm(), 'If Clasp’s servers were broken into, Google-wallet keys could be stolen.', 18)}
        ${li(Wm(), 'If Clasp’s service is down, the Google wallet can’t be used from the site until it is back.', 18)}
        ${li(Vm(), 'You can move out any time: withdraw ETH or export the key.', 18)}
      </div></div>`,
  ],
}));

await renderAll(pages, process.argv.slice(2));
