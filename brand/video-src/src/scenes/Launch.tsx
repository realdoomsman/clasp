import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT_BODY, display } from "../theme";
import { bez, durationMult, easeIn, easeOut, inOut, lerp, pop, ramp, sp, YEAR_H } from "../lib/anim";
import { beat, Scene } from "../timeline";
import { Card, Chip, Mark, Rise, Tick, Words } from "../components/Base";
import { FlowDiagram } from "../components/Flow";
import { BurnChart, CoinBar } from "../components/Charts";
import { Browser, Page } from "../components/Browser";
import { EndCard } from "../components/EndCard";
import rects from "../../public/ui/rects.json";

type P = { s: Scene };

const R = rects as Record<string, Record<string, { x: number; y: number; w: number; h: number }>>;
const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Fades a whole scene out over its last frames. */
export const SceneOut: React.FC<{ dur: number; children: React.ReactNode; hold?: boolean }> = ({ dur, children, hold }) => {
  const f = useCurrentFrame();
  const o = hold ? 0 : ramp(f, dur - 9, dur - 1, easeIn);
  return <div style={{ position: "absolute", inset: 0, opacity: 1 - o, transform: `translateY(${-o * 14}px)` }}>{children}</div>;
};

// ---------------------------------------------------------------- 1. Cold open
const TAPE = ["Buy", "Sell", "Buy", "Buy", "Sell", "Buy", "Sell", "Sell", "Buy", "Buy", "Sell", "Buy", "Buy", "Sell"];

