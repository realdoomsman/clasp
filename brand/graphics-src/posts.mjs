import path from 'node:path';
import { post, shot, multChart, C, mark, MULT_POINTS } from './lib.mjs';
import { renderAll } from './render.mjs';

const OUT = path.resolve(import.meta.dirname, '../x/posts');
const P = (n, html, w = 1600, h = 900) => ({ out: path.join(OUT, `post-${n}.png`), w, h, html, group: 'post' });

const arrowDown = (h = 34) => `<svg width="24" height="${h}" viewBox="0 0 24 ${h}" style="display:block;margin:0 auto"><path d="M12 2V${h - 4}M5 ${h - 11}l7 7 7-7" stroke="${C.ink3}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const arrowRight = (w = 44, col = C.ink3) => `<svg width="${w}" height="24" viewBox="0 0 ${w} 24" style="display:block;flex:none"><path d="M2 12H${w - 4}M${w - 11} 5l7 7-7 7" stroke="${col}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const node = (t, s = '', cls = '') => `<div class="node ${cls}"><div class="nt">${t}</div>${s ? `<div class="ns">${s}</div>` : ''}</div>`;
const head = (h1, sub = '', mb = 0) => `<h1>${h1}</h1>${sub ? `<p class="sub" style="margin-top:18px">${sub}</p>` : ''}`;

const extra = `
.node{background:#fff;border:1.5px solid ${C.line};border-radius:16px;padding:14px 20px;text-align:center}
.node .nt{font-family:Outfit;font-weight:600;font-size:24px;letter-spacing:-.01em}
.node .ns{font-size:16px;color:${C.ink3};margin-top:3px}
.node.acc{background:${C.accentSoft};border-color:${C.lav}}
.node.dim{background:${C.paper2};}
.node.ink{background:${C.ink};border-color:${C.ink};color:#fff}.node.ink .ns{color:#c9c6d0}
.lab{font-size:15px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3}}
.big{font-family:Outfit;font-weight:600;letter-spacing:-.03em;line-height:1}
.li{display:flex;gap:14px;align-items:flex-start;font-size:21px;line-height:1.4;color:${C.ink2}}
.li .n{flex:none;width:32px;height:32px;border-radius:50%;background:${C.accent};color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;margin-top:1px}
.li b{color:${C.ink};font-weight:600}
.tick{flex:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:2px}
.tick.y{background:${C.goodSoft}}.tick.x{background:${C.badSoft}}
.formula{font-family:Consolas,'Cascadia Mono',monospace;font-size:21px;color:${C.ink};background:${C.paper2};border-radius:12px;padding:12px 16px;display:inline-block}
table{border-collapse:collapse}
`;
const X = (w = 22) => `<span class="tick x"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="${C.bad}" stroke-width="2.4" stroke-linecap="round"/></svg></span>`;
const V = () => `<span class="tick y"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 7.5l3 3 6-7" stroke="${C.good}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
const wrap = (o) => post({ ...o, body: `<style>${extra}</style>${o.body}` });

const pages = [];

// 01 — Problem statement: status quo vs Clasp
pages.push(P('01', wrap({
  kicker: 'The problem',
  body: `
<div class="col" style="height:100%">
  <h1 style="font-size:62px;max-width:1300px">Holders make the volume. <span class="a">The trading fee goes to one wallet.</span></h1>
  <div class="row" style="gap:36px;margin-top:40px;flex:1">
    <div class="card" style="flex:1;padding:30px 36px;background:${C.paper2};box-shadow:none;display:flex;flex-direction:column;justify-content:space-between">
      <div class="row" style="justify-content:space-between;align-items:center"><span class="lab">A typical memecoin</span><span class="chip warn">Status quo</span></div>
      <div class="row" style="align-items:center;gap:14px">
        ${node('Every trade', 'buys and sells')}${arrowRight(40)}${node('Creator fee', 'on each trade')}${arrowRight(40)}${node('One wallet', 'the creator', 'ink')}
      </div>
      <p style="font-size:20px;line-height:1.5;color:${C.ink2}">Holders buy, sell and hold. The fee from all that volume goes to a single address.</p>
      <div style="border-top:1.5px dashed #ddd3c3;padding-top:22px" class="row">
        <div style="flex:1"><div class="big" style="font-size:64px;color:${C.ink3}">0</div><div style="font-size:19px;color:${C.ink2};margin-top:8px">earned by the holders who create the volume</div></div>
      </div>
    </div>
    <div class="card" style="flex:1;padding:30px 36px;display:flex;flex-direction:column;justify-content:space-between">
      <div class="row" style="justify-content:space-between;align-items:center"><span class="lab" style="color:${C.accentStrong}">A Clasp coin</span><span class="chip acc">Live on Robinhood Chain</span></div>
      <div class="row" style="align-items:center;gap:14px">
        ${node('Every trade', 'buys and sells')}${arrowRight(40, C.accent)}${node('Coin’s vault', 'fees in ETH', 'acc')}${arrowRight(40, C.accent)}${node('Lockers', 'by weight', 'acc')}
      </div>
      <p style="font-size:20px;line-height:1.5;color:${C.ink2}">The fees land in the coin’s vault and go to the people who lock it, weighted by amount, time and size.</p>
      <div style="border-top:1.5px dashed ${C.line};padding-top:22px" class="row">
        <div style="flex:1"><div class="big a" style="font-size:64px">90%</div><div style="font-size:19px;color:${C.ink2};margin-top:8px">to lockers</div></div>
        <div style="flex:1"><div class="big" style="font-size:64px">10%</div><div style="font-size:19px;color:${C.ink2};margin-top:8px">to the Clasp treasury</div></div>
        <div style="flex:1"><div class="big" style="font-size:64px;color:${C.ink3}">0%</div><div style="font-size:19px;color:${C.ink2};margin-top:8px">to the creator</div></div>
      </div>
    </div>
  </div>
