import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT_BODY, display } from "../theme";
import { durationMult, easeIn, easeOut, ramp, sp } from "../lib/anim";
import { beat, Scene } from "../timeline";
import { Card, Chip, Rise, Tick, Words } from "../components/Base";
import { FlowDiagram } from "../components/Flow";
import { BurnChart, LockCurve, MultTable } from "../components/Charts";
import { Browser, Page } from "../components/Browser";
import { EndCard } from "../components/EndCard";
import { SceneOut } from "./Launch";
import rects from "../../public/ui/rects.json";

type P = { s: Scene };
const R = rects as Record<string, Record<string, { x: number; y: number; w: number; h: number }>>;

const ClipEnd: React.FC<P> = ({ s }) => (
  <SceneOut dur={s.dur} hold>
    <EndCard at={2} compact />
  </SceneOut>
);

/** Phase wrapper: rises in at `at`, lifts out at `out`. */
const Phase: React.FC<{ at: number; out?: number; children: React.ReactNode }> = ({ at, out, children }) => {
  const f = useCurrentFrame();
  if (f < at - 2 || (out !== undefined && f > out + 12)) return null;
  const t = sp(f, at, 140, 24);
  const o = out === undefined ? 0 : ramp(f, out - 6, out + 8, easeIn);
  return <div style={{ position: "absolute", inset: 0, opacity: Math.min(1, t * 1.4) * (1 - o), transform: `translateY(${(1 - t) * 30 - o * 26}px)` }}>{children}</div>;
};

// ---------------------------------------------------------------- Money flow
const Flow: React.FC<P> = ({ s }) => (
  <SceneOut dur={s.dur}>
    <div style={{ position: "absolute", left: 140, top: 150, ...display(62) }}>
      <Words text="Where does the ETH come from?" at={beat(s, "title")} accentWords={["ETH"]} />
    </div>
    <FlowDiagram
      detailed
      dy={46}
      scale={0.94}
      b={{
        vault: beat(s, "vault"),
        srcA: beat(s, "srcA"),
        srcB: beat(s, "srcB"),
        out90: beat(s, "out90"),
        out10: beat(s, "out10"),
        out0: beat(s, "out0"),
      }}
    />
  </SceneOut>
);

// ---------------------------------------------------------------- Lock weight
const Token: React.FC<{ at: number; title: string; sub: string; tone: "ink" | "accent" | "soft" }> = ({ at, title, sub, tone }) => {
  const f = useCurrentFrame();
  const t = sp(f, at, 170, 20);
  const bg = tone === "ink" ? C.ink : tone === "accent" ? C.accent : C.accentSoft;
  const fg = tone === "soft" ? C.accentStrong : "#fff";
  return (
    <div
      style={{
        padding: "26px 34px",
        borderRadius: 24,
        background: bg,
        color: fg,
        opacity: Math.min(1, t * 1.5),
        transform: `translateY(${(1 - t) * 24}px) scale(${0.94 + 0.06 * t})`,
        border: tone === "soft" ? `1px solid ${C.lavender}` : "none",
        minWidth: 300,
      }}
    >
      <div style={{ ...display(50), color: fg }}>{title}</div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 24, marginTop: 6, opacity: 0.85 }}>{sub}</div>
    </div>
  );
};

const Times: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  return <span style={{ ...display(64), color: C.ink3, opacity: ramp(f, at, at + 10) }}>×</span>;
};

