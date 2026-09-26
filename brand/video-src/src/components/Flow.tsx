import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT_BODY, display } from "../theme";
import { bez, inOut, pop, ramp, sp } from "../lib/anim";
import { Mark } from "./Base";

type Pt = number[];
type Curve = [Pt, Pt, Pt, Pt];

const hcurve = (a: Pt, b: Pt): Curve => {
  const mx = (a[0] + b[0]) / 2;
  return [a, [mx, a[1]], [mx, b[1]], b];
};

/** A connector that draws itself, then carries moving ETH dots. */
export const FlowPath: React.FC<{
  curve: Curve;
  at: number;
  rate?: number;
  count?: number;
  color?: string;
  dot?: number;
  dashed?: boolean;
  width?: number;
}> = ({ curve, at, rate = 0.018, count = 5, color = C.accent, dot = 7, dashed, width = 3 }) => {
  const f = useCurrentFrame();
  const draw = ramp(f, at, at + 18);
  const live = f - at - 10;
  const d = `M${curve[0][0]},${curve[0][1]} C${curve[1][0]},${curve[1][1]} ${curve[2][0]},${curve[2][1]} ${curve[3][0]},${curve[3][1]}`;
  return (
    <g>
      <path d={d} stroke={C.line} strokeWidth={width + 6} fill="none" strokeLinecap="round" opacity={draw * 0.9} />
      <path
        d={d}
        stroke={dashed ? C.ink3 : color}
        strokeOpacity={dashed ? 0.45 : 0.35}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={dashed ? "0.012 0.018" : 1}
        strokeDashoffset={dashed ? 0 : 1 - draw}
        opacity={dashed ? draw : 1}
      />
      {!dashed && live > 0
        ? Array.from({ length: count }).map((_, i) => {
            // Each dot starts at the path origin in turn, then loops.
            const travel = live * rate - i / count;
            if (travel < 0) return null;
            const p = travel % 1;
            const [x, y] = bez(curve[0], curve[1], curve[2], curve[3], p);
            const edge = Math.min(1, p / 0.08, (1 - p) / 0.08);
            return <circle key={i} cx={x} cy={y} r={dot} fill={color} opacity={edge} />;
          })
        : null}
    </g>
  );
};

export type FlowBeats = {
  vault: number;
  srcA: number;
  srcB: number;
  out90: number;
  out10: number;
  out0: number;
};

const cardBase: React.CSSProperties = {
  position: "absolute",
  background: C.card,
  border: `1px solid ${C.line}`,
  borderRadius: 26,
  boxShadow: "0 1px 2px rgba(22,21,26,0.04), 0 18px 40px -18px rgba(22,21,26,0.16)",
  padding: "26px 30px",
  boxSizing: "border-box",
};

const eyebrow: React.CSSProperties = {
  fontFamily: FONT_BODY,
  fontWeight: 600,
  fontSize: 21,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: C.accentStrong,
};

const Appear: React.FC<{ at: number; style: React.CSSProperties; children: React.ReactNode; from?: "left" | "right" | "scale" }> = ({
  at,
  style,
  children,
  from = "scale",
}) => {
  const f = useCurrentFrame();
  const t = from === "scale" ? pop(f, at) : sp(f, at, 150, 22);
  const dx = from === "left" ? (1 - t) * -40 : from === "right" ? (1 - t) * 40 : 0;
  const s = from === "scale" ? 0.9 + 0.1 * t : 1;
  return <div style={{ ...style, opacity: Math.min(1, t * 1.5), transform: `translateX(${dx}px) scale(${s})` }}>{children}</div>;
};

/** Buy/Sell chips scrolling inside the trading-fee card. */
const Ticker: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const kinds = ["Buy", "Sell", "Buy", "Buy", "Sell", "Buy", "Sell", "Buy", "Sell", "Sell", "Buy", "Buy"];
  const off = (f - at) * 2.2;
  return (
    <div style={{ position: "relative", height: 44, marginTop: 16, overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}>
      {kinds.concat(kinds).map((k, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: i * 96 - (off % (kinds.length * 96)),
            top: 4,
            padding: "6px 14px",
            borderRadius: 999,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 19,
            background: k === "Buy" ? C.goodSoft : C.badSoft,
            color: k === "Buy" ? C.good : C.bad,
          }}
        >
          {k}
        </span>
      ))}
    </div>
  );
};