</div>`,
})));

// 02 — 90/10/0 split
const splitCard = (big, t, s, col) => `<div class="card" style="flex:1;padding:48px 38px 36px;display:flex;flex-direction:column;justify-content:flex-start;gap:56px">
  <div class="big" style="font-size:150px;color:${col}">${big}</div>
  <div><div class="display" style="font-size:34px">${t}</div>
  <div style="font-size:20px;line-height:1.45;color:${C.ink2};margin-top:10px">${s}</div></div></div>`;
pages.push(P('02', wrap({
  kicker: 'Fee split',
  body: `
<div class="col" style="height:100%">
  <div class="row" style="align-items:flex-end;justify-content:space-between;gap:60px">
    <h1 style="font-size:64px">Where every fee goes.</h1>
    <p class="sub" style="max-width:720px;font-size:22px">Pons creator fees and Clasp’s 2% trading fee both land in the coin’s vault. The split is written into the vault when it is created and can’t be changed.</p>
  </div>
  <div class="row" style="gap:28px;margin-top:40px;flex:1">
    ${splitCard('90%', 'Lockers', 'Shared by weight: amount × time × size. Paid in ETH. Collect any time.', C.accent)}
    ${splitCard('10%', 'Clasp treasury', 'Sent to the treasury address stored in the vault. If no one is locked, the lockers’ share goes here too.', C.ink)}
    ${splitCard('0%', 'Creator', 'No cut for the creator. A creator earns the same way as everyone else: by locking.', C.ink3)}
  </div>
  <div style="margin-top:28px;height:16px;border-radius:8px;overflow:hidden;display:flex">
    <div style="width:90%;background:${C.accent}"></div><div style="width:10%;background:${C.ink}"></div>
  </div>
</div>`,
})));

// 04 — Duration multiplier
pages.push(P('04', wrap({
  kicker: 'Lock length',
  body: `
<div class="row" style="height:100%;gap:56px;align-items:center">
  <div style="width:500px;flex:none">
    <h1>Longer lock, <span class="a">bigger share.</span></h1>
    <p class="sub" style="margin-top:22px">The duration multiplier runs from 1.0× at 4 hours to 4.0× at 1 year on a square-root curve, so it climbs fastest early on.</p>
    <div class="formula" style="margin-top:28px">1 + 3·√((t − 4h) / (1y − 4h))</div>
    <p style="font-size:17px;color:${C.ink3};margin-top:14px;line-height:1.45">Computed on-chain in integer basis points. Frozen into each vault at creation.</p>
  </div>
  <div class="card" style="flex:1;padding:24px 24px 18px">
    ${multChart({ w: 850, h: 470, labels: 'big', fs: 17 })}
    <div class="row" style="margin-top:8px;border-top:1.5px solid ${C.line};padding-top:16px">
      ${MULT_POINTS.map(([n, , v]) => `<div style="flex:1;text-align:center"><div class="display num" style="font-size:25px;${n === '1 year' ? `color:${C.accent}` : ''}">${v}×</div><div style="font-size:15px;color:${C.ink3};margin-top:3px">${n}</div></div>`).join('')}
    </div>
  </div>
</div>`,
})));

// 05 — Size bonus table
const durs = [['1 week', 1.411], ['30 days', 1.858], ['90 days', 2.489], ['1 year', 4.0]];
const sizes = [['under 0.1%', 'none', 1], ['0.1% or more', '+10%', 1.1], ['0.5% or more', '+25%', 1.25], ['1% or more', '+50%', 1.5]];
const fmt3 = (x) => (Math.round(x * 1000 + 1e-9) / 1000).toFixed(3);
pages.push(P('05', wrap({
  kicker: 'Lock size',
  body: `
