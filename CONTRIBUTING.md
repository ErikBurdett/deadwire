# Contributing to DEADWIRE

This is an early playable prototype. Help turn working mechanics and a reproducible
asset pipeline into a better game. For a broad redesign, open an issue describing
the player outcome before investing in a large change. Small fixes can go straight
to a pull request.

## Local workflow

1. Fork the repository and create a branch for one coherent change.
2. Follow the README setup. Runtime art is included; Blender is only needed for art changes.
3. Implement the behavior across rules, player controls, presentation, and persistence
   wherever those boundaries are affected.
4. Run the relevant checks below, update status or documentation when behavior changes,
   and open a PR explaining the problem, result, and validation.

```bash
npm ci
npm run typecheck
npm run format:check
npm test
npm run art:validate
npm run art:test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run format` applies the repository formatting. Browser tests use a dedicated
local port, real input events, and read-only snapshots. Do not make tests pass by
turning off AI, teleporting around broken controls, or mutating the saved state.
Use deterministic fixtures for pure rules tests and label their scope clearly.

## Game architecture

`Game` in `src/sim.ts` owns gameplay state. The renderer and UI call its methods and
consume state; they should not create competing economy, damage, loot, or extraction
rules. Preserve seeded random generation, fixed simulation steps, and saved continuation.
Use `game.serialize()` and `Game.restore()` when testing persistence. Save shape changes
need an explicit version/migration decision and a regression test.

Keep authored map geometry and colliders consistent. A visual obstacle or opened
route should behave the same for players, enemies, and shots. Measure material changes
to per-frame cost separately from pure simulation timings.

## Art contributions

Read [the art factory guide](docs/ART_FACTORY.md). Include editable source, original
or properly licensed materials, stable asset IDs, meter scale, consistent axes,
technical validation, and actual visual-review evidence. Retain the exact reviewed
bytes; a new generation should not silently replace an approved runtime asset.

The existing original art is CC0. Do not import proprietary game assets or change
third-party attribution to CC0. Source `.blend` and runtime GLB files are checked in;
keep them small and scoped. Coordinate before adding large binary collections.
The factory currently regenerates procedural sources; preserve manual edits under a
separate source name before running a build.

## Good starting areas

- Distinct weapon meshes and a more natural soldier silhouette.
- Hideout and scenery collision aligned with visible geometry.
- Door-aware AI navigation and clearer combat feedback.
- Animation, reload presentation, and audio control polish.
- GPU profiling, light culling, instancing, and resource disposal.
- Accessibility, configurable controls, and wider browser testing.

These are starting points, not claims that an issue has been assigned or completed.
Keep feature proposals and known defects in GitHub Issues. PRs should include
screenshots for visual changes and test output for changed game behavior.

By contributing code, you agree to license it under MIT. Contributions to the original
art collection must be compatible with its CC0 dedication or have an explicitly
reviewed separate license. Be respectful, give specific feedback, and credit others.
