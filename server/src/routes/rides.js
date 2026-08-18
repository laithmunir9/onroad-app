import { Router } from "express";
import { createRide, getRide, publicState, summarize } from "../rideStore.js";
import { createRateLimiter } from "../rateLimiter.js";
import { sanitizeName } from "../sanitize.js";

const router = Router();

// Generous enough for legitimate re-tries/multi-ride testing, low enough to
// blunt scripted ride-creation abuse against a public endpoint.
const createRideLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

router.post("/", (req, res) => {
  if (!createRideLimiter.check(req.ip)) {
    return res.status(429).json({ error: "Too many rides created. Try again in a few minutes." });
  }

  const { driverName, carLabel } = req.body || {};
  const nameResult = sanitizeName(driverName, "Driver");
  const carResult = sanitizeName(carLabel, "");
  if (!nameResult.ok || !carResult.ok) {
    return res.status(400).json({ error: "driverName and carLabel must be strings." });
  }

  const ride = createRide({ driverName: nameResult.value, carLabel: carResult.value });
  res.status(201).json({ code: ride.code, driverName: ride.driverName });
});

router.get("/:code", (req, res) => {
  const ride = getRide(req.params.code);
  if (!ride) return res.status(404).json({ error: "Ride not found" });
  res.json(publicState(ride));
});

router.get("/:code/summary", (req, res) => {
  const ride = getRide(req.params.code);
  if (!ride) return res.status(404).json({ error: "Ride not found" });
  if (ride.status !== "ended") {
    return res.status(409).json({ error: "Ride has not ended yet" });
  }
  res.json(summarize(ride));
});

export default router;
