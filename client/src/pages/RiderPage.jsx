import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Screen from "../components/Screen";
import Button from "../components/Button";
import Logo from "../components/Logo";
import BackButton from "../components/BackButton";
import EndRideSheet from "../components/EndRideSheet";
import QrScanner from "../components/QrScanner";
import { EyeOffIcon, AlertTriangleIcon, CheckIcon, WifiOffIcon, StopSquareIcon, ArrowRightIcon, QRScanIcon } from "../components/Icons";
import { getSocket } from "../lib/socket";
import { fetchSummary } from "../lib/api";
import { fmtTime, colors } from "../lib/theme";
import { SOFT_ALERT_SEC, ALARM_SEC } from "../lib/constants";
import { AlertAudio } from "../lib/audio";
import { saveSession, loadSession, clearSession } from "../lib/rideSession";

export default function RiderPage() {
  const { code: codeFromUrl } = useParams();
  const [connected, setConnected] = useState(false);
  const [ride, setRide] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showEnd, setShowEnd] = useState(false);
  // A URL-provided code is explicit intent (a fresh link/QR scan) and wins
  // over a stale saved session from a previous, possibly different ride.
  const [checkingResume, setCheckingResume] = useState(() => !codeFromUrl && loadSession()?.role === "rider");
  const audioRef = useRef(null);

  if (!audioRef.current) audioRef.current = new AlertAudio();
  useEffect(() => () => audioRef.current.dispose(), []);

  useEffect(() => {
    const socket = getSocket();
    const onSoft = () => {
      audioRef.current.playSoft();
      notify("Heads up", "The driver looked away from the road.");
    };
    const onAlarm = () => {
      audioRef.current.startAlarm();
      notify("Driver distracted", "Get the driver's attention now.", true);
    };
    const onSoundStop = () => audioRef.current.stopAlarm();
    // The server pushes 'ride:summary' right after 'ride:ended' (see rideStore
    // broadcast in server/src/socket/index.js), so this only needs to silence audio.
    const onEnded = () => audioRef.current.stopAlarm();
    // The ride is truly over once a summary exists — clear the saved session
    // so a later reload doesn't try to silently reconnect to it again.
    const onSummary = (s) => {
      setSummary(s);
      clearSession();
    };
    const onState = (state) => {
      setRide(state);
      if (!state.distraction) audioRef.current.stopAlarm();
    };

    socket.on("ride:state", onState);
    socket.on("alert:soft", onSoft);
    socket.on("alert:alarm", onAlarm);
    socket.on("alert:sound-stop", onSoundStop);
    socket.on("ride:ended", onEnded);
    socket.on("ride:summary", onSummary);

    return () => {
      socket.off("ride:state", onState);
      socket.off("alert:soft", onSoft);
      socket.off("alert:alarm", onAlarm);
      socket.off("alert:sound-stop", onSoundStop);
      socket.off("ride:ended", onEnded);
      socket.off("ride:summary", onSummary);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnected = useCallback((state) => {
    setRide(state);
    setConnected(true);
    saveSession({ role: "rider", code: state.code, riderName: state.riderName || "" });
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (state.status === "ended") {
      fetchSummary(state.code)
        .then((s) => {
          setSummary(s);
          clearSession();
        })
        .catch(() => {});
    }
  }, []);

  // Silently try to rejoin a ride the rider was following before a reload —
  // no camera/permissions involved on this side, so no confirmation needed.
  // The ride survives a disconnect server-side, so a still-live or
  // recently-ended code just reconnects; anything else falls through to the
  // normal connect screen.
  useEffect(() => {
    if (!checkingResume) return;
    const session = loadSession();
    if (!session || session.role !== "rider") {
      setCheckingResume(false);
      return;
    }
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit("join", { code: session.code, role: "rider", name: session.riderName || "Rider" }, (res) => {
      if (res?.ok) handleConnected(res.state);
      else clearSession();
      setCheckingResume(false);
    });
  }, [checkingResume, handleConnected]);

  const endRide = () => {
    getSocket().emit("rider:end-ride");
    setShowEnd(false);
  };

  if (checkingResume) {
    return (
      <Screen>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13.5, color: colors.textMuted }}>Reconnecting…</span>
        </div>
      </Screen>
    );
  }

  if (!connected) {
    return <ConnectScreen initialCode={codeFromUrl} audio={audioRef.current} onConnected={handleConnected} />;
  }

  if (summary) {
    return <SummaryScreen summary={summary} />;
  }

  if (!ride?.driverConnected) {
    return <LostScreen ride={ride} onAskEnd={() => setShowEnd(true)} showEnd={showEnd} onCancelEnd={() => setShowEnd(false)} onConfirmEnd={endRide} />;
  }

  const secs = ride.distraction?.secs ?? 0;
  const phase = ride.distraction ? (secs >= ALARM_SEC ? "alarm" : secs >= SOFT_ALERT_SEC ? "soft" : "calm") : "calm";

  if (phase === "alarm") {
    return <AlarmScreen ride={ride} onAskEnd={() => setShowEnd(true)} showEnd={showEnd} onCancelEnd={() => setShowEnd(false)} onConfirmEnd={endRide} />;
  }

  return <RideScreen ride={ride} phase={phase} onAskEnd={() => setShowEnd(true)} showEnd={showEnd} onCancelEnd={() => setShowEnd(false)} onConfirmEnd={endRide} />;
}