<div class="row" style="height:100%;gap:56px;align-items:center">
  <div style="width:470px;flex:none">
    <h1>Big locks get a <span class="a">size bonus.</span></h1>
    <p class="sub" style="margin-top:22px">Lock at least 0.1% of the supply in one lock and your duration multiplier gets +10%. At 0.5%, +25%. At 1%, +50%.</p>
    <p class="sub" style="margin-top:18px">The two multiply. The ceiling is <b style="color:${C.ink}">6.0×</b>: a 1&#8209;year lock of 1% or more.</p>
  </div>
  <div class="card" style="flex:1;padding:30px 34px">
    <table style="width:100%;font-size:21px">
      <thead><tr style="text-align:left">
        <th style="padding:0 0 16px;font-weight:600;font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:${C.ink3}">One lock’s share<br>of total supply</th>
        <th style="padding:0 0 16px;font-weight:600;font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:${C.ink3}">Size<br>bonus</th>
        ${durs.map(([d]) => `<th style="padding:0 0 16px;text-align:right;font-weight:600;font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:${C.ink3}">Locked<br>${d}</th>`).join('')}
      </tr></thead>
      <tbody>
      ${sizes.map(([s, b, k], i) => `<tr style="border-top:1.5px solid ${C.line}">
        <td style="padding:20px 0;font-weight:600">${s}</td>
        <td style="padding:20px 0;color:${i ? C.accentStrong : C.ink3};font-weight:600">${b}</td>
        ${durs.map(([, d], j) => {
          const top = i === 3 && j === 3;
          return `<td class="num" style="padding:20px 0;text-align:right;${top ? '' : `color:${C.ink2}`}">${top ? `<span style="background:${C.accent};color:#fff;border-radius:10px;padding:6px 12px;font-weight:700">${fmt3(d * k)}×</span>` : `${fmt3(d * k)}×`}</td>`;
        }).join('')}
      </tr>`).join('')}
      </tbody>
    </table>
    <p style="font-size:16px;color:${C.ink3};margin-top:14px">Combined multiplier = duration multiplier × size bonus. Values rounded to 3 decimals.</p>
  </div>
</div>`,
})));

// 06 — Worked example (formula card)
const code = (l, r, strong) => `<div class="row" style="justify-content:space-between;gap:20px;padding:9px 0"><span style="color:${C.ink3}">${l}</span><span class="num" style="${strong ? `color:${C.ink};font-weight:700` : `color:${C.ink}`}">${r}</span></div>`;
pages.push(P('06', wrap({
  kicker: 'Worked example',
  body: `
<div class="row" style="height:100%;gap:52px;align-items:center">
  <div style="width:470px;flex:none">
    <h1>Two lockers. <span class="a">The math.</span></h1>
    <p class="sub" style="margin-top:22px">Weight = amount × duration multiplier × size bonus. Your share of every arrival is your weight divided by the total.</p>
    <p style="font-size:17px;color:${C.ink3};margin-top:20px;line-height:1.5">Example coin with 1,000,000,000 supply. Illustrative amounts, not a forecast.</p>
  </div>
  <div class="col" style="flex:1;gap:18px">
    <div class="row" style="gap:18px">
      <div class="card" style="flex:1;padding:22px 26px">
        <div class="row" style="justify-content:space-between;align-items:center"><span class="display" style="font-size:26px">Locker A</span><span class="chip acc">0.2% · 1 year</span></div>
        <div class="mono" style="font-size:19px;margin-top:10px">
          ${code('amount', '2,000,000')}${code('duration', '× 4.000')}${code('size (≥0.1%)', '× 1.10')}
          <div style="border-top:1.5px solid ${C.line};margin-top:4px"></div>${code('weight', '8,800,000', true)}
        </div>
      </div>
      <div class="card" style="flex:1;padding:22px 26px">
        <div class="row" style="justify-content:space-between;align-items:center"><span class="display" style="font-size:26px">Locker B</span><span class="chip warn">1% · 1 week</span></div>
        <div class="mono" style="font-size:19px;margin-top:10px">
          ${code('amount', '10,000,000')}${code('duration', '× 1.411')}${code('size (≥1%)', '× 1.50')}
          <div style="border-top:1.5px solid ${C.line};margin-top:4px"></div>${code('weight', '21,165,000', true)}
        </div>
      </div>
    </div>
    <div class="card" style="padding:22px 26px">
      <div class="row" style="justify-content:space-between;font-size:19px;color:${C.ink2}"><span>Total weight <b class="num" style="color:${C.ink}">29,965,000</b></span><span>Per <b style="color:${C.ink}">1 ETH</b> that arrives, <b style="color:${C.ink}">0.90 ETH</b> goes to lockers</span></div>
      <div style="display:flex;height:46px;border-radius:12px;overflow:hidden;margin-top:16px;font-weight:700;font-size:19px;color:#fff">
        <div style="width:29.37%;background:${C.accent};display:flex;align-items:center;padding-left:14px" class="num">A 29.37%</div>
        <div style="flex:1;background:${C.ink};display:flex;align-items:center;padding-left:14px" class="num">B 70.63%</div>
      </div>
      <div class="row num" style="justify-content:space-between;margin-top:14px;font-size:19px;color:${C.ink2}">
        <span>A: 8.8M ÷ 29.965M × 0.90 = <b style="color:${C.accent}">0.2643 ETH</b></span>
        <span>B: 21.165M ÷ 29.965M × 0.90 = <b style="color:${C.ink}">0.6357 ETH</b></span>
      </div>
    </div>
  </div>
