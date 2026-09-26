// Shared template system for Clasp X graphics.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname);
export const SHOTS = path.resolve(ROOT, '../x/shots');
const fontUrl = (f) => pathToFileURL(path.join(ROOT, 'fonts', f)).href;
export const shotUrl = (f) => pathToFileURL(path.join(SHOTS, f)).href;

export const C = {
  paper: '#fbf8f3', paper2: '#f4eee4', card: '#ffffff', ink: '#16151a', ink2: '#45424d', ink3: '#6b6773',
  line: '#e8e1d5', accent: '#3d3bf3', accentStrong: '#2a27c7', accentSoft: '#ecebff', lav: '#c7c6ff',
  good: '#11764a', goodSoft: '#e3f4ea', warn: '#7a5200', warnSoft: '#fff3d1', bad: '#b42318', badSoft: '#fdecea',
};

// Screenshot pixel sizes (2x captures)
export const SHOT_SIZE = {
  'home.png': [2880, 1800], 'coin.png': [2880, 1800], 'signin.png': [2880, 1800], 'launch.png': [2880, 1800],
  'coin-full.png': [2850, 4880], 'launch-full.png': [2850, 6480], 'security-full.png': [2850, 7522],
  'coins.png': [2880, 1800], 'm-coin.png': [1170, 2532], 'm-home.png': [1170, 2532], 'm-launch.png': [1170, 2532],
};

export const mark = (size = 40, dark = false) => `
<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M7.5 26V13a6 6 0 0 1 12 0v4" stroke="${dark ? '#ffffff' : C.ink}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M24.5 6v13a6 6 0 0 1-12 0v-4" stroke="${dark ? C.lav : C.accent}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
</svg>`;

export const CSS = `
@font-face { font-family: 'Outfit'; src: url('${fontUrl('Outfit.ttf')}'); font-weight: 100 900; }
@font-face { font-family: 'Inter'; src: url('${fontUrl('Inter.ttf')}'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: ${C.paper}; }
body { font-family: 'Inter', sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; font-feature-settings: 'cv11', 'ss01'; }
.tnum, .num { font-variant-numeric: tabular-nums; }
.frame { position: relative; overflow: hidden; background: ${C.paper}; display: flex; flex-direction: column; }
.top { display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 12px; font-family: 'Outfit'; font-weight: 600; font-size: 30px; letter-spacing: -0.02em; }
.pill { display: inline-flex; align-items: center; gap: 10px; border: 1.5px solid ${C.line}; background: #fff; border-radius: 999px; padding: 9px 18px; font-size: 18px; font-weight: 500; color: ${C.ink2}; }
.pill .dot { width: 9px; height: 9px; border-radius: 50%; background: ${C.accent}; }
.kicker { font-size: 18px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.accentStrong}; }
h1, h2, h3, .display { font-family: 'Outfit'; font-weight: 600; letter-spacing: -0.02em; }
h1 { font-size: 66px; line-height: 1.02; }
h1 .a, .a { color: ${C.accent}; }
.sub { font-size: 24px; line-height: 1.45; color: ${C.ink2}; }
.card { background: ${C.card}; border: 1.5px solid ${C.line}; border-radius: 22px; box-shadow: 0 1px 2px rgba(22,21,26,.04), 0 12px 32px -12px rgba(22,21,26,.12); }
.foot { display: flex; align-items: center; justify-content: space-between; font-size: 16px; color: ${C.ink3}; }
.foot b { color: ${C.ink2}; font-weight: 600; }
.mono { font-family: 'Consolas', 'Cascadia Mono', monospace; }
.muted { color: ${C.ink3}; }
.chip { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 15px; font-weight: 600; }
.chip.good { background: ${C.goodSoft}; color: ${C.good}; }
.chip.warn { background: ${C.warnSoft}; color: ${C.warn}; }
.chip.acc { background: ${C.accentSoft}; color: ${C.accentStrong}; }
.chip.bad { background: ${C.badSoft}; color: ${C.bad}; }
.badge { position: absolute; width: 38px; height: 38px; border-radius: 50%; background: ${C.accent}; color: #fff; font-weight: 700; font-size: 19px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px #fff, 0 6px 14px -4px rgba(61,59,243,.5); font-family: 'Inter'; }
.hl { position: absolute; border: 3px solid ${C.accent}; border-radius: 12px; background: rgba(61,59,243,0.05); }
.shot { position: relative; overflow: hidden; border-radius: 18px; border: 1.5px solid ${C.line}; background: ${C.paper}; box-shadow: 0 1px 2px rgba(22,21,26,.04), 0 18px 40px -18px rgba(22,21,26,.22); }
.shot img { position: absolute; max-width: none; }
.row { display: flex; }
.col { display: flex; flex-direction: column; }
`;

