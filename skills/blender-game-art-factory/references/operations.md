# Factory operations and export contract

The self-contained templates originate in DEADWIRE's working `scripts/art_factory.py` and `scripts/blender_assets.py`. `assets/template-manifest.json` records the bundled file digests. Bootstrap requires Python 3; generation requires Blender with its glTF exporter and Cycles renderer. Pillow or ImageMagick is optional for the combined contact sheet. Individual PNG reviews render without either.

## Commands

Run from the target project directory. Set `BLENDER_BIN` to an executable path if discovery needs an override.

```bash
python3 scripts/art_factory.py doctor
python3 scripts/art_factory.py build --asset crate
python3 scripts/art_factory.py validate --asset crate
python3 scripts/art_factory.py contact-sheet
```

Inspect `assets/previews/crate.png` with an image viewer, then inspect its gameplay appearance. Record actual evidence; substitute real notes and reviewer identity in this command:

```bash
python3 scripts/art_factory.py review --asset crate --decision approve --reviewer "agent or person" --notes "Actual visual findings about this candidate and its intended use."
python3 scripts/art_factory.py publish --asset crate
```

Use `--decision reject` for unsatisfactory candidates. `--asset` accepts a comma-separated list or `all` (default). `build` does not publish. Asset IDs are registered in `IDS` in the orchestrator and `BUILDERS` in the Blender source; update both when adding or removing an asset. Project package-manager aliases may invoke these commands but are not required.

## Boundaries and failure behavior

| Stage | Location | Meaning |
| --- | --- | --- |
| Authored generator | `scripts/blender_assets.py` | Editable reproducible asset source |
| Blender source | `assets/source/<id>.blend` | Generated editable scene, includes review setup |
| Candidate | `assets/candidates/<id>.glb` and `.json` | Unpublished geometry plus metadata/hashes |
| Evidence | `assets/previews/<id>.png` | Render bound to candidate review |
| Latest decision | `assets/reviews/<id>.json` | Reviewer, notes, decision, exact hashes |
| Review archive | `assets/reviewed/<id>/…` or `assets/rejected/<id>/…` | Exact source, export, preview and review snapshot |
| Runtime | `public/assets/<id>.glb` and `manifest.json` | Local published files consumed by the game |

Validation checks GLB structure, self-contained image/buffer references, geometry/material/draw/size budgets, dimensions, required named groups, and exact source/output/preview hashes. It is a focused project validator, not a full Khronos conformance check, UV inspection, topology audit, or performance benchmark. Add checks only for actual project contracts.

Publication validates every requested candidate and review before copying requested runtime files; an unreviewed/rejected/stale item prevents that batch's publication. Runtime I/O is a local copy rather than a transactional release/deployment. Existing published assets remain available while candidates are rebuilt. Do not edit their manifests to bypass failed checks. Verify copied runtime file SHA256 values against `outputSha256`, and treat altered bytes as unpublished artwork.

The factory captures Blender version, generator digest, dimensions, counts, seed, and original authorship provenance. Generated `.blend` files may differ byte-for-byte across builds because of stored state or tool versions; each resulting hash needs its own review. The bundled source's DEADWIRE names/stencils and CC0 declaration describe its original authored geometry/textures. When adding another project's work, update textual branding and provenance; third-party inputs keep their own licenses.

## Geometry, coordinates, PBR, and motion

- Model in meters. Blender source uses +Z up and +Y forward; the glTF exporter produces +Y up and -Z forward. Ground roots at the agreed contact point and measure the exported bounds. Keep unusual pivots documented: the starter rifle is grounded at its magazine base.
- Apply intended mesh scale/rotation before UV and export operations, while preserving the local transforms needed for attachments or articulation. Avoid negative scales in the export. Test a known directional object in-engine; do not hide a repeated coordinate error with arbitrary per-instance scaling.
- Use Principled BSDF materials compatible with glTF metallic/roughness. The starter embeds 128px generated base-color images with metallic/roughness scalar factors. It does not bake procedural shader graphs into full texture sets. For richer surfaces, author UVs and bake intended normal/roughness/metallic/occlusion maps; set color/data texture spaces correctly and inspect actual exported textures in-engine.
- Merge compatible static meshes by material/group to bound draw calls while keeping meaningful attachment/motion nodes. Triangle count alone does not measure scene cost. Optimize repeated instances, textures, shadows, and scene density at the expected gameplay view.
- The starter rifle exposes `optic` and `suppressor`. Soldier groups `leg_l`, `leg_r`, `arm_l`, `arm_r` have joint pivots for simple rigid motion. The export disables animation clips and contains no skinned rig. A group name is not a skeletal animation. For animated characters, implement bones/weights/actions and clip export, then verify clip names, lengths, rest pose and deformation in the actual engine loader.
- Collision volumes and LODs are separate engine responsibilities in this starter. Derive colliders from actual asset bounds where appropriate; implement/export dedicated collision or LOD assets if the game needs them.

## Headless Blender behavior

Builds use `--background --factory-startup -noaudio --threads 6 --python-exit-code 1 --python SCRIPT -- ASSET_IDS`. The wrapper syntax-checks the generator before launching. The six-thread limit is a tested default that can be adapted to the host.

On the development host, Blender completed saves/renders but stalled during audio teardown. The bundled generator flushes stdout/stderr and calls `os._exit(0)` only after every synchronous export, source save, PNG render, and metadata write has completed. Preserve that ordering. This bypasses normal teardown and is specific to a dedicated batch process; never use it in desktop/MCP code. Do not assume a hung process succeeded: check exit status and validate every expected output. If another host fails earlier, inspect its error/log and change the failing stage rather than repeatedly relaunching an unchanged command.

## Integrate and accept

Use the project's real glTF loader and its asset root convention. The starter publishes URLs as `/assets/<id>.glb`; adjust the publisher/loader together for a different engine or base path. Cache loaded source scenes and clone instances appropriately. Named node visibility/rotation must remain instance-local; clone materials before per-instance mutations, and use the engine's skeleton-aware clone for future skinned assets. Dispose replaced GPU resources without disposing shared resources still in use.

Check representative assets in both a neutral studio and the actual game light/exposure. Review at first-person and world distances where applicable: silhouette, plausible construction and scale, roughness/metal separation, UV distortion, attachment fit, articulation, foot grounding, clipping, and shadow readability. Save evidence and concrete remaining gaps. Measure performance at the intended scene density on a representative configuration; report device/resolution and observed limits rather than claiming universal frame rates.

The stock kit establishes an optimized playable prototype. Realistic character/weapon production may require better anatomy, clothing deformation, authored texture maps, animation, normal baking, and LODs. Decide which work matters for the user's requested finish; passing starter technical limits alone does not demonstrate that quality.
