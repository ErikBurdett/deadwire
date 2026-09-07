# Browser gameplay evidence

The current DEADWIRE renderer revision passed all **3 Playwright browser tests in 43.6 seconds with forced SwiftShader software rendering and Low graphics**. The interface viewport was 1280 × 800, with an additional 900 × 700 layout check. The tests used real UI clicks, keyboard movement, and mouse fire. The `window.__deadwire` snapshots were read only. No test directly wrote game state or browser storage, seeded the RNG, teleported an actor, or altered the game clock.

The original local graphics run passed in 2.6 minutes, but the first GitHub CI run timed out all three cases under software rendering. This exposed a renderer portability problem. The revised run exercises a real user graphics setting; gameplay assertions and timeouts are unchanged. [GitHub CI passed for renderer revision `5d95961`](https://github.com/ErikBurdett/deadwire/actions/runs/34095896308), including the same browser suite with forced software rendering.

The test server uses dedicated port **5187**, `--strictPort`, and `reuseExistingServer: false`. This prevents accidentally testing another project already running on a common development port. An earlier attempt reached Theandril on 5173 and is excluded from these results.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium PLAYWRIGHT_SOFTWARE_RENDERER=1 ./node_modules/.bin/playwright test tests/gameplay.spec.ts --output=test-results/software-renderer-low
```

Omit the executable override to use Playwright's installed Chromium on another platform. The software-renderer flag adds Chromium's `--use-angle=swiftshader --use-gl=angle` launch options. CI uses this path explicitly. TypeScript, Prettier, the production build and all 18 simulation tests also pass locally.

## Graphics portability

Controls & settings now offers persistent **Auto / Low / High** graphics quality. Auto selects Low when the WebGL renderer identifies SwiftShader, llvmpipe, softpipe, lavapipe, or another software renderer. Users can select Low manually if detection is unavailable. Every browser case verifies Auto resolution, selects Low through the actual settings control, checks the canvas drawing-buffer dimensions, and continues the same gameplay tests. Reload checks also confirm that the graphics preference persists separately from the raid save.

| Setting or observation | Current behavior / measured evidence |
| --- | --- |
| Low resolution | Half CSS resolution, capped at 640 × 400; this run verified a real 640 × 400 drawing buffer inside the 1280 × 800 interface. Menus and HUD remain at CSS resolution. |
| Low lighting | Directional and hemisphere lighting with the same geometry/textures; shadow maps, environment reflections and local point lights are disabled. |
| High lighting | Full render scale up to 1.6 device-pixel ratio, shadows, environment reflections and three fixed nearby point-light slots. Camera movement changes slot uniforms rather than compiling shaders for a changing light count. |
| Gameplay retained | All 30 soldiers and 57 caches, simulation rules, interaction distances and existing visibility distances remain unchanged. |
| Actual renderer | ANGLE, Vulkan 1.3.0, SwiftShader Device (Subzero), SwiftShader driver. |
| Completed case durations | Hideout 4.3s; raid/save/edge extraction 24.8s; paid call 13.6s. |
| Sampled diagnostics | Edge-extraction snapshot: 60 wall-clock FPS, 69 draw calls, 40,344 triangles, 1.0ms renderer CPU submission time. These are local samples, not sustained or cross-machine guarantees. |

FPS now uses the unclamped animation-frame interval. The `frameMs` diagnostic measures renderer CPU submission time, not a GPU timer. Draw counts include the world and first-person weapon passes. A zero FPS reading immediately after reload means the first half-second sampling window has not completed. Full observations are attached to the Playwright report as `graphics-observations.json` and `renderer-observations.json`.

## Verified behavior

| Browser case | Observed result |
| --- | --- |
| Hideout preparation | Bought a suppressor, fitted it through the weapon modification selector, equipped the sidearm and rifle, upgraded the ammunition facility, verified the resulting bank/reserve values, and checked the initially empty lore archive. Walked the 3D hideout with W, changed view with an arrow key, and confirmed profile persistence after a page reload. |
| Raid and edge extraction | Deployed into a world containing 30 guards and 57 loot caches. Walked to the starter supplies using WASD, searched with E, recovered $95, ammunition, a trauma kit and the Last Ferry note. Observed patrol positions change. Opened the map and inventory, read the note, fired with the mouse, and reloaded with R. Confirmed the complete paused raid state and profile survived a page reload exactly. Walked to the south extraction at (-209, 220), completed its hold, and returned with bank $745, the rifle, and archived lore. |
| Called extraction | Looted nearby South Cordon caches through movement and E interactions. The call button was disabled at $95 and enabled after earning more than $200. This software-rendering run reached $314; clicking the call debited exactly $200, left $114, and started the aircraft arrival timer. The subsequent call button was disabled. |

All three cases finished with empty browser error collections: no recorded JavaScript exceptions, console errors, or failed same-origin asset responses. The 900 × 700 layout check found no horizontal document overflow. Screenshots were visually inspected; they are evidence rather than pixel-comparison assertions.

## Screenshots

The current screenshots show the software-rendering run in Low graphics. Reduced 3D resolution and simpler lighting are visible; UI resolution is preserved.

| Evidence | View |
| --- | --- |
| [hideout-desktop.png](hideout-desktop.png) | 1280 × 800 operations menu after the equipment and facility purchases |
| [hideout-narrow.png](hideout-narrow.png) | 900 × 700 operations menu |
| [weapon-workbench.png](weapon-workbench.png) | Weapon modification interface |
| [hideout-walk.png](hideout-walk.png) | First-person hideout environment |
| [blackwater-deployment.png](blackwater-deployment.png) | Actual raid insertion and HUD |
| [tactical-map.png](tactical-map.png) | Map and edge extraction legend |
| [field-inventory.png](field-inventory.png) | Recovered cash and readable Last Ferry note |
| [extraction-success.png](extraction-success.png) | Completed edge extraction and secured rewards |
| [called-extraction.png](called-extraction.png) | Paid extraction request and $114 remaining; the temporary event toast overlaps part of the arrival HUD in this captured frame |

## Scope and limits

These checks validate the exercised solo gameplay loop and persistence on this browser configuration. The browser run did not defeat and loot a soldier, complete the full called-aircraft arrival/boarding sequence, or explore every compound. It is not a frame-rate benchmark, a hardware compatibility matrix, an accessibility audit, or a guarantee that every procedural seed behaves identically. The underlying simulation has separate tests in `tests/sim.test.ts`.

The images show the current original procedural polygon prototype and its actual lighting. They do not establish AAA realism, production humanoid animation quality, or a finished commercial game.
