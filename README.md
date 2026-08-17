# OnRoad: Real-Time Driver Monitoring

Real-time driver distraction monitoring: a Driver Dashboard runs on the
driver's phone doing on-device computer-vision detection, and a paired Rider
Dashboard on a second device gets live status and escalating alerts over a
Node/Express/Socket.io backend.

The visual design started as an interactive prototype. The original bundle
(HTML/CSS/JS mockup + reference screenshots) is kept in `design-reference/`
for provenance. Everything in `client/` and `server/` is the real
implementation.

## Repository layout

```
client/             React + Vite frontend (driver + rider dashboards)
server/             Node + Express + Socket.io backend (ride state, timers, events)
design-reference/   Original design handoff bundle (not part of the app)
```

## Running locally

```bash
# terminal 1
cd server
npm install
npm run dev          # listens on :4000

# terminal 2
cd client
npm install
npm run dev          # http://localhost:5173
```

**Configuration.** Both default to `localhost:4000` / `localhost:5173` via
`.env.example` in each folder. Copy to `.env` and adjust `CLIENT_ORIGIN` /
`VITE_SERVER_URL` / `VITE_API_URL` for a real deployment (driver and rider
are meant to run on two different physical devices, so in practice you'll
deploy the server somewhere reachable from both).

**Trying it end to end.** With two devices or tabs: open `/driver` on one,
start a ride, then open `/rider` (or scan the QR code, which links straight
to `/rider/<code>`) on the other and enter the code.

## How the pieces fit together

- **Detection** (`client/src/lib/faceMonitor.js`) runs entirely on the
  driver's device using MediaPipe Face Landmarker, loaded from CDN at
  runtime (not bundled). It tracks head yaw/pitch (look-away) and a rolling
  1s window of blendshape-derived eye openness (eyes-closed), each requiring
  ~0.8-1s of continuous signal before counting as a real event. No video is
  ever sent anywhere; only `distraction-start` / `distraction-end` socket
  events.

- **Speed gating** (`client/src/lib/speed.js`) uses Geolocation (preferred)
  with a coarse DeviceMotion-based fallback, and only lets detection run
  above ~5 mph.

- **Server** (`server/src/rideStore.js`) is the source of truth for ride
  state: it owns the elapsed-time clock, the escalation timers (see below),
  and the event log, and broadcasts state to both devices over a Socket.io
  room keyed by the ride code. State is in-memory and lives for the process
  lifetime. This is fine for a single ride session, not meant to survive a server
  restart.

- **Summary** is computed server-side from the real logged events when the
  ride ends. Either side can end it (`rideStore.summarize`), including
  capturing whatever distraction was still in progress at that moment.

**Escalation thresholds** (`server/src/constants.js`), timed from the start
of a single continuous distraction:

| Elapsed | Broadcast | Effect |
| --- | --- | --- |
| 5s | `alert:soft` | Soft alert |
| 15s | `alert:alarm` | Full alarm, sound starts |
| 60s | `alert:sound-stop` | Sound auto-stops after 45s of alarm; the alert state itself is unchanged |

## Where this diverges from the prototype

The prototype was a single-tab demo (one shared component driving two phone
mockups side by side, with a manual control panel to fake every state). A
few things had to be designed rather than copied because the prototype
never needed them for two real, independently-connected devices:

- **No phone bezel/status-bar chrome in production**: the prototype's
  `IOSDevice` frame was presentational packaging for the desktop demo; a
  real phone browser supplies its own chrome, so only the inner screen
  content was ported.

- **Added a role-select entry screen** (`/`) and simple name-entry fields:
  the prototype had neither, since it never needed real navigation between
  two separate devices.

- **Dropped the demo control panel** (Start ride / Auto-play / manual
  distraction triggers / settings sliders) entirely. That was explicitly
  the prototype's own testing harness, not product UI.

- **Dropped the fake continuous "attention %" meter**: the app is driven
  purely by real binary distraction state (focused / soft-alert / alarm /
  paused), not a simulated score.

- **QR code is real and scannable** (encodes a `/rider/<code>` join URL),
  replacing the prototype's decorative fake QR pattern.

- **App mark** (`client/src/components/Logo.jsx`) renders a real logo image
  (`client/public/logo.png`), the icon cropped out of the prototype's
  eye/road mark, with the wordmark left off since every usage site already
  renders "OnRoad" as separate text next to it.

## License

MIT. See [LICENSE](./LICENSE).
