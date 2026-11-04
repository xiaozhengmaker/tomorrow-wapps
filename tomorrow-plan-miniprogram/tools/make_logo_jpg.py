"""导出 logo / 吉祥物的 JPG（白底，给外部使用）和小程序图标。

JPG 没有透明通道，所以统一放白底——方便直接发给别人或在文档里用。
需要透明的地方仍然用 PNG/SVG。
"""

import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

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

COLOR = {
    "K": (26, 26, 26, 255),
    "O": (255, 107, 26, 255),
    "Y": (255, 176, 32, 255),
    "W": (255, 240, 192, 255),
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


def render(rows, cell):
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w * cell, h * cell), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            color = COLOR.get(ch)
            if not color:
                continue
            for dy in range(cell):
                for dx in range(cell):
                    px[x * cell + dx, y * cell + dy] = color
    return img


def on_white(img, size, pad_ratio=0.12):
    """放到白底方形画布上，居中，留边距。"""
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    pad = int(size * pad_ratio)
    box = size - pad * 2
    ratio = min(box / img.width, box / img.height)
    w = max(1, int(img.width * ratio))
    h = max(1, int(img.height * ratio))
    scaled = img.resize((w, h), Image.NEAREST)
    canvas.paste(scaled, ((size - w) // 2, (size - h) // 2), scaled)
    return canvas


if __name__ == "__main__":
    layered = build(SILHOUETTE)

    # 高清彩色图
    big = render(layered, 64)                 # 1024 x 1152

    on_white(big, 1024).save(os.path.join(OUT, "logo.jpg"), quality=95)
    on_white(big, 512).save(os.path.join(OUT, "mascot.jpg"), quality=95)
    on_white(big, 144).save(os.path.join(OUT, "app-icon-144.png"))
    on_white(big, 512).save(os.path.join(OUT, "logo-white-bg.png"))

    for name in ("logo.jpg", "mascot.jpg", "app-icon-144.png"):
        p = os.path.join(OUT, name)
        print(f"{name:20} {os.path.getsize(p):>7} bytes")
