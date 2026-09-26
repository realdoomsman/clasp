export const C = {
  paper: "#fbf8f3",
  paper2: "#f4eee4",
  card: "#ffffff",
  ink: "#16151a",
  ink2: "#45424d",
  ink3: "#6b6773",
  line: "#e8e1d5",
  accent: "#3d3bf3",
  accentStrong: "#2a27c7",
  accentSoft: "#ecebff",
  lavender: "#c7c6ff",
  good: "#11764a",
  goodSoft: "#e3f4ea",
  warn: "#7a5200",
  warnSoft: "#fff3d1",
  bad: "#c2362b",
  badSoft: "#fde8e5",
};

export const FONT_DISPLAY = "Outfit, sans-serif";
export const FONT_BODY = "Inter, sans-serif";

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const shadow = "0 1px 2px rgba(22,21,26,0.04), 0 12px 32px -8px rgba(22,21,26,0.10), 0 32px 64px -24px rgba(22,21,26,0.10)";
export const shadowLift = "0 2px 4px rgba(22,21,26,0.05), 0 24px 48px -12px rgba(22,21,26,0.16), 0 48px 96px -32px rgba(22,21,26,0.16)";

export const display = (size: number, weight = 600): React.CSSProperties => ({
  fontFamily: FONT_DISPLAY,
  fontWeight: weight,
  fontSize: size,
  letterSpacing: "-0.02em",
  lineHeight: 1.04,
  color: C.ink,
});

export const body = (size: number, weight = 400): React.CSSProperties => ({
  fontFamily: FONT_BODY,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 1.4,
  color: C.ink2,
});

export const tab: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };
