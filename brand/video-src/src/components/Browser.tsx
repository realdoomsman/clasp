import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { C, FONT_BODY } from "../theme";
import { easeIn, easeOut, inOut, Key, keyed, ramp } from "../lib/anim";

export type Rect = { x: number; y: number; w: number; h: number };

export type Overlay = { src: string; rect: Rect; from: number; to?: number; clipH?: number };

export type Highlight = {
  rect: Rect;
  from: number;
  to: number;
  dim?: number;
  pad?: number;
  label?: string;
  labelSide?: "top" | "bottom" | "left" | "right";
  labelAt?: number;
  tone?: "accent" | "warn" | "ink";
};

export type Page = {
  src: string;
  cssW: number;
  cssH: number;
  url: string;
  from: number;
  to: number;
  cam: Key[]; // f, cx, cy, z  (CSS px center, zoom relative to fit-width)
  overlays?: Overlay[];
  highlights?: Highlight[];
};

export type CursorKey = Key; // f, x, y (CSS px of active page), o (opacity)

const FADE = 10;

const camAt = (p: Page, f: number) => ({ cx: keyed(f, p.cam, "cx"), cy: keyed(f, p.cam, "cy"), z: keyed(f, p.cam, "z") });

/** Browser window showing real clasp.fun captures with camera moves, highlights and a cursor. */
export const Browser: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  pages: Page[];
  cursor?: CursorKey[];
  clicks?: number[];
  badge?: { text: string; from: number; to: number };
  enter?: number;
}> = ({ x, y, w, h, pages, cursor, clicks = [], badge, enter = 0 }) => {
  const f = useCurrentFrame();
  const bar = 58;
  const vw = w;
  const vh = h - bar;
  const s0 = vw / 1440;
  const appear = ramp(f, enter, enter + 22);
  const active = [...pages].reverse().find((p) => f >= p.from) ?? pages[0];
  const urlPage = active;

  const toScreen = (p: Page, px: number, py: number) => {
    const c = camAt(p, f);
    const s = s0 * c.z;
    return { sx: vw / 2 + (px - c.cx) * s, sy: vh / 2 + (py - c.cy) * s, s };
  };

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 22,
        overflow: "hidden",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "0 2px 4px rgba(22,21,26,0.04), 0 40px 90px -30px rgba(22,21,26,0.30)",
        opacity: appear,
        transform: `translateY(${(1 - appear) * 40}px) scale(${0.97 + 0.03 * appear})`,
      }}
    >
      {/* Window bar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: C.paper2, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ position: "absolute", left: 22, top: 22, display: "flex", gap: 9 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: "#ddd5c7" }} />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 11,
            transform: "translateX(-50%)",
            height: 36,
            minWidth: 420,
            padding: "0 22px",
            borderRadius: 18,
            background: C.card,
            border: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontFamily: FONT_BODY,
            fontSize: 19,
            color: C.ink2,
          }}
        >
          <svg width={14} height={16} viewBox="0 0 14 16">
            <rect x={1} y={7} width={12} height={8} rx={2} fill={C.ink3} />
            <path d="M4 7V5a3 3 0 0 1 6 0v2" stroke={C.ink3} strokeWidth={1.8} fill="none" />
          </svg>
          <span key={urlPage.url} style={{ opacity: ramp(f, urlPage.from, urlPage.from + 8) }}>
            {urlPage.url}
          </span>
        </div>
        {badge && f >= badge.from - 10 && f < badge.to + 10 ? (
          <div
            style={{
              position: "absolute",
              right: 18,
              top: 12,
              height: 34,
              padding: "0 16px",
              borderRadius: 17,
              background: C.warnSoft,
              color: C.warn,
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 17,
              display: "flex",
              alignItems: "center",
              opacity: Math.min(ramp(f, badge.from, badge.from + 10), 1 - ramp(f, badge.to - 10, badge.to)),
            }}
          >
            {badge.text}
          </div>
        ) : null}
      </div>

      {/* Viewport */}
      <div style={{ position: "absolute", left: 0, top: bar, width: vw, height: vh, overflow: "hidden", background: C.paper }}>
        {pages.map((p, i) => {
          if (f < p.from - 1 || f > p.to + FADE) return null;
          const o = i === 0 ? 1 : ramp(f, p.from, p.from + FADE, inOut);
          const c = camAt(p, f);
          const s = s0 * c.z;
          return (
            <div key={i} style={{ position: "absolute", inset: 0, opacity: o }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: p.cssW,
                  height: p.cssH,
                  transformOrigin: "0 0",
                  transform: `translate(${vw / 2 - c.cx * s}px, ${vh / 2 - c.cy * s}px) scale(${s})`,
                }}
              >
                <Img src={staticFile(p.src)} style={{ position: "absolute", left: 0, top: 0, width: p.cssW, height: p.cssH }} />
                {(p.overlays ?? []).map((ov, k) => {
                  if (f < ov.from || (ov.to !== undefined && f >= ov.to)) return null;
                  return (
                    <div
                      key={k}
                      style={{
                        position: "absolute",
                        left: ov.rect.x,
                        top: ov.rect.y,
                        width: ov.rect.w,
                        height: ov.clipH ?? ov.rect.h,
                        overflow: "hidden",
                      }}
                    >
                      <Img src={staticFile(ov.src)} style={{ width: ov.rect.w, height: ov.rect.h, display: "block" }} />
                    </div>
                  );
                })}
                {(p.highlights ?? []).map((hl, k) => {
                  if (f < hl.from - 1 || f > hl.to + 12) return null;
                  const t = Math.min(ramp(f, hl.from, hl.from + 12), 1 - ramp(f, hl.to, hl.to + 12, easeIn));
                  const pad = hl.pad ?? 10;
                  const color = hl.tone === "warn" ? "#c98a00" : hl.tone === "ink" ? C.ink : C.accent;
                  return (
                    <div
                      key={k}
                      style={{
                        position: "absolute",
                        left: hl.rect.x - pad,
                        top: hl.rect.y - pad,
                        width: hl.rect.w + pad * 2,
                        height: hl.rect.h + pad * 2,
                        borderRadius: 16,
                        border: `${3 / s}px solid ${color}`,
                        boxShadow: `0 0 0 ${6 / s}px ${hl.tone === "warn" ? "rgba(201,138,0,0.18)" : "rgba(61,59,243,0.16)"}, 0 0 0 9999px rgba(22,21,26,${(hl.dim ?? 0.28) * t})`,
                        opacity: t,
                        transform: `scale(${1.04 - 0.04 * ramp(f, hl.from, hl.from + 14, easeOut)})`,
                      }}
                    />
                  );
                })}
              </div>
              {/* Screen-space labels */}
              {(p.highlights ?? []).map((hl, k) => {
                if (!hl.label || f < hl.from - 1 || f > hl.to + 12) return null;
                const la = hl.labelAt ?? hl.from + 6;
                const t = Math.min(ramp(f, la, la + 12), 1 - ramp(f, hl.to, hl.to + 10, easeIn));
                const pad = hl.pad ?? 10;
                const side = hl.labelSide ?? "bottom";
                const cxp = side === "left" ? hl.rect.x - pad : side === "right" ? hl.rect.x + hl.rect.w + pad : hl.rect.x + hl.rect.w / 2;
                const cyp = side === "top" ? hl.rect.y - pad : side === "bottom" ? hl.rect.y + hl.rect.h + pad : hl.rect.y + hl.rect.h / 2;
                const { sx, sy } = toScreen(p, cxp, cyp);
                const tx = side === "left" ? "-100%" : side === "right" ? "0%" : "-50%";
                const ty = side === "top" ? "-100%" : side === "bottom" ? "0%" : "-50%";
                const gap = 16;
                const off = { top: [0, -gap], bottom: [0, gap], left: [-gap, 0], right: [gap, 0] }[side];
                const bg = hl.tone === "warn" ? C.warnSoft : hl.tone === "ink" ? C.ink : C.accent;
                const fg = hl.tone === "warn" ? C.warn : "#fff";
                return (
                  <div
                    key={`l${k}`}
                    style={{
                      position: "absolute",
                      left: sx + off[0],
                      top: sy + off[1],
                      transform: `translate(${tx}, ${ty}) translateY(${(1 - t) * 8}px)`,
                      opacity: t,
                      padding: "12px 20px",
                      borderRadius: 14,
                      background: bg,
                      color: fg,
                      border: hl.tone === "warn" ? "1px solid #f1dfa8" : "none",
                      fontFamily: FONT_BODY,
                      fontWeight: 600,
                      fontSize: 26,
                      whiteSpace: "nowrap",
                      boxShadow: "0 12px 30px -12px rgba(22,21,26,0.35)",
                    }}
                  >
                    {hl.label}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Cursor */}
        {cursor && cursor.length
          ? (() => {
              const cx = keyed(f, cursor, "x", inOut);
              const cy = keyed(f, cursor, "y", inOut);
              const co = keyed(f, cursor, "o", (v) => v);
              if (co <= 0.01) return null;
              const { sx, sy } = toScreen(active, cx, cy);
              const lastClick = [...clicks].reverse().find((c) => f >= c);
              const since = lastClick === undefined ? 999 : f - lastClick;
              const press = since < 8 ? 1 - Math.abs(since - 3) / 5 : 0;
              const ring = since < 20 ? since / 20 : 1;
              return (
                <>
                  {since < 20 ? (
                    <div
                      style={{
                        position: "absolute",
                        left: sx - 36 * ring,
                        top: sy - 36 * ring,
                        width: 72 * ring,
                        height: 72 * ring,
                        borderRadius: "50%",
                        border: `3px solid ${C.accent}`,
                        opacity: (1 - ring) * 0.9 * co,
                      }}
                    />
                  ) : null}
                  <svg
                    width={40}
                    height={40}
                    viewBox="0 0 24 24"
                    style={{
                      position: "absolute",
                      left: sx - 5,
                      top: sy - 3,
                      opacity: co,
                      transform: `scale(${1 - 0.14 * Math.max(0, press)})`,
                      transformOrigin: "5px 3px",
                      filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.25))",
                    }}
                  >
                    <path d="M4 2.5l15 8.2-6.4 1.6 3.6 6.6-2.6 1.4-3.6-6.6-4.8 4.5z" fill="#fff" stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
                  </svg>
                </>
              );
            })()
          : null}
      </div>
    </div>
  );
};
