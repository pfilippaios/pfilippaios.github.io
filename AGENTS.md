# Hoop Rush — Game Architecture & Physics Guide for AI Agents

This document explains how the Hoop Rush basketball game works at every level — from the fake-3D
visual system built on a flat 2D canvas, through the physics simulation, to the scoring state machine.
Read this **before** making any changes to `js/game.js`.

---

## 1. The Fundamental Challenge: Faking 3D on a 2D Canvas

This game simulates a basketball shot **toward** a hoop that is "far away" from the camera, using
only a 2D canvas (`420 × 760` game units). There is no real Z-axis. Depth is faked entirely through:

- **Y-position mapping**: Higher on screen = farther from camera.
- **Scale reduction**: Objects shrink as they go "deeper" (higher on screen).
- **Layer reordering**: The ball draws in front of or behind the hoop depending on state.
- **Perspective ellipse**: The circular rim is drawn/collided as an ellipse (30% height) to look
  like a hoop seen from slightly below.

Every bug, every "the ball does weird things", almost always traces back to the tension between
these 2D tricks and real physics expectations.

---

## 2. Coordinate System & Key Positions

```
  (0, 0) ─────────────────────────── (420, 0)
    │            SKY / FAR                │
    │                                     │
    │     ┌─── Backboard ───┐             │
    │     │  (135–285, 137–155)           │
    │     └──────────────────┘            │
    │          ╭── Rim ──╮                │
    │        (172, 247)—(248, 247)        │
    │        rimY = 247, radius = 38      │
    │          ╰── Net ──╯                │
    │        netHeight = 55               │
    │                                     │
    │     Hoop ground (scored ball        │
    │     landing zone) Y ≈ 560           │
    │                                     │
    │                                     │
    │                                     │
    │         ● Ball rest position        │
    │        (210, 540)                   │
    │           NEAR / CAMERA             │
  (0, 760) ──────────────────────── (420, 760)
```

### Critical constants

| Constant              | Value         | Meaning                                              |
|-----------------------|---------------|------------------------------------------------------|
| `GAME_WIDTH`          | 420           | Canvas logical width                                 |
| `GAME_HEIGHT`         | 760           | Canvas logical height                                |
| `GRAVITY`             | 0.38          | Downward acceleration per frame (px/frame²)          |
| `hoop.centerX`        | 210           | Horizontal center of the rim                         |
| `hoop.rimY`           | 247           | Vertical position of the rim plane                   |
| `hoop.rimRadius`      | 38            | Horizontal radius of the rim ellipse                 |
| `hoop.netHeight`      | 55            | Vertical extent of the net below the rim             |
| `BALL_DISPLAY_RADIUS` | 36            | Visual radius of the ball sprite                     |
| `BALL_COLLISION_RADIUS`| 25.2 (36×0.7)| Fixed collision radius (decoupled from depth)        |
| `BALL_REST_Y`         | 540           | Ball's resting Y position (GAME_HEIGHT − 220)        |
| `HOOP_GROUND_Y`       | 560           | Where the scored ball lands (pole base depth)        |
| `RIM_DEPTH_SCALE`     | ≈ 0.66        | Visual scale at the rim's depth                      |

---

## 3. The Fake Depth System

### 3.1 Y → Z mapping

```javascript
ball.z = clamp((BALL_REST_Y - ball.y) / 3.93, 0, 110);
```

- Ball at rest (y=540): z = 0 (closest to camera, full size)
- Ball at rim (y=247): z ≈ 74.6 (far, ~66% size)
- Maximum depth: z = 110

### 3.2 Z → visual scale

```javascript
depthScale(z) = 1 - (z / 130.5)^0.85 × 0.6
```

| Position       | Z     | Scale  | Ball visual radius |
|----------------|-------|--------|--------------------|
| At rest        | 0     | 1.00   | 36 px              |
| Mid-flight     | ~40   | 0.82   | 29.5 px            |
| At rim         | ~75   | 0.66   | 23.8 px            |
| Max depth      | 110   | 0.51   | 18.4 px            |

### 3.3 Why collision radius is FIXED

