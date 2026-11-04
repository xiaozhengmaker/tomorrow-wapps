"""火焰吉祥物的唯一数据源。

改这里 → 所有产物一起更新：
  images/logo.png / logo.jpg / mascot.jpg / logo.svg / logo-mono.svg
  images/mascot.png            预览页用的位图
  images/app-icon-144.png      小程序头像
  app.wxss 里的 .mascot       页面里那个 box-shadow 画的像素火焰
  app.wxss 里的 .mascot-box

用法： python tools/make_flame.py
"""

import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "images")
os.makedirs(OUT, exist_ok=True)

# ---------------- 1. 轮廓（唯一需要改的地方） ----------------
# '#' = 实心火焰    '.' = 透明
SILHOUETTE = [
    "........#.......",
    ".......##.......",
    "......###.......",
    "......####......",
    ".....#####......",
    ".....######.....",
    "....#######.###.",
    "...########.###.",
    "...########.###.",
    "..#########.###.",
    "..#########.....",
    "..##########....",
    ".###########....",
    ".###########....",
    ".###########....",
    "..##########....",
    "...########.....",
    "....######......",
]

# ---------------- 2. 分层规则 ----------------
COLOR = {
    "K": (26, 26, 26, 255),      # 黑描边
    "O": (255, 107, 26, 255),    # 橙外焰
    "Y": (255, 176, 32, 255),    # 黄中焰
    "W": (255, 240, 192, 255),   # 奶白核心
}
MONO = {
    "K": (10, 10, 10, 255),
    "O": (70, 70, 70, 255),
    "Y": (150, 150, 150, 255),
    "W": (255, 255, 255, 255),
}


def build(rows):
    """按「到边界的距离」分层，底部加权让火心下沉。"""
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

    depth = {}
    frontier = [(x, y) for y in range(h) for x in range(w) if solid[y][x] and near_edge(x, y)]
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
            bias = 1.6 * max(0.0, (y - h * 0.35) / (h * 0.65))
            score = dd + bias
            if dd == 0:
                row += "K"
            elif score < 1.6:
                row += "O"
            elif score < 3.2:
                row += "Y"
            else:
                row += "W"
        out.append(row)
    return out


# ---------------- 3. 位图输出 ----------------
def render(rows, cell, palette=COLOR):
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


def on_white(img, size, pad_ratio=0.12):
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    pad = int(size * pad_ratio)
    box = size - pad * 2
    ratio = min(box / img.width, box / img.height)
    w = max(1, int(img.width * ratio))
    h = max(1, int(img.height * ratio))
    scaled = img.resize((w, h), Image.NEAREST)
    canvas.paste(scaled, ((size - w) // 2, (size - h) // 2), scaled)
    return canvas


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


# ---------------- 4. 页面里的 box-shadow 版 ----------------
def write_wxss(rows):
    """把同一张点阵写成 app.wxss 的 .mascot 阴影列表。"""
    px = 10
    shadows = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            rgba = COLOR.get(ch)
            if not rgba:
                continue
            hexcolor = "#%02x%02x%02x" % rgba[:3]
            shadows.append(f"{x * px}rpx {y * px}rpx 0 0 {hexcolor}")

    block = (
        ".mascot {\n"
        f"  width: {px}rpx;\n"
        f"  height: {px}rpx;\n"
        "  background: transparent;\n"
        "  box-shadow:\n  "
        + ",\n  ".join(shadows)
        + ";\n}"
    )

    box = (
        ".mascot-box {\n"
        f"  width: {len(rows[0]) * px}rpx;\n"
        f"  height: {len(rows) * px}rpx;\n"
        "  position: relative;\n"
        "  margin: 0 auto;\n"
        "}"
    )

    css_file = os.path.join(ROOT, "app.wxss")
    with open(css_file, "r", encoding="utf-8") as f:
        t = f.read()

    t2, n1 = re.subn(r"\.mascot \{[\s\S]*?\n\}", block, t, count=1)
    t2, n2 = re.subn(r"\.mascot-box \{[\s\S]*?\n\}", box, t2, count=1)
    if n1 != 1 or n2 != 1:
        print("  ⚠ app.wxss 里没找到 .mascot / .mascot-box，跳过")
        return 0

    with open(css_file, "w", encoding="utf-8") as f:
        f.write(t2)
    return len(shadows)


if __name__ == "__main__":
    grid = build(SILHOUETTE)
    print("\n".join(grid))
    print()

    big = render(grid, 64)
    render(grid, 32).save(os.path.join(OUT, "logo.png"))
    render(grid, 3).save(os.path.join(OUT, "logo-48.png"))
    render(grid, 6).save(os.path.join(OUT, "mascot.png"))
    render(grid, 32, MONO).save(os.path.join(OUT, "logo-mono.png"))
    render(grid, 6, MONO).save(os.path.join(OUT, "mascot-mono.png"))

    on_white(big, 1024).save(os.path.join(OUT, "logo.jpg"), quality=95)
    on_white(big, 512).save(os.path.join(OUT, "mascot.jpg"), quality=95)
    on_white(big, 144).save(os.path.join(OUT, "app-icon-144.png"))

    with open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8") as f:
        f.write(to_svg(grid, COLOR))
    with open(os.path.join(OUT, "logo-mono.svg"), "w", encoding="utf-8") as f:
        f.write(to_svg(grid, MONO))

    count = write_wxss(grid)

    for name in ("logo.png", "logo.jpg", "mascot.jpg", "mascot.png", "logo.svg", "app-icon-144.png"):
        p = os.path.join(OUT, name)
        print(f"  {name:22} {os.path.getsize(p):>7} bytes")
    print(f"  app.wxss .mascot        {count} 个像素")
