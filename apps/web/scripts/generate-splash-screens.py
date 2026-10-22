#!/usr/bin/env python3
"""Generate iOS PWA splash screens (apple-touch-startup-image) from the
BairePorbo logo. Centers the logo on the manifest's background_color for
every common iPhone/iPad resolution (portrait + landscape).

Run: python3 scripts/generate-splash-screens.py
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
LOGO_PATH = PUBLIC / "splashscreen.png"
OUT_DIR = PUBLIC / "splash"

with open(PUBLIC / "manifest.json") as f:
    BACKGROUND_COLOR = json.load(f)["background_color"]

# (device-width, device-height, dpr, label) in CSS px @ 1x — used to derive
# both the pixel dimensions and the <link media> query in the layout.
DEVICES = [
    (320, 568, 2, "iphone-se1"),
    (375, 667, 2, "iphone-8"),
    (414, 736, 3, "iphone-8-plus"),
    (375, 812, 3, "iphone-x"),
    (414, 896, 2, "iphone-xr"),
    (414, 896, 3, "iphone-xs-max"),
    (360, 780, 3, "iphone-12-mini"),
    (390, 844, 3, "iphone-12"),
    (428, 926, 3, "iphone-12-pro-max"),
    (393, 852, 3, "iphone-14-pro"),
    (430, 932, 3, "iphone-14-pro-max"),
    (768, 1024, 2, "ipad-9-7"),
    (810, 1080, 2, "ipad-10-2"),
    (820, 1180, 2, "ipad-air-10-9"),
    (834, 1112, 2, "ipad-pro-10-5"),
    (834, 1194, 2, "ipad-pro-11"),
    (744, 1133, 2, "ipad-mini-6"),
    (1024, 1366, 2, "ipad-pro-12-9"),
]

LOGO_WIDTH_RATIO = 0.42  # logo occupies ~42% of the shorter screen edge


def build_canvas(px_w: int, px_h: int, logo: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (px_w, px_h), BACKGROUND_COLOR)

    logo_bbox = logo.getbbox()
    cropped = logo.crop(logo_bbox) if logo_bbox else logo
    target_w = int(min(px_w, px_h) * LOGO_WIDTH_RATIO)
    scale = target_w / cropped.width
    target_h = max(1, int(cropped.height * scale))
    resized = cropped.resize((target_w, target_h), Image.LANCZOS)

    x = (px_w - target_w) // 2
    y = (px_h - target_h) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    logo = Image.open(LOGO_PATH).convert("RGBA")

    manifest_links = []
    for width, height, dpr, label in DEVICES:
        for orientation, (w, h) in (
            ("portrait", (width, height)),
            ("landscape", (height, width)),
        ):
            px_w, px_h = w * dpr, h * dpr
            filename = f"apple-splash-{px_w}-{px_h}.png"
            canvas = build_canvas(px_w, px_h, logo)
            canvas.save(OUT_DIR / filename)

            media = (
                f"(device-width: {w}px) and (device-height: {h}px) "
                f"and (-webkit-device-pixel-ratio: {dpr}) and (orientation: {orientation})"
            )
            manifest_links.append((filename, media))
            print(f"Wrote {filename} ({label}, {orientation})")

    (OUT_DIR / "links.json").write_text(json.dumps(manifest_links, indent=2))
    print(f"\nGenerated {len(manifest_links)} splash images in {OUT_DIR}")


if __name__ == "__main__":
    main()
