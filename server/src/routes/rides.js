import { Router } from "express";
import { createRide, getRide, publicState, summarize } from "../rideStore.js";

const router = Router();

router.post("/", (req, res) => {
  const { driverName, carLabel } = req.body || {};
  const ride = createRide({ driverName, carLabel });
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
