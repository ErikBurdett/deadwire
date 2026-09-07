#!/usr/bin/env python3
"""Copy the bundled Blender factory into an explicit project without overwriting work."""
import argparse
import hashlib
import json
from pathlib import Path
import shlex
import sys


SKILL = Path(__file__).resolve().parents[1]
TEMPLATE = SKILL / "assets" / "template"
MANIFEST = SKILL / "assets" / "template-manifest.json"
OUTPUT_DIRS = (
    "assets/source", "assets/candidates", "assets/previews", "assets/reviews",
    "assets/reviewed", "assets/rejected", "public/assets",
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_path(project, relative):
    """Reject links inside the explicit root instead of writing through them."""
    current = project
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"Destination contains a symlink: {current}")
        if current != project / relative and current.exists() and not current.is_dir():
            raise ValueError(f"Destination parent is not a directory: {current}")
    return current


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, required=True, help="Target game project directory")
    parser.add_argument("--check", action="store_true", help="Show planned files without writing")
    args = parser.parse_args()
    project = args.project.expanduser().resolve()
    if project == SKILL or SKILL in project.parents:
        raise ValueError("Choose a game project outside the installed skill directory.")
    if project.exists() and not project.is_dir():
        raise ValueError(f"Project path is not a directory: {project}")

    manifest = json.loads(MANIFEST.read_text())
    entries = []
    conflicts = []
    for entry in manifest["files"]:
        relative = Path(entry["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError(f"Invalid bundled relative path: {relative}")
        source = TEMPLATE / relative
        if source.is_symlink() or not source.is_file() or digest(source) != entry["sha256"]:
            raise ValueError(f"Bundled template missing or modified: {relative}")
        target = inspect_path(project, relative)
        if target.exists():
            if target.is_file() and digest(target) == entry["sha256"]:
                entries.append((source, target, "keep"))
            else:
                conflicts.append(str(target))
        else:
            entries.append((source, target, "create"))
    for folder in OUTPUT_DIRS:
        target = inspect_path(project, Path(folder))
        if target.exists() and not target.is_dir():
            conflicts.append(str(target))
    if conflicts:
        raise ValueError("Existing files differ; nothing written. Integrate manually or select another project:\n" + "\n".join(conflicts))

    for source, target, action in entries:
        print(f"{action.upper()}: {target}")
    if args.check:
        print("Preflight passed; no files or directories were written.")
        return

    project.mkdir(parents=True, exist_ok=True)
    for source, target, action in entries:
        if action == "keep":
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation also protects against a file created after preflight.
        with target.open("xb") as stream:
            stream.write(source.read_bytes())
    for folder in OUTPUT_DIRS:
        (project / folder).mkdir(parents=True, exist_ok=True)
    print("Factory installed. No assets generated or published.")
    print("Run from your project:")
    print("cd " + shlex.quote(str(project)))
    print("python3 scripts/art_factory.py doctor")
    print("python3 scripts/art_factory.py build --asset crate")
    print("Inspect the rendered candidate before recording review and publishing.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as exc:
        print("BOOTSTRAP ERROR: " + str(exc), file=sys.stderr)
        sys.exit(1)
