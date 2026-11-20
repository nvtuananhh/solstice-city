# SOLSTICE CITY — test log (round 15, written by the builder)

## Environment
- Headless Chromium 159 (chromium-1255) via playwright-core, SwiftShader,
  served by `node serve.ts`. Viewport 640x360 for the playthrough (software
  rendering is slow), 1280x720 for screenshots.
- `?perf=low` disables antialiasing/preserveDrawingBuffer for the playthrough
  only; screenshots use the normal path.

## Full playthrough — 30/30 PASS (test.mjs, 2026-11-20 ~01:1x +07)
- boot: window.__ready
- new-game: title -> New Game, job "First Light"
- walk: moved 12.8u in 2 sim-seconds
- steal-parked: entered Theo's pickup at the garage
- drive: drove 50.3u, speed 34 (122 km/h)
- exit-car: E exits the car
- jack-npc-car: stole a traffic car, wanted +1
- helicopter-4stars: setWanted(4) -> helicopter visible, 4 police cars, 6 roadblock cars
- weapon-wheel: Q opens the wheel, 4 selects SMG
- fire-weapon: SMG ammo 90 -> 89
- job1-step1: teleport to garage -> step advances
- job1-enter-pickup: entered the job pickup
- job1-complete: drove to the Heliostat Sea marker -> jobIndex 1, cash 120 -> 670
- save-load: save then load restores jobIndex 1
- pause-resume: Escape pauses (menu "pause"), Resume unpauses
- console-errors: none
- failed-requests: none
- no-external-requests: none (only localhost)

## Determinism — byte-identical double renders (seed=1, 1280x720 JPEG q82)
- 1-cover.jpg 73,461 B sha256 9f51b12714ff… (a == b)
- 2-onfoot.jpg 74,545 B sha256 0ab00395a316… (a == b)
- 3-driving.jpg 70,129 B sha256 05463a681c6c… (a == b)
- 4-mission.jpg 71,381 B sha256 503dd952578e… (a == b)
All four under the 256 KiB limit, long side 1280, short side 720.

## Performance fix found during testing
- First render measured 160 ms/frame at 640x360 with 606 draw calls under
  SwiftShader (sim step itself 0.02 ms). Fix: merged all static city geometry
  into a few meshes per material (merge.js), one merged mesh per car, 3 meshes
  per pedestrian. After: 6.4 ms/frame, 122 draw calls.
- Headless rAF runs at ~5 fps, so the main loop now catches up to 30 fixed
  steps per frame (was 5) instead of dropping sim time.

## Bugs fixed during testing
- Spawn point and the job pickup sat inside building/garage colliders
  (player/car stuck) — moved to the road intersection (-200, 200) and (-214, 200).
- save.js wrote S.jobIndex (undefined) instead of S.missions.jobIndex.
- Favicon 404s in the console — added a `data:,` favicon link.

## Screenshots (visually inspected)
- 1-cover: 4-star chase at dusk — pickup + police car + helicopter with
  searchlight + roadblock cones + traffic + minimap + objective + speedo.
- 2-onfoot: Dana (orange jacket) among pedestrians, Solstice Tacos storefront,
  Helios Tower, pistol + crosshair + minimap.
- 3-driving: orange pickup + red coupe, road to the Helios Tower, minimap,
  objective "Drive the pickup to the Heliostat Sea", 122 km/h.
- 4-mission: Job 6 rooftop combat at dusk — Dana with SMG (90/90), 3 rival
  crew members, windowed rooftop building + ramp, crosshair.