</div>`,
})));

// 08 — Launch with vault built in (portrait, annotated screenshot)
pages.push(P('08', wrap({
  w: 1080, h: 1350, pad: 64, kicker: 'Launch',
  body: `
<div class="col" style="height:100%">
  <h1 style="font-size:60px">Launch a coin with its <span class="a">vault built in.</span></h1>
  <p class="sub" style="margin-top:16px;font-size:22px">One transaction on Pons creates the coin, creates its Clasp vault and points the creator fees at the vault before anyone can trade.</p>
  ${shot({
    src: 'launch-full.png', crop: [765, 2240, 1355, 935], width: 896, style: 'margin:30px 0 0 56px',
    marks: [
      { r: [803, 2458, 1125, 58], n: 1, pad: 6 },
      { r: [803, 2546, 1280, 204], n: 2, pad: 6 },
      { r: [803, 2796, 1280, 322], n: 3, pad: 6 },
    ],
  })}
  <div class="col" style="gap:18px;margin-top:40px">
    <div class="li"><span class="n">1</span><span><b>You buy first</b>, in the same transaction, before anyone else can.</span></div>
    <div class="li"><span class="n">2</span><span><b>Lock part of it</b> right away, if you want to.</span></div>
    <div class="li"><span class="n">3</span><span><b>Pick the length:</b> 4 hours to 1 year.</span></div>
  </div>
  <div class="row" style="gap:16px;margin-top:24px">
    <div class="card" style="flex:1;padding:16px 20px;box-shadow:none"><div class="lab">Rules frozen in the vault</div><div style="font-size:19px;margin-top:6px;color:${C.ink}">90% lockers · 10% Clasp · 0% creator</div></div>
    <div class="card" style="flex:none;padding:16px 20px;box-shadow:none"><div class="lab">Launch gas, measured</div><div class="num" style="font-size:19px;margin-top:6px;color:${C.ink};white-space:nowrap">≈ 0.000245 ETH</div></div>
  </div>
</div>`,
}), 1080, 1350));

// 09 — 1-hour stream + collect anytime
const streamChart = () => {
  const w = 890, h = 400, L = 64, R = 30, T = 26, B = 58;
  const pw = w - L - R, ph = h - T - B;
  const X = (m) => L + (m / 90) * pw, Y = (p) => T + ph - (p / 100) * ph;
  return `<svg width="${w}" height="${h}" style="font-family:Inter">
  ${[0, 25, 50, 75, 100].map((v) => `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}" stroke-width="1.5"/><text x="${L - 12}" y="${Y(v) + 6}" text-anchor="end" font-size="16" fill="${C.ink3}">${v}%</text>`).join('')}
  <path d="M${X(0)},${Y(0)}L${X(30)},${Y(50)}L${X(30)},${Y(0)}Z" fill="${C.paper2}"/>
  <path d="M${X(30)},${Y(0)}L${X(30)},${Y(50)}L${X(60)},${Y(100)}L${X(60)},${Y(0)}Z" fill="${C.accentSoft}"/>
  <path d="M${X(0)},${Y(0)}L${X(60)},${Y(100)}L${X(90)},${Y(100)}" fill="none" stroke="${C.accent}" stroke-width="4" stroke-linejoin="round"/>
  <line x1="${X(30)}" x2="${X(30)}" y1="${Y(0)}" y2="${Y(62)}" stroke="${C.ink}" stroke-width="2" stroke-dasharray="5 5"/>
  <text x="${X(30) - 10}" y="${Y(66)}" text-anchor="end" font-size="17" font-weight="600" fill="${C.ink}">New lock at minute 30</text>
  <text x="${X(46)}" y="${Y(18)}" text-anchor="middle" font-size="16" font-weight="600" fill="${C.accentStrong}">shares this half</text>
  <text x="${X(20)}" y="${Y(4)}" text-anchor="middle" font-size="15" font-weight="600" fill="${C.ink3}">went to earlier lockers</text>
  <circle cx="${X(0)}" cy="${Y(0)}" r="7" fill="${C.accent}"/>
  <line x1="${L}" x2="${w - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.ink3}" stroke-width="1.5"/>
  ${[0, 15, 30, 45, 60, 75, 90].map((m) => `<text x="${X(m)}" y="${Y(0) + 30}" text-anchor="middle" font-size="16" fill="${C.ink3}">${m}m</text>`).join('')}
  </svg>`;
};
pages.push(P('09', wrap({
  kicker: 'How payouts work',
  body: `
