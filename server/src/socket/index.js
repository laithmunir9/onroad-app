import {
  getRide,
  driverJoin,
  riderJoin,
  handleDisconnect,
  setSpeed,
  startDistraction,
  endDistraction,
  endRide,
  publicState,
  summarize,
  setBroadcaster,
} from "../rideStore.js";
import { createRateLimiter } from "../rateLimiter.js";
import { sanitizeName } from "../sanitize.js";

const room = (code) => `ride:${code}`;

// Join attempts are the actual brute-force vector for a 6-character ride
// code — generous enough for a mistyped code or a legitimate resume/rejoin,
// low enough to make guessing codes at scale impractical.
const joinLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 20 });

function clientIp(socket) {
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return socket.handshake.address;
}

// Only the socket that most recently joined as driver for this ride code
// "is" the driver — driverJoin keeps driverSocketId current on every join,
// including a legitimate resume-after-reload, so this also handles that
// case correctly without extra work.
function isCurrentDriverSocket(socket) {
  if (socket.data.role !== "driver" || !socket.data.code) return false;
  const ride = getRide(socket.data.code);
  return !!ride && ride.driverSocketId === socket.id;
}

export function registerSocketHandlers(io) {
  setBroadcaster((code, state, extra) => {
    io.to(room(code)).emit("ride:state", state);
    if (extra && extra.type) {
      io.to(room(code)).emit(extra.type, {});
      if (extra.type === "ride:ended") {
        const ride = getRide(code);
        if (ride) io.to(room(code)).emit("ride:summary", summarize(ride));
      }
    }
  });

  io.on("connection", (socket) => {
    socket.data.code = null;
    socket.data.role = null;

    socket.on("join", ({ code, role, name }, ack) => {
      if (!joinLimiter.check(clientIp(socket))) {
        if (typeof ack === "function") ack({ ok: false, error: "Too many attempts — try again in a few minutes." });
        return;
      }

      const ride = getRide(code);
      if (!ride) {
        if (typeof ack === "function") ack({ ok: false, error: "Ride not found" });
        return;
      }

      const nameResult = sanitizeName(name, role === "driver" ? "Driver" : "Rider");
      if (!nameResult.ok) {
        if (typeof ack === "function") ack({ ok: false, error: "Invalid name" });
        return;
      }

      socket.join(room(code));
      socket.data.code = code.toUpperCase();
      socket.data.role = role;

      const updated =
        role === "driver"
          ? driverJoin(code, socket.id, nameResult.value)
          : riderJoin(code, socket.id, nameResult.value);

      if (typeof ack === "function") {
        ack({ ok: true, state: publicState(updated) });
      }
    });

    socket.on("driver:distraction-start", ({ type }) => {
      if (!isCurrentDriverSocket(socket)) return;
      startDistraction(socket.data.code, type);
    });

    socket.on("driver:distraction-end", () => {
      if (!isCurrentDriverSocket(socket)) return;
      endDistraction(socket.data.code);
    });

    socket.on("driver:speed", ({ aboveThreshold }) => {
      if (!isCurrentDriverSocket(socket)) return;
      setSpeed(socket.data.code, aboveThreshold);
    });

    socket.on("rider:end-ride", () => {
      if (socket.data.role !== "rider" || !socket.data.code) return;
      endRide(socket.data.code);
    });

    socket.on("driver:end-ride", () => {
      if (socket.data.role !== "driver" || !socket.data.code) return;
      endRide(socket.data.code);
    });

    socket.on("disconnect", () => {
      handleDisconnect(socket.id);
    });
  });
}