/** Fee flow: sources → the coin's vault → 90 / 10 / 0. Coordinates in a 1920×1080 frame. */
export const FlowDiagram: React.FC<{ b: FlowBeats; detailed?: boolean; dy?: number; scale?: number }> = ({ b, detailed, dy = 0, scale = 1 }) => {
  const f = useCurrentFrame();
  const A: Curve = hcurve([560, 372], [770, 452]);
  const B: Curve = hcurve([560, 640], [770, 532]);
  const O90: Curve = hcurve([1150, 440], [1370, 330]);
  const O10: Curve = hcurve([1150, 492], [1370, 557]);
  const O0: Curve = hcurve([1150, 540], [1370, 747]);
  const pulse = f > b.srcA + 30 ? 0.5 + 0.5 * Math.sin((f - b.srcA) / 6) : 0;
  const pct90 = Math.round(90 * ramp(f, b.out90 + 4, b.out90 + 26));
  const pct10 = Math.round(10 * ramp(f, b.out10 + 4, b.out10 + 20));
  const release = ramp(f, b.out90 + 16, b.out90 + 106, inOut);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `translateY(${dy}px) scale(${scale})`, transformOrigin: "960px 500px" }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <FlowPath curve={A} at={b.srcA + 6} count={4} />
        <FlowPath curve={B} at={b.srcB + 6} count={3} />
        <FlowPath curve={O90} at={b.out90 + 4} count={9} rate={0.012} dot={8} />
        <FlowPath curve={O10} at={b.out10 + 4} count={2} rate={0.012} dot={6} color={C.ink2} />
        <FlowPath curve={O0} at={b.out0 + 4} dashed />
      </svg>

      <Appear at={b.srcA} from="left" style={{ ...cardBase, left: 120, top: 262, width: 440, height: 220 }}>
        <div style={eyebrow}>Clasp trading fee</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 6 }}>
          <span style={{ ...display(84), color: C.accent }}>2%</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 25, color: C.ink2, lineHeight: 1.3 }}>of every buy or sell through Clasp</span>
        </div>
        {detailed ? <Ticker at={b.srcA} /> : null}
      </Appear>
      <Appear at={b.srcB} from="left" style={{ ...cardBase, left: 120, top: 530, width: 440, height: 220 }}>
        <div style={eyebrow}>Pons creator fees</div>
        <div style={{ ...display(40), marginTop: 12, lineHeight: 1.12 }}>Pointed at the vault</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 23, color: C.ink3, marginTop: 10, lineHeight: 1.35 }}>
          Pulled in by anyone, or Clasp's keeper bot
        </div>
      </Appear>

      <Appear
        at={b.vault}
        style={{
          position: "absolute",
          left: 770,
          top: 318,
          width: 380,
          height: 356,
          borderRadius: 34,
          background: C.ink,
          boxShadow: `0 30px 70px -24px rgba(22,21,26,0.5), 0 0 0 ${10 * pulse}px rgba(61,59,243,${0.1 * pulse})`,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <Mark size={84} draw={ramp(f, b.vault + 4, b.vault + 30)} dark="#ffffff" accent={C.lavender} />
        <div style={{ ...display(48), color: "#fff", marginTop: 20 }}>The coin's vault</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 23, color: "rgba(255,255,255,0.72)", marginTop: 12, lineHeight: 1.35 }}>
          One per coin.
          <br />
          Split frozen at creation.
        </div>
      </Appear>

      <Appear at={b.out90} from="right" style={{ ...cardBase, left: 1370, top: 218, width: 430, height: 224, background: C.accentSoft, border: `1px solid ${C.lavender}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ ...display(88), color: C.accent, fontVariantNumeric: "tabular-nums" }}>{pct90}%</span>
          <span style={{ ...display(34) }}>to lockers</span>
        </div>
        {detailed ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 12, borderRadius: 6, background: "#fff", overflow: "hidden" }}>
              <div style={{ width: `${release * 100}%`, height: "100%", background: C.accent, borderRadius: 6 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_BODY, fontSize: 20, color: C.ink2, marginTop: 8 }}>
              <span>Released over 1 hour</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(release * 60)} / 60 min</span>
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: FONT_BODY, fontSize: 23, color: C.ink2, marginTop: 8, lineHeight: 1.35 }}>Split by size and lock length. Paid in ETH.</div>
        )}
      </Appear>
      <Appear at={b.out10} from="right" style={{ ...cardBase, left: 1370, top: 478, width: 430, height: 158 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ ...display(64), fontVariantNumeric: "tabular-nums" }}>{pct10}%</span>
          <span style={{ ...display(30) }}>Clasp treasury</span>
        </div>
      </Appear>
      <Appear at={b.out0} from="right" style={{ ...cardBase, left: 1370, top: 668, width: 430, height: 158, background: C.paper2 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ ...display(64), color: C.ink3 }}>0%</span>
          <span style={{ ...display(30), color: C.ink3 }}>the creator</span>
        </div>
      </Appear>
    </div>
  );
};
