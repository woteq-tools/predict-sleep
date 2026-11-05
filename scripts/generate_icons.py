#!/usr/bin/env python3
"""Generate the app icons for the Sleep Predictor.

The icon is a crescent moon on a night sky. Everything is drawn at 4x and then
downscaled, which gives clean anti-aliased edges without extra dependencies.

Usage:
    python3 scripts/generate_icons.py
"""

from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(HERE), "icons")

SUPERSAMPLE = 4

# Night sky colours.
SKY_TOP = (30, 42, 94)
SKY_BOTTOM = (11, 16, 32)
MOON = (255, 233, 168)
MOON_SHADOW = (255, 209, 102)
STAR = (255, 255, 255)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_background(size: int) -> Image.Image:
    """A vertical gradient over the whole canvas."""
    image = Image.new("RGBA", (size, size), SKY_BOTTOM + (255,))
    draw = ImageDraw.Draw(image)
    for y in range(size):
        t = y / max(1, size - 1)
        color = tuple(int(round(lerp(SKY_TOP[i], SKY_BOTTOM[i], t))) for i in range(3))
        draw.line([(0, y), (size, y)], fill=color + (255,))
    return image


def draw_stars(image: Image.Image, size: int, count: int, seed: int = 7) -> None:
    """Scattered stars with a deterministic layout."""
    rng = random.Random(seed)
    draw = ImageDraw.Draw(image, "RGBA")
    for _ in range(count):
        x = rng.uniform(0.04, 0.96) * size
        y = rng.uniform(0.04, 0.96) * size
        radius = rng.uniform(0.006, 0.017) * size
        alpha = rng.randint(90, 225)
        draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=STAR + (alpha,))


def draw_moon(image: Image.Image, size: int, scale: float, offset_x: float, offset_y: float) -> None:
    """A crescent moon: a filled circle minus an offset circle."""
    radius = 0.26 * size * scale
    cx = size * (0.5 + offset_x)
    cy = size * (0.48 + offset_y)

    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=255)
    # The bite that turns the disc into a crescent.
    cut = radius * 0.92
    mask_draw.ellipse(
        [cx - cut + radius * 0.42, cy - cut - radius * 0.2, cx + cut + radius * 0.42, cy + cut - radius * 0.2],
        fill=0,
    )

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        [cx - radius * 1.25, cy - radius * 1.25, cx + radius * 1.25, cy + radius * 1.25],
        fill=MOON_SHADOW + (70,),
    )
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius * 0.18)))

    body = Image.new("RGBA", (size, size), MOON + (255,))
    image.paste(body, (0, 0), mask)


def build_icon(size: int, maskable: bool = False) -> Image.Image:
    """Render one icon at the requested pixel size."""
    big = size * SUPERSAMPLE
    image = draw_background(big)

    if maskable:
        # Keep the artwork inside the 80% safe zone so the launcher can crop it.
        draw_stars(image, big, count=26, seed=11)
        draw_moon(image, big, scale=0.82, offset_x=0.0, offset_y=-0.02)
    else:
        draw_stars(image, big, count=34, seed=7)
        draw_moon(image, big, scale=1.0, offset_x=0.03, offset_y=-0.03)

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon-180.png", 180, False),
        ("favicon-32.png", 32, False),
    ]

    for name, size, maskable in targets:
        icon = build_icon(size, maskable)
        path = os.path.join(OUT_DIR, name)
        icon.save(path, "PNG", optimize=True)
        print(f"wrote {os.path.relpath(path, os.path.dirname(HERE))} ({size}x{size})")


if __name__ == "__main__":
    main()