export const Cold: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const tape = beat(s, "tape");
  const fee = beat(s, "fee");
  const wallet = beat(s, "wallet");
  const holders = beat(s, "holders");
  const gateX = 1010;
  const laneY = 540;
  const speed = 12;
  const spacing = 11;
  const t0 = tape - 80;
  const travel = (gateX - 40 + 180) / speed;
  const kMax = Math.floor((f - t0) / spacing);
  const kMin = Math.max(0, Math.ceil((f - t0 - travel) / spacing));
  const ks: number[] = [];
  for (let k = kMin; k <= kMax; k++) ks.push(k);
  const walletT = pop(f, fee + 2);
  const walletLabel = sp(f, wallet);
  const W0 = [1410, laneY - 30];
  const flightPath = [[gateX + 38, laneY], [gateX + 220, laneY], [W0[0] - 180, W0[1]], [W0[0], W0[1]]];
  const holderTones = ["#e6dfd2", C.lavender, "#d8eadf", "#f3d9d5", "#e9e3f8", "#efe3c8", "#dcd7ea"];
  return (
    <SceneOut dur={s.dur}>
      <div style={{ position: "absolute", left: 140, top: 168, ...display(96) }}>
        <Words text="Every memecoin trade pays a fee." at={beat(s, "headline")} accentWords={["fee."]} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: laneY - 1,
          width: gateX,
          height: 2,
          background: `linear-gradient(90deg, rgba(232,225,213,0), ${C.line} 20%)`,
          opacity: ramp(f, tape - 6, tape + 10),
        }}
      />
      {ks.map((k) => {
        const kind = TAPE[k % TAPE.length];
        const x = -180 + (f - (t0 + k * spacing)) * speed;
        const fadeIn = ramp(f, tape - 4, tape + 12);
        const nearGate = 1 - ramp(x, gateX - 150, gateX - 40, (v) => v);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: x,
              top: laneY - 30,
              padding: "12px 26px",
              borderRadius: 999,
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 28,
              background: kind === "Buy" ? C.goodSoft : C.badSoft,
              color: kind === "Buy" ? C.good : C.bad,
              border: `1px solid ${kind === "Buy" ? "#bfe3cc" : "#f5c9c3"}`,
              opacity: fadeIn * nearGate,
            }}
          >
            {kind}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: gateX - 34, top: laneY - 60, opacity: ramp(f, fee - 8, fee + 6), transform: `scale(${0.8 + 0.2 * pop(f, fee - 8)})` }}>
        <div style={{ width: 68, height: 120, borderRadius: 34, border: `3px solid ${C.ink}`, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 20, letterSpacing: "0.1em", color: C.ink, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>FEE</span>
        </div>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path
          d={`M${flightPath[0].join(",")} C${flightPath[1].join(",")} ${flightPath[2].join(",")} ${flightPath[3].join(",")}`}
          stroke={C.line}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          opacity={ramp(f, fee, fee + 12)}
        />
        {ks.concat([kMin - 1, kMin - 2, kMin - 3]).map((k) => {
          if (k < 0) return null;
          const reach = t0 + k * spacing + travel;
          if (reach < fee) return null;
          const p = ramp(f, reach, reach + 24, inOut);
          if (f < reach || p >= 1) return null;
          const [x, y] = bez(flightPath[0], flightPath[1], flightPath[2], flightPath[3], p);
          return <circle key={k} cx={x} cy={y} r={10} fill={C.accent} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: W0[0], top: W0[1] - 126, width: 380, height: 252, opacity: Math.min(1, walletT * 1.5), transform: `scale(${0.9 + 0.1 * walletT})` }}>
        <Card style={{ width: "100%", height: "100%", padding: "34px 38px", boxSizing: "border-box" }}>
          <svg width={60} height={50} viewBox="0 0 54 46">
            <rect x={2} y={8} width={50} height={36} rx={9} fill="none" stroke={C.ink} strokeWidth={3} />
            <path d="M8 8 L38 2 L42 8" fill="none" stroke={C.ink} strokeWidth={3} strokeLinejoin="round" />
            <rect x={34} y={21} width={18} height={11} rx={5} fill={C.accent} />
          </svg>
          <div style={{ ...display(52), marginTop: 18, opacity: walletLabel, transform: `translateY(${(1 - walletLabel) * 10}px)` }}>One wallet</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: C.ink3, marginTop: 6, opacity: walletLabel }}>keeps every fee</div>
        </Card>
      </div>

      <div style={{ position: "absolute", left: 140, top: 690, display: "flex", alignItems: "center", gap: 30 }}>
        <div style={{ display: "flex" }}>
          {holderTones.map((tone, i) => {
            const t = pop(f, holders - 8 + i * 2);
            return (
              <div
                key={i}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  marginLeft: i ? -16 : 0,
                  background: tone,
                  border: `4px solid ${C.paper}`,
                  boxShadow: `0 0 0 1.5px ${C.line}`,
                  opacity: Math.min(1, t * 1.4),
                  transform: `scale(${0.6 + 0.4 * t})`,
                }}
              />
            );
          })}
        </div>
        <div style={{ opacity: sp(f, holders + 4), transform: `translateX(${(1 - sp(f, holders + 4)) * -14}px)` }}>
          <div style={{ ...display(46) }}>Holders</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 28, color: C.ink3, marginTop: 4 }}>
            earn <b style={{ color: C.bad }}>nothing</b> from the volume they create
          </div>
        </div>
      </div>
    </SceneOut>
  );
};

// ---------------------------------------------------------------- 2. Reveal
export const Reveal: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const mark = beat(s, "mark");
  const word = beat(s, "word");
  const draw = ramp(f, mark, mark + 34, inOut);
  const slide = sp(f, word, 120, 20);
  const wordT = sp(f, word + 3, 140, 22);
  const tag2 = beat(s, "tag2");
  const subT = sp(f, tag2 + 24);
  return (
    <SceneOut dur={s.dur}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 190, height: 220, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ transform: `translateX(${-176 * slide}px) scale(${lerp(1.25, 1, slide)})` }}>
          <Mark size={190} draw={draw} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 960 - 176 + 95 + 30,
            top: 26,
            ...display(170),
            clipPath: `inset(-20% ${(1 - wordT) * 100}% -20% 0)`,
            transform: `translateX(${(1 - wordT) * -30}px)`,
          }}
        >
          Clasp
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, textAlign: "center", ...display(80), lineHeight: 1.1 }}>
        <Words text="Lock a coin you believe in." at={beat(s, "tag1")} />
        <br />
        <Words text="Earn a share of every trade." at={tag2} color={C.accent} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 736,
          textAlign: "center",
          fontFamily: FONT_BODY,
          fontSize: 30,
          color: C.ink2,
          opacity: subT,
          transform: `translateY(${(1 - subT) * 12}px)`,
        }}
      >
        Trading fees paid in ETH to the people who lock. On Robinhood Chain.
      </div>
    </SceneOut>
  );
};

