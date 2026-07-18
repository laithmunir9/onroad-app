import { useEffect, useRef, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import Screen from "../components/Screen";
import Button from "../components/Button";
import Logo from "../components/Logo";
import BackButton from "../components/BackButton";
import EndRideSheet from "../components/EndRideSheet";
import { EyeOffIcon, AlertTriangleIcon, CheckIcon, ClockIcon, StopSquareIcon } from "../components/Icons";
import { getSocket } from "../lib/socket";
import { createRide } from "../lib/api";
import { fmtTime, colors } from "../lib/theme";
import { SOFT_ALERT_SEC, ALARM_SEC, SPEED_THRESHOLD_MPH } from "../lib/constants";
import { FaceMonitor } from "../lib/faceMonitor";
import { startSpeedTracking, requestMotionPermission } from "../lib/speed";

export default function DriverPage() {
  const [step, setStep] = useState("setup"); // setup | starting | monitoring | error
  const [driverName, setDriverName] = useState("");
  const [carLabel, setCarLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [ride, setRide] = useState(null); // live state snapshot from server
  const [speedOk, setSpeedOk] = useState(true);
  const [modelReady, setModelReady] = useState(false);
  const [devSkipSpeedGate, setDevSkipSpeedGate] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).get("devSkipSpeedGate") === "1"
  );
  const [showEnd, setShowEnd] = useState(false);

  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const monitorRef = useRef(null);
  const stopSpeedRef = useRef(null);
  const streamRef = useRef(null);
  const codeRef = useRef(null);
  const speedOkRef = useRef(true);

  const effectiveSpeedOk = speedOk || devSkipSpeedGate;

  useEffect(() => {
    speedOkRef.current = effectiveSpeedOk;
  }, [effectiveSpeedOk]);

  const teardown = useCallback(() => {
    monitorRef.current?.stop();
    monitorRef.current = null;
    stopSpeedRef.current?.();
    stopSpeedRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  async function handleStartRide(e) {
    e.preventDefault();
    setErrorMsg("");
    setRide(null);
    setStep("starting");
    try {
      const { code } = await createRide({ driverName: driverName.trim() || "Driver", carLabel: carLabel.trim() });
      codeRef.current = code;

      // Must be requested inside this click-driven handler for browser permission prompts.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      await requestMotionPermission();

      const socket = getSocket();
      socketRef.current = socket;
      if (!socket.connected) socket.connect();
      await new Promise((resolve, reject) => {
        socket.emit("join", { code, role: "driver", name: driverName.trim() || "Driver" }, (res) => {
          if (res?.ok) resolve(res.state);
          else reject(new Error(res?.error || "Could not start ride"));
        });
      });

      // A driver can now end a ride and start a fresh one without reloading
      // the page — drop any listener from a prior ride on this same socket
      // before attaching a new one.
      socket.off("ride:state");
      socket.on("ride:state", (state) => setRide(state));
      socket.off("ride:ended");
      socket.on("ride:ended", () => {
        teardown();
        setStep("setup");
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});

      stopSpeedRef.current = startSpeedTracking(({ aboveThreshold }) => {
        setSpeedOk(aboveThreshold);
        socket.emit("driver:speed", { aboveThreshold });
      });

      const monitor = new FaceMonitor(videoRef.current, {
        isActive: () => speedOkRef.current,
        onDistractionStart: (type) => socket.emit("driver:distraction-start", { type }),
        onDistractionEnd: () => socket.emit("driver:distraction-end"),
      });
      monitorRef.current = monitor;
      await monitor.start();
      setModelReady(true);
      setStep("monitoring");
    } catch (err) {
      teardown();
      setErrorMsg(err.message || "Something went wrong starting the ride.");
      setStep("error");
    }
  }

  function askEndRide() {
    setShowEnd(true);
  }

  function cancelEndRide() {
    setShowEnd(false);
  }

  function confirmEndRide() {
    socketRef.current?.emit("driver:end-ride");
    teardown();
    setShowEnd(false);
    setStep("setup");
  }

  if (step === "setup" || step === "starting" || step === "error") {
    return (
      <Screen background="radial-gradient(120% 80% at 50% -10%,#0a1f45 0%,#030c22 60%)">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
          <BackButton />
          <Logo size={30} radius={8} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>OnRoad</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22, maxWidth: 380, margin: "0 auto", width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 24,
                background: "rgba(53,214,164,.12)",
                border: "1px solid rgba(53,214,164,.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <EyeOffIcon size={32} color="#35D6A4" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Start a ride</div>
            <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 8, lineHeight: 1.5 }}>
              Your camera watches the road ahead of you — no video ever leaves this device, only distraction events.
            </div>
          </div>

          <form onSubmit={handleStartRide} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
              required
            />
            <input
              value={carLabel}
              onChange={(e) => setCarLabel(e.target.value)}
              placeholder="Vehicle (optional)"
              style={inputStyle}
            />
            {errorMsg && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,85,69,.1)", border: "1px solid rgba(255,85,69,.35)", borderRadius: 16, padding: "12px 14px" }}>
                <AlertTriangleIcon size={18} color="#FF7A70" />
                <span style={{ fontSize: 12.5, color: "#ffb3ad", lineHeight: 1.4 }}>{errorMsg}</span>
              </div>
            )}
            <Button type="submit" disabled={step === "starting"}>
              {step === "starting" ? "Requesting camera & location…" : "Start monitoring"}
            </Button>
            <div style={{ fontSize: 11.5, color: colors.textDim, textAlign: "center", lineHeight: 1.5 }}>
              Requires camera and location access. Monitoring only runs while the vehicle is moving above {SPEED_THRESHOLD_MPH} mph.
            </div>
          </form>
        </div>
        <video ref={videoRef} muted playsInline style={{ display: "none" }} />
      </Screen>
    );
  }

  return (
    <MonitoringScreen
      ride={ride}
      code={codeRef.current}
      speedOk={effectiveSpeedOk}
      modelReady={modelReady}
      videoRef={videoRef}
      devSkipSpeedGate={devSkipSpeedGate}
      onToggleDevSkipSpeedGate={import.meta.env.DEV ? () => setDevSkipSpeedGate((v) => !v) : undefined}
      showEnd={showEnd}
      onAskEnd={askEndRide}
      onCancelEnd={cancelEndRide}
      onConfirmEnd={confirmEndRide}
    />
  );
}

