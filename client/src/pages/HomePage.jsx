import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { CarIcon, EyeOffIcon } from "../components/Icons";

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 28px",
        background: "radial-gradient(120% 80% at 50% -10%,#0a1f45 0%,#030c22 60%)",
        color: "#fff",
        fontFamily: "'Rubik', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "6%",
          left: "8%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(245,166,35,.16),transparent 70%)",
          filter: "blur(34px)",
          animation: "floatblob 15s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "6%",
          right: "6%",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(53,214,164,.12),transparent 70%)",
          filter: "blur(40px)",
          animation: "floatblob 19s ease-in-out infinite reverse",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
        <Logo size={52} radius={16} />
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1 }}>OnRoad</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#F5A623", letterSpacing: ".14em", textTransform: "uppercase", marginTop: 5 }}>
            Driver Monitoring
          </div>
        </div>
      </div>
      <p style={{ position: "relative", zIndex: 1, maxWidth: 320, textAlign: "center", color: "#8298c0", fontSize: 13.5, lineHeight: 1.55, margin: "10px 0 36px" }}>
        Real-time distraction monitoring for the drive, and clear alerts for whoever's riding along.
      </p>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        <button
          onClick={() => navigate("/driver")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            width: "100%",
            textAlign: "left",
            padding: "20px 20px",
            borderRadius: 24,
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
            cursor: "pointer",
          }}
        >
          <div style={{ width: 46, height: 46, borderRadius: 16, background: "rgba(53,214,164,.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <CarIcon size={22} color="#35D6A4" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>I'm driving</div>
            <div style={{ fontSize: 12.5, color: "#8298c0", marginTop: 2 }}>Start a monitored ride</div>
          </div>
        </button>

        <button
          onClick={() => navigate("/rider")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            width: "100%",
            textAlign: "left",
            padding: "20px 20px",
            borderRadius: 24,
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
            cursor: "pointer",
          }}
        >
          <div style={{ width: 46, height: 46, borderRadius: 16, background: "rgba(245,166,35,.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <EyeOffIcon size={22} color="#F5A623" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>I'm riding</div>
            <div style={{ fontSize: 12.5, color: "#8298c0", marginTop: 2 }}>Follow a driver's ride</div>
          </div>
        </button>
      </div>
    </div>
  );
}
