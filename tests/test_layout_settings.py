import unittest
from pathlib import Path

from src import aozoratex, settings_store


class LayoutSettingsTests(unittest.TestCase):
    WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
    OUTPUT_ROOT = WORKSPACE_ROOT / "out" / "work"

    def test_default_device_profiles_match_requested_margins(self) -> None:
        expected_margins = {
            "iphone": 3.0,
            "iphone_plus": 3.0,
            "android_phone": 3.0,
            "ipad": 5.0,
            "ipad_pro": 5.0,
            "android_tablet": 5.0,
            "pc": 20.0,
        }

        for device, expected_margin in expected_margins.items():
            with self.subTest(device=device):
                profile = settings_store.get_device_settings(
                    device,
                    include_custom=False,
                )
                self.assertNotIn("characters_per_line", profile)
                self.assertAlmostEqual(profile["margin_top_mm"], expected_margin)
                self.assertAlmostEqual(profile["margin_bottom_mm"], expected_margin)
                self.assertAlmostEqual(profile["margin_left_mm"], expected_margin)
                self.assertAlmostEqual(profile["margin_right_mm"], expected_margin)

    def test_device_api_payload_includes_font_size(self) -> None:
        payload = settings_store.get_device_api_payload(include_custom=False)

        self.assertAlmostEqual(payload["iphone"]["font_size"], 9.0)
        self.assertAlmostEqual(payload["iphone_plus"]["font_size"], 9.0)
        self.assertAlmostEqual(payload["android_phone"]["font_size"], 9.0)
        self.assertAlmostEqual(payload["ipad"]["font_size"], 11.0)
        self.assertAlmostEqual(payload["ipad_pro"]["font_size"], 11.0)
        self.assertAlmostEqual(payload["android_tablet"]["font_size"], 11.0)
        self.assertAlmostEqual(payload["pc"]["font_size"], 13.5)
        self.assertEqual(payload["iphone"]["category"], "smartphone")
        self.assertFalse(payload["iphone"]["supports_orientation"])
        self.assertTrue(payload["ipad"]["supports_orientation"])
        self.assertTrue(payload["ipad"]["supports_columns"])
        self.assertTrue(payload["pc"]["supports_orientation"])
        self.assertTrue(payload["pc"]["supports_columns"])

    def test_legacy_device_aliases_resolve_to_new_profiles(self) -> None:
        smart = settings_store.get_device_settings("smart", include_custom=False)
        tablet = settings_store.get_device_settings("tablet", include_custom=False)
        tablet_landscape = settings_store.get_device_settings(
            "ipad_landscape",
            include_custom=False,
        )

        self.assertEqual(settings_store.normalize_device_name("smart"), "iphone")
        self.assertEqual(settings_store.normalize_device_name("tablet"), "ipad")
        self.assertAlmostEqual(smart["width_mm"], 90.0)
        self.assertAlmostEqual(tablet["width_mm"], 150.0)
        self.assertAlmostEqual(tablet_landscape["width_mm"], 215.0)
        self.assertAlmostEqual(tablet_landscape["height_mm"], 150.0)
        self.assertEqual(tablet_landscape["mode"], "two_column")

    def test_pc_landscape_and_two_column_are_supported(self) -> None:
        profile = settings_store.get_device_settings("pc", include_custom=False)
        self.assertEqual(profile["orientation"], "portrait")
        self.assertAlmostEqual(profile["width_mm"], 210.0)
        self.assertAlmostEqual(profile["height_mm"], 297.0)

        out_tex = self.OUTPUT_ROOT / "test_layout_pc_landscape_two_column.tex"
        self.OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
        try:
            aozoratex.build_tex_file(
                latex_body="本文テスト\n",
                out_tex=out_tex,
                device="pc",
                title="題名",
                author="著者",
                body_column_mode="two_column",
                device_orientation="landscape",
                use_default_settings=True,
            )

            content = out_tex.read_text(encoding="utf-8")
            self.assertIn("paper={297.0mm,210.0mm}", content)
            self.assertIn(r"\twocolumn", content)
            self.assertIn(r"\clearpage\onecolumn", content)
        finally:
            if out_tex.exists():
                out_tex.unlink()

    def test_build_tex_file_uses_configured_margins_without_recentering(self) -> None:
        expected_margins = {
            "iphone": "3.0",
            "ipad": "5.0",
            "pc": "20.0",
        }

        self.OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

        for device, expected_margin in expected_margins.items():
            with self.subTest(device=device):
                out_tex = self.OUTPUT_ROOT / f"test_layout_{device}.tex"
                try:
                    aozoratex.build_tex_file(
                        latex_body="本文テスト\n",
                        out_tex=out_tex,
                        device=device,
                        title="題名",
                        author="著者",
                        use_default_settings=True,
                    )

                    content = out_tex.read_text(encoding="utf-8")
                    self.assertIn(f"head_space={expected_margin}mm", content)
                    self.assertIn(f"foot_space={expected_margin}mm", content)
                    self.assertIn(f"gutter={expected_margin}mm", content)
                    self.assertIn(f"fore-edge={expected_margin}mm", content)
                    self.assertNotIn("line_length=", content)
                    self.assertNotIn("number_of_lines=", content)
                finally:
                    if out_tex.exists():
                        out_tex.unlink()

    def test_layout_counts_are_derived_from_fixed_margins(self) -> None:
        chars = aozoratex._compute_jis_characters_per_line(
            device_name="pc",
            font_size=13.5,
            page_height_mm=297.0,
            margin_top_mm=20.0,
            margin_bottom_mm=20.0,
        )
        lines = aozoratex._compute_jis_lines_per_column(
            page_width_mm=210.0,
            margin_left_mm=20.0,
            margin_right_mm=20.0,
            font_size=13.5,
            line_leading_ratio=1.5,
            columns=1,
        )

        self.assertEqual(chars, 53)
        self.assertEqual(lines, 23)


if __name__ == "__main__":
    unittest.main()
