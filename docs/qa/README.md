# Browser gameplay evidence

The current DEADWIRE build passed all **3 Playwright browser tests in 2.6 minutes** using system Chromium at 1280 × 800, with an additional 900 × 700 layout check. The tests used real UI clicks, keyboard movement, and mouse fire. The `window.__deadwire` snapshots were read only; no game state, storage, random seed, actor position, or clock was injected or modified by the tests.

The test server uses dedicated port **5187**, `--strictPort`, and `reuseExistingServer: false`. This prevents accidentally testing another project already running on a common development port. An earlier attempt reached Theandril on 5173 and is excluded from these results.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium ./node_modules/.bin/playwright test tests/gameplay.spec.ts --output=test-results/deadwire-browser-controls
```

Omit the executable override to use Playwright's installed Chromium on another platform. Test configuration and test source also passed TypeScript and Prettier checks.

## Verified behavior

| Browser case | Observed result |
| --- | --- |
| Hideout preparation | Bought a suppressor, fitted it through the weapon modification selector, equipped the sidearm and rifle, upgraded the ammunition facility, verified the resulting bank/reserve values, and checked the initially empty lore archive. Walked the 3D hideout with W, changed view with an arrow key, and confirmed profile persistence after a page reload. |
| Raid and edge extraction | Deployed into a world containing 30 guards and 57 loot caches. Walked to the starter supplies using WASD, searched with E, recovered $95, ammunition, a trauma kit and the Last Ferry note. Observed patrol positions change. Opened the map and inventory, read the note, fired with the mouse, and reloaded with R. Confirmed the complete paused raid state and profile survived a page reload exactly. Walked to the south extraction at (-209, 220), completed its hold, and returned with bank $745, the rifle, and archived lore. |
| Called extraction | Looted nearby South Cordon caches through movement and E interactions. The call button was disabled at $95 and enabled after earning more than $200. This run reached $224; clicking the call debited exactly $200, left $24, and started the aircraft arrival timer. The subsequent call button was disabled. |

All three cases finished with empty browser error collections: no recorded JavaScript exceptions, console errors, or failed same-origin asset responses. The 900 × 700 layout check found no horizontal document overflow. Screenshots were visually inspected; they are evidence rather than pixel-comparison assertions.

## Screenshots

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
| [called-extraction.png](called-extraction.png) | Paid extraction request and $24 remaining; the temporary event toast overlaps part of the arrival HUD in this captured frame |

## Scope and limits

These checks validate the exercised solo gameplay loop and persistence on this browser configuration. The browser run did not defeat and loot a soldier, complete the full called-aircraft arrival/boarding sequence, or explore every compound. It is not a frame-rate benchmark, a hardware compatibility matrix, an accessibility audit, or a guarantee that every procedural seed behaves identically. The underlying simulation has separate tests in `tests/sim.test.ts`.

The images show the current original procedural polygon prototype and its actual lighting. They do not establish AAA realism, production humanoid animation quality, or a finished commercial game.