// ---------------------------------------------------------------- 3. How it works
export const How: React.FC<P> = ({ s }) => (
  <SceneOut dur={s.dur}>
    <FlowDiagram
      b={{
        vault: beat(s, "vault"),
        srcA: beat(s, "srcA"),
        srcB: beat(s, "srcB"),
        out90: beat(s, "out90"),
        out10: beat(s, "out10"),
        out0: beat(s, "out0"),
      }}
      dy={-10}
    />
  </SceneOut>
);

// ---------------------------------------------------------------- 4. Lock mechanics
const CHIPS: [string, number][] = [
  ["4h", 4],
  ["1d", 24],
  ["1w", 168],
  ["1m", 720],
  ["3m", 2160],
  ["6m", 4320],
  ["1y", 8760],
];

const Panel: React.FC<{ at: number; out: number; children: React.ReactNode }> = ({ at, out, children }) => {
  const f = useCurrentFrame();
  const t = sp(f, at, 150, 24);
  const o = ramp(f, out - 8, out + 2, easeIn);
  if (f < at - 2 || f > out + 3) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: Math.min(1, t * 1.4) * (1 - o),
        transform: `translateY(${(1 - t) * 40 - o * 30}px)`,
      }}
    >
      {children}
    </div>
  );
};

const Heading: React.FC<{ at: number; out: number; title: string; sub: string; accent?: string[] }> = ({ at, out, title, sub, accent }) => {
  const f = useCurrentFrame();
  if (f < at - 2 || f > out + 12) return null;
  const subT = sp(f, at + 8);
  const o = ramp(f, out - 8, out + 2, easeIn);
  return (
    <div style={{ position: "absolute", left: 140, top: 300, width: 640, opacity: 1 - o }}>
      <div style={{ ...display(80), lineHeight: 1.06 }}>
        <Words text={title} at={at} accentWords={accent} />
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 32, lineHeight: 1.4, color: C.ink2, marginTop: 28, opacity: subT, transform: `translateY(${(1 - subT) * 12}px)` }}>
        {sub}
      </div>
    </div>
  );
};

