# Game asset brief

Copy the asset section for each requested asset or closely related batch. Choose values from the game and platform rather than inheriting the starter budgets without review.

## Project contract

- Project / engine / loader:
- Art direction and visual references:
- Target hardware, resolution, and representative scene density:
- Runtime asset directory and URL/base-path convention:
- Source ownership and third-party license/attribution requirements:

## Asset

- Stable ID and gameplay role:
- Real dimensions in meters; tolerance:
- Expected nearest/farthest viewing distance:
- Origin/contact point; forward/up axes:
- Silhouette, construction details, wear, and identifying features:
- Material/UV/texture requirements and texel density:
- Triangle, material/draw, texture-memory, and file-size budgets:
- Required attachment nodes and local pivots:
- Motion contract: rigid groups or skeleton; required named clips:
- Collision and LOD ownership/requirements:
- Export variants and naming:
- Generator/manual source path and provenance:
- Acceptance evidence: views, gameplay location, lighting, articulation checks:
- Actual review findings, decision, and known limits:

Starter defaults are meters, +Y up/-Z forward in GLB, embedded textures, at most 45 draw primitives, 16 materials, and 8MB per GLB. Triangle budgets vary by ID. These are implemented checks, not a quality target. The supplied character has rigid motion groups and no animation clips or skeleton.