**This is critical.** The visual scale changes with depth, but the collision radius does NOT.
`BALL_COLLISION_RADIUS = BALL_DISPLAY_RADIUS × 0.7 = 25.2` — always, regardless of where the
ball is on screen. If collision radius scaled with depth, the ball's ability to fit through the
hoop and trigger scoring would change depending on the arc height of the throw. This caused
the original "successful shots counted as misses" bug.

### 3.4 Scale lock after scoring

Once `ball.hoopState` is `"entering"` or `"scored"`, `getDynamicScale()` returns `RIM_DEPTH_SCALE`
(≈ 0.66) instead of computing from Y. This prevents the ball from visually growing as it falls
below the hoop — it stays at the hoop's depth, small and "far away".

---

## 4. The Ball State Machine

The ball's `hoopState` drives almost all game logic. It has three values:

```
                    ┌──────────────────────────────┐
                    │                              │
    ┌───────────┐   │   ┌──────────┐   ┌────────┐ │
    │  outside  │───┼──▸│ entering │──▸│ scored │ │
    │           │◂──┘   │          │   │        │ │
    └───────────┘       └──────────┘   └────────┘
         ▲                   │
         └───────────────────┘
           (exit conditions)
```

### Transitions

| From       | To         | Trigger                                                              |
|------------|------------|----------------------------------------------------------------------|
| `outside`  | `entering` | Ball descends into mouth zone OR crosses rim from above              |
| `entering` | `scored`   | `registerScore()` called (ball deep enough in net)                   |
| `entering` | `outside`  | Ball bounces back above `rimY - 8` OR exits capture zone horizontally|
| `scored`   | (reset)    | Ball settles on ground → `resetBall()` after 1200ms timeout         |

### Why `entering → outside` transitions are dangerous

This is the #1 source of bugs. If the ball enters the hoop mouth legitimately but then:
- A rim collision nudges it sideways → exits capture zone horizontally → reset to `outside`
- A rim collision reverses `vy` momentarily → appears to go back above rim → reset to `outside`
- The centering code hasn't pulled it to center yet → it looks off-center → exits horizontally

The ball then falls through the hoop area as `"outside"`, the score check requires `"entering"`,
so it registers as a **miss** instead of a **score**.

### Fixes in place

1. **Centering runs BEFORE exit check** — the ball's X is corrected toward `hoop.centerX` before
   we evaluate whether it has exited the capture zone.
2. **Velocity-reversal guard** — requires `ball.y < rimY - 8` (not just `≤ rimY`) before
   allowing a negative-vy exit, so momentary rim rattles don't invalidate the entry.
3. **Deep-inside-net check** — once `ball.y >= rimY + netHeight × 0.12`, horizontal exit is
   suppressed entirely (ball is already too deep to logically exit sideways).
4. **Committed drop zone** — when the ball has a valid entry, is falling, and is within
   `rimY - 2` to `rimY + netHeight × 0.65`, rim collisions are completely suppressed.

---

## 5. Physics Pipeline (per frame)

`updateBallPhysics()` runs once per `requestAnimationFrame` (~60fps). Here is the exact order:

```
 1. Flight timer increment + timeout check (240 frames max)
 2. Store previous position (prevX, prevY)
 3. Spin → Magnus effect (vx += spin × 0.002, spin decays)
 4. Quadratic air drag (slows fast throws more than slow ones)
 5. Assist mode steering (pulls ball toward hoop center)
 6. Velocity Verlet integration (position + velocity update with gravity)
 7. Depth (Z) calculation from Y
 8. Entry detection (descending into mouth)
 9. Committed drop zone calculation
10. Rim collision (24-point ellipse, upper arc only)
11. Stalled-on-rim nudge
12. Backboard collision
13. Post-collision speed cap
14. Top-down crossing detection (prevBallBottom → ballBottom crosses rimY)
15. NET CENTERING (pulls ball.x toward hoop.centerX) ← BEFORE exit check
16. Exit check (can revert entering → outside)
17. Score check (entering + deep enough + inside capture zone)
18. Scored ball: lock X, bounce on HOOP_GROUND_Y
19. Early miss detection (ball past rimY + 80, not scored)
20. Out-of-bounds detection
```

