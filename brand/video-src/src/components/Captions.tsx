import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT_BODY } from "../theme";
import { easeIn, easeOut, ramp } from "../lib/anim";
import type { VideoTimeline } from "../timeline";

type Cue = { a: number; b: number; text: string };

const HILITE = /(\d[\d.,]*\s?(?:%|×)?|0x…dEaD|clasp\.fun)/g;

/** Burned-in lower-third captions, one cue per VO line, max two lines. */
export const Captions: React.FC<{ tl: VideoTimeline; bottom?: number }> = ({ tl, bottom = 58 }) => {
  const f = useCurrentFrame();
  const cues: Cue[] = [];
  for (const s of tl.scenes) for (const l of s.lines) cues.push({ a: s.from + l.from - 2, b: s.from + l.from + l.dur + 8, text: l.cap });
  // Bridge short gaps so the caption box doesn't flicker between adjacent lines.
  for (let i = 0; i < cues.length - 1; i++) if (cues[i + 1].a - cues[i].b < 10) cues[i].b = cues[i + 1].a;
  const idx = cues.findIndex((c) => f >= c.a && f < c.b);
  if (idx < 0) return null;
  const cue = cues[idx];
  const chainedIn = idx > 0 && cues[idx - 1].b === cue.a;
  const chainedOut = idx < cues.length - 1 && cues[idx + 1].a === cue.b;
  const inT = ramp(f, cue.a, cue.a + 6, easeOut);
  const outT = chainedOut ? 0 : ramp(f, cue.b - 6, cue.b, easeIn);
  const boxIn = chainedIn ? 1 : inT;
  // Keep "1-year", "4-hour" etc. on one line; U+2011 is a non-breaking hyphen.
  const parts = cue.text.replace(/(\d)-(\p{L})/gu, "$1\u2011$2").split(HILITE);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          padding: "16px 34px 18px",
          borderRadius: 20,
          background: "rgba(22,21,26,0.9)",
          boxShadow: "0 12px 32px -12px rgba(22,21,26,0.35)",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 46,
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
          textAlign: "center",
          textWrap: "balance",
          fontVariantNumeric: "tabular-nums",
          opacity: boxIn * (1 - outT),
          transform: `translateY(${(1 - boxIn) * 10}px)`,
        }}
      >
        <span style={{ opacity: inT }}>
          {parts.map((p, i) =>
            i % 2 === 1 ? (
              <span key={i} style={{ color: C.lavender, fontWeight: 600 }}>
                {p}
              </span>
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
        </span>
      </div>
    </div>
  );
};
