"""日历页素材：四档进度火焰 + 顶部像素花园横幅。

火焰形状参考「水滴状 + 顶部左倾的小火苗」，用黑描边 + 纯色填充，
换颜色就得到不同进度档。
"""

import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

# 12 行 x 11 列，'#' = 火焰本体
FLAME = [
    ".....###...",
    "....#####..",
    "....#####..",
    "...######..",
    "...######..",
    "..#######..",
    "..#######..",
    ".########..",
    ".########..",
    "#########..",
    "#########..",
    ".#######...",
]

BLACK = (26, 26, 26, 255)

# 四档进度：冷 → 热
LEVELS = {
    1: ((201, 201, 201, 255), (236, 236, 236, 255)),   # 一点没动：灰
    2: ((255, 138, 61, 255), (255, 190, 140, 255)),    # 做了些：暗橙
    3: ((255, 107, 26, 255), (255, 168, 92, 255)),     # 大半：橙
    4: ((255, 200, 0, 255), (255, 244, 190, 255)),     # 全清：黄热
}


def outline_and_fill(rows):
    """返回 (outline集合, fill集合, core集合)。"""
    h, w = len(rows), len(rows[0])
    solid = [[rows[y][x] == "#" for x in range(w)] for y in range(h)]

    def edge(x, y):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or not solid[ny][nx]:
                    return True
        return False

    outline, fill = set(), set()
    for y in range(h):
        for x in range(w):
            if not solid[y][x]:
                continue
            (outline if edge(x, y) else fill).add((x, y))

    # 内芯：离边界 2 格以上
    core = set()
    for (x, y) in fill:
        deep = True
        for dy in (-2, -1, 0, 1, 2):
            for dx in (-2, -1, 0, 1, 2):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or not solid[ny][nx]:
                    deep = False
        if deep:
            core.add((x, y))
    return outline, fill, core


def render_flame(rows, cell, main, light):
    outline, fill, core = outline_and_fill(rows)
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w * cell, h * cell), (0, 0, 0, 0))
    px = img.load()
    layers = [(outline, BLACK), (fill, main), (core, light)]
    for cells, color in layers:
        for (x, y) in cells:
            for dy in range(cell):
                for dx in range(cell):
                    px[x * cell + dx, y * cell + dy] = color
    return img


# ---------------- 顶部像素花园 ----------------
BANNER_W, BANNER_H = 36, 9
PETALS = [
    (255, 88, 88, 255),
    (255, 154, 61, 255),
    (255, 210, 0, 255),
    (236, 72, 153, 255),
    (120, 160, 255, 255),
    (255, 255, 255, 255),
]
GREEN = (60, 160, 70, 255)
DARK = (30, 90, 40, 255)
SOIL = (120, 90, 60, 255)


def render_banner(cell=8):
    random.seed(7)
    img = Image.new("RGBA", (BANNER_W * cell, BANNER_H * cell), (255, 255, 255, 255))
    px = img.load()

    def put(x, y, color):
        if 0 <= x < BANNER_W and 0 <= y < BANNER_H:
            for dy in range(cell):
                for dx in range(cell):
                    px[x * cell + dx, y * cell + dy] = color

    # 花茎
    for i in range(0, BANNER_W, 4):
        top = random.choice([1, 1, 2])
        for y in range(top + 2, BANNER_H):
            put(i + 1, y, GREEN if y % 2 else DARK)

    # 花朵
    for i in range(0, BANNER_W, 4):
        top = random.choice([1, 1, 2])
        petal = random.choice(PETALS)
        cx = i + 1
        put(cx, top + 1, petal)
        put(cx - 1, top + 2, petal)
        put(cx + 1, top + 2, petal)
        put(cx, top + 3, (255, 240, 150, 255))

    # 顶部天空留白 + 底部泥土
    for x in range(BANNER_W):
        put(x, BANNER_H - 1, SOIL)

    return img


if __name__ == "__main__":
    for lv, (main, light) in LEVELS.items():
        img = render_flame(FLAME, 6, main, light)
        img.save(os.path.join(OUT, f"flame-{lv}.png"))

    render_banner(8).save(os.path.join(OUT, "cal-banner.png"))

    for f in sorted(os.listdir(OUT)):
        if f.startswith("flame-") or f.startswith("cal-banner"):
            print(f"{f:20} {os.path.getsize(os.path.join(OUT, f)):>6} bytes")