**ORDER MATTERS.** Centering (step 15) must come before exit check (step 16). Committed drop
(step 9) must be computed before rim collision (step 10). Changing the order will re-introduce
the scoring bug.

---

## 6. Collision System

### 6.1 Rim collision

The rim is modeled as a **perspective ellipse** — 24 discrete points around:
```javascript
px = hoop.centerX + cos(angle) × hoop.rimRadius        // horizontal: full 38px
py = hoop.rimY    + sin(angle) × hoop.rimRadius × 0.3   // vertical: compressed to 30%
```

**Only upper-arc points collide.** Points where `py > rimY + 2` are skipped. This prevents
the far side of the rim (bottom of the ellipse) from blocking balls that are correctly falling
through the hoop from above. Without this filter, balls would hit "phantom" collision points
that visually don't exist from the player's perspective.

### 6.2 Collision response

For each rim point, circle-vs-point distance check:
- If `dist < BALL_COLLISION_RADIUS`: collision detected
- Separation: push ball out by overlap along the normal
- Velocity reflection: `v' = (v - 2(v·n)n) × restitution`
- Rim restitution: `0.22` (moderate bounce — enough for rim rattles)
- Backboard restitution: `0.38` (bouncier)

### 6.3 Assist mode special handling

When assist mode is active and the ball hits a rim point:
- **Rising + above rim**: No collision (let it fly over)
- **Rising + near rim**: Gentle nudge toward center, maintain upward velocity
- **Falling + at/above rim**: Strong center pull, force `hoopState = "entering"`
- **Below rim**: Deflect outward (under-rim contact, no score)

### 6.4 Backboard

Modeled as an axis-aligned box: `(135–285, 137–155)` in game coords.
Only triggers when ball is rising (`vy < 0`). Reflects velocity downward.

---

## 7. Rendering / Draw Order

The draw order creates the 3D illusion of the ball going through the hoop:

### Normal flight (ball above/outside hoop):
```
1. Background (bg.png — backboard, pole, court are all painted in)
2. Assist glow (green pulse around hoop)
3. Ball shadow + trail
4. Ball glow (drag indicator)
5. Net image (net_default.png)
6. Front hoop rim (front-hoop.png)
7. Ball sprite ← IN FRONT of hoop
```

### Dropping through net (entering/scored, falling, at/below rim):
```
1. Background
2. Assist glow
3. Ball shadow + trail
4. Ball glow
5. Ball sprite ← BEHIND net and rim
6. Net image (net_expanded.png — wider, stretched)
7. Front hoop rim
```

The **layer swap** happens at `ball.y >= hoop.rimY - 2` when `hoopState` is `entering` or `scored`.
This is what makes the ball visually pass through the hoop instead of floating in front of it.

### Asset layers
- `bg.png` (1536×2752): Contains the entire court scene — backboard, back rim arc, pole, trees,
  buildings, court lines. Everything except the front rim arc, net, and ball.
- `front-hoop.png`: The front semicircle of the rim. Drawn as overlay at `rimY - 14`.
- `net_default.png`: Resting net. Drawn below the rim.
- `net_expanded.png`: Wider net shown when ball passes through. Stretches and wobbles dynamically.
- `ball.png`: Basketball sprite. Drawn with rotation (`ball.angle`) and depth-scaled radius.

---

## 8. Launch Mechanics

### Swipe-to-throw
1. Player touches/clicks the ball → `pointerDown` starts drag
2. Player drags upward → `pointerMove` tracks position
3. Player releases → `pointerUp` calls `launchBall()`

### Velocity calculation
```javascript
dx = pointerCurrent.x - pointerStart.x        // horizontal swipe distance
dy = pointerCurrent.y - pointerStart.y        // vertical swipe distance (negative = upward)
upwardPull = clamp(-dy, 20, 260)              // how far up they pulled

ball.vx = clamp(dx × 0.02 × assistFactor, -1.8, 1.8)
ball.vy = clamp(-upwardPull × 0.07 × assistFactor - 5.5, -18, -12)
ball.spin = clamp(dx × 0.008, -1.5, 1.5)
```

