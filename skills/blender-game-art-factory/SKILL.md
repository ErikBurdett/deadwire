---
name: blender-game-art-factory
description: Set up or extend a reproducible Blender game-asset pipeline with optional Blender MCP authoring, editable sources, textured GLB exports, rendered review evidence, and hash-checked runtime publication. Use for game props, modular equipment, characters, and repeatable 3D asset batches.
---

# Blender Game Art Factory

Turn an asset brief into editable Blender sources, self-contained game exports, actual visual evidence, and traceable runtime files. Preserve the project's engine, art direction, license choices, and existing build conventions.

## Start with the project

Resolve the requested project path; inspect its instructions, asset loader, build scripts, and art conventions. Extend an existing factory when present. For a new one, this skill bundles a working starter with 13 original industrial/tactical assets; it does not depend on the original DEADWIRE checkout.

Run the bootstrap with an absolute path to this skill's script:

```bash
python3 /absolute/path/to/blender-game-art-factory/scripts/bootstrap.py --project /absolute/path/to/game --check
python3 /absolute/path/to/blender-game-art-factory/scripts/bootstrap.py --project /absolute/path/to/game
```

It copies only authored source and a brief template, creates output directories, and refuses conflicting files. It preserves identical files on repeat runs. `--check` makes no changes. Read [operations.md](references/operations.md) for commands, source boundaries, export conventions, and engine integration.

## Choose authoring transport

Run the project's `python3 scripts/art_factory.py doctor`. This proves executable availability, not the interactive MCP connection. When Blender MCP is available, read [blender-mcp.md](references/blender-mcp.md), check add-on/scene health with read-only tools, and use small scene operations for interactive inspection or authoring. A working factory does not depend on desktop Blender or paid generation services.

For batch work, edit `scripts/blender_assets.py` and run isolated Blender background builds. For manual source edits, preserve a separate `.blend`: the starter's `build` command regenerates and overwrites the generated source. There is no manual-source import command. Port accepted interactive changes into the generator, or implement an explicit manual-source export path before relying on them.

## Work from a measurable brief

Use the bootstrapped `docs/ASSET_BRIEF.md` for requested assets. Set role, gameplay viewing distance, real dimensions, origin/forward axis, materials, attachment/animation node contract, geometry and draw budgets, collision/LOD responsibilities, provenance, and visual acceptance criteria. Adapt IDs and budgets in both factory scripts. The bundled collection is a starter kit; replace its subject matter and labels when the next project differs.

## Build, inspect, publish, verify

1. Build one representative asset; validate geometry, references, named nodes, and hashes before scaling to a batch.
2. Inspect its actual rendered PNG with an image viewer; use the engine's preview/import path for gameplay-scale checks when available. Record specific silhouette, material, scale, articulation, and clipping findings. File existence or a passing validator is not visual review. If the task is factory setup before an engine exists, label review as studio-only and leave engine acceptance outstanding.
3. Approve or reject the exact candidate using the factory's `review` command. Agent review is sufficient when the task authorizes it; this skill adds no user approval step. Group assets in one review only when each has been inspected and the same notes apply.
4. Publish approved candidates through the factory. Publication is a local runtime copy, not a deployment. Never replace the gate with a manual copy or attach an old review to a changed candidate.
5. Load published GLBs through the project's real loader; verify orientation, dimensions, material appearance, motion/attachment nodes, collision behavior, and representative scene performance. Verify runtime bytes match the published manifest. Record observed limits and fix failures within the task scope.

The supplied pipeline binds review to exact source, GLB, and preview SHA256 hashes, and archives those files per decision. Rebuilding invalidates the previous decision if any of those bytes change; procedural determinism does not imply byte-identical Blender files across runs or versions.

The starter uses PBR materials, generated color textures, and articulated mesh groups. It provides no skinned humanoid rig, motion capture, normal-map baking, LOD generation, or mesh colliders. Do not describe these outputs as realistic AAA assets without substantially improving and reviewing those qualities. See the quality and extension guidance in [operations.md](references/operations.md).
