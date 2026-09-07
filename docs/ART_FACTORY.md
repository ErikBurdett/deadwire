# DEADWIRE Blender art factory

The factory produces original textured polygon assets for the game using your installed Blender. It keeps editable `.blend` sources, candidate `.glb` exports, rendered review evidence, recorded decisions, and runtime files separate, following the useful source/candidate/review/runtime boundary in Theandril's art pipeline.

Run from this project directory:

```bash
npm run art:doctor
npm run art:build
npm run art:validate
```

`BLENDER_BIN=/path/to/blender` overrides executable discovery. Builds launch `blender --background --factory-startup`; they do not change a scene already open in your desktop Blender. All generation is local: no model subscription, downloaded assets, API tokens, or paid services are required. The original procedural models and original generated texture pixels are dedicated under CC0-1.0; source/provenance records are included per asset. No Call of Duty models, textures, logos, or extracted content are used.

## Review and publish

A successful technical check **does not** mean an asset has passed visual review. Inspect `assets/previews/contact-sheet.jpg` and individual 512-pixel renders. Open `assets/source/<id>.blend` for a closer look and verify the asset in the game before final acceptance. Record actual findings:

```bash
python3 scripts/art_factory.py review --asset all --decision approve --reviewer "your name" --notes "Specific findings from the rendered assets and in-game inspection."
python3 scripts/art_factory.py publish
```

Review can cover one asset or a comma-separated list. Each decision retains the exact `.blend`, GLB and PNG in a hash-addressed snapshot under `assets/reviewed/<id>/` or `assets/rejected/<id>/`, so later builds cannot erase the approved source or evidence. Use `--decision reject` to retain a rejected candidate and its notes. Publish rechecks the source, candidate, and preview SHA256 values against the review and refuses unreviewed, rejected, or subsequently changed artwork. It validates all requested files before copying any of them to runtime. Runtime copies are under `public/assets`, and `public/assets/manifest.json` retains dimensions, geometry budgets, tool version, original authoring provenance, review notes, and exact hashes. Building a new candidate never replaces a previously published runtime file.

## Coordinates and asset IDs

All exports use meters, glTF +Y up, and -Z forward. The object origin is on the floor plane near the center of the footprint. Asymmetric extensions such as a rifle muzzle, aerial or mirror can extend beyond the footprint center. Blender source uses +Z up and +Y forward, converted by the glTF exporter. The rifle is grounded at the magazine base; its muzzle points -Z. Runtime first-person placement should rotate or position the rifle root as needed, without scaling the weapon to world-building dimensions.

| Asset ID    | Intended use                                                         | Special nodes                                                 |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `rifle`     | Original modular rifle; approximately 1.18m including suppressor     | `optic`, `suppressor` can toggle visibility independently     |
| `soldier`   | 1.84m clothed armed patrolman                                        | `leg_l`, `leg_r` hip pivots; `arm_l`, `arm_r` shoulder pivots |
| `crate`     | Military equipment chest; approximately 1m wide                      | Material batches                                              |
| `container` | 12m long shipping container with corrugation, locking rods, markings | Long axis X                                                   |
| `barrel`    | 0.64m diameter steel drum                                            | Material batches                                              |
| `barrier`   | 2.1m concrete Jersey barrier                                         | Long axis X                                                   |
| `truck`     | 6m military cargo truck                                              | Front -Z                                                      |
| `workbench` | 2.3m gunsmith bench, pegboard, vise, tools                           | Front +Z working side                                         |
| `locker`    | 1.91m twin equipment locker                                          | Front -Z                                                      |
| `radio`     | Extraction radio and aerial                                          | Front -Z                                                      |
| `medkit`    | Fabric medical pouch                                                 | Neutral ivory plus on green patch                             |
| `backpack`  | Tactical loot backpack                                               | Straps, webbing, buckles                                      |
| `generator` | Framed industrial generator                                          | Fuel tank, alternator, sockets                                |

Actual exported dimensions, triangle counts, primitive counts and hashes are authoritative in the candidate/runtime manifests. Soldier legs animate by small `.rotation.x` offsets on named groups. They are articulated mesh groups, not a deforming humanoid skeleton; no skeletal animation clips are claimed. The rifle optic and suppressor are separate node groups; the rest of each asset merges meshes by material to keep draw calls bounded.

## Extend the collection

The editable procedural source is `scripts/blender_assets.py`. It creates dimensioned mesh parts, bevelled edge highlights, named motion/attachment groups and embedded PBR textures. Add a builder, register its stable ID in both scripts, and run:

```bash
python3 scripts/art_factory.py build --asset rifle
python3 scripts/art_factory.py validate --asset rifle
```

Revise shape/materials until its rendered silhouette and surfaces read clearly at gameplay scale. Retain role-specific attachment nodes. Technical checks enforce glTF 2.0, exact source/output/preview hashes, positive meter dimensions, self-contained texture/buffer references, material/draw budgets, a per-asset triangle budget, and an 8MB export ceiling. The source may contain camera and light objects used for review; GLB exports intentionally contain only game geometry.

If manually editing a `.blend` file, treat that as a new authored source: export a new candidate and regenerate matching metadata and review evidence before publishing. The current `build` command regenerates from Python and will overwrite the generated `.blend` file for that asset. Copy a `.blend` to a separately named source before manual exploration that you want to keep. A future manual-source import command is not implemented.

## Blender MCP use

MCP lets an assistant inspect and change a Blender scene interactively. It complements the repeatable factory: use it to inspect an object, prototype geometry, change materials and render comparisons; transfer accepted design changes into the procedural source to reproduce them across builds. MCP does not automatically make a model production ready, rig it, optimize it, or approve it visually.

The installed Blender MCP add-on must be enabled in Blender and its local server started from the Blender sidebar before a configured MCP client can connect. Desktop Blender and its current scene remain a separate workspace from the factory's background processes. Save a copy of your current file before permitting interactive scene mutations, and open a dedicated DEADWIRE asset source for such work. Do not expose the add-on server beyond localhost. This factory does not need the add-on running; `art:doctor` validates the actual background Blender executable rather than pretending the optional interactive connection has been tested.

## Current quality boundary

These are original procedural PBR polygon assets with recognizable industrial construction and authored surface wear. They form an optimized playable prototype asset set, not a photogrammetry library or AAA character production package. There are no scanned surfaces, human face scans, motion capture, skeletal clips, generated LODs, normal-map bake stages, or collision meshes inside the exports. The game supplies its own simple collision and animation behavior. In the studio sheet the container is intentionally framed from its unmarked long side; the opposite side carries original logistics stencils. In-game lighting, shadows, exposure and pixel scale determine final appearance and must be reviewed alongside the contact sheet.

## Verification evidence

`assets/build.log` records the completed Blender build and technical checks. `assets/qa/factory-tests.json` records seven executed tests against an isolated temporary copy: missing review, rejected review, stale review, changed preview and truncated GLB are refused; approved exact bytes publish successfully; only the requested asset is copied. Tests do not fabricate live visual approval. Runtime assets retain the parent reviewer’s actual visual findings and explicit prototype-quality limits.
