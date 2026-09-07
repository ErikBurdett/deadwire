# Security reports

DEADWIRE is an experimental local browser game. It has no authentication service,
remote game server, or cloud account system. Saves are local and are not an
anti-cheat or trust boundary. Development diagnostics expose read-only snapshots.

For a vulnerability that could affect users, use GitHub's private vulnerability
reporting on this repository when available. Do not include credentials or private
user data in a public issue. Ordinary gameplay bugs belong in Issues.

The Blender MCP add-on can execute Python in Blender. Keep its listener on localhost
and use only trusted clients. This repository's standalone asset factory does not
require MCP and launches Blender in a separate background process.