function notify(title, body, requireInteraction) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted" && document.hidden) {
    try {
      new Notification(title, { body, requireInteraction: !!requireInteraction });
    } catch {
      /* ignore */
    }
  }
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

function ConnectScreen({ initialCode, audio, onConnected }) {
  const [riderName, setRiderName] = useState("");
  const [chars, setChars] = useState(() => {
    const c = (initialCode || "").toUpperCase().slice(0, 6).split("");
    while (c.length < 6) c.push("");
    return c;
  });
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputsRef = useRef([]);

  function setChar(i, val) {
    const v = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    setChars((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  }

  async function connectWithCode(code) {
    if (code.length < 6) {
      setError("Enter the full 6-character ride code.");
      return;
    }
    setError("");
    setConnecting(true);
    audio.ensureCtx();
    try {
      const socket = getSocket();
      if (!socket.connected) socket.connect();
      const res = await new Promise((resolve, reject) => {
        socket.emit("join", { code, role: "rider", name: riderName.trim() || "Rider" }, (r) => {
          if (r?.ok) resolve(r);
          else reject(new Error(r?.error || "Could not connect"));
        });
      });
      onConnected(res.state);
    } catch (err) {
      setError(err.message || "Could not connect to that ride.");
    } finally {
      setConnecting(false);
    }
  }

  function connect(e) {
    e.preventDefault();
    connectWithCode(chars.join(""));
  }

  function handleScanDecode(text) {
    setScanning(false);
    const raw = text.split("/").filter(Boolean).pop() || text;
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (code.length < 6) {
      setError("Couldn't read a valid ride code from that QR code.");
      return;
    }
    setChars(code.split(""));
    connectWithCode(code);
  }

  return (
    <Screen>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "auto" }}>
        <BackButton />
        <Logo size={30} radius={8} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>OnRoad</span>
      </div>
      <div style={{ textAlign: "center", margin: "34px 0" }}>
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 24,
            background: "rgba(245,166,35,.12)",
            border: "1px solid rgba(245,166,35,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <EyeOffIcon size={34} color="#F5A623" />
        </div>
        <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-.01em" }}>Follow the ride</div>
        <div style={{ fontSize: 14, color: colors.textMuted, marginTop: 9, lineHeight: 1.55, maxWidth: 270, margin: "9px auto 0" }}>
          Enter the ride code from your driver's screen to watch their trip in real time.
        </div>
      </div>

      <form onSubmit={connect} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={riderName} onChange={(e) => setRiderName(e.target.value)} placeholder="Your name" style={inputStyle} />

        <div style={{ fontSize: 11, fontWeight: 600, color: colors.textDim, letterSpacing: ".13em", textTransform: "uppercase", margin: "8px 0 2px", textAlign: "center" }}>
          Ride code
        </div>
        <div style={{ display: "flex", gap: 9, justifyContent: "center", marginBottom: 8 }}>
          {chars.map((ch, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              value={ch}
              onChange={(e) => setChar(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              maxLength={1}
              style={{
                width: 44,
                height: 56,
                borderRadius: 16,
                background: "rgba(255,255,255,.05)",
                border: "1.5px solid rgba(245,166,35,.4)",
                textAlign: "center",
                fontFamily: "'Space Mono', monospace",
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
                outline: "none",
              }}
            />
          ))}
        </div>
        {error && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,85,69,.1)", border: "1px solid rgba(255,85,69,.35)", borderRadius: 16, padding: "12px 14px" }}>
            <AlertTriangleIcon size={18} color="#FF7A70" />
            <span style={{ fontSize: 12.5, color: "#ffb3ad", lineHeight: 1.4 }}>{error}</span>
          </div>
        )}
        <Button type="submit" disabled={connecting}>
          {connecting ? (
            "Connecting…"
          ) : (
            <>
              Connect to ride
              <ArrowRightIcon size={20} />
            </>
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setScanning(true)} disabled={connecting} height={48}>
          <QRScanIcon size={18} />
          Scan QR instead
        </Button>
      </form>

      {scanning && <QrScanner onDecode={handleScanDecode} onClose={() => setScanning(false)} />}
    </Screen>
  );
}

function StatusRing({ isCalm, color, glow, inner }) {
  return (
    <div style={{ position: "relative", width: 172, height: 172, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${color}`, animation: "breatheSlow 4.4s ease-in-out infinite" }} />
      <div style={{ width: 130, height: 130, borderRadius: "50%", background: inner, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 44px ${glow}` }}>
        {isCalm ? <CheckIcon size={58} strokeWidth={2.4} /> : <EyeOffIcon size={56} color="#F5A623" strokeWidth={2.2} />}
      </div>
    </div>
  );
}

function TopStrip({ ride }) {
  const total = ride.events.length;
  return (
    <div style={{ display: "flex", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 24, overflow: "hidden", marginBottom: 18, boxShadow: "0 12px 30px rgba(3,10,25,.4)" }}>
      <Cell label="Elapsed" value={fmtTime(ride.elapsed)} />
      <div style={{ width: 1, background: "rgba(255,255,255,.09)" }} />
      <Cell label="Status" value={ride.distraction ? "Watching" : "All clear"} color={ride.distraction ? colors.orange : colors.green} />
      <div style={{ width: 1, background: "rgba(255,255,255,.09)" }} />
      <Cell label="Flags" value={total} color={total > 0 ? colors.orange : colors.green} />
    </div>
  );
}

function Cell({ label, value, color }) {
  return (
    <div style={{ flex: 1, padding: "12px 15px" }}>
      <div style={{ fontSize: 10, color: colors.textDim, letterSpacing: ".11em", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 19, fontWeight: 700, marginTop: 3, color: color || "#fff" }}>{value}</div>
    </div>
  );
}

function DriverHeader({ ride }) {
  const initials = (ride.driverName || "D")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#1a3766,#0d2246)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, flex: "none" }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{ride.driverName || "Driver"}</div>
        {ride.carLabel && <div style={{ fontSize: 12.5, color: colors.textMuted }}>{ride.carLabel}</div>}
      </div>
    </div>
  );
}