const Weight: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const formula = beat(s, "formula");
  const fTime = beat(s, "fTime");
  const fSize = beat(s, "fSize");
  const curve = beat(s, "curve");
  const size = beat(s, "size");
  const example = beat(s, "example");
  const share = beat(s, "share");
  const shareT = ramp(f, example + 16, share + 12, easeOut);
  const a = durationMult(8760);
  const b = durationMult(168);
  const shareA = a / (a + b);
  const tiers: [string, string, string][] = [
    ["0.1%", "+10%", "×1.10"],
    ["0.5%", "+25%", "×1.25"],
    ["1%", "+50%", "×1.50"],
  ];
  const rows: [string, string, number, number][] = [
    ["1-year lock", `${a.toFixed(3)}× time boost`, shareA, 0],
    ["1-week lock", `${b.toFixed(3)}× time boost`, 1 - shareA, 8],
  ];
  return (
    <SceneOut dur={s.dur}>
      <Phase at={beat(s, "title")} out={curve}>
        <div style={{ position: "absolute", left: 140, top: 176, ...display(80) }}>
          <Words text="Your share depends on weight." at={beat(s, "title")} accentWords={["weight."]} />
        </div>
        <div style={{ position: "absolute", left: 140, top: 380, display: "flex", alignItems: "center", gap: 28 }}>
          <Token at={formula} title="Amount" sub="coins you lock" tone="ink" />
          <Times at={fTime - 6} />
          <Token at={fTime} title="Time boost" sub="1.000× to 4.000×" tone="accent" />
          <Times at={fSize - 6} />
          <Token at={fSize} title="Size boost" sub="up to +50%" tone="soft" />
        </div>
        <Rise at={fSize + 22} style={{ position: "absolute", left: 140, top: 640 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 34, color: C.ink2 }}>
            Your share of every payout = <b style={{ color: C.ink }}>your weight ÷ total weight</b>
          </div>
        </Rise>
      </Phase>

      <Phase at={curve} out={size}>
        <div style={{ position: "absolute", left: 140, top: 164, ...display(64) }}>
          <Words text="Time boost: a square-root curve." at={curve + 2} accentWords={["square-root"]} />
        </div>
        <LockCurve x={230} y={330} w={900} h={400} at={curve + 4} playFrom={beat(s, "sweep")} playTo={beat(s, "sweepEnd") + 10} />
        <MultTable x={1360} y={236} at={curve + 6} playFrom={beat(s, "sweep")} playTo={beat(s, "sweepEnd") + 10} w={420} />
      </Phase>

      <Phase at={size} out={example}>
        <div style={{ position: "absolute", left: 140, top: 164, ...display(64) }}>
          <Words text="Size boost: one big lock counts extra." at={size + 2} accentWords={["extra."]} />
        </div>
        <div style={{ position: "absolute", left: 140, right: 140, top: 330, display: "flex", gap: 28 }}>
          {tiers.map(([pct, bonus, mult], i) => (
            <Rise key={pct} at={size + 10 + i * 8} style={{ flex: 1 }}>
              <Card style={{ padding: "36px 40px", height: 290, boxSizing: "border-box", background: i === 2 ? C.accentSoft : C.card, border: `1px solid ${i === 2 ? C.lavender : C.line}` }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: C.ink2 }}>One lock of at least</div>
                <div style={{ ...display(66), marginTop: 6 }}>{pct} of supply</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 26 }}>
                  <span style={{ ...display(72), color: C.accent }}>{bonus}</span>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 28, color: C.ink3, fontVariantNumeric: "tabular-nums" }}>{mult}</span>
                </div>
              </Card>
            </Rise>
          ))}
        </div>
        <Rise at={size + 40} style={{ position: "absolute", left: 140, top: 666 }}>
          <Chip tone="ink">Max combined: 4.000× time × 1.50 size = 6.0×</Chip>
        </Rise>
      </Phase>

      <Phase at={example}>
        <div style={{ position: "absolute", left: 140, top: 164, ...display(64) }}>
          <Words text="Two lockers, same amount." at={example + 2} />
        </div>
        <div style={{ position: "absolute", left: 140, right: 140, top: 320 }}>
          {rows.map(([name, boost, frac, d]) => {
            const t = sp(f, example + 8 + d);
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 40, marginBottom: 64, opacity: t, transform: `translateX(${(1 - t) * -24}px)` }}>
                <div style={{ width: 400 }}>
                  <div style={{ ...display(58) }}>{name}</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 28, color: C.ink3, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{boost}</div>
                </div>
                <div style={{ flex: 1, height: 96, borderRadius: 24, background: C.paper2, overflow: "hidden" }}>
                  <div style={{ width: `${frac * shareT * 100}%`, height: "100%", borderRadius: 24, background: frac > 0.5 ? C.accent : C.lavender }} />
                </div>
                <div style={{ width: 280, textAlign: "right", ...display(96), color: frac > 0.5 ? C.accent : C.ink2, fontVariantNumeric: "tabular-nums" }}>
                  {(frac * shareT * 100).toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
        <Rise at={share + 20} style={{ position: "absolute", left: 140, top: 660 }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 26, color: C.ink3, lineHeight: 1.45 }}>
            Worked example from the formula: weights 4.000 and 1.411, no size boost.
            <br />
            Each payout splits by weight ÷ total weight.
          </div>
        </Rise>
      </Phase>
    </SceneOut>
  );
};

