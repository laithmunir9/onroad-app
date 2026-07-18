export default function Screen({ background, children, style }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: background || "linear-gradient(180deg,#071a3a,#03102a 50%)",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        paddingLeft: "calc(env(safe-area-inset-left, 0px) + 22px)",
        paddingRight: "calc(env(safe-area-inset-right, 0px) + 22px)",
        color: "#fff",
        fontFamily: "'Rubik', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
