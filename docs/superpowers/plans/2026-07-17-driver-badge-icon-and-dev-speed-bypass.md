# Driver Badge Icon + Dev Speed-Gate Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing per-phase icon to the driver's status badge, and add a dev-only speed-gate bypass so distraction detection can be tested without driving.

**Architecture:** Both changes live entirely in `client/src/pages/DriverPage.jsx`, plus one new icon component in `client/src/components/Icons.jsx`. No server changes, no new dependencies. There is no test framework in this project (`client/package.json` has no test script) — verification is `oxlint` plus manual exercise of the running dev server (already running on `:5173`, hot-reloads automatically).

**Tech Stack:** React 19, Vite, plain inline-style JSX (no CSS framework), `oxlint` for linting.

## Global Constraints

- Icon color must equal `palette.color` for the badge's current phase (same color as the word next to it).
- The dev speed-gate bypass must be fully absent from production builds — gate every bit of it behind `import.meta.env.DEV`, since Vite statically replaces that constant and dead-code-eliminates the `false` branch during `vite build`.
- Do not touch `speed.js`, `faceMonitor.js`, or any server file — the bypass only changes what `DriverPage` treats as "moving."
- Do not restart or kill the running dev servers (`server` on `:4000`, `client` on `:5173`); Vite hot-reloads edits automatically.

---

### Task 1: Add `ClockIcon` to the shared icon set

**Files:**
- Modify: `client/src/components/Icons.jsx`

**Interfaces:**
- Produces: `ClockIcon({ size = 16, color = "#6f86ad", strokeWidth = 2 })` — a React component rendering an `<svg>`, exported alongside the file's other icon components (matches the existing export style, e.g. `CheckIcon`, `EyeOffIcon`).

- [ ] **Step 1: Add the `ClockIcon` export**

Append this to the end of `client/src/components/Icons.jsx` (after the existing `CarIcon` export, following the same style as the other icons in the file):

```jsx
export function ClockIcon({ size = 16, color = "#6f86ad", strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
```

- [ ] **Step 2: Lint**

Run: `cd client && npx oxlint src/components/Icons.jsx`
Expected: no errors reported.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Icons.jsx
git commit -m "Add ClockIcon for driver standby status badge"
```

---

### Task 2: Show a per-phase icon in the driver status badge

**Files:**
- Modify: `client/src/pages/DriverPage.jsx`

**Interfaces:**
- Consumes: `ClockIcon` from `../components/Icons` (Task 1); existing `CheckIcon`, `EyeOffIcon`, `AlertTriangleIcon` already imported in this file (confirm the import line includes all three — currently only `EyeOffIcon, AlertTriangleIcon, CheckIcon` are imported at `client/src/pages/DriverPage.jsx:6`, which already covers three of the four; only `ClockIcon` needs adding to that import).
- Produces: no new exports — this is a leaf-level UI change consumed only by rendering.

This task edits the `palette` object (`client/src/pages/DriverPage.jsx:186-191`) to carry an `icon` field per phase, and the badge markup (`client/src/pages/DriverPage.jsx:233-235`) to render it.

- [ ] **Step 1: Update the icon import**

In `client/src/pages/DriverPage.jsx`, change line 6 from:

```jsx
import { EyeOffIcon, AlertTriangleIcon, CheckIcon } from "../components/Icons";
```

to:

```jsx
import { EyeOffIcon, AlertTriangleIcon, CheckIcon, ClockIcon } from "../components/Icons";
```

- [ ] **Step 2: Add an `icon` field to each phase in `palette`**

Find the `palette` object in `MonitoringScreen` (`client/src/pages/DriverPage.jsx:186-191`):

```jsx
  const palette = {
    calm: { ring: "rgba(53,214,164,.3)", bg: "radial-gradient(circle at 50% 40%,#0d2c56,#071a3a)", color: colors.green, chip: "rgba(53,214,164,.14)", word: "Focused", sub: "Focused on the road" },
    paused: { ring: "rgba(138,160,200,.35)", bg: "radial-gradient(circle at 50% 40%,#1a2438,#0c1220)", color: "#8aa0c8", chip: "rgba(138,160,200,.16)", word: "Standby", sub: "Vehicle stopped — monitoring paused" },
    soft: { ring: "rgba(245,166,35,.45)", bg: "radial-gradient(circle at 50% 40%,#3a2c0d,#1a1405)", color: colors.orange, chip: "rgba(245,166,35,.16)", word: "Caution", sub: `${distraction?.type === "eyes_closed" ? "Eyes closed" : "Looking away"} · ${secs}s` },
    alarm: { ring: "rgba(255,85,69,.45)", bg: "radial-gradient(circle at 50% 40%,#5e1512,#2a0906)", color: colors.red, chip: "rgba(255,85,69,.16)", word: "Alert", sub: `${distraction?.type === "eyes_closed" ? "Eyes closed" : "Looking away"} · ${secs}s — pull over` },
  }[phase];
