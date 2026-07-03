import unittest
from pathlib import Path

from src import aozoratex, settings_store


class LayoutSettingsTests(unittest.TestCase):
    WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
    OUTPUT_ROOT = WORKSPACE_ROOT / "out" / "work"

    def test_default_device_profiles_match_requested_margins(self) -> None:
        expected_margins = {
            "smart": 4.0,
            "tablet": 7.0,
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

        self.assertAlmostEqual(payload["smart"]["font_size"], 10.5)
        self.assertAlmostEqual(payload["tablet"]["font_size"], 13.5)
        self.assertAlmostEqual(payload["pc"]["font_size"], 13.5)

    def test_build_tex_file_uses_configured_margins_without_recentering(self) -> None:
        expected_margins = {
            "smart": "4.0",
            "tablet": "7.0",
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
