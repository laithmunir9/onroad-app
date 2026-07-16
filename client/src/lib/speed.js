import { SPEED_THRESHOLD_MPH } from "./constants";

const MPS_TO_MPH = 2.23694;
const EARTH_RADIUS_M = 6371000;

function haversineMeters(a, b) {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Tracks vehicle speed via Geolocation (preferred) with a DeviceMotion-based
// coarse movement fallback when geolocation speed isn't available (e.g. desktop
// browsers, or permission denied). Calls onUpdate({ mph, aboveThreshold, source }).
export function startSpeedTracking(onUpdate) {
  let lastPos = null;
  let watchId = null;
  let motionCleanup = null;
  let stopped = false;

  const emit = (mph, source) => {
    if (stopped) return;
    onUpdate({ mph, aboveThreshold: mph >= SPEED_THRESHOLD_MPH, source });
  };

  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy } = pos.coords;
        const ts = pos.timestamp;
        if (typeof speed === "number" && speed >= 0) {
          emit(speed * MPS_TO_MPH, "geolocation-speed");
          lastPos = { latitude, longitude, ts };
          return;
        }
        if (lastPos && accuracy != null && accuracy < 50) {
          const dtSec = (ts - lastPos.ts) / 1000;
          if (dtSec > 0.5) {
            const meters = haversineMeters(lastPos, { latitude, longitude });
            const mps = meters / dtSec;
            emit(mps * MPS_TO_MPH, "geolocation-derived");
            lastPos = { latitude, longitude, ts };
          }
        } else {
          lastPos = { latitude, longitude, ts };
        }
      },
      () => {
        motionCleanup = startMotionFallback(emit);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  } else {
    motionCleanup = startMotionFallback(emit);
  }

  return () => {
    stopped = true;
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    if (motionCleanup) motionCleanup();
  };
}

// Coarse movement proxy from accelerometer variance — DeviceMotion can't give
// absolute speed without drift-prone integration, so this only distinguishes
// "stationary" from "moving" rather than reporting a real mph figure.
function startMotionFallback(emit) {
  if (typeof DeviceMotionEvent === "undefined") {
    emit(0, "unavailable");
    return () => {};
  }
  let samples = [];
  const handler = (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a) return;
    const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    samples.push(mag);
    if (samples.length > 20) samples.shift();
    if (samples.length >= 5) {
      const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
      const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
      const moving = variance > 0.6;
      emit(moving ? SPEED_THRESHOLD_MPH + 1 : 0, "motion-fallback");
    }
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}

export async function requestMotionPermission() {
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    try {
      return (await DeviceMotionEvent.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true;
}