function ActivityTicker({ ride }) {
  const chips = ride.events
    .filter((e) => ride.elapsed - e.timestamp < 60)
    .slice(-3)
    .reverse()
    .map((e) => {
      const ago = Math.max(0, ride.elapsed - e.timestamp);
      const ecx = e.type === "eyes_closed";
      return {
        label: `${ecx ? "Eyes closed" : "Looked away"} · ${e.duration}s`,
        ago: `${ago}s ago`,
        color: ecx ? colors.red : colors.orange,
        text: ecx ? "#ffb3ad" : "#f0cf94",
        bg: ecx ? "rgba(255,85,69,.12)" : "rgba(245,166,35,.12)",
        border: ecx ? "rgba(255,85,69,.35)" : "rgba(245,166,35,.3)",
      };
    });
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: ride.distraction ? colors.orange : colors.green }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: colors.textDim, letterSpacing: ".11em", textTransform: "uppercase" }}>Recent activity</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, minHeight: 46 }}>
        {chips.length > 0 ? (
          chips.map((chip, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: chip.bg, border: `1px solid ${chip.border}`, borderRadius: 16, padding: "8px 12px", animation: "chipIn .4s ease" }}>
              <EyeOffIcon size={16} color={chip.color} strokeWidth={2.2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: chip.text, flex: 1 }}>{chip.label}</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11.5, color: colors.textDim }}>{chip.ago}</span>
            </div>
          ))
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(53,214,164,.09)", border: "1px solid rgba(53,214,164,.25)", borderRadius: 16, padding: "8px 12px" }}>
            <CheckIcon size={16} strokeWidth={2.4} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#8fb9a9" }}>No recent distractions</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RideScreen({ ride, phase, onAskEnd, showEnd, onCancelEnd, onConfirmEnd }) {
  const isSoft = phase === "soft";
  const isCalm = phase === "calm";
  const secs = ride.distraction?.secs ?? 0;
  const bg = isSoft ? "linear-gradient(180deg,#2a1e08,#03102a 40%)" : "linear-gradient(180deg,#071a3a,#03102a 50%)";

  return (
    <Screen background={bg}>
      <DriverHeader ride={ride} />
      <TopStrip ride={ride} />

      {isSoft && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(245,166,35,.16)", border: "1.5px solid #F5A623", borderRadius: 20, padding: "14px 15px", marginBottom: 18, animation: "slideDown .35s ease" }}>
          <div style={{ width: 38, height: 38, borderRadius: 16, background: "rgba(245,166,35,.22)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", animation: "softpulse 1.4s ease-in-out infinite" }}>
            <EyeOffIcon size={21} color="#FFC303" strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#FFC303" }}>Heads up</div>
            <div style={{ fontSize: 12.5, color: "#d8c191", lineHeight: 1.4 }}>
              {ride.driverName || "Driver"} {ride.distraction?.type === "eyes_closed" ? "closed their eyes" : "looked away"} · {secs}s
            </div>
          </div>
        </div>
      )}

      {!ride.speedOk && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(138,160,200,.12)", border: "1px solid rgba(138,160,200,.3)", borderRadius: 14, padding: "10px 14px", marginBottom: 18 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: colors.textFaint }}>Vehicle stopped · monitoring paused</span>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <StatusRing
          isCalm={isCalm}
          color={isSoft ? "rgba(245,166,35,.4)" : "rgba(53,214,164,.32)"}
          glow={isSoft ? "rgba(245,166,35,.22)" : "rgba(53,214,164,.2)"}
          inner={isSoft ? "radial-gradient(circle at 50% 40%,#3a2c0d,#1a1405)" : "radial-gradient(circle at 50% 40%,#0d3a2c,#052018)"}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: isSoft ? colors.orange : colors.green, letterSpacing: "-.01em" }}>{isSoft ? "Caution" : "All clear"}</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 6 }}>{isSoft ? `Distracted for ${secs}s — watching` : "Driver is focused on the road"}</div>
        </div>
      </div>

      <ActivityTicker ride={ride} />

      <Button variant="outline" onClick={onAskEnd}>
        <StopSquareIcon size={19} />
        End Ride
      </Button>

      {showEnd && <EndRideSheet onCancel={onCancelEnd} onConfirm={onConfirmEnd} />}
    </Screen>
  );
}