// Wrap page body into a full HTML document.
export const doc = (w, h, body, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
html,body{width:${w}px;height:${h}px;}
${extraCss}</style></head><body>${body}</body></html>`;

// Standard post frame: header strip, content, footer.
export function post({ w = 1600, h = 900, kicker = '', body, pad = 72, foot = true, footLeft }) {
  const fl = footLeft ?? 'Not audited yet. Memecoins can go to zero.';
  return doc(w, h, `
<div class="frame" style="width:${w}px;height:${h}px;padding:${pad - 20}px ${pad}px ${pad - 28}px;">
  <div class="top" style="margin-bottom:${h > 1000 ? 44 : 30}px">
    <div class="brand">${mark(38)}<span>Clasp</span></div>
    <div style="display:flex;gap:14px;align-items:center">
      ${kicker ? `<span class="kicker" style="margin-right:10px">${kicker}</span>` : ''}
      <span class="pill"><span class="dot"></span>clasp.fun</span>
    </div>
  </div>
  <div style="flex:1;min-height:0;position:relative">${body}</div>
  ${foot ? `<div class="foot" style="margin-top:22px;border-top:1.5px solid ${C.line};padding-top:16px">
    <span>${fl}</span><span><b>@ClaspFun</b> · On Robinhood Chain</span></div>` : ''}
</div>`);
}

// Annotated screenshot. crop = [x,y,w,h] in source pixels; width = display width in CSS px.
// marks: {r:[x,y,w,h] (source px), n?: label, pos?: 'tl'|'tr'|'bl'|'br'|'l'|'r', pad?: number, color?}
export function shot({ src, crop, width, marks = [], style = '', radius }) {
  const [W, H] = SHOT_SIZE[src];
  const [cx, cy, cw, ch] = crop;
  const s = width / cw;
  const height = Math.round(ch * s);
  const m = marks.map((mk) => {
    const pad = mk.pad ?? 8;
    const x = (mk.r[0] - cx) * s - pad, y = (mk.r[1] - cy) * s - pad;
    const w = mk.r[2] * s + pad * 2, h = mk.r[3] * s + pad * 2;
    const col = mk.color || C.accent;
    let b = '';
    if (mk.n != null && mk.n !== '') {
      // L/R: badge fully outside the shot (left/right of the box), vertically centred on the box top row.
      const pos = mk.pos || 'L';
      let bx, by;
      if (pos === 'L') { bx = -52; by = y + Math.min(h / 2, 30) - 19; }
      else if (pos === 'R') { bx = width + 14; by = y + Math.min(h / 2, 30) - 19; }
      else { bx = pos.includes('r') ? x + w - 19 : x - 19; by = pos.startsWith('b') ? y + h - 19 : y - 19; }
      b = `<div class="badge" style="left:${bx}px;top:${by}px;background:${col}">${mk.n}</div>`;
      if (pos === 'L') b += `<div style="position:absolute;left:-14px;top:${by + 18}px;width:${x + 14}px;height:2px;background:${col}"></div>`;
      if (pos === 'R') b += `<div style="position:absolute;left:${x + w}px;top:${by + 18}px;width:${width + 14 - x - w}px;height:2px;background:${col}"></div>`;
    }
    const box = mk.nobox ? '' : `<div class="hl" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${col};background:${col}0d"></div>`;
    return { box, b };
  });
  return `<div style="position:relative;width:${width}px;height:${height}px;flex:none;${style}">
  <div class="shot" style="width:${width}px;height:${height}px;${radius != null ? `border-radius:${radius}px;` : ''}">
  <img src="${shotUrl(src)}" style="left:${-cx * s}px;top:${-cy * s}px;width:${W * s}px;height:${H * s}px">
  ${m.map((q) => q.box).join('')}</div>
  ${m.map((q) => q.b).join('')}</div>`;
}

// ---------- math from the brief ----------
export const HOUR = 1, DAY = 24, YEAR = 8760;
export const durMult = (h) => 1 + 3 * Math.sqrt(Math.max(0, h - 4) / (YEAR - 4));
export const burnPct = (elapsedFrac) => Math.max(5, 25 * (1 - elapsedFrac));
export const MULT_POINTS = [
  ['4 hours', 4, '1.000'], ['1 day', 24, '1.143'], ['1 week', 168, '1.411'], ['30 days', 720, '1.858'],
  ['90 days', 2160, '2.489'], ['180 days', 4320, '3.106'], ['1 year', 8760, '4.000'],
];