<div class="row" style="height:100%;gap:40px;align-items:stretch">
  <div class="col" style="flex:1;justify-content:center">
    <h1 style="font-size:60px">Fees stream in over an hour. <span class="a">Collect whenever you like.</span></h1>
    <div class="card" style="margin-top:30px;padding:20px 24px 10px">
      <div class="row" style="justify-content:space-between;align-items:baseline"><span class="lab">One fee arrival, released to lockers</span><span style="font-size:15px;color:${C.ink3}">cumulative %</span></div>
      ${streamChart()}
    </div>
  </div>
  <div class="col" style="width:470px;flex:none;gap:18px;justify-content:center">
    <div class="card" style="padding:26px 28px"><div class="display" style="font-size:27px">No sniping a big fee</div><p style="font-size:19px;line-height:1.5;color:${C.ink2};margin-top:8px">Every arrival is released linearly over 1 hour. Locking right after a large fee only gets you a share of what is still left to release.</p></div>
    <div class="card" style="padding:26px 28px"><div class="display" style="font-size:27px">Collect any time</div><p style="font-size:19px;line-height:1.5;color:${C.ink2};margin-top:8px">ETH builds up continuously. Claim it whenever you want. Your coins stay locked.</p></div>
    <div class="card" style="padding:22px 28px;background:${C.paper2};box-shadow:none"><div style="font-size:17px;color:${C.ink3}">Claim gas measured on mainnet</div><div class="display num" style="font-size:30px;margin-top:4px">≈ 0.000004–0.000006 ETH</div></div>
  </div>
</div>`,
})));

// 10 — Add an existing Pons coin
const step = (n, t, s) => `<div class="card" style="padding:24px 28px;display:flex;gap:20px;align-items:flex-start">
  <div class="big" style="font-size:54px;color:${C.accent};width:44px;flex:none">${n}</div>
  <div><div class="display" style="font-size:27px">${t}</div><p style="font-size:19px;line-height:1.5;color:${C.ink2};margin-top:6px">${s}</p></div></div>`;
pages.push(P('10', wrap({
  kicker: 'Join',
  body: `
<div class="row" style="height:100%;gap:52px;align-items:center">
  <div class="col" style="width:640px;flex:none;gap:18px">
    <h1 style="margin-bottom:14px">Already on Pons?<br><span class="a">Two steps.</span></h1>
    ${step('1', 'Create the coin’s vault', 'Anyone can do it. It costs only gas.')}
    ${step('2', 'Point creator fees at the vault', 'The coin’s current creator-fee recipient sets the vault as recipient on Pons.')}
    <div style="font-size:18px;color:${C.ink3};margin-top:4px">Works for ETH-paired Pons v2 coins with buyback off.</div>
  </div>
  <div class="col" style="flex:1;gap:16px">
    ${shot({ src: 'launch-full.png', crop: [680, 5060, 1520, 660], width: 760, marks: [{ r: [720, 5265, 1400, 100], pad: 6 }] })}
    <div style="font-size:17px;color:${C.ink3}">clasp.fun/launch · “Bring your coin to Clasp”</div>
  </div>
</div>`,
})));

// 12 — Keeper bot
const chore = (fn, t, s) => `<div class="card" style="padding:22px 26px;display:flex;gap:22px;align-items:center">
  <div class="mono" style="flex:none;width:210px;font-size:19px;background:${C.accentSoft};color:${C.accentStrong};border-radius:10px;padding:10px 12px;text-align:center">${fn}</div>
  <div><div class="display" style="font-size:25px">${t}</div><div style="font-size:18px;color:${C.ink2};margin-top:4px;line-height:1.45">${s}</div></div></div>`;
pages.push(P('12', wrap({
  kicker: 'Keeper',
  body: `
<div class="row" style="height:100%;gap:56px;align-items:center">
  <div style="width:500px;flex:none">
    <h1>A bot does the chores. <span class="a">It can’t touch funds.</span></h1>
    <p class="sub" style="margin-top:22px">Clasp’s keeper runs permissionless calls that anyone could make. It only spends its own gas.</p>
    <div class="card" style="margin-top:28px;padding:18px 22px;background:${C.goodSoft};border-color:#c9e8d5;box-shadow:none;font-size:18px;line-height:1.5;color:${C.good}"><b>In our mainnet test</b> it ran <span class="mono">harvest()</span> and <span class="mono">claimTreasury()</span> on its own. No human involved.</div>
  </div>
  <div class="col" style="flex:1;gap:18px">
    <div class="lab">Three jobs · anyone can call them</div>
    ${chore('harvest()', 'Pull in creator fees', 'Moves the coin’s Pons creator fees into its vault.')}
    ${chore('unlock', 'Close ended locks', 'Largest first. Coins and ETH go only to the lock’s owner.')}
    ${chore('claimTreasury()', 'Send the treasury share', 'Pays Clasp’s 10% to the treasury address.')}
  </div>