function AlarmScreen({ ride, onAskEnd, showEnd, onCancelEnd, onConfirmEnd }) {
  const secs = ride.distraction?.secs ?? 0;
  const typeText = `${ride.distraction?.type === "eyes_closed" ? "Eyes closed" : "Looking away"} · ${secs}s`;
  return (
    <Screen style={{ animation: "alarmbg 1.1s ease-in-out infinite", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.28)", padding: "7px 14px", borderRadius: 999 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "softpulse .7s ease-in-out infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".14em" }}>ALARM SOUNDING</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, width: "100%" }}>
        <div style={{ position: "relative", width: 172, height: 172, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(255,255,255,.7)", animation: "alarmring 1.4s ease-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(255,255,255,.7)", animation: "alarmring 1.4s ease-out .7s infinite" }} />
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: "rgba(0,0,0,.22)", display: "flex", alignItems: "center", justifyContent: "center", animation: "shake .5s ease-in-out infinite" }}>
            <AlertTriangleIcon size={66} strokeWidth={2.2} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: ".01em", lineHeight: 1.05 }}>
            DRIVER
            <br />
            DISTRACTED
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, background: "rgba(0,0,0,.28)", padding: "8px 16px", borderRadius: 999 }}>
            <EyeOffIcon size={18} color="#fff" strokeWidth={2.2} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{typeText}</span>
          </div>
          <div style={{ fontSize: 14, color: "#ffd7d3", marginTop: 14, lineHeight: 1.5 }}>
            Get the driver's attention now.
            <br />
            Ask them to pull over safely.
          </div>
        </div>
      </div>
      <Button variant="white" onClick={onAskEnd}>
        <StopSquareIcon size={20} color="#c81e12" strokeWidth={2.6} />
        End Ride
      </Button>
      {showEnd && <EndRideSheet onCancel={onCancelEnd} onConfirm={onConfirmEnd} />}
    </Screen>
  );
}

