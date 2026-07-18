import { generateRideCode } from "./codeGen.js";
import {
  SOFT_ALERT_SEC,
  ALARM_SEC,
  ALARM_SOUND_STOP_SEC,
  DISTRACTION_FLOOR_SEC,
  RIDE_TTL_MS,
} from "./constants.js";

const rides = new Map();
let broadcast = () => {};

export function setBroadcaster(fn) {
  broadcast = fn;
}

function freshRide(code, driverName, carLabel) {
  return {
    code,
    driverName: driverName || "Driver",
    carLabel: carLabel || "",
    riderName: "",
    status: "live",
    createdAt: Date.now(),
    endedAt: null,
    elapsed: 0,
    driverConnected: false,
    riderConnected: false,
    driverSocketId: null,
    riderSocketId: null,
    speedOk: true,
    currentDistraction: null, // { type, startedAt: elapsedSec }
    events: [], // { type, timestamp: elapsedSec, duration: sec }
    _tick: null,
    _softTimer: null,
    _alarmTimer: null,
    _alarmStopTimer: null,
  };
}

export function createRide({ driverName, carLabel }) {
  let code = generateRideCode();
  while (rides.has(code)) code = generateRideCode();
  const ride = freshRide(code, driverName, carLabel);
  rides.set(code, ride);
  return ride;
}

export function getRide(code) {
  return rides.get((code || "").toUpperCase());
}

function clearAlertTimers(ride) {
  clearTimeout(ride._softTimer);
  clearTimeout(ride._alarmTimer);
  clearTimeout(ride._alarmStopTimer);
  ride._softTimer = null;
  ride._alarmTimer = null;
  ride._alarmStopTimer = null;
}

function startTick(ride) {
  if (ride._tick) return;
  ride._tick = setInterval(() => {
    if (ride.status !== "live") return;
    ride.elapsed += 1;
    broadcast(ride.code, publicState(ride));
  }, 1000);
}

function stopTick(ride) {
  clearInterval(ride._tick);
  ride._tick = null;
}

// The rides Map never shrinks on its own — every ride ever created (live,
// abandoned, or ended) stays in memory until swept. Age is measured from
// createdAt regardless of status, so this also catches rides that never
// got a rider or were never explicitly ended.
export function sweepStaleRides(now = Date.now()) {
  for (const [code, ride] of rides) {
    if (now - ride.createdAt > RIDE_TTL_MS) {
      clearAlertTimers(ride);
      stopTick(ride);
      rides.delete(code);
    }
  }
}

export function startCleanupSweep(intervalMs) {
  return setInterval(() => sweepStaleRides(), intervalMs);
}

export function driverJoin(code, socketId, name) {
  const ride = getRide(code);
  if (!ride) return null;
  ride.driverSocketId = socketId;
  ride.driverConnected = true;
  if (name) ride.driverName = name;
  startTick(ride);
  broadcast(ride.code, publicState(ride));
  return ride;
}

export function riderJoin(code, socketId, name) {
  const ride = getRide(code);
  if (!ride) return null;
  ride.riderSocketId = socketId;
  ride.riderConnected = true;
  if (name) ride.riderName = name;
  broadcast(ride.code, publicState(ride));
  return ride;
}

export function handleDisconnect(socketId) {
  for (const ride of rides.values()) {
    if (ride.driverSocketId === socketId) {
      ride.driverSocketId = null;
      ride.driverConnected = false;
      broadcast(ride.code, publicState(ride));
    }
    if (ride.riderSocketId === socketId) {
      ride.riderSocketId = null;
      ride.riderConnected = false;
      broadcast(ride.code, publicState(ride));
    }
  }
}

export function setSpeed(code, aboveThreshold) {
  const ride = getRide(code);
  if (!ride) return null;
  ride.speedOk = !!aboveThreshold;
  broadcast(ride.code, publicState(ride));
  return ride;
}

