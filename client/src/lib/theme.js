export const colors = {
  bg: "#030c22",
  bgDeep: "#03102a",
  orange: "#F5A623",
  orangeHover: "#FFC303",
  green: "#35D6A4",
  red: "#FF5545",
  redBright: "#FF3B30",
  redDark: "#c81e12",
  textMuted: "#8298c0",
  textDim: "#6f86ad",
  textLight: "#a9bdde",
  textFaint: "#aebdd6",
  cardBg: "rgba(255,255,255,.05)",
  cardBorder: "rgba(255,255,255,.09)",
  white: "#ffffff",
};

export const fontMono = "'Space Mono', monospace";
export const fontSans = "'Rubik', system-ui, sans-serif";

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
