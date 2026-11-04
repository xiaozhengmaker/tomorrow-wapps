"""把选定的像素火焰输出成 logo.png / logo.svg / 小尺寸版。"""

import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

# 选定的火焰：尖顶 + 右侧一缕飘火 + 底部三簇火舌
FLAME = [
    "........#.......",
    ".......##.......",
    ".......###......",
    "......####......",
    "......#####.....",
    ".....######.....",
    ".....#######....",
    "....########....",
    "...#########....",
    "...##########...",
    "..###########...",
    "..###########...",
    ".############...",
    ".###########....",
    "..##.##.##......",
    "..#..#..#.......",
]
BLACK = (10, 10, 10, 255)


def render(rows, cell, color=BLACK):
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w * cell, h * cell), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "#":
                continue
            for dy in range(cell):
                for dx in range(cell):
                    px[x * cell + dx, y * cell + dy] = color
    return img


def to_svg(rows, color="#0a0a0a"):
    """把点阵转成 SVG：每行把连续像素合并成一个 rect，输出很小。"""
    h, w = len(rows), len(rows[0])
    parts = []
    for y, row in enumerate(rows):
        x = 0
        while x < w:
            if row[x] != "#":
                x += 1
                continue
            start = x
            while x < w and row[x] == "#":
                x += 1
            parts.append(
                f'<rect x="{start}" y="{y}" width="{x - start}" height="1" fill="{color}"/>'
            )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'shape-rendering="crispEdges">' + "".join(parts) + "</svg>"
    )


if __name__ == "__main__":
    render(FLAME, 32).save(os.path.join(OUT, "logo.png"))       # 512
    render(FLAME, 3).save(os.path.join(OUT, "logo-48.png"))     # 48
    with open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8") as f:
        f.write(to_svg(FLAME))
    # 白色版（放在深色背景 / 做 favicon 反色用）
    render(FLAME, 32, (255, 255, 255, 255)).save(os.path.join(OUT, "logo-white.png"))

    for name in ("logo.png", "logo-48.png", "logo.svg", "logo-white.png"):
        p = os.path.join(OUT, name)
        print(f"{name:16} {os.path.getsize(p):>6} bytes")
