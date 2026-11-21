# TESTLOG — SOLSTICE CITY (gta6-01 round 16)

How the game was tested, in my own words. All runs in headless Chromium
(Playwright, chromium-1255, SwiftShader) against `node serve.ts --port 8123`,
viewport 1280x720 for shots and 800x450 for the playthrough, seed=1.

## Full playthrough — 58/58 checks passed (final run, 2026-11-21 ~05:20 UTC)

A harness drove the game through its own stage checks (proximity, E
interacts, real pistol combat, deliveries). Debug hooks were used only for
positioning (warp), aiming, and test aids (indestructible car, cash) — never
to skip a stage.

- Job 1 First Light: talk, enter car, drive to mirror field — complete.
  Cash 350, respect 5 after it.
- Job 2 Hotwire: steal a parked sedan (wanted 1), deliver to chop shop — complete.
- Job 3 The Drop: pick up package, fight 2 rivals (real pistol combat),
  escape to safehouse — complete. Mira recruited after it.
- Job 4 Clean Plates: walk to garage, swap plates (E), drive to plaza — complete.
- Job 5 Dust Run: take getaway car (wanted 3), call Mira with V (wanted 3 -> 2,
  "on her way…"), reach foundry tunnels, roadblock seen — complete.
- Job 6 The Witness: stair door, climb to roof (onRoof, y=14), clear 4 rooftop
  rivals, protect the witness, descend — complete.
- Job 7 Air Support: car at garage (wanted 4), drive to foundry, helicopter
  seen, escape by losing the tail in the tunnels (wanted fell to <= 1) — complete.
- Job 8 Double Cross: truck yard, 4-rival ambush, take car with the score,
  deliver to safehouse — complete.
- Job 9 The Last Light (finale): tower vault, breach (wanted 5, dusk 17:00),
  4 tower-security rivals, escape drive to mirror field with helicopter +
  roadblock + 6 police cars live, 15 s escape timer — complete.
  Finale state: cash 7,450, respect 123, 9/9 jobs done, clock 17:14.
- Garage: engine upgrade bought (cash 9,450 -> 9,112, "Engine Stage 1/3").
- Taxi: fare started and completed, paid (9,112 -> 9,183).
- Street race: started at the flag, all 4 checkpoints, payout (cash -> 9,539).
- Save + load restores cash exactly (9,539). Pause opens and resumes.
  Weapon wheel opens, switches to pistol, closes.
- Console errors: none. Failed requests: none.

## Bugs found by testing and fixed (all in this round's own code)

- Foot police could arrest the player through a car window while the player
  was pinned by police rams. Fixed: arrest only counts on foot.
- The descend stage of job 6 required the player to be on the roof; a player
  who fell off the roof during the fight could never finish the job. Fixed:
  being on the ground at the descend point completes the stage.
- Police rams shoved the player's car out of the foundry tunnel zone, so the
  wanted level never decayed and job 7's escape could not complete (wanted
  stuck at 2). Fixed: cops lose the trail inside the tunnels (no chase/ram
  there) and the tunnel timer decays instead of resetting instantly.
- The race flag sat at (-30,-30), the centre of a building block; the
  collision push-out shoved the player outside the 8 m trigger, so the race
  could never start. Fixed: flag moved to the (-60,-60) intersection, the
  same spot as the race start point.
- The pause/resume edge: pressing Escape/Enter to dismiss a big message or
  the pause menu re-triggered the same action in the same step. Fixed by
  consuming the edge after dismissing.
- Job 1 never started: `currentJob()` treated activeJob 0 as falsy. Fixed.

## Determinism — byte-identical double renders (seed=1)

Each of the 4 shot modes rendered twice with `?shot=<mode>&seed=1`; the PNG
screenshots hashed identically both times:

- cover:   sha256 1a68a37326057068… (identical)
- onfoot:  sha256 d96c6e70aa4a886d… (identical)
- driving: sha256 0228f6e183ca28cf… (identical)
- mission: sha256 5f410552d3035201… (identical)

Seeded RNG only (sfc32, seed from `?seed=`). No `Math.random()`,
`Date.now()`, or `performance.now()` anywhere in the game code (grep
verified); fixed 1/60 s timestep. No fetch/XHR/WebSocket in the game.

## Screenshots (viewed by me, in `screenshots/`)

- 1-cover.jpg (95,221 B): player pickup large and central on the avenue,
  police cars chasing ahead, helicopter overhead, 4 wanted stars, minimap,
  "Job 5: Dust Run" objective.
- 2-onfoot.jpg (80,587 B): Dana large and centred in her bright orange
  jacket, pedestrians around her, plaza fountain and Helios Tower behind,
  no crosshair.
- 3-driving.jpg (90,270 B): player pickup large and near, Helios Tower
  detailed (panel seams, gold bands, red beacon, antenna, stepped base).
- 4-mission.jpg (97,904 B): Dana on the rooftop for job 6 "The Witness"
  with the witness and rivals, city and mirror field below, title matches
  the staging.
- All 4 are 1280x720 JPEGs, each under the 256 KiB cap.

## Offline check

With every non-localhost request aborted, the game boots and renders the
cover shot: zero external requests attempted, zero failed requests, zero
page errors. The game is fully self-contained (vendored Three.js r149,
no network at run).

## Local gate-limit check (`main.ts`, MAKEFUN_OUTPUT_DIR set)

`MAKEFUN_OUTPUT_DIR=/tmp/sc-out node main.ts` exits 0 (it enforces the
scorer's caps while copying). Verified in the output:

- dossier text: 157,343 bytes (limit 163,840) — pass
- screenshots: 4 files, largest 97,904 bytes (limit 4 / 262,144 each) — pass
- game files: 22 (limit 993) — pass
- game bytes: 764,003 (limit 50,331,648) — pass
- longest game path: 24 bytes (limit 1,000) — pass
- index.html: 6,805 bytes (limit 1 MiB) — pass