</div>`,
})));

// 13 — Immutable / no admin path
const item = (ok, t) => `<div class="row" style="gap:14px;align-items:flex-start;font-size:21px;line-height:1.4;color:${C.ink}">${ok ? V() : X()}<span>${t}</span></div>`;
pages.push(P('13', wrap({
  kicker: 'Safety',
  body: `
<div class="row" style="height:100%;gap:52px;align-items:center">
  <div style="width:570px;flex:none">
    <h1>No admin path to <span class="a">your coins or ETH.</span></h1>
    <p class="sub" style="margin-top:22px">Clasp’s contracts are immutable: no proxies, no upgrade key. Each vault writes its rules into itself at creation.</p>
  </div>
  <div class="col" style="flex:1;gap:20px">
    <div class="card" style="padding:26px 30px">
      <div class="lab" style="margin-bottom:16px">The factory owner can only</div>
      <div class="col" style="gap:12px">
        ${item(true, 'Change defaults for <b>vaults created later</b> (rules, treasury address)')}
        ${item(true, 'Pause the creation of <b>new</b> vaults')}
      </div>
    </div>
    <div class="card" style="padding:26px 30px">
      <div class="lab" style="margin-bottom:16px">Nobody, including Clasp, can</div>
      <div class="col" style="gap:12px">
        ${item(false, 'Move locked coins. They only go back to the wallet that locked them')}
        ${item(false, 'Move earned ETH. It only goes to the lock’s owner')}
        ${item(false, 'Change an existing vault’s rules')}
        ${item(false, 'Swap the contract code')}
      </div>
    </div>
  </div>
</div>`,
})));

// 14 — Google vs own wallet
pages.push(P('14', wrap({
  kicker: 'Signing in',
  body: `
<div class="row" style="height:100%;gap:52px;align-items:center">
  ${shot({ src: 'signin.png', crop: [1011, 479, 831, 840], width: 540, radius: 22, style: 'margin-left:56px', marks: [
    { r: [1056, 625, 739, 192], n: 1, pad: 12 },
    { r: [1056, 868, 739, 412], n: 2, pad: 12 },
  ] })}
  <div class="col" style="flex:1;gap:20px">
    <h1 style="font-size:58px;margin-bottom:8px">Two ways in. <span class="a">One is custodial.</span></h1>
    <div class="card" style="padding:24px 28px">
      <div class="row" style="gap:12px;align-items:center"><span class="li"><span class="n">1</span></span><span class="display" style="font-size:27px">Continue with Google</span><span class="chip warn">Custodial</span></div>
      <p style="font-size:19px;line-height:1.5;color:${C.ink2};margin-top:10px">Clasp creates a wallet for your Google account and holds its key, encrypted. You can withdraw ETH or export the key any time.</p>
    </div>
    <div class="card" style="padding:24px 28px">
      <div class="row" style="gap:12px;align-items:center"><span class="li"><span class="n">2</span></span><span class="display" style="font-size:27px">Your own wallet</span><span class="chip good">Clasp never sees keys</span></div>
      <p style="font-size:19px;line-height:1.5;color:${C.ink2};margin-top:10px">Any browser wallet, auto-detected. Transactions are built in your browser and signed by your wallet.</p>
    </div>
  </div>
</div>`,
})));

// 16 — Pons admin redirect risk
pages.push(P('16', wrap({
  kicker: 'Risk',
  body: `
<div class="col" style="height:100%;justify-content:center;gap:60px">
  <div class="row" style="gap:56px;align-items:flex-start">
    <div style="width:640px;flex:none">
      <h1 style="font-size:62px">One outside risk, <span class="a">stated plainly.</span></h1>
      <p class="sub" style="margin-top:20px;font-size:22px">Pons’s admin can redirect a coin’s creator fees after a 3-day public timelock. Clasp can’t switch that off. It is part of Pons.</p>
    </div>
    <div class="col" style="flex:1;gap:14px;padding-top:12px">
      ${shot({ src: 'coin-full.png', crop: [380, 3797, 944, 193], width: 740, radius: 16 })}
      <div style="font-size:16px;color:${C.ink3}">As shown in the rules panel of every coin page on clasp.fun</div>
    </div>
  </div>
  <div class="card" style="padding:34px 38px">
    <div class="row" style="align-items:center;gap:0">
      <div style="flex:none;width:290px"><div class="lab">Day 0</div><div class="display" style="font-size:28px;margin-top:6px">Change proposed</div><div style="font-size:18px;color:${C.ink2};margin-top:4px">Public on-chain right away</div></div>
      <div style="flex:1;height:4px;background:repeating-linear-gradient(90deg,${C.warn} 0 12px,transparent 12px 20px);margin:0 20px"></div>
      <div style="flex:none;width:440px;background:${C.badSoft};border:1.5px solid #f3c7c2;border-radius:14px;padding:16px 20px"><div class="display" style="font-size:24px;color:${C.bad}">Clasp shows a warning banner</div><div style="font-size:18px;color:${C.ink2};margin-top:4px">on the coin’s page while the change is pending</div></div>
      <div style="flex:1;height:4px;background:repeating-linear-gradient(90deg,${C.warn} 0 12px,transparent 12px 20px);margin:0 20px"></div>
      <div style="flex:none;width:260px;text-align:right"><div class="lab">Day 3</div><div class="display" style="font-size:28px;margin-top:6px">Earliest effect</div><div style="font-size:18px;color:${C.ink2};margin-top:4px">after the public timelock</div></div>
    </div>
    <div class="row" style="gap:28px;margin-top:30px;border-top:1.5px solid ${C.line};padding-top:26px">
      <div style="flex:1" class="row">${X()}<span style="margin-left:14px;font-size:21px;line-height:1.4"><b>Would stop:</b> that coin’s Pons creator fees reaching its lockers</span></div>
      <div style="flex:1" class="row">${V()}<span style="margin-left:14px;font-size:21px;line-height:1.4"><b>Unaffected:</b> Clasp’s 2% fee, locked coins, ETH already earned</span></div>
    </div>
  </div>