```

Replace it with (adds an `icon: (color) => <Component .../>` factory per phase, so the icon can be colored with `palette.color` at render time):

```jsx
  const palette = {
    calm: { ring: "rgba(53,214,164,.3)", bg: "radial-gradient(circle at 50% 40%,#0d2c56,#071a3a)", color: colors.green, chip: "rgba(53,214,164,.14)", word: "Focused", sub: "Focused on the road", icon: (color) => <CheckIcon size={16} color={color} strokeWidth={2.6} /> },
    paused: { ring: "rgba(138,160,200,.35)", bg: "radial-gradient(circle at 50% 40%,#1a2438,#0c1220)", color: "#8aa0c8", chip: "rgba(138,160,200,.16)", word: "Standby", sub: "Vehicle stopped — monitoring paused", icon: (color) => <ClockIcon size={16} color={color} strokeWidth={2.2} /> },
    soft: { ring: "rgba(245,166,35,.45)", bg: "radial-gradient(circle at 50% 40%,#3a2c0d,#1a1405)", color: colors.orange, chip: "rgba(245,166,35,.16)", word: "Caution", sub: `${distraction?.type === "eyes_closed" ? "Eyes closed" : "Looking away"} · ${secs}s`, icon: (color) => <EyeOffIcon size={16} color={color} strokeWidth={2.2} /> },
    alarm: { ring: "rgba(255,85,69,.45)", bg: "radial-gradient(circle at 50% 40%,#5e1512,#2a0906)", color: colors.red, chip: "rgba(255,85,69,.16)", word: "Alert", sub: `${distraction?.type === "eyes_closed" ? "Eyes closed" : "Looking away"} · ${secs}s — pull over`, icon: (color) => <AlertTriangleIcon size={16} color={color} strokeWidth={2.4} /> },
  }[phase];
```

- [ ] **Step 3: Render the icon in the badge**

Find the badge markup (`client/src/pages/DriverPage.jsx:233-235`):

```jsx
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 999, background: palette.chip }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: palette.color }}>{palette.word}</span>
          </div>
```

Replace it with:

```jsx
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 999, background: palette.chip }}>
            {palette.icon(palette.color)}
            <span style={{ fontSize: 19, fontWeight: 700, color: palette.color }}>{palette.word}</span>
          </div>
```

- [ ] **Step 4: Lint**

Run: `cd client && npx oxlint src/pages/DriverPage.jsx`
Expected: no errors reported.

- [ ] **Step 5: Manually verify all four phases in the browser**

The client dev server is already running at `http://localhost:5173` — don't restart it.

1. Open `http://localhost:5173/driver`, fill the start form, click "Start monitoring" (grant camera + location permissions).
2. Confirm the badge shows a checkmark + "Focused" while looking at the screen normally.
3. Look away from the camera for >1s (below the 5s soft-alert threshold, so it stays "Focused") then hold the look-away past 5s — confirm the badge switches to an eye-off icon + "Caution".
4. Hold it past 15s — confirm the badge switches to a triangle icon + "Alert".
5. To see "Standby" (clock icon), the vehicle must read below ~5 mph — if testing at a desk, this is already the default state (real speed is 0), so the badge should show "Standby" with a clock icon before any movement is detected. Confirm the clock icon renders here too.

Expected: every phase's badge shows an icon immediately to the left of the word, colored the same as the word.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/DriverPage.jsx
git commit -m "Show per-phase icon in driver status badge"
```

---

### Task 3: Add the dev-only speed-gate bypass

**Files:**
- Modify: `client/src/pages/DriverPage.jsx`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: no new exports — internal state/behavior change to `DriverPage` and `MonitoringScreen`.

This task adds a `devSkipSpeedGate` state flag to the top-level `DriverPage` component, threads an `effectiveSpeedOk` value through to `MonitoringScreen` and the `FaceMonitor`'s `isActive` gate, and renders a dev-only toggle pill (visible only when `import.meta.env.DEV` is true) so it can be flipped without restarting the ride.

- [ ] **Step 1: Add `devSkipSpeedGate` state, initialized from the URL**

In `client/src/pages/DriverPage.jsx`, inside `export default function DriverPage()`, find the existing state declarations (`client/src/pages/DriverPage.jsx:15-21`):

```jsx
  const [step, setStep] = useState("setup"); // setup | starting | monitoring | error
  const [driverName, setDriverName] = useState("");
  const [carLabel, setCarLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [ride, setRide] = useState(null); // live state snapshot from server
  const [speedOk, setSpeedOk] = useState(true);
  const [modelReady, setModelReady] = useState(false);
```

Add this line directly after `const [modelReady, setModelReady] = useState(false);`:

```jsx
  const [devSkipSpeedGate, setDevSkipSpeedGate] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).get("devSkipSpeedGate") === "1"
  );
