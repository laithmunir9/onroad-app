import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import ridesRouter from "./routes/rides.js";
import { registerSocketHandlers } from "./socket/index.js";
import { startCleanupSweep } from "./rideStore.js";
import { RIDE_CLEANUP_INTERVAL_MS } from "./constants.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/rides", ridesRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

registerSocketHandlers(io);
startCleanupSweep(RIDE_CLEANUP_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`OnRoad server listening on :${PORT}`);
});