// ---------------------------------------------------------------- Early exit
const Exit: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const play = beat(s, "play");
  const playEnd = beat(s, "playEnd");
  const cards: { at: number; title: string; sub: string; tone: "bad" | "ink" | "good" }[] = [
    { at: beat(s, "dead"), title: "Burned coins", sub: "Sent to 0x…dEaD. Gone for good.", tone: "bad" },
    { at: beat(s, "eth"), title: "Uncollected ETH", sub: "Goes back to the other lockers.", tone: "ink" },
    { at: beat(s, "ethKeep"), title: "Collected ETH", sub: "Always yours.", tone: "good" },
  ];
  return (
    <SceneOut dur={s.dur}>
      <div style={{ position: "absolute", left: 140, top: 164, ...display(72) }}>
        <Words text="Leaving a lock early." at={beat(s, "title")} />
      </div>
      <div style={{ position: "absolute", left: 140, top: 250, fontFamily: FONT_BODY, fontSize: 30, color: C.ink2, opacity: sp(f, beat(s, "title") + 14) }}>
        Allowed any time. It costs part of the locked coins.
      </div>
      <Rise at={beat(s, "chart")} style={{ position: "absolute", left: 140, top: 330, width: 1000, height: 470 }}>
        <Card style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", left: 40, top: 28, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 24, color: C.ink }}>
            Burn = max(5%, 25% × time left ÷ lock length)
          </div>
          <BurnChart x={110} y={110} w={840} h={270} at={beat(s, "chart") + 4} playFrom={play} playTo={playEnd + 50} />
        </Card>
      </Rise>
      <div style={{ position: "absolute", left: 1190, top: 330, width: 590 }}>
        {cards.map((c) => {
          const t = sp(f, c.at);
          const color = c.tone === "bad" ? C.bad : c.tone === "good" ? C.good : C.ink;
          return (
            <div
              key={c.title}
              style={{
                marginBottom: 22,
                opacity: Math.min(1, t * 1.4),
                transform: `translateX(${(1 - t) * 30}px)`,
              }}
            >
              <Card style={{ padding: "26px 32px", display: "flex", gap: 20, alignItems: "center", background: c.tone === "good" ? C.goodSoft : C.card }}>
                {c.tone === "good" ? (
                  <Tick size={48} draw={ramp(f, c.at + 6, c.at + 20)} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: c.tone === "bad" ? C.badSoft : C.paper2, display: "flex", alignItems: "center", justifyContent: "center", color, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 26 }}>
                    {c.tone === "bad" ? "×" : "↺"}
                  </div>
                )}
                <div>
                  <div style={{ ...display(38), color }}>{c.title}</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 24, color: C.ink2, marginTop: 4 }}>{c.sub}</div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
      <Rise at={playEnd + 30} style={{ position: "absolute", left: 140, top: 820 }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 23, color: C.ink3 }}>
          In our mainnet test, unlocking a minutes-old 4-hour lock burned about 24.8%.
        </div>
      </Rise>
    </SceneOut>
  );
};