- Horizontal: gentle (`0.02` scale, capped at `±1.8`)
- Vertical: stronger (`0.07` scale + `5.5` base, range `-18` to `-12`)
- Spin: derived from horizontal swipe, creates visual rotation + slight Magnus curve
- Assist factor: `1.15` (always on) — 15% velocity boost

### Why these values matter
With `GRAVITY = 0.38`, the ball needs enough initial velocity to arc up ~293px (from y=540 to y=247).
The vertical range of `[-18, -12]` ensures the ball always reaches the hoop height. If you increase
gravity, you must also increase the vertical velocity range, or the ball won't clear the rim.

---

## 9. Capture Zone & Scoring Geometry

### Capture zone (where the ball can enter/score)
```
innerLeftRimX  = hoop.centerX - hoop.rimRadius + 4  = 176
innerRightRimX = hoop.centerX + hoop.rimRadius - 4  = 244
capturePadding = BALL_DISPLAY_RADIUS × 0.28          ≈ 10.1

captureLeftX   = 176 - 10.1 = 165.9
captureRightX  = 244 + 10.1 = 254.1
```

The capture zone is **88px wide** (166–254), centered on the hoop. The padding is FIXED
(not depth-dependent) so the scoring window doesn't change based on arc height.

### Entry conditions (any of these transitions to `"entering"`):
1. **Descending into mouth**: `vy > 0`, ball within capture zone, `y` between `rimY - effR×0.55`
   and `rimY + netHeight×0.24`
2. **Top-down crossing**: `prevBallBottom ≤ rimY` and `ballBottom > rimY` (ball's bottom edge
   crosses the rim plane), within capture zone
3. **Assist rim contact**: Ball hits rim point at/above rim plane while assist is active

### Score conditions (all must be true):
- `!ball.scored`
- `ball.validEntry === true`
- `ball.hoopState === "entering"`
- `ball.vy > 0` (falling)
- `ball.y >= rimY + netHeight × 0.35` (= 247 + 19.25 = **266.25** — deep enough in net)
- Ball within capture zone horizontally

### Miss conditions:
- Ball falls past `rimY + 80` (= **327**) without scoring → early miss
- Ball exits game bounds (y > 840 or x outside -80 to 500) → out-of-bounds miss
- 240 frames elapsed without scoring → timeout

---

## 10. Post-Score Behavior

After `registerScore()`:
1. `ball.scored = true`, `ball.hoopState = "scored"`
2. Score message displayed ("ΚΑΛΑΘΙ!", "ΜΠΑΜ!", etc.)
3. Ball locks to `hoop.centerX` (no horizontal drift)
4. Ball falls with gravity, **visual scale locked to `RIM_DEPTH_SCALE`** (stays small)
5. Ball bounces on `HOOP_GROUND_Y = 560` with 45% energy retention
6. Shadow appears at the ball's feet at ground level
7. Ball settles when `|vy| < 0.5`, then deactivates
8. After 1200ms timeout: check win/loss conditions, then `resetBall()`

---

## 11. Assist Mode

Assist is **always on** (`state.assistMode = true`). It provides:

### Trajectory steering (during flight)
- Horizontal pull toward hoop: `ball.vx += dxToHoop × 0.004`
- Vertical pull when below rim or falling: `ball.vy += dyToHoop × 0.0015`
- Light air damping: `ball.vx *= 0.99`
- Only active within 600px of hoop and above `rimY + 180`

### Rim collision forgiveness
- Rising ball above rim: rim collisions suppressed entirely
- Rising ball near rim: nudged toward center instead of bouncing
- Falling ball at rim: forced into `"entering"` state with center pull

### Launch boost
- `assistFactor = 1.15` — 15% velocity increase on throw

---

## 12. Known Pitfalls & Edge Cases

### Things that WILL break if you change them:

| Change | What breaks |
|--------|-------------|
| Move centering after exit check | Successful shots register as misses |
| Make collision radius depth-dependent | Scoring becomes inconsistent at different arc heights |
| Remove committed drop zone | Rim collisions bounce the ball out after valid entry |
| Let bottom-half rim points collide | Phantom deflections block clean shots |
| Change `rimY` without updating bg.png | Collision geometry misaligns with visual hoop |
| Reduce vertical velocity range below `-12` | Ball can't reach the hoop |
| Remove `RIM_DEPTH_SCALE` lock | Ball grows as it falls after scoring (looks wrong) |
| Change `HOOP_GROUND_Y` significantly | Ball lands at wrong visual depth after scoring |

### The 2D-is-not-3D problems:

1. **No real Z collision**: The ball and rim exist on the same 2D plane. The rim's "depth" is
   faked with a perspective ellipse. A ball that visually passes "behind" the rim can still
   collide with rim points because there's no Z-separation.

2. **Depth scaling vs collision**: If the visual ball radius and collision radius don't match,
   the player sees the ball "fit" through the hoop but the collision system disagrees (or vice versa).
   Solution: fixed collision radius, independent of visual scaling.

3. **Layer swap timing**: The ball must switch from "in front of hoop" to "behind hoop" at exactly
   the right moment. Too early: ball disappears behind the rim before reaching it. Too late: ball
   visually sits on top of the rim/net instead of passing through.

4. **Post-score depth**: After going through the hoop, the ball is "far away" at the hoop's depth.
   If the Y-to-Z mapping makes it "close" as Y increases (falling), the ball grows — breaking the
   illusion. Solution: locked scale after scoring.

5. **Shadow position**: The ball's shadow must be at the "ground" at the hoop's depth (Y≈584),
   not at the screen bottom (Y≈710). The court surface at the hoop's distance is higher on screen
   than the court surface near the camera.

---

## 13. Debug & Logging

### In-game debug panel
- Press **D** to toggle the debug panel (shows state + event log)
- Panel shows: ball position, velocity, hoopState, flight time, game state

### Log file
- Press **L** to download the full log as `.log` file at any time
- Logs auto-download on WIN or LOSS
- All game events are logged with timestamps:
  - `pointerDown` — touch/click start
  - `launch` — ball thrown (velocity, spin, attempt number)
  - `frame` — ball state every 10 frames (position, velocity, hoopState, spin)
  - `entering-mouth` — ball enters capture zone
  - `top-down crossing` — ball bottom crosses rim plane
  - `rim.assist-rising-nudge` — assist pushes ball over rim
  - `rim.assist→entering` — assist forces entering state on rim contact
  - `rim.under-rim-deflect` — ball hits rim from below
  - `backboard hit` — ball hits backboard
  - `exit-entering` — ball reverts from entering to outside (with reason)
  - `score-trigger` — score conditions met
  - `SCORE!` — score registered
  - `ball-bounce` — post-score ground bounce
  - `ball-settled` — ball stopped bouncing
  - `early-miss` — ball fell past net without scoring
  - `out-of-bounds` — ball left game area
  - `flight-timeout` — 240 frame limit reached
  - `MISS` — miss concluded
  - `WIN` / `LOSS` — game end

### Using logs to diagnose scoring bugs
1. Look for `entering-mouth` or `top-down crossing` — did the ball enter the hoop?
2. If yes, look for `exit-entering` — was it kicked out? What reason?
3. If no exit, look for `score-trigger` — did it reach scoring depth?
4. If no score-trigger, check the `frame` logs — is `ball.y` reaching `rimY + 19.25` while
   still in `"entering"` state?
5. If `early-miss` fires right after `exit-entering`, the ball was incorrectly ejected from
   entering state — this is the classic scoring bug.

---

## 14. File Structure

```
pfilippaios.github.io/
├── index.html          # HTML structure, overlays, HUD, lead form
├── js/
│   └── game.js         # ALL game logic (~1150 lines)
├── css/
│   └── style.css       # All styling
├── assets/
│   ├── bg.webp         # Background — court, backboard, pole
│   ├── ball.webp       # Basketball sprite
│   ├── front-hoop.webp # Front rim arc overlay
│   ├── net-state-*.webp# Net animation states
│   └── brand/logo.webp # Brand logo used in overlays/HUD
└── fonts/
    ├── BergenSans-Regular.otf
    └── BergenSans-SemiBold.otf
```
