#!/usr/bin/env python3

import runpy
from pathlib import Path


if __name__ == "__main__":
    runpy.run_path(
        str(Path(__file__).resolve().parent / "tools" / "fonts" / "texlive_font_list.py"),
        run_name="__main__",
    )