// ---------------------------------------------------------------- Walkthrough
const Walk: React.FC<P> = ({ s }) => {
  const b = (n: string) => beat(s, n);
  const coin = R.coin;
  const si = R.signin;
  const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const c1w = center(coin.chip1w);
  const c1y = center(coin.chip1y);
  const typing = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ src: `ui/lock-t${i}-1y.png`, at: b("type") + i * 3 }));
  const lockRect = coin.lockClip;
  const clipH = coin.boost.y - lockRect.y - 6;
  const overlays = [
    ...typing.map((t, i) => ({ src: t.src, rect: lockRect, from: t.at, to: i < typing.length - 1 ? typing[i + 1].at : b("c1w") + 2, clipH })),
    { src: "ui/lock-t7-1w.png", rect: lockRect, from: b("c1w") + 2, to: b("c1y") + 2, clipH },
    { src: "ui/lock-t7-1y-b.png", rect: lockRect, from: b("c1y") + 2, to: b("trade") + 12, clipH },
  ];
  const pages: Page[] = [
    {
      src: "ui/home.png",
      cssW: 1440,
      cssH: 900,
      url: "clasp.fun",
      from: 0,
      to: b("coin"),
      cam: [
        { f: 0, cx: 720, cy: 440, z: 1.0 },
        { f: b("coin"), cx: 660, cy: 410, z: 1.08 },
      ],
    },
    {
      src: "ui/coin.png",
      cssW: 1440,
      cssH: 2440,
      url: "clasp.fun/coins/0x1fFB…E173",
      from: b("coin"),
      to: b("signin"),
      cam: [
        { f: b("coin"), cx: 720, cy: 330, z: 1.0 },
        { f: b("toLock"), cx: 720, cy: 345, z: 1.02 },
        { f: b("toLock") + 22, cx: 440, cy: 760, z: 1.9 },
        { f: b("trade"), cx: 440, cy: 760, z: 1.9 },
        { f: b("trade") + 24, cx: 950, cy: 845, z: 1.45 },
      ],
      overlays,
      highlights: [
        { rect: { x: 193, y: 328, w: 150, h: 104 }, from: b("stats"), to: b("paid") - 4, pad: 12, dim: 0.12 },
        { rect: coin.paidCell, from: b("paid"), to: b("toLock") - 2, pad: 12, dim: 0.12 },
        { rect: coin.chip1y, from: b("boost") - 4, to: b("trade") - 2, pad: 6, dim: 0.16, label: "1 year · full 4× time boost", labelSide: "right" },
        { rect: coin.tradeNote, from: b("trade") + 20, to: b("fee") - 2, pad: 12, dim: 0.16 },
        { rect: coin.feeRows, from: b("fee"), to: b("signin") + 6, pad: 8, dim: 0.16, label: "2% Clasp fee → this coin's vault", labelSide: "left" },
      ],
    },
    {
      src: "ui/signin.png",
      cssW: 1440,
      cssH: 900,
      url: "clasp.fun",
      from: b("signin"),
      to: s.dur + 20,
      cam: [
        { f: b("signin"), cx: 720, cy: 450, z: 1.05 },
        { f: b("signin") + 22, cx: 720, cy: 452, z: 1.42 },
      ],
      highlights: [
        { rect: { x: 537, y: 429, w: 366, h: 207 }, from: b("wallet"), to: b("google") - 2, pad: 10, dim: 0.2, label: "Clasp never sees your keys", labelSide: "right" },
        {
          rect: { x: si.google.x, y: si.google.y, w: si.google.w, h: 97 },
          from: b("google"),
          to: s.dur + 20,
          pad: 10,
          dim: 0.2,
          tone: "warn",
          label: "Custodial: Clasp holds the key",
          labelAt: b("custodial"),
          labelSide: "right",
        },
      ],
    },
  ];
  const input = { x: coin.input.x + 90, y: coin.input.y + coin.input.h / 2 };
  const cursor = [
    { f: b("coin") + 4, x: 900, y: 520, o: 0 },
    { f: b("coin") + 16, x: 860, y: 500, o: 1 },
    { f: b("toLock") + 10, x: 560, y: 640, o: 1 },
    { f: b("type") - 2, x: input.x, y: input.y + 4, o: 1 },
    { f: b("c1w") - 2, x: c1w.x + 4, y: c1w.y + 6, o: 1 },
    { f: b("c1y") - 2, x: c1y.x + 4, y: c1y.y + 6, o: 1 },
    { f: b("trade") + 2, x: c1y.x + 30, y: c1y.y + 30, o: 1 },
    { f: b("trade") + 24, x: 1170, y: 700, o: 1 },
    { f: b("signin") - 4, x: 1170, y: 700, o: 0 },
    { f: b("signin") + 6, x: 820, y: 560, o: 0 },
    { f: b("signin") + 16, x: 800, y: 540, o: 1 },
    { f: b("google") - 2, x: 760, y: 342, o: 1 },
  ];
  return (
    <SceneOut dur={s.dur}>
      <Browser
        x={160}
        y={132}
        w={1600}
        h={760}
        enter={-16}
        pages={pages}
        cursor={cursor}
        clicks={[b("type") - 1, b("c1w"), b("c1y")]}
        badge={{ text: "Real site · test coin, not an investment", from: b("coin") + 6, to: b("signin") }}
      />
    </SceneOut>
  );
};

export const CLIP_SCENES: Record<string, React.FC<P>> = { flow: Flow, weight: Weight, exit: Exit, walk: Walk, end: ClipEnd };

export const CLIP_LABELS: Record<string, [string, string] | null> = {
  flow: ["", "Where the ETH comes from"],
  weight: ["", "How your share is set"],
  exit: ["", "Leaving a lock early"],
  walk: ["", "A lock, start to finish"],
  end: null,
};
