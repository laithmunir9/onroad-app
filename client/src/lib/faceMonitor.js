import {
  LOOK_AWAY_YAW_DEG,
  LOOK_AWAY_PITCH_DEG,
  EYE_OPEN_THRESHOLD,
  EYE_ROLLING_WINDOW_MS,
  DISTRACTION_FLOOR_SEC,
} from "./constants";

// Loaded from CDN per spec — no local MediaPipe dependency. Also means a real
// external driver-facing camera can later feed the same <video> element this
// module already reads from; nothing here assumes "webcam" specifically.
const VISION_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const WASM_URL = `${VISION_CDN}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise = null;

async function loadFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(/* @vite-ignore */ VISION_CDN);
      const { FaceLandmarker, FilesetResolver } = vision;
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    })();
  }
  return landmarkerPromise;
}

// Column-major 4x4 rotation matrix -> yaw/pitch/roll degrees.
function matrixToEuler(m) {
  const m00 = m[0],
    m10 = m[1],
    m20 = m[2];
  const m01 = m[4],
    m11 = m[5],
    m21 = m[6];
  const m22 = m[10];
  let yaw, pitch, roll;
  if (Math.abs(m20) < 0.999999) {
    pitch = Math.asin(-m20);
    yaw = Math.atan2(m10, m00);
    roll = Math.atan2(m21, m22);
  } else {
    yaw = Math.atan2(-m01, m11);
    pitch = m20 <= -1 ? Math.PI / 2 : -Math.PI / 2;
    roll = 0;
  }
  return { yaw: (yaw * 180) / Math.PI, pitch: (pitch * 180) / Math.PI, roll: (roll * 180) / Math.PI };
}

/**
 * Runs Face Landmarker detection against a <video> element and reports
 * qualifying distraction events (continuous >= DISTRACTION_FLOOR_SEC).
 * Detection only proceeds while `isActive()` returns true (used to gate on
 * speed + ride-live state); when gated off, any in-flight timer is dropped.
 */
export class FaceMonitor {
  constructor(videoEl, { onDistractionStart, onDistractionEnd, onFrame, isActive }) {
    this.video = videoEl;
    this.onDistractionStart = onDistractionStart;
    this.onDistractionEnd = onDistractionEnd;
    this.onFrame = onFrame;
    this.isActive = isActive || (() => true);
    this.landmarker = null;
    this.rafId = null;
    this.eyeSamples = [];
    this.pending = null; // { type, since } — condition seen, not yet past the floor
    this.active = null; // { type, since } — promoted, reported to caller
    this.running = false;
  }

  async start() {
    this.landmarker = await loadFaceLandmarker();
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.active) {
      this.onDistractionEnd();
      this.active = null;
    }
    this.pending = null;
    this.eyeSamples = [];
  }

  loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.video || this.video.readyState < 2) return;
    const now = performance.now();
    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, now);
    } catch {
      return;
    }
    this.processResult(result, now);
  };

  resetCondition() {
    this.pending = null;
    if (this.active) {
      this.onDistractionEnd();
      this.active = null;
    }
  }

  processResult(result, now) {
    if (!this.isActive()) {
      this.eyeSamples = [];
      this.resetCondition();
      return;
    }

    const faces = result.faceLandmarks;
    if (!faces || faces.length === 0) {
      this.onFrame?.({ closed: false, away: false, faceFound: false });
      this.resetCondition();
      return;
    }

    const closed = this.computeEyesClosed(result, now);
    const away = !closed && this.computeLookingAway(result);
    this.onFrame?.({ closed, away, faceFound: true });

    const condition = closed ? "eyes_closed" : away ? "looked_away" : null;

    if (condition) {
      if (this.active) return; // already reporting; let it keep running
      if (!this.pending || this.pending.type !== condition) {
        this.pending = { type: condition, since: now };
      }
      if (now - this.pending.since >= DISTRACTION_FLOOR_SEC * 1000) {
        this.active = { type: condition, since: this.pending.since };
        this.onDistractionStart(condition);
      }
    } else {
      // gaze returned to center — reset immediately, no accumulation across glances
      this.resetCondition();
    }
  }

  computeEyesClosed(result, now) {
    const shapes = result.faceBlendshapes?.[0]?.categories || [];
    const find = (name) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
    const openness = 1 - (find("eyeBlinkLeft") + find("eyeBlinkRight")) / 2;
    this.eyeSamples.push({ t: now, openness });
    const cutoff = now - EYE_ROLLING_WINDOW_MS;
    this.eyeSamples = this.eyeSamples.filter((s) => s.t >= cutoff);
    if (this.eyeSamples.length < 3) return false;
    const span = now - this.eyeSamples[0].t;
    if (span < EYE_ROLLING_WINDOW_MS * 0.6) return false;
    const avg = this.eyeSamples.reduce((s, x) => s + x.openness, 0) / this.eyeSamples.length;
    return avg < EYE_OPEN_THRESHOLD;
  }

  computeLookingAway(result) {
    const matrices = result.facialTransformationMatrixes;
    if (!matrices || matrices.length === 0) return false;
    const { yaw, pitch } = matrixToEuler(matrices[0].data);
    return Math.abs(yaw) > LOOK_AWAY_YAW_DEG || Math.abs(pitch) > LOOK_AWAY_PITCH_DEG;
  }
}
