"""黑色像素火焰（带白色眼睛）—— logo 与吉祥物共用同一套点阵。

'#' = 黑色火焰   'o' = 白色眼睛   '.' = 透明
"""

import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

FLAME = [
    "........#.......",
    ".......##.......",
    ".......###......",
    "......####......",
    "......#####.....",
    ".....#######....",
    ".....##o##o#....",
    "....########....",
    "...##########...",
    "..############..",
    "..############..",
    ".##############.",
    ".#############..",
    "..##.###.##.....",
    "..#...#..#......",
    "................",
]

BLACK = (10, 10, 10, 255)
WHITE = (255, 255, 255, 255)
COLORS = {"#": BLACK, "o": WHITE}


def render(rows, cell):
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w * cell, h * cell), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            color = COLORS.get(ch)
            if not color:
                continue
            for dy in range(cell):
                for dx in range(cell):
                    px[x * cell + dx, y * cell + dy] = color
    return img


def to_svg(rows):
    h, w = len(rows), len(rows[0])
    parts = []
    for color, fill in ((BLACK, "#0a0a0a"), (WHITE, "#ffffff")):
        for y, row in enumerate(rows):
            x = 0
            while x < w:
                if COLORS.get(row[x]) != color:
                    x += 1
                    continue
                start = x
                while x < w and COLORS.get(row[x]) == color:
                    x += 1
                parts.append(
                    f'<rect x="{start}" y="{y}" width="{x - start}" height="1" fill="{fill}"/>'
                )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'shape-rendering="crispEdges">' + "".join(parts) + "</svg>"
    )


if __name__ == "__main__":
    render(FLAME, 32).save(os.path.join(OUT, "logo.png"))          # 512
    render(FLAME, 3).save(os.path.join(OUT, "logo-48.png"))        # 48，看小尺寸
    render(FLAME, 6).save(os.path.join(OUT, "mascot.png"))         # 96，预览页用
    with open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8") as f:
        f.write(to_svg(FLAME))

    for name in ("logo.png", "logo-48.png", "mascot.png", "logo.svg"):
        p = os.path.join(OUT, name)
        print(f"{name:14} {os.path.getsize(p):>6} bytes")
