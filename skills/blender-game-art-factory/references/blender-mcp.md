# Interactive Blender MCP

Use this path when interactive scene inspection or editing benefits the task. Prefer the installed tool schema and local add-on implementation over remembered interfaces.

## Discover and prove the connection

Search available tools for Blender. This implementation exposes `get_addon_status`, `get_scene_info`, `get_object_info`, `get_viewport_screenshot`, and `execute_blender_code`; prefixes vary by environment. When a tool accepts `user_prompt`, pass the user's actual instruction verbatim, as required by its schema.

Call `get_addon_status`, then `get_scene_info`. Report separately whether Blender exists, the MCP tools are configured, and the desktop add-on responds. A configured server name or successful `blender --version` is not evidence of a live scene connection. Avoid dumping general client configuration or credentials during discovery.

If unavailable, continue headless asset work and explain the interactive limitation. To connect, the installed Blender add-on must be enabled and its server started from the **MCP for Blender** sidebar in desktop Blender. Inspect the installed add-on for the actual operator, port, and auto-start behavior before scripting it. The tested add-on queues work on Blender's main UI thread and rejects background mode; starting it inside `blender --background` does not produce a working interactive session. Keep the server on localhost. Diagnose a failed connection once with actual add-on/version evidence; retry only after changing the implicated state.

## Preserve the current scene

Inspect `bpy.data.filepath`, `bpy.data.is_dirty`, scene/object names, and selection before writing. Work in a dedicated project asset scene. Preserve any existing unsaved work before opening another file or deleting objects; if its ownership/preservation cannot be established, use an isolated factory process while clarifying only the dependent interactive action. Do not run the batch generator's scene-reset code through MCP in the user's active scene.

A small read-only Python inspection, where supported:

```python
import bpy, json
print(json.dumps({
    "file": bpy.data.filepath,
    "dirty": bpy.data.is_dirty,
    "blender": bpy.app.version_string,
    "objects": [{"name": o.name, "type": o.type,
                 "dimensions": list(o.dimensions), "scale": list(o.scale)}
                for o in bpy.context.scene.objects][:50]
}))
```

Make related edits in short chunks with identifiable object names, inspect the result, and capture the viewport or a studio render. UI context-dependent operators can fail; use Blender data APIs where practical and explicitly set active/selected objects when an operator requires them. Read the installed API or official documentation when uncertain about version-specific properties.

Interactive mutations are exploration until saved/exported and brought into the candidate/review pipeline. The bundled generator's `os._exit(0)` is a headless process teardown workaround: **never execute it in the desktop Blender MCP process**. A manual `.blend` edit is overwritten by procedural `build`; keep a separate source and implement its export/metadata/render stage or port the edit into the generator.

External asset download and hosted 3D generation tools, if installed, are separate optional capabilities. The starter needs neither. Use them only when they serve the requested brief and its permitted services; retain actual source/license attribution and do not relabel third-party content with the starter's CC0 provenance.