// ---------- charts ----------
// Duration multiplier curve (linear time axis in days).
export function multChart({ w = 900, h = 520, labels = "all", fs = 17, overlay }) {
  const L = 74, R = 36, T = 28, B = 62;
  const pw = w - L - R, ph = h - T - B;
  const X = (hours) => L + (hours / YEAR) * pw;
  const Y = (m) => T + ph - ((m - 0.5) / (4.3 - 0.5)) * ph;
  let d = '';
  for (let i = 0; i <= 400; i++) {
    const hh = 4 + ((YEAR - 4) * i) / 400;
    d += `${i ? 'L' : 'M'}${X(hh).toFixed(2)},${Y(durMult(hh)).toFixed(2)}`;
  }
  const area = `${d}L${X(YEAR)},${Y(0.5)}L${X(4)},${Y(0.5)}Z`;
  const grid = [1, 2, 3, 4].map((v) => `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}" stroke-width="1.5"/>
    <text x="${L - 14}" y="${Y(v) + 6}" text-anchor="end" font-size="${fs}" fill="${C.ink3}" class="num">${v}.0×</text>`).join('');
  const xt = [[0, '0'], [30, '30d'], [90, '90d'], [180, '180d'], [270, '270d'], [365, '1 year']].map(([dd, t]) =>
    `<line x1="${X(dd * 24)}" x2="${X(dd * 24)}" y1="${Y(0.5)}" y2="${Y(0.5) + 8}" stroke="${C.ink3}" stroke-width="1.5"/>
     <text x="${X(dd * 24)}" y="${Y(0.5) + 32}" text-anchor="middle" font-size="${fs}" fill="${C.ink3}">${t}</text>`).join('');
  // label placements [dx, dy, anchor]: below-right of the point, inside the filled area
  const place = {
    '4 hours': [16, 34, 'start'], '1 day': [16, 8, 'start'], '1 week': [16, -16, 'start'],
    '30 days': [16, 34, 'start'], '90 days': [14, 36, 'start'], '180 days': [14, 36, 'start'], '1 year': [-18, -18, 'end'],
  };
  const pts = MULT_POINTS.map(([n, hh, v]) => {
    const x = X(hh), y = Y(Number(v));
    const small = hh <= 168;
    const [dx, dy, an] = place[n];
    const showLabel = labels === 'all' || !small;
    const lab = showLabel ? `<text x="${x + dx}" y="${y + dy}" text-anchor="${an}" font-size="${fs + 1}" fill="${C.ink}" font-weight="600" class="num">${v}×<tspan fill="${C.ink3}" font-weight="500"> ${n}</tspan></text>` : '';
    return `<circle cx="${x}" cy="${y}" r="${small ? 5.5 : 7}" fill="#fff" stroke="${C.accent}" stroke-width="3"/>${lab}`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="font-family:Inter">
  ${grid}
  <path d="${area}" fill="${C.accentSoft}" opacity=".7"/>
  <path d="${d}" fill="none" stroke="${C.accent}" stroke-width="4" stroke-linecap="round"/>
  <line x1="${L}" x2="${w - R}" y1="${Y(0.5)}" y2="${Y(0.5)}" stroke="${C.ink3}" stroke-width="1.5"/>
  ${xt}${pts}${overlay ? overlay({ X, Y, L, T, pw, ph }) : ""}</svg>`;
}

// Early-exit burn curve vs % of lock elapsed.
export function burnChart({ w = 900, h = 520, fs = 17, live = true, example = true }) {
  const L = 70, R = 40, T = 30, B = 64;
  const pw = w - L - R, ph = h - T - B;
  const X = (f) => L + f * pw;
  const Y = (p) => T + ph - (p / 30) * ph;
  const d = `M${X(0)},${Y(25)}L${X(0.8)},${Y(5)}L${X(1)},${Y(5)}`;
  const area = `${d}L${X(1)},${Y(0)}L${X(0)},${Y(0)}Z`;
  const grid = [0, 5, 10, 15, 20, 25].map((v) => `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}" stroke-width="1.5"/>
    <text x="${L - 14}" y="${Y(v) + 6}" text-anchor="end" font-size="${fs}" fill="${C.ink3}" class="num">${v}%</text>`).join('');
  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${X(f)}" y="${Y(0) + 34}" text-anchor="middle" font-size="${fs}" fill="${C.ink3}" class="num">${f * 100}%</text>`).join('');
  const dot = (f, p, lab, dx, dy, an = 'start', col = C.accent) => `<circle cx="${X(f)}" cy="${Y(p)}" r="7" fill="#fff" stroke="${col}" stroke-width="3"/>
    <text x="${X(f) + dx}" y="${Y(p) + dy}" text-anchor="${an}" font-size="${fs + 1}" font-weight="600" fill="${C.ink}" class="num">${lab}</text>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="font-family:Inter">
  ${grid}
  <rect x="${X(0.8)}" y="${T}" width="${X(1) - X(0.8)}" height="${ph}" fill="${C.paper2}" opacity=".8"/>
  <text x="${(X(0.8) + X(1)) / 2}" y="${T + 26}" text-anchor="middle" font-size="${fs - 1}" fill="${C.ink3}" font-weight="600">5% floor</text>
  <path d="${area}" fill="${C.badSoft}" opacity=".9"/>
  <path d="${d}" fill="none" stroke="${C.bad}" stroke-width="4" stroke-linejoin="round"/>
  <line x1="${L}" x2="${w - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.ink3}" stroke-width="1.5"/>
  ${xt}
  <text x="${L + pw / 2}" y="${h - 6}" text-anchor="middle" font-size="${fs}" fill="${C.ink2}" font-weight="500">Share of the lock already served</text>
  ${dot(0, 25, '25% at the start', 16, -14)}
  ${example ? dot(0.25, 18.75, '18.75% at 25% served', 14, -14) : ''}
  ${dot(0.5, 12.5, '12.5% halfway', 14, -14)}
  ${dot(0.8, 5, '5% from 80% served', 0, 36, 'middle')}
  </svg>`;
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
