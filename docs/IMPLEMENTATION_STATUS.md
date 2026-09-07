# Implementation status

## 0.1.0 — playable prototype

The current release connects the complete local hideout → deployment → loot/combat →
extraction or death → hideout loop. It includes persistent money, gear, documents,
weapon modifications and permanent upgrades. See the README for controls and exact
extraction rules. Multiplayer, accounts, and a network-authoritative server are absent.

### Implemented and checked

- Pure seeded simulation, fixed steps, versioned active-raid saves, nested restore validation.
- 480m square map, eight locations, 15 enterable buildings, 57 caches, 30 active soldiers.
- Patrol, hearing, investigation, line-of-sight combat, search, corpse loot, death gear loss.
- Inventory, weapons, modifications, bank/stash, four persistent upgrade tracks and eight notes.
- Three edge exits and paid contractor extraction; the strict cash threshold is >$200.
- Walkable 3D hideout, equipment menus, weapon bench, field HUD, map, pack and pause controls.
- Persistent Auto/Low/High graphics settings. Auto detects common software renderers;
  Low bounds the actual framebuffer to 640 × 400 and disables expensive lighting passes
  while retaining all gameplay, assets, AI and loot.
- Thirteen original textured Blender assets, editable sources, technical validation,
  hash-bound visual decisions and durable reviewed source/export/preview snapshots.
- Portable factory skill with tested bootstrap, relocation and conflict protection.

The simulation suite has 18 passing tests, including deterministic continuation,
corrupt saves, loss/return of kit, extraction boundaries, line of sight and loot.
A five-seed 2m-grid navigation audit reached every cache's interaction radius and all
three extraction zones. Seven isolated factory tests cover missing/rejected/stale
reviews, changed previews, truncated GLBs, and exact-byte scoped publication.
Browser checks and their actual results are recorded in `docs/qa/README.md`.

### Known limitations and contribution targets

- The soldier is an economical articulated polygon model, with no skinned rig or
  authored animation clips. The five weapon stat profiles share one rifle mesh.
- The hideout uses boundary collision; its furnishings are walk-through. Raid collision
  covers building walls, containers, major props, tanks, trucks and refinery structures;
  decorative scenery and loose loot cases are not universally solid.
- Enemy navigation uses local obstacle avoidance, not a navmesh. There are no coordinated
  tactical planners, squads with communication rules, or multiplayer replication.
- Soldiers are visually culled at 165m, which is shorter than some weapon ranges.
  This can permit hits on an unrendered distant enemy and needs a visibility/range pass.
- High graphics uses three stable nearby point-light slots; Low omits these lights,
  shadows and environment reflections. The weapon camera is reused. Other per-frame
  allocations and incomplete resource disposal remain; broader GPU profiling is needed.
- Frame delta is clamped during long stalls. Under severe load the simulation slows;
  the FPS diagnostic now uses the unclamped wall clock. Render submission timing is a CPU
  measurement, not a GPU benchmark. Low graphics trades 3D resolution and lighting quality
  for lower raster cost; Auto detection may be unavailable on some browser configurations.
- Menus pause the solo raid. Saves use browser-local storage with no export UI, cloud
  backup, cheat prevention, or compatibility promises beyond the current schema.
- Audio is synthesized; visual weapon variations, reload animation, broader browser
  testing, gamepad support, full input remapping and accessibility work remain.
- Studio art approval describes prototype suitability. It is not a claim of AAA
  character anatomy, photorealism, authored LODs, normal baking or production animation.

### Performance evidence

A synthetic 120-second simulation at the unmodified insertion point, with all 30
patrols active, executed 7,200 steps in 82.78ms (0.0115ms/step) on the development host.
This excludes rendering and does not measure a combat-heavy encounter. It is a recorded
local observation, not a cross-machine performance guarantee.

After the initial GitHub CI run timed out under software rendering, a local forced
SwiftShader run of the same three browser cases passed in 43.6 seconds using Low graphics
selected through the user interface. The 1280 × 800 interface retained a verified 640 × 400
game drawing buffer, with all 30 soldiers and 57 loot caches present. Gameplay assertions
and timeouts were unchanged. The current screenshots and exact scope are in `docs/qa/README.md`;
[GitHub CI passed for this renderer revision](https://github.com/ErikBurdett/deadwire/actions/runs/34095896308).

### Save schema

`SAVE_VERSION = 1`. Save data contains the profile, full raid state, RNG state, and
fixed-step remainder. Map geometry is regenerated from the seed. Geometry changes
can affect saved raids; future releases should include explicit migration/restart policy.
