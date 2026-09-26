import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT_BODY, display } from "../theme";
import { easeOut, ramp, sp } from "../lib/anim";
import { Mark, Words } from "./Base";

/** Branded end card: mark, tagline, URL and handle. */
export const EndCard: React.FC<{ at?: number; compact?: boolean }> = ({ at = 0, compact }) => {
  const f = useCurrentFrame();
  const markT = ramp(f, at, at + 26, easeOut);
  const lift = sp(f, at + 8);
  const k = compact ? 0.86 : 1;
  const urlT = sp(f, at + (compact ? 18 : 30));
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26 * k, transform: `translateY(${(1 - lift) * 20}px)` }}>
        <Mark size={112 * k} draw={markT} />
        <span style={{ ...display(104 * k), opacity: ramp(f, at + 8, at + 22) }}>Clasp</span>
      </div>
      <div style={{ ...display(66 * k), textAlign: "center", marginTop: 46 * k, lineHeight: 1.12 }}>
        <Words text="Lock a coin you believe in." at={at + 10} />
        <br />
        <Words text="Earn a share of every trade." at={at + 16} color={C.accent} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 18,
          marginTop: 50 * k,
          opacity: Math.min(1, urlT * 1.4),
          transform: `translateY(${(1 - urlT) * 16}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 34 * k,
            color: "#fff",
            background: C.accent,
            borderRadius: 999,
            padding: `${14 * k}px ${34 * k}px`,
            boxShadow: "0 14px 30px -14px rgba(61,59,243,0.7)",
          }}
        >
          clasp.fun
        </span>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 34 * k,
            color: C.ink,
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 999,
            padding: `${14 * k}px ${34 * k}px`,
          }}
        >
          @ClaspFun
        </span>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 24 * k, color: C.ink3, marginTop: 30 * k, opacity: ramp(f, at + 34, at + 50) }}>
        On Robinhood Chain · fees paid in ETH
      </div>
    </div>
  );
};
