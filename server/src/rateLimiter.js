// Small in-memory fixed-window rate limiter, keyed by caller-supplied string
// (typically an IP). Mirrors rideStore's own sweep pattern rather than
// pulling in a dependency. This process already treats in-memory state as
// fine for its lifetime.
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }

  function check(key) {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= max;
  }

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }, windowMs);

  return { check };
}
