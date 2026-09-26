import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { C, FONT_BODY, display } from "../theme";
import { easeIn, pop, ramp, sp } from "../lib/anim";

/** Paper background with subtle film grain and edge falloff. */
export const Paper: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  // Static grain: gives the paper texture without per-frame noise (keeps H.264 bitrate sane).
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {children}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(251,248,243,0) 60%, rgba(232,225,213,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile("tex/grain0.png")})`,
          backgroundSize: "320px 320px",
          opacity: 0.14,
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/** The Clasp mark; `draw` 0→1 animates the hooks' strokes. */
export const Mark: React.FC<{
  size: number;
  draw?: number;
  dark?: string;
  accent?: string;
  style?: React.CSSProperties;
}> = ({ size, draw = 1, dark = C.ink, accent = C.accent, style }) => {
  const a = Math.min(1, Math.max(0, draw * 1.25));
  const b = Math.min(1, Math.max(0, draw * 1.25 - 0.25));
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={style}>
      <path
        d="M7.5 26V13a6 6 0 0 1 12 0v4"
        stroke={dark}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - a}
        opacity={a > 0 ? 1 : 0}
      />
      <path
        d="M24.5 6v13a6 6 0 0 1-12 0v-4"
        stroke={accent}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - b}
        opacity={b > 0 ? 1 : 0}
      />
    </svg>
  );
};

/** Masked word-by-word rise. Segments allow per-word color. */
export const Words: React.FC<{
  text: string;
  at: number;
  stagger?: number;
  style?: React.CSSProperties;
  color?: string;
  accentWords?: string[];
  accentColor?: string;
  out?: number;
}> = ({ text, at, stagger = 2.2, style, color, accentWords = [], accentColor = C.accent, out }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const outT = out === undefined ? 0 : ramp(f, out, out + 10, easeIn);
  return (
    <span style={{ display: "inline", ...style }}>
      {words.map((w, i) => {
        const t = sp(f, at + i * stagger, 170, 24);
        const clean = w.replace(/[.,:;!?]/g, "");
        const isAccent = accentWords.includes(clean) || accentWords.includes(w);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "top",
              paddingBottom: "0.12em",
              marginBottom: "-0.12em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - t) * 105 - outT * 105}%)`,
                color: isAccent ? accentColor : color,
                whiteSpace: "pre",
              }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </span>
  );
};

/** Small uppercase section label in accent, like the site's eyebrow. */
export const Eyebrow: React.FC<{ text: string; at: number; style?: React.CSSProperties }> = ({ text, at, style }) => {
  const f = useCurrentFrame();
  const t = ramp(f, at, at + 14);
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: 22,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: C.accentStrong,
        opacity: t,
        transform: `translateY(${(1 - t) * 10}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** Top chrome: mark + wordmark left, section label right. */
export const Chrome: React.FC<{ label: string; index?: string; show: number }> = ({ label, index, show }) => {
  return (
    <div style={{ position: "absolute", left: 96, right: 96, top: 54, height: 44, opacity: show }}>
      <div style={{ position: "absolute", left: 0, top: 0, display: "flex", alignItems: "center", gap: 12 }}>
        <Mark size={34} />
        <span style={{ ...display(30), letterSpacing: "-0.02em" }}>Clasp</span>
      </div>
      <div
        key={label}
        style={{
          position: "absolute",
          right: 0,
          top: 6,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: FONT_BODY,
          fontSize: 20,
          fontWeight: 500,
          color: C.ink3,
          letterSpacing: "0.01em",
        }}
      >
        {index ? <span style={{ color: C.accent, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{index}</span> : null}
        <span>{label}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 58, height: 1, background: C.line, opacity: 0.9 }} />
    </div>
  );
};

/** White rounded card. */
export const Card: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      background: C.card,
      borderRadius: 24,
      border: `1px solid ${C.line}`,
      boxShadow: "0 1px 2px rgba(22,21,26,0.04), 0 18px 40px -18px rgba(22,21,26,0.14)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Pill chip. */
export const Chip: React.FC<{ children: React.ReactNode; tone?: "accent" | "ink" | "warn" | "good" | "plain"; style?: React.CSSProperties }> = ({
  children,
  tone = "plain",
  style,
}) => {
  const tones = {
    accent: { background: C.accentSoft, color: C.accentStrong, border: `1px solid ${C.lavender}` },
    ink: { background: C.ink, color: "#fff", border: `1px solid ${C.ink}` },
    warn: { background: C.warnSoft, color: C.warn, border: "1px solid #f1dfa8" },
    good: { background: C.goodSoft, color: C.good, border: "1px solid #bfe3cc" },
    plain: { background: C.card, color: C.ink, border: `1px solid ${C.line}` },
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 20px",
        borderRadius: 999,
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: 24,
        whiteSpace: "nowrap",
        ...tones,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** Element entrance: rise + fade (spring). Optional exit. */
export const Rise: React.FC<{ at: number; out?: number; dy?: number; children: React.ReactNode; style?: React.CSSProperties; scale?: boolean }> = ({
  at,
  out,
  dy = 28,
  children,
  style,
  scale,
}) => {
  const f = useCurrentFrame();
  const t = scale ? pop(f, at) : sp(f, at);
  const o = out === undefined ? 0 : ramp(f, out, out + 10, easeIn);
  const vis = Math.min(1, t * 1.4) * (1 - o);
  return (
    <div
      style={{
        opacity: vis,
        transform: scale
          ? `scale(${0.86 + 0.14 * t}) translateY(${-o * 12}px)`
          : `translateY(${(1 - t) * dy - o * 16}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Simple green check / red cross icon. */
export const Tick: React.FC<{ size?: number; color?: string; draw?: number }> = ({ size = 28, color = C.good, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx={12} cy={12} r={11} fill={color} opacity={0.12} />
    <path d="M7 12.5l3.2 3.2L17 9" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
  </svg>
);
