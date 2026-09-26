import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT_BODY, display } from "../theme";
import { burnFrac, durationMult, easeOut, inOut, ramp, sp, YEAR_H } from "../lib/anim";

export const MULT_TABLE: [string, number][] = [
  ["4 hours", 4],
  ["1 day", 24],
  ["1 week", 168],
  ["30 days", 720],
  ["90 days", 2160],
  ["180 days", 4320],
  ["1 year", 8760],
];

const label = (h: number) => {
  if (h < 24) return `${Math.round(h)} hours`;
  const d = h / 24;
  if (d >= 364.5) return "1 year";
  return `${Math.round(d)} ${Math.round(d) === 1 ? "day" : "days"}`;
};

/** Duration multiplier curve 1.000× (4h) → 4.000× (1y) with a sweeping playhead. */
export const LockCurve: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  playFrom: number;
  playTo: number;
  markers?: boolean;
}> = ({ x, y, w, h, at, playFrom, playTo, markers = true }) => {
  const f = useCurrentFrame();
  const show = sp(f, at);
  const draw = ramp(f, at + 6, playTo, inOut);
  const px = (hours: number) => ((hours - 4) / (YEAR_H - 4)) * w;
  const py = (m: number) => h - ((m - 1) / 3) * h;
  const pts = Array.from({ length: 161 }, (_, i) => {
    const hrs = 4 + (YEAR_H - 4) * (i / 160) ** 2;
    return `${i ? "L" : "M"}${px(hrs).toFixed(1)},${py(durationMult(hrs)).toFixed(1)}`;
  }).join(" ");
  const t = ramp(f, playFrom, playTo, inOut);
  const hours = 4 + (YEAR_H - 4) * t;
  const m = durationMult(hours);
  const hx = px(hours);
  const hy = py(m);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: show }}>
      <svg width={w + 40} height={h + 60} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {[1, 2, 3, 4].map((v) => (
          <g key={v}>
            <line x1={0} x2={w} y1={py(v)} y2={py(v)} stroke={C.line} strokeWidth={v === 1 ? 2 : 1.2} strokeDasharray={v === 1 ? undefined : "6 8"} />
            <text x={-18} y={py(v) + 7} fontFamily="Inter" fontSize={20} fill={C.ink3} textAnchor="end">
              {v}×
            </text>
          </g>
        ))}
        <text x={0} y={h + 40} fontFamily="Inter" fontSize={20} fill={C.ink3}>
          4 hours
        </text>
        <text x={w} y={h + 40} fontFamily="Inter" fontSize={20} fill={C.ink3} textAnchor="end">
          1 year
        </text>
        <path d={pts} stroke={C.accent} strokeWidth={6} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        {markers
          ? MULT_TABLE.slice(3).map(([name, hrs]) => {
              const on = hours >= hrs - 1;
              return (
                <g key={name} opacity={on ? 1 : 0}>
                  <circle cx={px(hrs)} cy={py(durationMult(hrs))} r={8} fill={C.card} stroke={C.accent} strokeWidth={4} />
                  <text x={px(hrs)} y={py(durationMult(hrs)) + 40} fontFamily="Inter" fontSize={19} fill={C.ink2} textAnchor="middle">
                    {name}
                  </text>
                </g>
              );
            })
          : null}
        <line x1={hx} x2={hx} y1={hy} y2={h} stroke={C.accent} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="4 6" opacity={f >= playFrom ? 1 : 0} />
        <circle cx={hx} cy={hy} r={13} fill={C.accent} opacity={f >= playFrom - 4 ? 1 : 0} />
        <circle cx={hx} cy={hy} r={5} fill="#fff" opacity={f >= playFrom - 4 ? 1 : 0} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 24,
          top: -6,
          padding: "12px 20px",
          borderRadius: 16,
          background: C.ink,
          color: "#fff",
          fontFamily: FONT_BODY,
          whiteSpace: "nowrap",
          opacity: f >= playFrom - 4 ? 1 : 0,
          boxShadow: "0 14px 30px -14px rgba(22,21,26,0.5)",
        }}
      >
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>{label(hours)}</div>
        <div style={{ ...display(44), color: "#fff", fontVariantNumeric: "tabular-nums" }}>{m.toFixed(3)}×</div>
      </div>
    </div>
  );
};

/** Exact multiplier table; rows light up as the playhead passes them. */
export const MultTable: React.FC<{ x: number; y: number; at: number; playFrom: number; playTo: number; w?: number }> = ({
  x,
  y,
  at,
  playFrom,
  playTo,
  w = 360,
}) => {
  const f = useCurrentFrame();
  const t = ramp(f, playFrom, playTo, inOut);
  const hours = 4 + (YEAR_H - 4) * t;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 24,
        padding: "18px 26px",
        boxShadow: "0 18px 40px -20px rgba(22,21,26,0.16)",
      }}
    >
      <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 19, letterSpacing: "0.06em", textTransform: "uppercase", color: C.ink3, marginBottom: 6 }}>
        Time boost
      </div>
      {MULT_TABLE.map(([name, hrs], i) => {
        const vis = sp(f, at + 4 + i * 3);
        const lit = hours >= hrs - 0.5;
        return (
          <div
            key={name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "9px 0",
              borderTop: i ? `1px solid ${C.line}` : "none",
              opacity: vis,
              transform: `translateX(${(1 - vis) * 16}px)`,
              fontFamily: FONT_BODY,
              fontSize: 26,
              color: lit ? C.ink : C.ink3,
            }}
          >
            <span>{name}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: lit ? C.accent : C.ink3 }}>{durationMult(hrs).toFixed(3)}×</span>
          </div>
        );
      })}
    </div>
  );
};