const inputStyle = {
  width: "100%",
  height: 52,
  borderRadius: 16,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#fff",
  fontSize: 15,
  padding: "0 16px",
  outline: "none",
};

function MonitoringScreen({
  ride,
  code,
  speedOk: effectiveSpeedOk,
  modelReady,
  videoRef,
  devSkipSpeedGate,
  onToggleDevSkipSpeedGate,
  showEnd,
  onAskEnd,
  onCancelEnd,
  onConfirmEnd,
}) {
  const distraction = ride?.distraction || null;
  const secs = distraction?.secs ?? 0;
  const phase = !effectiveSpeedOk ? "paused" : distraction ? (secs >= ALARM_SEC ? "alarm" : secs >= SOFT_ALERT_SEC ? "soft" : "calm") : "calm";

  const palette = {
    calm: { ring: "rgba(53,214,164,.3)", bg: "radial-gradient(circle at 50% 40%,#0d2c56,#071a3a)", color: colors.green, chip: "rgba(53,214,164,.14)", word: "Focused", sub: "Focused on the road", icon: (color) => <CheckIcon size={16} color={color} strokeWidth={2.6} /> },
    paused: { ring: "rgba(138,160,200,.35)", bg: "radial-gradient(circle at 50% 40%,#1a2438,#0c1220)", color: "#8aa0c8", chip: "rgba(138,160,200,.16)", word: "Standby", sub: "Vehicle stopped — monitoring paused", icon: (color) => <ClockIcon size={16} color={color} strokeWidth={2.2} /> },
    soft: { ring: "rgba(245,166,35,.45)", bg: "radial-gradient(circle at 50% 40%,#3a2c0d,#1a1405)", color: colors.orange, chip: "rgba(245,166,35,.16)", word: "Caution", sub: `${distraction?.type === "eyes_closed" ? "Eyes closed" : "Looking away"} · ${secs}s`, icon: (color) => <EyeOffIcon size={16} color={color} strokeWidth={2.2} /> },
    alarm: { ring: "rgba(255,85,69,.45)", bg: "radial-gradient(circle at 50% 40%,#5e1512,#2a0906)", color: colors.red, chip: "rgba(255,85,69,.16)", word: "Alert", sub: `${distraction?.type === "eyes_closed" ? "Eyes closed" : "Looking away"} · ${secs}s — pull over`, icon: (color) => <AlertTriangleIcon size={16} color={color} strokeWidth={2.4} /> },
  }[phase];

  const ambient = {
    calm: "linear-gradient(180deg,#071a3a 0%,#03102a 55%,#030c22 100%)",
    paused: "linear-gradient(180deg,#141b2c 0%,#0a0f1c 55%,#060a14 100%)",
    soft: "linear-gradient(180deg,#2e2109 0%,#0a1120 55%,#050b18 100%)",
    alarm: "linear-gradient(180deg,#4a1109 0%,#1a0708 55%,#0a0406 100%)",
  }[phase];

  const joinUrl = `${window.location.origin}/rider/${code || ""}`;

  return (
    <Screen background={ambient} style={{ transition: "background .8s ease" }}>
      <video ref={videoRef} muted playsInline style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Logo size={30} radius={8} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>OnRoad</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onToggleDevSkipSpeedGate && (
            <button
              onClick={onToggleDevSkipSpeedGate}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".04em",
                color: devSkipSpeedGate ? "#04122b" : "#FFC303",
                background: devSkipSpeedGate ? "#FFC303" : "rgba(245,166,35,.14)",
                border: "1px solid rgba(245,166,35,.5)",
                borderRadius: 999,
                padding: "5px 10px",
                cursor: "pointer",
              }}
            >
              {devSkipSpeedGate ? "DEV: SPEED GATE BYPASSED" : "DEV: BYPASS SPEED GATE"}
            </button>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: colors.textDim, letterSpacing: ".13em", textTransform: "uppercase" }}>Driver</span>
          <button
            onClick={onAskEnd}
            aria-label="End ride"
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "#a9bdde",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flex: "none",
            }}
          >
            <StopSquareIcon size={15} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 44,
            background: palette.bg,
            border: `2px solid ${palette.ring}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 44px ${palette.color}33`,
            transition: "background .6s ease, box-shadow .6s ease, border-color .6s ease",
            animation: phase === "alarm" ? "shake .5s ease-in-out infinite" : "eyepulse 3.4s ease-in-out infinite",
          }}
        >
          <Logo size={104} radius={26} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 999, background: palette.chip }}>
            {palette.icon(palette.color)}
            <span style={{ fontSize: 19, fontWeight: 700, color: palette.color }}>{palette.word}</span>
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 10, lineHeight: 1.45 }}>
            {!modelReady ? "Starting detection…" : palette.sub}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          <StatCard label="Trip time" value={fmtTime(ride?.elapsed ?? 0)} mono />
          <StatCard
            label="Monitoring"
            value={
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: effectiveSpeedOk ? colors.green : colors.orange }} />
                {effectiveSpeedOk ? "Active" : "Paused"}
              </span>
            }
          />
        </div>
      </div>

      {phase === "soft" && (
        <AlertReflection color="#FFC303" bg="rgba(245,166,35,.14)" border="rgba(245,166,35,.5)" title="Stay focused" sub="Your eyes drifted from the road." icon={<EyeOffIcon size={22} color="#F5A623" />} />
      )}
      {phase === "alarm" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#c81e12", borderRadius: 20, padding: "16px 16px", marginBottom: 14, boxShadow: "0 0 30px rgba(200,30,18,.5)", animation: "softpulse 1s ease-in-out infinite" }}>
          <AlertTriangleIcon size={26} color="#fff" strokeWidth={2.4} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: ".02em" }}>EYES ON THE ROAD</div>
            <div style={{ fontSize: 12, color: "#ffd7d3" }}>Wake up — pull over if drowsy.</div>
          </div>
        </div>
      )}

      {!ride?.riderConnected ? (
        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 24, padding: "18px 18px 16px", display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 88, height: 88, background: "#fff", borderRadius: 16, padding: 7, flex: "none" }}>
            <QRCodeSVG value={joinUrl} size={74} bgColor="#fff" fgColor="#04122b" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: colors.textDim, letterSpacing: ".13em", textTransform: "uppercase" }}>Ride code</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 27, fontWeight: 700, letterSpacing: ".06em", margin: "3px 0 6px" }}>{code}</div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 1.4 }}>Share the code or QR so your rider can follow the ride.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(53,214,164,.1)", border: "1px solid rgba(53,214,164,.35)", borderRadius: 24, padding: "16px 18px" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(53,214,164,.2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <CheckIcon size={20} strokeWidth={2.6} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Rider connected</div>
            <div style={{ fontSize: 12, color: "#8fb9a9" }}>{ride.riderName || "Your rider"} is following this ride · {fmtTime(ride.elapsed)}</div>
          </div>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: colors.textDim }}>{code}</span>
        </div>
      )}

      {showEnd && (
        <EndRideSheet
          onCancel={onCancelEnd}
          onConfirm={onConfirmEnd}
          description={
            <>
              Monitoring will stop and your rider
              <br />
              will get a safety summary for the trip.
            </>
          }
          confirmLabel="End Ride"
          cancelLabel="Keep monitoring"
        />
      )}
    </Screen>
  );
}

function StatCard({ label, value, mono }) {
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: "12px 14px", boxShadow: "0 8px 22px rgba(3,10,25,.35)" }}>
      <div style={{ fontSize: 10.5, color: colors.textDim, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: mono ? "'Space Mono', monospace" : undefined, fontSize: 20, fontWeight: 700, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function AlertReflection({ color, bg, border, title, sub, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: "13px 15px", marginBottom: 14, animation: "slideDown .3s ease" }}>
      {icon}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color }}>{title}</div>
        <div style={{ fontSize: 12, color: "#c7b183" }}>{sub}</div>
      </div>
    </div>
  );
}
