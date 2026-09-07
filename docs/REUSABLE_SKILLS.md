# Reusable Blender pipeline skill

`skills/blender-game-art-factory` is a self-contained Codex skill created with this project. It packages the working Python factory source, a conflict-safe project bootstrap, an asset brief, and instructions for optional Blender MCP authoring, visual review, exact-hash publication, and game integration. It contains no generated `.blend`, GLB, or preview files.

After installation, invoke it with a project path and the intended asset collection:

> Use $blender-game-art-factory in /path/to/my-game to make a reviewed collection of industrial props. Reuse our engine's existing glTF loader and target the game's normal viewing distance.

The bundled tactical/industrial collection is a working starting point. New projects can replace its asset builders, dimensions, labels, material choices, and budgets. The skill can also extend an existing factory without bootstrapping over it.

For a project-local invocation before installation:

> Use the skill at ./skills/blender-game-art-factory/SKILL.md to set up the pipeline in /path/to/my-game.

To bootstrap directly, without requiring Codex:

```bash
python3 skills/blender-game-art-factory/scripts/bootstrap.py --project /path/to/my-game --check
python3 skills/blender-game-art-factory/scripts/bootstrap.py --project /path/to/my-game
```

The bootstrap checks bundled source hashes, refuses conflicting destination files and directory symlinks, and preserves identical files on repeat runs. It creates only source/brief files and output directories. Build, review, and local runtime publication remain explicit factory commands. The skill adds no user approval requirement to an already authorized task; an agent can inspect real visual evidence and record its findings.

The generator is independent of a running Blender MCP connection. MCP is useful for interactive editing and inspection, while isolated headless Blender processes produce the reproducible batch. The skill documents the tested audio-teardown workaround, coordinate and named-node contracts, and the distinction between the prototype kit and production character/animation work.

The skill is authored in this repository for review and versioning. Install its whole directory into the configured Codex skills directory; `SKILL.md` links the supporting files and the bootstrap discovers its templates relative to itself. See [the skill entrypoint](../skills/blender-game-art-factory/SKILL.md) for the complete workflow.

Validation passed for skill metadata, Python syntax, supporting links, template digests matching the working factory, no-write preflight, relocation to another directory, a project path containing spaces, repeat-run preservation, and rejection of conflicting files, directory symlinks, and altered templates. A fresh temporary project completed a real Blender 5.2.1 crate build: 1,968 triangles, four draw primitives, and a 179 KiB GLB. Its actual PNG was inspected and recorded as studio-only prototype evidence; review archives and the published runtime copy matched the source/export/preview hashes. This isolated test did not include a game engine; the DEADWIRE game's integration is verified separately.