export function startDistraction(code, type) {
  const ride = getRide(code);
  if (!ride || ride.status !== "live") return null;
  if (ride.currentDistraction) return ride; // already tracking one
  clearAlertTimers(ride);
  ride.currentDistraction = { type, startedAt: ride.elapsed };

  ride._softTimer = setTimeout(() => {
    broadcast(ride.code, publicState(ride), { type: "alert:soft" });
  }, SOFT_ALERT_SEC * 1000);

  ride._alarmTimer = setTimeout(() => {
    broadcast(ride.code, publicState(ride), { type: "alert:alarm" });
    ride._alarmStopTimer = setTimeout(() => {
      broadcast(ride.code, publicState(ride), { type: "alert:sound-stop" });
    }, ALARM_SOUND_STOP_SEC * 1000);
  }, ALARM_SEC * 1000);

  broadcast(ride.code, publicState(ride));
  return ride;
}

export function endDistraction(code) {
  const ride = getRide(code);
  if (!ride || !ride.currentDistraction) return null;
  clearAlertTimers(ride);
  const { type, startedAt } = ride.currentDistraction;
  const duration = ride.elapsed - startedAt;
  ride.currentDistraction = null;
  if (duration >= DISTRACTION_FLOOR_SEC) {
    ride.events.push({ type, timestamp: startedAt, duration });
  }
  broadcast(ride.code, publicState(ride));
  return ride;
}

export function endRide(code) {
  const ride = getRide(code);
  if (!ride) return null;
  clearAlertTimers(ride);
  if (ride.currentDistraction) {
    const { type, startedAt } = ride.currentDistraction;
    const duration = ride.elapsed - startedAt;
    if (duration >= DISTRACTION_FLOOR_SEC) {
      ride.events.push({ type, timestamp: startedAt, duration });
    }
    ride.currentDistraction = null;
  }
  ride.status = "ended";
  ride.endedAt = Date.now();
  stopTick(ride);
  const state = publicState(ride);
  broadcast(ride.code, state, { type: "ride:ended" });
  return ride;
}

export function publicState(ride) {
  return {
    code: ride.code,
    driverName: ride.driverName,
    carLabel: ride.carLabel,
    riderName: ride.riderName,
    status: ride.status,
    elapsed: ride.elapsed,
    driverConnected: ride.driverConnected,
    riderConnected: ride.riderConnected,
    speedOk: ride.speedOk,
    distraction: ride.currentDistraction
      ? {
          type: ride.currentDistraction.type,
          secs: ride.elapsed - ride.currentDistraction.startedAt,
        }
      : null,
    events: ride.events,
    createdAt: ride.createdAt,
    endedAt: ride.endedAt,
  };
}

export function summarize(ride) {
  const events = ride.events;
  const total = events.length;
  const laCount = events.filter((e) => e.type === "looked_away").length;
  const ecCount = events.filter((e) => e.type === "eyes_closed").length;
  const score = Math.max(20, 100 - laCount * 5 - ecCount * 11);
  const scoreLabel =
    score >= 88 ? "Excellent" : score >= 72 ? "Good" : score >= 58 ? "Fair" : "Needs attention";
  const scoreNote =
    score >= 88
      ? "Focused and alert throughout the ride."
      : score >= 72
      ? "A few brief distractions, mostly attentive."
      : "Several distraction events — worth a check-in.";
  const maxT = Math.max(ride.elapsed, ...events.map((e) => e.timestamp), 1);
  const timeline = events.map((e) => ({
    type: e.type,
    timestamp: e.timestamp,
    duration: e.duration,
    left: +(8 + (e.timestamp / maxT) * 84).toFixed(1),
  }));
  return {
    code: ride.code,
    driverName: ride.driverName,
    riderName: ride.riderName,
    carLabel: ride.carLabel,
    elapsed: ride.elapsed,
    createdAt: ride.createdAt,
    endedAt: ride.endedAt,
    totalEvents: total,
    laCount,
    ecCount,
    laPct: total ? Math.round((laCount / Math.max(laCount, ecCount, 1)) * 100) : 0,
    ecPct: total ? Math.round((ecCount / Math.max(laCount, ecCount, 1)) * 100) : 0,
    score,
    scoreLabel,
    scoreNote,
    timeline,
    events,
  };
}
