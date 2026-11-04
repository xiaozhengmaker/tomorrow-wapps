"""火焰素材 v3：更扁更宽 + 白眼睛。

产出：
  images/mascot-l0..l4.png   首页打卡火焰（灰 / 普通 / 银 / 金 / 钻石蓝）
  images/flame-1..4.png      日历格里的小火焰（四档进度）
  images/cal-banner.png      台历顶部像素花园
"""

import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

# 18 宽 x 14 高：扁宽的水滴，第 7 行挖两个白眼睛
FLAME = [
    "........##........",
    ".......####.......",
    "......######......",
    ".....########.....",
    "....##########....",
    "...############...",
    "..##############..",
    "..####oo##oo####..",
    ".#################",
    ".#################",
    ".#################",
    "..###############.",
    "...#############..",
    ".....#########....",
]

BLACK = (26, 26, 26, 255)
WHITE = (255, 255, 255, 255)

# 打卡五档：[最暗, 暗, 亮, 高光]
TIERS = {
    0: [(70, 70, 70, 255), (110, 110, 110, 255), (150, 150, 150, 255), (196, 196, 196, 255)],
    1: [(176, 74, 20, 255), (214, 96, 26, 255), (255, 107, 26, 255), (255, 168, 92, 255)],
    2: [(120, 122, 128, 255), (168, 172, 180, 255), (214, 218, 226, 255), (245, 247, 250, 255)],
    3: [(176, 122, 0, 255), (214, 160, 20, 255), (255, 200, 0, 255), (255, 240, 160, 255)],
    4: [(24, 96, 190, 255), (40, 140, 240, 255), (92, 190, 255, 255), (196, 236, 255, 255)],
}

# 日历四档进度（沿用橙系 + 银/金）
CAL_TIERS = {
    1: [(84, 84, 84, 255), (130, 130, 130, 255), (176, 176, 176, 255), (216, 216, 216, 255)],
    2: [(176, 74, 20, 255), (214, 106, 40, 255), (255, 154, 77, 255), (255, 201, 143, 255)],
    3: [(190, 60, 18, 255), (232, 84, 18, 255), (255, 107, 26, 255), (255, 168, 92, 255)],
    4: [(176, 122, 0, 255), (214, 160, 20, 255), (255, 200, 0, 255), (255, 240, 160, 255)],
}


def depth_map(rows):
    h, w = len(rows), len(rows[0])
    solid = [[rows[y][x] in "#o" for x in range(w)] for y in range(h)]

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

    for (x, y), d in depth.items():
        if rows[y][x] == "o":
            c = WHITE
        elif d == 0:
            c = BLACK
        elif d == 1:
            c = tones[0]
        elif d == 2:
            c = tones[1]
        elif d <= 4:
            c = tones[2]
        else:
            c = tones[3]
        for dy in range(cell):
            for dx in range(cell):
                px[x * cell + dx, y * cell + dy] = c
    return img


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
    for tier, tones in TIERS.items():
        render_flame(FLAME, 8, tones).save(os.path.join(OUT, f"mascot-l{tier}.png"))

    for lv, tones in CAL_TIERS.items():
        render_flame(FLAME, 5, tones).save(os.path.join(OUT, f"flame-{lv}.png"))

    render_banner(8).save(os.path.join(OUT, "cal-banner.png"))

    tiles = [Image.open(os.path.join(OUT, f"mascot-l{i}.png")) for i in range(5)]
    pad = 14
    W = sum(t.width for t in tiles) + pad * (len(tiles) + 1)
    H = max(t.height for t in tiles) + pad * 2
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    x = pad
    for t in tiles:
        canvas.paste(t, (x, pad), t)
        x += t.width + pad
    canvas.save(os.path.join(OUT, "_mascots.png"))

    for f in sorted(os.listdir(OUT)):
        if f.startswith(("mascot-l", "flame-", "cal-banner", "_mascots")):
            print(f"{f:20} {os.path.getsize(os.path.join(OUT, f)):>6} bytes")
