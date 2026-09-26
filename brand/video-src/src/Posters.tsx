import React from "react";
import { C, FONT_BODY, display } from "./theme";
import { Card, Mark, Paper } from "./components/Base";
import { ensureFonts } from "./fonts";

ensureFonts();

/** Launch poster: tagline + a static fee-split summary. */
export const LaunchPoster: React.FC = () => {
  const rows: [string, string, string][] = [
    ["90%", "to the people who lock", C.accent],
    ["10%", "to the Clasp treasury", C.ink],
    ["0%", "to the creator", C.ink3],
  ];
  return (
    <Paper>
      <div style={{ position: "absolute", left: 140, top: 150, display: "flex", alignItems: "center", gap: 22 }}>
        <Mark size={92} />
        <span style={{ ...display(96) }}>Clasp</span>
      </div>
      <div style={{ position: "absolute", left: 140, top: 330, ...display(104), lineHeight: 1.04 }}>
        Lock a coin
        <br />
        you believe in.
        <br />
        <span style={{ color: C.accent }}>
          Earn a share
          <br />
          of every trade.
        </span>
      </div>
      <div style={{ position: "absolute", left: 140, top: 790, width: 860, fontFamily: FONT_BODY, fontSize: 32, lineHeight: 1.4, color: C.ink2 }}>
        Trading fees paid in ETH to the people who lock. On Robinhood Chain.
      </div>
      <Card style={{ position: "absolute", left: 1150, top: 196, width: 630, padding: "44px 48px", boxSizing: "border-box" }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase", color: C.accentStrong }}>
          Every Clasp coin has a vault
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 28, color: C.ink2, marginTop: 14, lineHeight: 1.4 }}>
          2% of every trade on Clasp, plus the coin's Pons creator fees, flow in. Then:
        </div>
        {rows.map(([pct, label, color]) => (
          <div key={pct} style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
            <span style={{ ...display(72), color, width: 170, fontVariantNumeric: "tabular-nums" }}>{pct}</span>
            <span style={{ fontFamily: FONT_BODY, fontSize: 30, color: C.ink }}>{label}</span>
          </div>
        ))}
      </Card>
      <div style={{ position: "absolute", left: 1150, top: 836, display: "flex", gap: 16 }}>
        <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 30, color: "#fff", background: C.accent, borderRadius: 999, padding: "12px 30px" }}>clasp.fun</span>
        <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 30, color: C.ink, background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: "12px 30px" }}>
          @ClaspFun
        </span>
      </div>
    </Paper>
  );
};
