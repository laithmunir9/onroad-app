# Driver status badge icon + dev-only speed-gate bypass

## Context

Compared the running client against the authoritative design reference
(`design-reference/OnRoad Prototype.dc.html`) and the numbered PNGs. The
client already matches closely: navy/charcoal + amber/electric-blue palette,
squircle corners throughout, no live attention percentage/ring (replaced by
status word + badge), no "Call Driver" button, correct fonts loaded. Two
concrete gaps remain, scoped below.

## 1. Driver status badge icon

**Problem:** `DriverPage.jsx`'s `MonitoringScreen` status chip renders only
`palette.word` ("Focused" / "Caution" / "Alert" / "Standby"). The reference
(`makeStateIcon()` in the `.dc.html`) always pairs the word with a small
leading icon matching the phase.

**Fix:** Add an icon before the word in the chip, colored `palette.color`,
~16px, mapped per phase:

| phase (client) | word     | icon                                    |
|-----------------|----------|------------------------------------------|
| `calm`          | Focused  | checkmark (existing `CheckIcon`)         |
| `soft`          | Caution  | eye-off (existing `EyeOffIcon`)          |
| `alarm`         | Alert    | triangle (existing `AlertTriangleIcon`)  |
| `paused`        | Standby  | clock (new `ClockIcon`)                  |

`ClockIcon` is new in `client/src/components/Icons.jsx` — circle + clock
hands, matching the reference's idle-phase icon path (`circle cx12 cy12 r9`
+ `M12 7v5l3 2`). No existing icon in the set covers this case.

Only `DriverPage.jsx`'s badge markup changes; no other screen has this gap
(the rider's status ring already uses the right icon per phase).

## 2. Dev-only speed-gate bypass

**Problem:** Detection is gated on `speedOk` (real GPS/motion, threshold
~5 mph). Testing indoors at a desk means `speedOk` never becomes true, so
distraction detection can't be exercised without physically driving.

**Fix**, in `DriverPage.jsx`:

- New state `devSkipSpeedGate`, initialized from
  `import.meta.env.DEV && new URLSearchParams(window.location.search).get("devSkipSpeedGate") === "1"`.
- Everywhere `speedOk` currently gates behavior — `speedOkRef.current` (read
  by `FaceMonitor`'s `isActive`) and the "Active/Paused" monitoring-card
  display — use `effectiveSpeedOk = speedOk || devSkipSpeedGate` instead.
- When `import.meta.env.DEV` is true, render a small dev-only pill on the
  monitoring screen (e.g. "DEV: speed gate bypassed") that toggles
  `devSkipSpeedGate` live, so it can be flipped mid-ride without restarting.
  This pill must not render at all when `import.meta.env.DEV` is false —
  Vite statically eliminates the branch in production builds, so this never
  ships.

No changes to `speed.js`, `faceMonitor.js`, or the server — the bypass only
affects what `DriverPage` treats as "moving," not the underlying speed
tracking logic itself.

## Scope

Two files touched: `client/src/pages/DriverPage.jsx`,
`client/src/components/Icons.jsx`. No other pages, no server changes.
Both dev servers (`:4000`, `:5173`) are already running — edits hot-reload,
no restart needed.