/** Early-exit burn: max(5%, 25% × time left / lock length), with playhead. */
export const BurnChart: React.FC<{ x: number; y: number; w: number; h: number; at: number; playFrom: number; playTo: number }> = ({
  x,
  y,
  w,
  h,
  at,
  playFrom,
  playTo,
}) => {
  const f = useCurrentFrame();
  const show = sp(f, at);
  const draw = ramp(f, at + 4, at + 34, inOut);
  const px = (e: number) => e * w;
  const py = (b: number) => h - (b / 0.3) * h;
  const e = ramp(f, playFrom, playTo, (v) => v);
  const b = burnFrac(e);
  const line = `M0,${py(0.25)} L${px(0.8)},${py(0.05)} L${w},${py(0.05)}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const floorT = ramp(f, playFrom + (playTo - playFrom) * 0.8, playFrom + (playTo - playFrom) * 0.8 + 12, easeOut);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: show }}>
      <svg width={w + 60} height={h + 70} style={{ position: "absolute", overflow: "visible" }}>
        <defs>
          <clipPath id="burnclip">
            <rect x={0} y={0} width={w * draw} height={h} />
          </clipPath>
        </defs>
        {[0, 0.05, 0.1, 0.15, 0.2, 0.25].map((v) => (
          <g key={v}>
            <line x1={0} x2={w} y1={py(v)} y2={py(v)} stroke={C.line} strokeWidth={v === 0 ? 2 : 1.2} strokeDasharray={v === 0 ? undefined : "6 8"} />
            <text x={-16} y={py(v) + 7} fontFamily="Inter" fontSize={20} fill={C.ink3} textAnchor="end">
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}
        <text x={0} y={h + 40} fontFamily="Inter" fontSize={20} fill={C.ink3}>
          Lock starts
        </text>
        <text x={px(0.8)} y={h + 40} fontFamily="Inter" fontSize={20} fill={C.ink3} textAnchor="middle">
          80% through
        </text>
        <text x={w} y={h + 40} fontFamily="Inter" fontSize={20} fill={C.ink3} textAnchor="end">
          Lock ends
        </text>
        <g clipPath="url(#burnclip)">
          <path d={area} fill={C.badSoft} opacity={0.8} />
          <path d={line} stroke={C.bad} strokeWidth={6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <g opacity={floorT}>
          <rect x={px(0.8) + 30} y={py(0.05) - 58} width={170} height={40} rx={20} fill={C.card} stroke={C.line} />
          <text x={px(0.8) + 115} y={py(0.05) - 31} fontFamily="Inter" fontWeight={600} fontSize={20} fill={C.bad} textAnchor="middle">
            5% floor
          </text>
        </g>
        <g opacity={f >= playFrom - 2 ? 1 : 0}>
          <line x1={px(e)} x2={px(e)} y1={py(b)} y2={h} stroke={C.bad} strokeOpacity={0.4} strokeWidth={2} strokeDasharray="4 6" />
          <circle cx={px(e)} cy={py(b)} r={13} fill={C.bad} />
          <circle cx={px(e)} cy={py(b)} r={5} fill="#fff" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          right: -10,
          top: -24,
          padding: "12px 20px",
          borderRadius: 16,
          background: C.ink,
          color: "#fff",
          fontFamily: FONT_BODY,
          whiteSpace: "nowrap",
          opacity: f >= playFrom - 2 ? 1 : 0,
          boxShadow: "0 14px 30px -14px rgba(22,21,26,0.5)",
        }}
      >
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)" }}>Leave now, burn</div>
        <div style={{ ...display(44), color: "#fff", fontVariantNumeric: "tabular-nums" }}>{(b * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
};

/** Locked coins bar: kept vs burned for the current burn fraction. */
export const CoinBar: React.FC<{ x: number; y: number; w: number; at: number; playFrom: number; playTo: number }> = ({ x, y, w, at, playFrom, playTo }) => {
  const f = useCurrentFrame();
  const show = sp(f, at);
  const e = ramp(f, playFrom, playTo, (v) => v);
  const b = burnFrac(e);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, opacity: show, transform: `translateY(${(1 - show) * 20}px)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_BODY, fontSize: 22, color: C.ink2, marginBottom: 12 }}>
        <span>
          Back to you <b style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>{((1 - b) * 100).toFixed(1)}%</b>
        </span>
        <span>
          Burned to 0x…dEaD <b style={{ color: C.bad, fontVariantNumeric: "tabular-nums" }}>{(b * 100).toFixed(1)}%</b>
        </span>
      </div>
      <div style={{ height: 30, borderRadius: 15, background: C.badSoft, overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${(1 - b) * 100}%`, background: C.ink, borderRadius: 15 }} />
        <div style={{ flex: 1, background: `repeating-linear-gradient(135deg, ${C.bad} 0 8px, #d9574d 8px 16px)` }} />
      </div>
    </div>
  );
};
