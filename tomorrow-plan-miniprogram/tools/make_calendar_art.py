"""日历页素材 v2：圆胖身子的像素火焰（参考图的形状）+ 顶部像素花园。

参考图的特征：
  · 身子是个圆胖的水滴，底部最宽
  · 顶上一根向左弯的尖钩
  · 黑描边之内还有好几层深浅——暗红橙 → 亮橙 → 浅橙 → 奶黄
"""

import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

# 16x16：圆胖身子 + 向左弯的尖钩
FLAME = [
    ".......#........",
    "......##........",
    "......###.......",
    "......####......",
    ".....#####......",
    ".....######.....",
    "....########....",
    "...#########....",
    "..###########...",
    "..############..",
    ".#############..",
    ".##############.",
    ".##############.",
    ".##############.",
    "..############..",
    "...##########...",
]
BLACK = (26, 26, 26, 255)

# 每档 4 层：[最暗, 暗, 亮, 高光]
LEVELS = {
    1: [(84, 84, 84, 255), (140, 140, 140, 255), (190, 190, 190, 255), (232, 232, 232, 255)],
    2: [(176, 74, 20, 255), (214, 106, 40, 255), (255, 154, 77, 255), (255, 201, 143, 255)],
    3: [(190, 60, 18, 255), (232, 84, 18, 255), (255, 107, 26, 255), (255, 168, 92, 255)],
    4: [(206, 120, 0, 255), (240, 160, 0, 255), (255, 200, 0, 255), (255, 244, 176, 255)],
}


def depth_map(rows):
    h, w = len(rows), len(rows[0])
    solid = [[rows[y][x] == "#" for x in range(w)] for y in range(h)]

    def edge(x, y):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or not solid[ny][nx]:
                    return True
        return False

    depth = {}
    frontier = [(x, y) for y in range(h) for x in range(w) if solid[y][x] and edge(x, y)]
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
    return depth


def render_flame(rows, cell, tones):
    h, w = len(rows), len(rows[0])
    depth = depth_map(rows)
    img = Image.new("RGBA", (w * cell, h * cell), (0, 0, 0, 0))
    px = img.load()

    def color_for(d):
        if d == 0:
            return BLACK
        if d == 1:
            return tones[0]
        if d == 2:
            return tones[1]
        if d <= 4:
            return tones[2]
        return tones[3]

    for (x, y), d in depth.items():
        c = color_for(d)
        for dy in range(cell):
            for dx in range(cell):
                px[x * cell + dx, y * cell + dy] = c
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

    for i in range(0, BANNER_W, 4):
        top = random.choice([1, 1, 2])
        for y in range(top + 2, BANNER_H):
            put(i + 1, y, GREEN if y % 2 else DARK)

    for i in range(0, BANNER_W, 4):
        top = random.choice([1, 1, 2])
        petal = random.choice(PETALS)
        cx = i + 1
        put(cx, top + 1, petal)
        put(cx - 1, top + 2, petal)
        put(cx + 1, top + 2, petal)
        put(cx, top + 3, (255, 240, 150, 255))

    for x in range(BANNER_W):
        put(x, BANNER_H - 1, SOIL)

    return img


if __name__ == "__main__":
    for lv, tones in LEVELS.items():
        render_flame(FLAME, 6, tones).save(os.path.join(OUT, f"flame-{lv}.png"))

    render_banner(8).save(os.path.join(OUT, "cal-banner.png"))

    # 拼一张对比图方便看
    tiles = [Image.open(os.path.join(OUT, f"flame-{i}.png")) for i in (1, 2, 3, 4)]
    pad = 16
    W = sum(t.width for t in tiles) + pad * (len(tiles) + 1)
    H = max(t.height for t in tiles) + pad * 2
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    x = pad
    for t in tiles:
        canvas.paste(t, (x, pad), t)
        x += t.width + pad
    canvas = canvas.resize((canvas.width * 3, canvas.height * 3), Image.NEAREST)
    canvas.save(os.path.join(OUT, "_flames.png"))

    for f in sorted(os.listdir(OUT)):
        if f.startswith(("flame-", "cal-banner", "_flames")):
            print(f"{f:18} {os.path.getsize(os.path.join(OUT, f)):>6} bytes")