export const Lock: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const sweep = beat(s, "sweep");
  const sweepEnd = beat(s, "sweepEnd");
  const size = beat(s, "size");
  const p3 = beat(s, "p3");
  const collect = beat(s, "collect");
  const p4 = beat(s, "p4");
  const T = ramp(f, sweep, sweepEnd, inOut);
  // Sweep in sqrt space so the curve's early steps are visible, like the site's slider.
  const hours = 4 + (YEAR_H - 4) * T * T;
  const m = durationMult(hours);
  const chipIdx = CHIPS.reduce((acc, [, h], i) => (hours >= h - 0.5 ? i : acc), 0);
  const days = hours / 24;
  const lenLabel = hours < 24 ? `${Math.round(hours)} hours` : days >= 364.5 ? "1 year" : `${Math.round(days)} days`;
  const panelBox: React.CSSProperties = { position: "absolute", left: 880, top: 196, width: 900, height: 600 };
  const tiers: [string, string][] = [
    ["0.1% of supply", "+10%"],
    ["0.5% of supply", "+25%"],
    ["1% of supply", "+50%"],
  ];
  // Collect panel: earned ETH bar builds, then empties into the wallet on click.
  const fill = Math.min(1, ramp(f, p3 - 4, collect, (v) => v) * 0.82 + 0.12);
  const drained = ramp(f, collect + 2, collect + 16, inOut);
  return (
    <SceneOut dur={s.dur}>
      <Heading at={beat(s, "p1")} out={p3} title="4 hours to 1 year." sub="The longer the lock, the bigger your time boost: 1.000× up to 4.000×." accent={["year."]} />
      <Heading at={p3} out={p4} title="Collect anytime." sub="Your ETH builds up as trades come in. No need to unlock." accent={["anytime."]} />
      <Heading at={p4} out={s.dur + 20} title="Leaving early costs coins." sub="The burn starts at 25% and shrinks to a 5% floor near the end." accent={["costs"]} />

      <div style={panelBox}>
        <Panel at={beat(s, "p1") + 4} out={p3}>
          <Card style={{ position: "absolute", inset: 0, padding: "44px 52px", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 28, color: C.ink }}>Lock for</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 28, color: C.ink2, fontVariantNumeric: "tabular-nums" }}>{lenLabel}</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              {CHIPS.map(([k], i) => (
                <div
                  key={k}
                  style={{
                    padding: "12px 0",
                    width: 104,
                    textAlign: "center",
                    borderRadius: 14,
                    fontFamily: FONT_BODY,
                    fontWeight: 600,
                    fontSize: 26,
                    background: i === chipIdx ? C.accent : C.paper2,
                    color: i === chipIdx ? "#fff" : C.ink2,
                  }}
                >
                  {k}
                </div>
              ))}
            </div>
            <div style={{ position: "relative", height: 16, borderRadius: 8, background: "#ebe4d8", marginTop: 34 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${T * 100}%`, background: C.accent, borderRadius: 8 }} />
              <div
                style={{
                  position: "absolute",
                  left: `calc(${T * 100}% - 18px)`,
                  top: -10,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: "#fff",
                  border: `5px solid ${C.accent}`,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 44 }}>
              <div style={{ flex: 1, background: C.accentSoft, borderRadius: 20, padding: "22px 28px" }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 24, color: C.ink2 }}>Time boost</div>
                <div style={{ ...display(84), color: C.accent, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{m.toFixed(3)}×</div>
              </div>
              <div style={{ flex: 1, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 20, padding: "22px 28px", opacity: sp(f, size), transform: `translateY(${(1 - sp(f, size)) * 16}px)` }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 24, color: C.ink2 }}>Size bonus, one lock</div>
                {tiers.map(([a, b], i) => (
                  <div
                    key={a}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: FONT_BODY,
                      fontSize: 24,
                      marginTop: 8,
                      opacity: sp(f, size + 4 + i * 5),
                    }}
                  >
                    <span style={{ color: C.ink2 }}>from {a}</span>
                    <b style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>{b}</b>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Panel>

        <Panel at={p3 + 2} out={p4}>
          <Card style={{ position: "absolute", inset: 0, padding: "48px 56px", boxSizing: "border-box" }}>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 28, color: C.ink }}>Your ETH</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 24, color: C.ink3, marginTop: 6 }}>Builds up continuously while you stay locked</div>
            <div style={{ height: 40, borderRadius: 20, background: C.paper2, marginTop: 36, overflow: "hidden" }}>
              <div style={{ width: `${fill * (1 - drained) * 100}%`, height: "100%", borderRadius: 20, background: C.accent }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 48 }}>
              <div
                style={{
                  padding: "20px 44px",
                  borderRadius: 18,
                  background: C.accent,
                  color: "#fff",
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 30,
                  transform: `scale(${1 - 0.05 * (f >= collect && f < collect + 6 ? 1 : 0)})`,
                  boxShadow: "0 14px 30px -14px rgba(61,59,243,0.7)",
                }}
              >
                Collect
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: ramp(f, collect + 10, collect + 20) }}>
                <Tick size={40} draw={ramp(f, collect + 10, collect + 24)} />
                <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 28, color: C.good }}>Sent to your wallet</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 56 }}>
              <Chip tone="accent">Coins stay locked</Chip>
              <Chip>Collect as often as you like</Chip>
            </div>
          </Card>
        </Panel>

        <Panel at={p4 + 2} out={s.dur + 20}>
          <Card style={{ position: "absolute", inset: 0, padding: "40px 56px", boxSizing: "border-box" }}>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 26, color: C.ink }}>Burn if you unlock early</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 22, color: C.ink3, marginTop: 4 }}>max(5%, 25% × time left ÷ lock length)</div>
            <BurnChart x={96} y={150} w={700} h={290} at={p4 + 4} playFrom={beat(s, "burnGo")} playTo={beat(s, "burnEnd") + 8} />
            <CoinBar x={56} y={505} w={788} at={p4 + 10} playFrom={beat(s, "burnGo")} playTo={beat(s, "burnEnd") + 8} />
          </Card>
        </Panel>
      </div>
    </SceneOut>
  );
};

// ---------------------------------------------------------------- 5. UI demo
export const UI: React.FC<P> = ({ s }) => {
  const b = (n: string) => beat(s, n);
  const coin = R.coin;
  const si = R.signin;
  const la = R.launch;
  const c1w = center(coin.chip1w);
  const c1y = center(coin.chip1y);
  const pages: Page[] = [
    {
      src: "ui/home.png",
      cssW: 1440,
      cssH: 900,
      url: "clasp.fun",
      from: 0,
      to: b("coin"),
      cam: [
        { f: 0, cx: 720, cy: 430, z: 1.0 },
        { f: b("coin"), cx: 640, cy: 400, z: 1.1 },
      ],
      highlights: [{ rect: R.home.h1, from: b("home") + 18, to: b("coin") - 2, pad: 18, dim: 0.12 }],
    },
    {
      src: "ui/coin.png",
      cssW: 1440,
      cssH: 2440,
      url: "clasp.fun/coins/0x1fFB…E173",
      from: b("coin"),
      to: b("signin"),
      cam: [
        { f: b("coin"), cx: 720, cy: 360, z: 1.0 },
        { f: b("toLock"), cx: 720, cy: 380, z: 1.0 },
        { f: b("toLock") + 20, cx: 470, cy: 842, z: 1.55 },
        { f: b("trade"), cx: 470, cy: 842, z: 1.55 },
        { f: b("trade") + 20, cx: 1000, cy: 800, z: 1.5 },
      ],
      overlays: [{ src: "ui/lock-0-1w.png", rect: R.coin.lockClip, from: b("c1w") + 2, to: b("c1y") + 2 }],
      highlights: [
        { rect: coin.paidCell, from: b("coin") + 12, to: b("toLock") - 2, pad: 12, dim: 0.12 },
        { rect: coin.boost, from: b("c1y") + 8, to: b("trade") - 2, pad: 8, dim: 0.18, label: "1 year = 4× time boost", labelSide: "right" },
        { rect: coin.tradeNote, from: b("trade") + 18, to: b("signin") + 6, pad: 12, dim: 0.18 },
      ],
    },
    {
      src: "ui/signin.png",
      cssW: 1440,
      cssH: 900,
      url: "clasp.fun",
      from: b("signin"),
      to: b("launch"),
      cam: [
        { f: b("signin"), cx: 720, cy: 450, z: 1.05 },
        { f: b("signin") + 22, cx: 720, cy: 452, z: 1.42 },
      ],
      highlights: [
        { rect: { x: 537, y: 429, w: 366, h: 207 }, from: b("wallet"), to: b("google") - 2, pad: 10, dim: 0.2, label: "Clasp never sees your keys", labelSide: "right" },
        {
          rect: { x: si.google.x, y: si.google.y, w: si.google.w, h: 97 },
          from: b("google"),
          to: b("launch") - 2,
          pad: 10,
          dim: 0.2,
          tone: "warn",
          label: "Custodial: Clasp holds the key",
          labelAt: b("custodial"),
          labelSide: "right",
        },
      ],
    },
    {
      src: "ui/launch.png",
      cssW: 1440,
      cssH: 3240,
      url: "clasp.fun/launch",
      from: b("launch"),
      to: s.dur + 20,
      cam: [
        { f: b("launch"), cx: 720, cy: 330, z: 1.1 },
        { f: b("scroll"), cx: 720, cy: 360, z: 1.1 },
        { f: b("scroll") + 26, cx: 720, cy: 1296, z: 1.2 },
      ],
      highlights: [
        { rect: la.firstBuyBox, from: b("scroll") + 22, to: s.dur + 20, pad: 10, dim: 0.16, label: "Coin, vault, first buy and lock: one transaction", labelSide: "top" },
      ],
    },
  ];
  const cursor = [
    { f: b("coin") + 6, x: 900, y: 560, o: 0 },
    { f: b("toLock") + 4, x: 700, y: 700, o: 1 },
    { f: b("c1w") - 2, x: c1w.x + 4, y: c1w.y + 6, o: 1 },
    { f: b("c1y") - 2, x: c1y.x + 4, y: c1y.y + 6, o: 1 },
    { f: b("trade") + 4, x: c1y.x + 60, y: c1y.y + 40, o: 1 },
    { f: b("trade") + 22, x: 1164, y: 640, o: 1 },
    { f: b("signin") - 4, x: 1164, y: 640, o: 0 },
    { f: b("signin") + 6, x: 820, y: 560, o: 0 },
    { f: b("signin") + 16, x: 800, y: 540, o: 1 },
    { f: b("google") - 2, x: 760, y: 342, o: 1 },
    { f: b("launch") - 4, x: 760, y: 342, o: 0 },
  ];
  return (
    <SceneOut dur={s.dur}>
      <Browser
        x={160}
        y={132}
        w={1600}
        h={760}
        enter={0}
        pages={pages}
        cursor={cursor}
        clicks={[b("c1w"), b("c1y")]}
        badge={{ text: "Real site · test coin, not an investment", from: b("coin") + 6, to: b("signin") }}
      />
    </SceneOut>
  );
};

// ---------------------------------------------------------------- 6. Proof
export const Proof: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const test = beat(s, "test");
  const count = beat(s, "count");
  const countEnd = beat(s, "countEnd");
  const eth = 0.0879 * ramp(f, count, countEnd, easeOut);
  const partA = 1 - ramp(f, test - 8, test + 4, easeIn);
  const cards: [string, string][] = [
    ["Immutable", "No proxies, no upgrade key, no admin path to locked coins or earned ETH."],
    ["Verified", "Source verified on Sourcify. Factory 0x8286…60af, router 0x2c2F…f92A."],
    ["Tested", "84 unit, fuzz and invariant tests, plus 3 fork tests against live chain state."],
  ];
  const liveT = sp(f, beat(s, "live"));
  const pulse = 0.5 + 0.5 * Math.sin(f / 5);
  const keeperRows: [string, string, number][] = [
    ["harvest()", "pulled the creator fees into the vault", beat(s, "harvest")],
    ["Treasury share", "sent the 10% to the treasury", beat(s, "treasury")],
  ];
  return (
    <SceneOut dur={s.dur}>
      {f < test + 6 ? (
        <div style={{ position: "absolute", inset: 0, opacity: partA, transform: `translateY(${(1 - partA) * -30}px)` }}>
          <div style={{ position: "absolute", left: 140, top: 190, display: "flex", alignItems: "center", gap: 24, opacity: liveT }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: C.good, boxShadow: `0 0 0 ${6 + 8 * pulse}px rgba(17,118,74,${0.18 - 0.1 * pulse})` }} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 26, color: C.good }}>Mainnet · chain 4663</span>
          </div>
          <div style={{ position: "absolute", left: 140, top: 250, ...display(92) }}>
            <Words text="Live on Robinhood Chain." at={beat(s, "live") - 4} accentWords={["Robinhood", "Chain."]} />
          </div>
          <div style={{ position: "absolute", left: 140, right: 140, top: 450, display: "flex", gap: 28 }}>
            {cards.map(([t, d], i) => (
              <Rise key={t} at={beat(s, "cards") + i * 7} style={{ flex: 1 }}>
                <Card style={{ padding: "34px 36px", height: 280, boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Tick size={40} draw={ramp(f, beat(s, "cards") + i * 7 + 6, beat(s, "cards") + i * 7 + 20)} />
                    <span style={{ ...display(44) }}>{t}</span>
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 27, lineHeight: 1.42, color: C.ink2, marginTop: 20 }}>{d}</div>
                </Card>
              </Rise>
            ))}
          </div>
        </div>
      ) : null}

      {f >= test - 4 ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <Rise at={test} style={{ position: "absolute", left: 140, top: 176 }}>
            <Chip tone="warn">Our own end-to-end test · 2026-09-25</Chip>
          </Rise>
          <div style={{ position: "absolute", left: 140, top: 250, ...display(76) }}>
            <Words text="A throwaway test coin, on mainnet." at={test + 2} />
          </div>
          <Rise at={test + 8} style={{ position: "absolute", left: 140, top: 390, width: 760 }}>
            <Card style={{ padding: "40px 46px", height: 420, boxSizing: "border-box" }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: C.ink2 }}>Into the test vault, first hours</div>
              <div style={{ ...display(128), color: C.accent, fontVariantNumeric: "tabular-nums", marginTop: 12 }}>
                {eth.toFixed(4)}
                <span style={{ ...display(60), color: C.ink, marginLeft: 16 }}>ETH</span>
              </div>
              <div style={{ height: 1, background: C.line, margin: "26px 0" }} />
              <div style={{ fontFamily: FONT_BODY, fontSize: 25, lineHeight: 1.45, color: C.ink2, opacity: sp(f, beat(s, "bots")) }}>
                Mostly Pons launch-window tax paid by about a dozen bot wallets. <b style={{ color: C.ink }}>0.001305 ETH</b> reached the two lockers within minutes.
              </div>
            </Card>
          </Rise>
          <div style={{ position: "absolute", left: 950, top: 390, width: 830 }}>
            <Rise at={beat(s, "keeper") - 4}>
              <Card style={{ padding: "40px 46px", height: 420, boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 16, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Mark size={34} dark="#fff" accent={C.lavender} />
                  </div>
                  <div>
                    <div style={{ ...display(40) }}>Keeper bot, on its own</div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 22, color: C.ink3 }}>Permissionless chores. Spends only its own gas.</div>
                  </div>
                </div>
                {keeperRows.map(([t, d, at]) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 34, opacity: sp(f, at), transform: `translateX(${(1 - sp(f, at)) * 20}px)` }}>
                    <Tick size={44} draw={ramp(f, at + 4, at + 18)} />
                    <div>
                      <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 28, color: C.ink }}>{t}</div>
                      <div style={{ fontFamily: FONT_BODY, fontSize: 23, color: C.ink3 }}>{d}</div>
                    </div>
                  </div>
                ))}
                <div style={{ fontFamily: FONT_BODY, fontSize: 22, color: C.ink3, marginTop: 30, opacity: sp(f, beat(s, "treasury") + 16) }}>
                  $CLTEST was a test coin, not an investment.
                </div>
              </Card>
            </Rise>
          </div>
        </div>
      ) : null}
    </SceneOut>
  );
};

// ---------------------------------------------------------------- 7. Honest line
export const Honest: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const title = beat(s, "title");
  const items = beat(s, "items");
  const list = ["Pons v2 is unaudited too", "A coin with no trading pays nothing", "Google sign-in is custodial"];
  const cardT = sp(f, title - 4);
  return (
    <SceneOut dur={s.dur}>
      <div
        style={{
          position: "absolute",
          left: 240,
          right: 240,
          top: 250,
          borderRadius: 32,
          background: C.warnSoft,
          border: "1px solid #f1dfa8",
          opacity: Math.min(1, cardT * 1.4),
          transform: `translateY(${(1 - cardT) * 30}px)`,
          padding: "64px 80px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 24, letterSpacing: "0.08em", color: C.warn, textTransform: "uppercase" }}>Plainly</div>
        <div style={{ ...display(84), marginTop: 18, lineHeight: 1.08 }}>
          <Words text="Not audited yet." at={title} />
          <br />
          <Words text="Memecoins can go to zero." at={items - 2} />
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 44, flexWrap: "wrap" }}>
          {list.map((t, i) => (
            <Rise key={t} at={items + 10 + i * 6} dy={14}>
              <span
                style={{
                  display: "inline-block",
                  padding: "12px 22px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid #f1dfa8",
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 26,
                  color: C.warn,
                }}
              >
                {t}
              </span>
            </Rise>
          ))}
        </div>
      </div>
    </SceneOut>
  );
};

// ---------------------------------------------------------------- 8. End card
export const End: React.FC<P> = ({ s }) => (
  <SceneOut dur={s.dur} hold>
    <EndCard at={beat(s, "card")} />
  </SceneOut>
);

export const LAUNCH_SCENES: Record<string, React.FC<P>> = { cold: Cold, reveal: Reveal, how: How, lock: Lock, ui: UI, proof: Proof, honest: Honest, end: End };

export const LAUNCH_LABELS: Record<string, [string, string] | null> = {
  cold: null,
  reveal: null,
  how: ["01", "How the money flows"],
  lock: ["02", "Locking"],
  ui: ["03", "clasp.fun"],
  proof: ["04", "Proof"],
  honest: ["05", "Risks"],
  end: null,
};
