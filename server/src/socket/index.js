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

const room = (code) => `ride:${code}`;

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
      const ride = getRide(code);
      if (!ride) {
        if (typeof ack === "function") ack({ ok: false, error: "Ride not found" });
        return;
      }
      socket.join(room(code));
      socket.data.code = code.toUpperCase();
      socket.data.role = role;

      const updated =
        role === "driver"
          ? driverJoin(code, socket.id, name)
          : riderJoin(code, socket.id, name);

      if (typeof ack === "function") {
        ack({ ok: true, state: publicState(updated) });
      }
    });

    socket.on("driver:distraction-start", ({ type }) => {
      if (socket.data.role !== "driver" || !socket.data.code) return;
      startDistraction(socket.data.code, type);
    });

    socket.on("driver:distraction-end", () => {
      if (socket.data.role !== "driver" || !socket.data.code) return;
      endDistraction(socket.data.code);
    });

    socket.on("driver:speed", ({ aboveThreshold }) => {
      if (socket.data.role !== "driver" || !socket.data.code) return;
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
