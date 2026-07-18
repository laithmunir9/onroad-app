const KEY = "onroad:session";

// Tracks "I was mid-ride" across a page reload, so the driver/rider can be
// offered a way back in. The ride itself already survives a disconnect
// server-side (see rideStore's handleDisconnect) — this is only what the
// client needs to remember which ride and role to try rejoining.
export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable (private browsing, quota) — resuming just won't work */
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