```

- [ ] **Step 2: Compute `effectiveSpeedOk` and keep the ref in sync with it**

Find the existing ref-sync effect (`client/src/pages/DriverPage.jsx:31-33`):

```jsx
  useEffect(() => {
    speedOkRef.current = speedOk;
  }, [speedOk]);
```

Replace it with:

```jsx
  const effectiveSpeedOk = speedOk || devSkipSpeedGate;

  useEffect(() => {
    speedOkRef.current = effectiveSpeedOk;
  }, [effectiveSpeedOk]);
```

- [ ] **Step 3: Pass the bypass state and setter down to `MonitoringScreen`**

Find the `MonitoringScreen` render call at the bottom of `DriverPage` (`client/src/pages/DriverPage.jsx:166`):

```jsx
  return <MonitoringScreen ride={ride} code={codeRef.current} speedOk={speedOk} modelReady={modelReady} videoRef={videoRef} />;
```

Replace it with:

```jsx
  return (
    <MonitoringScreen
      ride={ride}
      code={codeRef.current}
      speedOk={effectiveSpeedOk}
      modelReady={modelReady}
      videoRef={videoRef}
      devSkipSpeedGate={devSkipSpeedGate}
      onToggleDevSkipSpeedGate={import.meta.env.DEV ? () => setDevSkipSpeedGate((v) => !v) : undefined}
    />
  );
```

- [ ] **Step 4: Accept the new props in `MonitoringScreen` and render the dev toggle pill**

Find the `MonitoringScreen` function signature (`client/src/pages/DriverPage.jsx:181`):

```jsx
function MonitoringScreen({ ride, code, speedOk, modelReady, videoRef }) {
```

Replace it with:

```jsx
function MonitoringScreen({ ride, code, speedOk, modelReady, videoRef, devSkipSpeedGate, onToggleDevSkipSpeedGate }) {
```

Then find the top row of `MonitoringScreen` (`client/src/pages/DriverPage.jsx:206-212`):

```jsx
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Logo size={30} radius={8} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>OnRoad</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: colors.textDim, letterSpacing: ".13em", textTransform: "uppercase" }}>Driver</span>
      </div>
```

Replace it with (adds the dev-only pill between the logo and the "Driver" label; it only renders when `onToggleDevSkipSpeedGate` is defined, which Task 3 Step 3 only sets when `import.meta.env.DEV` is true):

```jsx
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Logo size={30} radius={8} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>OnRoad</span>
        </div>
        {onToggleDevSkipSpeedGate && (
          <button
            onClick={onToggleDevSkipSpeedGate}
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".04em",
              color: devSkipSpeedGate ? "#04122b" : "#FFC303",
              background: devSkipSpeedGate ? "#FFC303" : "rgba(245,166,35,.14)",
              border: "1px solid rgba(245,166,35,.5)",
              borderRadius: 999,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            {devSkipSpeedGate ? "DEV: SPEED GATE BYPASSED" : "DEV: BYPASS SPEED GATE"}
          </button>
        )}
        <span style={{ fontSize: 11, fontWeight: 600, color: colors.textDim, letterSpacing: ".13em", textTransform: "uppercase" }}>Driver</span>
      </div>
```

- [ ] **Step 5: Lint**

Run: `cd client && npx oxlint src/pages/DriverPage.jsx`
Expected: no errors reported.

- [ ] **Step 6: Manually verify the bypass works**

The client dev server is already running at `http://localhost:5173` — don't restart it.

1. Open `http://localhost:5173/driver?devSkipSpeedGate=1` (note the query param), start a ride.
2. Confirm the top bar shows a "DEV: SPEED GATE BYPASSED" pill, and the "Monitoring" stat card reads "Active" even though you are stationary (real speed is 0 mph).
3. Click the pill — confirm it flips to "DEV: BYPASS SPEED GATE" and the "Monitoring" card switches to "Paused".
4. Click it again to re-enable, then confirm distraction detection triggers normally (look away >5s → "Caution" badge appears) while stationary.
5. Open `http://localhost:5173/driver` (no query param) and start a ride — confirm no dev pill renders and "Monitoring" reads "Paused" while stationary, i.e. the bypass is off by default.

Expected: all five checks pass as described.

- [ ] **Step 7: Verify the bypass is eliminated from production builds**

Run: `cd client && npm run build && grep -c "devSkipSpeedGate" dist/assets/*.js`
Expected: the grep exits non-zero / reports no matches — `import.meta.env.DEV` is statically `false` in a production build, so Vite's minifier dead-code-eliminates every branch referencing `devSkipSpeedGate`, including the string itself.

If the string is still present, do not treat this as a blocker to fix reflexively — first confirm whether it survived only inside a comment/unreachable string versus live logic (e.g. by checking whether `onToggleDevSkipSpeedGate` can still be truthy in the built output). Report what you find before changing anything further.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/DriverPage.jsx
git commit -m "Add dev-only speed-gate bypass for testing without driving"
```
