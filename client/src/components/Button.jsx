import { useState } from "react";

const VARIANTS = {
  primary: {
    background: "#F5A623",
    hoverBackground: "#FFC303",
    color: "#04122b",
    border: "none",
  },
  ghost: {
    background: "transparent",
    hoverBackground: "transparent",
    color: "#a9bdde",
    border: "1px solid rgba(255,255,255,.14)",
    hoverBorder: "1px solid rgba(255,255,255,.3)",
  },
  outline: {
    background: "rgba(255,255,255,.06)",
    hoverBackground: "rgba(255,255,255,.06)",
    color: "#fff",
    border: "1.5px solid rgba(255,255,255,.16)",
    hoverBorder: "1.5px solid #FF5545",
    hoverColor: "#FF7A70",
  },
  danger: {
    background: "#FF3B30",
    hoverBackground: "#E5342A",
    color: "#fff",
    border: "none",
  },
  white: {
    background: "#fff",
    hoverBackground: "#ffecea",
    color: "#c81e12",
    border: "none",
  },
};

export default function Button({
  variant = "primary",
  height = 56,
  fullWidth = true,
  children,
  style,
  disabled,
  ...props
}) {
  const [hover, setHover] = useState(false);
  const v = VARIANTS[variant];
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        width: fullWidth ? "100%" : undefined,
        height,
        borderRadius: 20,
        background: hover ? v.hoverBackground : v.background,
        border: hover ? v.hoverBorder || v.border : v.border,
        color: hover ? v.hoverColor || v.color : v.color,
        fontFamily: "'Rubik', system-ui, sans-serif",
        fontSize: 16,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        transition: "background .15s ease, border-color .15s ease, color .15s ease",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