function LostScreen({ ride, onAskEnd, showEnd, onCancelEnd, onConfirmEnd }) {
  return (
    <Screen background="linear-gradient(180deg,#141b2c,#080c16)">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: "auto" }}>
        <Logo size={30} radius={9} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>OnRoad</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <div style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(138,160,200,.16)", borderTopColor: "#8aa0c8", animation: "spin 1.1s linear infinite" }} />
          <WifiOffIcon />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 23, fontWeight: 700 }}>Connection lost</div>
          <div style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 9, lineHeight: 1.55, maxWidth: 250 }}>
            Trying to reconnect to {ride?.driverName || "the driver's"} device. Monitoring is paused until the signal returns.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(245,166,35,.12)", border: "1px solid rgba(245,166,35,.3)", borderRadius: 14, padding: "10px 14px" }}>
          <AlertTriangleIcon size={17} color="#F5A623" strokeWidth={2.2} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#e6c98f" }}>Monitoring paused · {fmtTime(ride?.elapsed ?? 0)}</span>
        </div>
      </div>
      <Button variant="outline" onClick={onAskEnd}>
        <StopSquareIcon size={19} />
        End Ride
      </Button>
      {showEnd && <EndRideSheet onCancel={onCancelEnd} onConfirm={onConfirmEnd} />}
    </Screen>
  );
}

function ScoreGauge({ score, color }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  return (
    <svg viewBox="0 0 96 96" width={96} height={96}>
      <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={8} />
      <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 48 48)" />
      <text x={48} y={54} textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize={26} fontWeight={700} fill="#fff">
        {score}
      </text>
    </svg>
  );
}

function SummaryScreen({ summary }) {
  const scoreColor = summary.score >= 88 ? colors.green : summary.score >= 72 ? colors.orange : colors.red;
  const when = summary.endedAt ? new Date(summary.endedAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <Screen background="linear-gradient(180deg,#071a3a,#03102a)" style={{ overflow: "auto" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.textDim, letterSpacing: ".13em", textTransform: "uppercase" }}>Ride complete</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.01em", margin: "5px 0 3px" }}>Ride Summary</div>
      <div style={{ fontSize: 13, color: colors.textMuted }}>
        {summary.driverName || "Driver"} · {fmtTime(summary.elapsed)} {when && `· ${when}`}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: 20, margin: "22px 0 16px" }}>
        <div style={{ position: "relative", width: 96, height: 96, flex: "none" }}>
          <ScoreGauge score={summary.score} color={scoreColor} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.textDim, letterSpacing: ".1em", textTransform: "uppercase" }}>Safety score</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor, marginTop: 3 }}>{summary.scoreLabel}</div>
          <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 4, lineHeight: 1.45, maxWidth: 150 }}>{summary.scoreNote}</div>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: "18px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 500 }}>Distraction events</div>
          <div style={{ fontSize: 12, color: colors.textDim, marginTop: 2 }}>Detected during the ride</div>
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{summary.totalEvents}</div>
      </div>

      <div style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: colors.textDim, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 16 }}>By type</div>
        <BreakdownRow icon={<EyeOffIcon size={19} color="#F5A623" />} label="Looked Away" count={summary.laCount} pct={summary.laPct} color="#F5A623" />
        <BreakdownRow icon={<EyeOffIcon size={19} color="#FF5545" />} label="Eyes Closed" count={summary.ecCount} pct={summary.ecPct} color="#FF5545" />
      </div>

      <div style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: "20px 20px 16px", marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: colors.textDim, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 20 }}>When they happened</div>
        <div style={{ position: "relative", height: 34, margin: "0 4px" }}>
          <div style={{ position: "absolute", top: 16, left: 0, right: 0, height: 3, borderRadius: 2, background: "rgba(255,255,255,.1)" }} />
          {summary.timeline.map((ev, i) => {
            const color = ev.type === "eyes_closed" ? "#FF5545" : "#F5A623";
            const glow = ev.type === "eyes_closed" ? "rgba(255,85,69,.7)" : "rgba(245,166,35,.6)";
            return (
              <div key={i} style={{ position: "absolute", top: 8, transform: "translateX(-50%)", left: `${ev.left}%` }}>
                <div style={{ width: 15, height: 15, borderRadius: "50%", background: color, border: "2.5px solid #0c1e40", boxShadow: `0 0 10px ${glow}` }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Space Mono', monospace", fontSize: 11, color: colors.textDim, marginTop: 2 }}>
          <span>0:00</span>
          <span>{fmtTime(summary.elapsed)}</span>
        </div>
      </div>

      <Button onClick={() => window.location.assign("/")}>Done</Button>
    </Screen>
  );
}

function BreakdownRow({ icon, label, count, pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "#e8eefb", fontWeight: 600, marginBottom: 6 }}>
          <span>{label}</span>
          <span style={{ fontFamily: "'Space Mono', monospace" }}>{count}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.07)" }}>
          <div style={{ height: "100%", borderRadius: 4, background: label === "Looked Away" ? "#F5A623" : "#FF5545", width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