</div>`,
})));

// 17 — Live mainnet test
const stat = (v, t, u = '', fs = 44) => `<div class="card" style="padding:20px 24px;flex:1"><div class="display num" style="font-size:${fs}px;letter-spacing:-.02em;line-height:1.1">${v}<span style="font-size:22px;color:${C.ink3}">${u}</span></div><div style="font-size:17px;color:${C.ink2};margin-top:8px;line-height:1.4">${t}</div></div>`;
const steps = ['launch', 'buy', 'lock', 'sell', 'harvest', 'claim', 'early unlock', 'sell-all'];
pages.push(P('17', wrap({
  kicker: 'Mainnet test',
  footLeft: 'Clasp Test ($CLTEST) is a test coin. Not an investment. Most fees were launch-window tax paid by bots.',
  body: `
<div class="col" style="height:100%;justify-content:space-between">
  <div class="row" style="gap:44px;align-items:flex-start">
    <div style="width:640px;flex:none">
      <h1 style="font-size:58px">We ran every action on mainnet <span class="a">with a test coin.</span></h1>
      <p class="sub" style="margin-top:16px;font-size:21px">Launched from two side wallets on 2026-09-25. Every step succeeded:</p>
      <div class="row" style="flex-wrap:wrap;gap:9px;margin-top:14px">${steps.map((s) => `<span class="chip good" style="font-size:16px;padding:6px 13px">✓ ${s}</span>`).join('')}</div>
    </div>
    <div class="col" style="flex:1;gap:14px">
      <div class="row" style="gap:14px">
        ${stat('0.0879', 'into the vault in its first hours', ' ETH')}
        ${stat('0.001305', 'paid to the two lockers after minutes locked', ' ETH')}
      </div>
      <div class="row" style="gap:14px">
        ${stat('About a dozen', 'outside wallets (launch bots) traded it', '', 34)}
        ${stat('~24.8%', 'burned on early unlock of a minutes-old 4-hour lock', '', 44)}
      </div>
    </div>
  </div>
  <div class="col" style="gap:12px">
    <div class="lab">The test coin’s page on clasp.fun, after the test</div>
    ${shot({ src: 'coin.png', crop: [323, 603, 2210, 312], width: 1456, radius: 18, marks: [{ r: [2152, 640, 296, 252], pad: 4 }] })}
  </div>
</div>`,
})));

// 18 — Tests + verified addresses
const addr = (n, a) => `<div class="row" style="justify-content:space-between;align-items:center;padding:20px 0;border-top:1.5px solid ${C.line}">
  <span style="font-weight:600;font-size:21px">${n}</span><span class="row" style="gap:14px;align-items:center"><span class="mono" style="font-size:19px;color:${C.ink2}">${a}</span><span class="chip good" style="font-size:13px">Sourcify verified</span></span></div>`;
pages.push(P('18', wrap({
  kicker: 'Tests',
  body: `
