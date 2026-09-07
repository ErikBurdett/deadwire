#!/usr/bin/env python3
"""Repeat the factory's seven review/publication checks using disposable fixtures.

Run: python3 scripts/test_art_factory.py
No Blender installation, third-party packages, network access, or live mutations
are required. Fixtures are copied from the checked-in, reviewed asset set.
"""

import contextlib
import importlib.util
import io
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "deadwire_art_factory_under_test", PROJECT_ROOT / "scripts/art_factory.py"
)
assert SPEC is not None and SPEC.loader is not None
factory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(factory)


class FactoryPublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Verify that running this suite leaves the real evidence/runtime intact.
        tracked_paths = [
            PROJECT_ROOT / "assets/candidates/rifle.json",
            PROJECT_ROOT / "assets/reviews/rifle.json",
            PROJECT_ROOT / "public/assets/rifle.glb",
            PROJECT_ROOT / "public/assets/manifest.json",
        ]
        metadata = factory.read(PROJECT_ROOT / "assets/candidates/rifle.json")
        tracked_paths.extend(
            PROJECT_ROOT / metadata[key] for key in ("candidate", "source", "preview")
        )
        cls.live_hashes = {path: factory.sha(path) for path in tracked_paths}

    @classmethod
    def tearDownClass(cls):
        for path, original_hash in cls.live_hashes.items():
            if factory.sha(path) != original_hash:
                raise AssertionError(f"Live asset unexpectedly changed during tests: {path}")

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="deadwire-factory-test-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        root_patch = patch.object(factory, "ROOT", self.root)
        root_patch.start()
        self.addCleanup(root_patch.stop)
        (self.root / "assets/reviews").mkdir(parents=True)
        self.metadata = self.copy_candidate("rifle")

    def copy_candidate(self, asset_id):
        metadata_path = Path("assets/candidates") / f"{asset_id}.json"
        metadata = factory.read(PROJECT_ROOT / metadata_path)
        for key in ("candidate", "source", "preview"):
            destination = self.root / metadata[key]
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(PROJECT_ROOT / metadata[key], destination)
        factory.write(self.root / metadata_path, metadata)
        return metadata

    def copy_review(self, asset_id="rifle", **changes):
        record = factory.read(PROJECT_ROOT / "assets/reviews" / f"{asset_id}.json")
        record.update(changes)
        factory.write(self.root / "assets/reviews" / f"{asset_id}.json", record)
        return record

    def publish(self, assets=None):
        with contextlib.redirect_stdout(io.StringIO()):
            factory.publish(assets if assets is not None else ["rifle"])

    def assert_nothing_published(self):
        runtime = self.root / "public/assets"
        self.assertFalse((runtime / "manifest.json").exists())
        self.assertEqual(list(runtime.glob("*.glb")), [])

    def test_unreviewed_publish_is_refused(self):
        with self.assertRaisesRegex(RuntimeError, "visual review required before publish"):
            self.publish()
        self.assert_nothing_published()

    def test_rejected_publish_is_refused(self):
        self.copy_review(decision="reject")
        with self.assertRaisesRegex(RuntimeError, "visual review rejected"):
            self.publish()
        self.assert_nothing_published()

    def test_stale_visual_review_is_refused(self):
        self.copy_review(outputSha256="0" * 64)
        with self.assertRaisesRegex(RuntimeError, "candidate changed after review"):
            self.publish()
        self.assert_nothing_published()

    def test_changed_preview_evidence_is_refused(self):
        self.copy_review()
        preview = self.root / self.metadata["preview"]
        preview.write_bytes(preview.read_bytes() + b"tampered test evidence")
        with self.assertRaisesRegex(RuntimeError, "Missing or modified.*rifle.png"):
            self.publish()
        self.assert_nothing_published()

    def test_truncated_glb_is_refused(self):
        broken = self.root / "truncated.glb"
        broken.write_bytes(b"not a GLB")
        with self.assertRaisesRegex(RuntimeError, "Truncated GLB"):
            factory.parse_glb(broken)
        self.assert_nothing_published()

    def test_matching_reviewed_publish_preserves_exact_bytes(self):
        review = self.copy_review()
        self.publish()
        runtime = self.root / "public/assets/rifle.glb"
        candidate = self.root / self.metadata["candidate"]
        self.assertEqual(runtime.read_bytes(), candidate.read_bytes())
        self.assertEqual(factory.sha(runtime), self.metadata["outputSha256"])
        manifest = factory.read(self.root / "public/assets/manifest.json")
        self.assertEqual(len(manifest["assets"]), 1)
        published = manifest["assets"][0]
        self.assertEqual(published["id"], "rifle")
        self.assertEqual(published["status"], "published")
        self.assertEqual(published["visualReview"], review)
        self.assertTrue(published["technicalValidation"]["passed"])

    def test_only_requested_approved_asset_is_published(self):
        # An unrelated candidate must not be published or require its own review.
        self.copy_candidate("crate")
        self.copy_review()
        self.publish(["rifle"])
        runtime = self.root / "public/assets"
        self.assertEqual(sorted(path.name for path in runtime.glob("*.glb")), ["rifle.glb"])
        manifest = factory.read(runtime / "manifest.json")
        self.assertEqual([asset["id"] for asset in manifest["assets"]], ["rifle"])
        self.assertFalse((self.root / "assets/reviews/crate.json").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
