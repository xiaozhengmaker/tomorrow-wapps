"""按参考图重做像素火焰：黑描边 + 橙色外焰 + 黄色中焰 + 奶白核心。

做法：先画一个实心轮廓，然后自动分层——
  贴边的格子 → 黑描边
  往内第 1 圈 → 橙
  第 2~3 圈   → 黄
  更里面      → 奶白
这样不用手摆每一格的颜色。
同时输出纯黑白版（给「最好也是黑白的」那个要求）。
"""

import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

# 实心轮廓：主火焰 + 右侧一小簇
SILHOUETTE = [
    "........#.......",
    ".......###......",
    "......#####.....",
    "......#####.....",
    ".....#######....",
    ".....#######....",
    "....#########...",
    "....#########...",
    "...###########..",
    "...###########..",
    "..#############.",
    "..#############.",
    "..#############.",
    ".###############",
    ".###############",
    "..#############.",
    "...###########..",
    "....#########...",
]
COLOR = {
    "K": (26, 26, 26, 255),     # 描边
    "O": (255, 107, 26, 255),   # 橙
    "Y": (255, 176, 32, 255),   # 黄
    "W": (255, 240, 192, 255),  # 奶白核心
}
MONO = {
    "K": (10, 10, 10, 255),
    "O": (60, 60, 60, 255),
    "Y": (140, 140, 140, 255),
    "W": (255, 255, 255, 255),
}


def build(rows):
    h, w = len(rows), len(rows[0])
    solid = [[rows[y][x] == "#" for x in range(w)] for y in range(h)]

    def near_edge(x, y):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    return True
                if not solid[ny][nx]:
                    return True
        return False

    # 从边缘做多轮腐蚀，记录每个内部格子的「深度」
    depth = {}
    frontier = [
        (x, y) for y in range(h) for x in range(w) if solid[y][x] and near_edge(x, y)
    ]
    d = 0
    seen = set()
    while frontier:
        nxt = []
        for (x, y) in frontier:
            if (x, y) in seen:
                continue
            seen.add((x, y))
            depth[(x, y)] = d
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and solid[ny][nx] and (nx, ny) not in seen:
                        nxt.append((nx, ny))
        frontier = nxt
        d += 1

    out = []
    for y in range(h):
        row = ""
        for x in range(w):
            if not solid[y][x]:
                row += "."
                continue
            dd = depth.get((x, y), 0)
            if dd == 0:
                row += "K"
            elif dd == 1:
                row += "O"
            elif dd <= 2:
                row += "Y"
            else:
                row += "W"
        out.append(row)
    return out


def render(rows, cell, palette):
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w * cell, h * cell), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            color = palette.get(ch)
            if not color:
                continue
            for dy in range(cell):
                for dx in range(cell):
                    px[x * cell + dx, y * cell + dy] = color
    return img


def to_svg(rows, palette):
    h, w = len(rows), len(rows[0])
    parts = []
    for ch, rgba in palette.items():
        fill = "#%02x%02x%02x" % rgba[:3]
        for y, row in enumerate(rows):
            x = 0
            while x < w:
                if row[x] != ch:
                    x += 1
                    continue
                start = x
                while x < w and row[x] == ch:
                    x += 1
                parts.append(
                    f'<rect x="{start}" y="{y}" width="{x - start}" height="1" fill="{fill}"/>'
                )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'shape-rendering="crispEdges">' + "".join(parts) + "</svg>"
    )


if __name__ == "__main__":
    layered = build(SILHOUETTE)
    print("\n".join(layered))

    render(layered, 32, COLOR).save(os.path.join(OUT, "logo.png"))
    render(layered, 3, COLOR).save(os.path.join(OUT, "logo-48.png"))
    render(layered, 6, COLOR).save(os.path.join(OUT, "mascot.png"))
    render(layered, 32, MONO).save(os.path.join(OUT, "logo-mono.png"))
    render(layered, 6, MONO).save(os.path.join(OUT, "mascot-mono.png"))

    with open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8") as f:
        f.write(to_svg(layered, COLOR))
    with open(os.path.join(OUT, "logo-mono.svg"), "w", encoding="utf-8") as f:
        f.write(to_svg(layered, MONO))

    for name in ("logo.png", "logo-48.png", "mascot.png", "logo-mono.png", "logo.svg"):
        print(f"{name:16} {os.path.getsize(os.path.join(OUT, name)):>6} bytes")