<div class="col" style="height:100%">
  <div class="row" style="justify-content:space-between;align-items:flex-end;gap:40px">
    <h1 style="font-size:60px">Tested hard. <span class="a">Verified on-chain.</span></h1>
    <p style="font-size:18px;color:${C.ink3};max-width:420px;line-height:1.45;text-align:right">Not audited yet. Tests are not an audit.</p>
  </div>
  <div class="row" style="gap:20px;margin-top:30px">
    <div class="card" style="flex:1;padding:26px 28px"><div class="big num" style="font-size:84px">84</div><div style="font-size:19px;color:${C.ink2};margin-top:10px">unit, fuzz and invariant tests</div></div>
    <div class="card" style="flex:1;padding:26px 28px"><div class="big num" style="font-size:84px">3</div><div style="font-size:19px;color:${C.ink2};margin-top:10px">fork tests against live Robinhood Chain state</div></div>
    <div class="card" style="flex:1.6;padding:26px 28px"><div class="big num" style="font-size:84px;color:${C.accent}">30,720</div><div style="font-size:19px;color:${C.ink2};margin-top:10px">random calls per invariant campaign: 256 runs × 120 calls, across 7 actors</div></div>
  </div>
  <div class="row" style="gap:20px;margin-top:20px;flex:1">
    <div class="card" style="flex:1;padding:26px 28px;background:${C.ink};border-color:${C.ink};color:#fff;display:flex;flex-direction:column;justify-content:center">
      <div class="lab" style="color:${C.lav}">Checked after every call</div>
      <div class="mono" style="font-size:25px;margin-top:16px;line-height:1.5">ETH the vault owes<br>≤ ETH the vault holds</div>
      <div style="font-size:17px;color:#c9c6d0;margin-top:18px;line-height:1.5">Reverting receivers can’t block payouts. Reentrancy guarded.</div>
    </div>
    <div class="card" style="flex:2.2;padding:22px 28px 6px;display:flex;flex-direction:column;justify-content:center">
      <div class="lab" style="margin-bottom:8px">Robinhood Chain mainnet · source on Sourcify</div>
      ${addr('ClaspFactory', '0x82866AEAD0a590E5f9e7da74fC8c4FCAFFad60af')}
      ${addr('ClaspRouter', '0x2c2F23acbEd17827b7873Ce1Bc7430ADEB7Bf92A')}
      ${addr('ClaspLauncher', '0xE9E68B421dD2dE4F6825A9D5288D00732432A7af')}
    </div>
  </div>
</div>`,
})));

// 19 — Gas costs
const gas = [['Launch', 'coin + vault + first buy, one transaction', 0.000245, '0.000245'], ['Lock', 'lock coins in a vault', 0.0000101, '0.0000101'], ['Buy', 'through the Clasp router', 0.0000094, '0.0000094'], ['Claim', 'collect your ETH', 0.000006, '0.000004–0.000006']];
pages.push(P('19', wrap({
  kicker: 'Costs',
  body: `
<div class="row" style="height:100%;gap:56px;align-items:center">
  <div style="width:470px;flex:none">
    <h1>Gas is <span class="a">tiny.</span></h1>
    <p class="sub" style="margin-top:22px">Measured on Robinhood Chain mainnet during our end-to-end test. Gas is paid in ETH.</p>
    <p style="font-size:18px;color:${C.ink3};margin-top:20px;line-height:1.5">Buys and sells through Clasp also pay the 2% trading fee, which goes to the coin’s vault.</p>
  </div>
  <div class="card" style="flex:1;padding:14px 34px">
    ${gas.map(([n, s, v, t], i) => `<div style="padding:22px 0;${i ? `border-top:1.5px solid ${C.line}` : ''}">
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <div><span class="display" style="font-size:28px">${n}</span><span style="font-size:17px;color:${C.ink3};margin-left:14px">${s}</span></div>
        <div class="display num" style="font-size:30px">≈ ${t} <span style="font-size:20px;color:${C.ink3}">ETH</span></div>
      </div>
      <div style="margin-top:12px;height:10px;background:${C.paper2};border-radius:5px"><div style="width:${Math.max(0.8, (v / 0.000245) * 100)}%;height:100%;background:${i ? C.accent : C.ink};border-radius:5px"></div></div>
    </div>`).join('')}
    <div style="font-size:15px;color:${C.ink3};padding:4px 0 14px">Bars to scale. Claim shown at its upper bound.</div>
  </div>
</div>`,
})));

// 20 — FAQ
const qa = (q, a) => `<div class="card" style="padding:28px 30px"><div class="display" style="font-size:28px;line-height:1.2">${q}</div><p style="font-size:21px;line-height:1.5;color:${C.ink2};margin-top:12px">${a}</p></div>`;
pages.push(P('20', wrap({
  kicker: 'FAQ',
  body: `
<div class="col" style="height:100%">
  <h1 style="font-size:60px">Common questions.</h1>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:28px;flex:1">
    ${qa('Do I have to unlock to get paid?', 'No. ETH builds up continuously and you can collect it any time. Your coins stay locked.')}
    ${qa('Where does the ETH come from?', 'The coin’s Pons creator fees plus Clasp’s 2% fee on buys and sells. 90% goes to lockers.')}
    ${qa('Does the creator get a cut?', 'No. 0% to the creator. A creator earns only by locking, like everyone else.')}
    ${qa('Can I leave early?', 'Yes. Early exit burns max(5%, 25% × time left ÷ lock length) of your coins. ETH you collected stays yours.')}
    ${qa('What if nobody trades?', 'Then there is nothing to share. A coin with no trading pays its lockers nothing.')}
    ${qa('Is it audited?', 'Not yet, and Pons v2 is unaudited too. Memecoins can go to zero. Lock only what you can afford to lose.')}
  </div>
</div>`,
})));

await renderAll(pages, process.argv.slice(2));
