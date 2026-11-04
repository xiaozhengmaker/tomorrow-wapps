"""生成「黑色像素火焰」Logo 的几个候选，拼一张对比图，再输出最终 PNG。"""

import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

CANDIDATES = {
    # A：尖顶 + 底部锯齿，像一簇真火
    "a": [
        "................",
        ".......###......",
        "......####......",
        "......#####.....",
        ".....######.....",
        "....#######.....",
        "....########....",
        "...#########....",
        "..##########....",
        "..###########...",
        ".############...",
        ".#############..",
        "..###########...",
        "..##..###..##...",
        "...#...#...#....",
        "................",
    ],
    # B：上方带一缕飘火（更灵动）
    "b": [
        "........#.......",
        ".......##.......",
        "......###...##..",
        "......####..##..",
        ".....#####.##...",
        ".....#######....",
        "....########....",
        "...#########....",
        "..##########....",
        "..###########...",
        ".############...",
        ".############...",
        "..##########....",
        "..##..##..##....",
        "...#...#..#.....",
        "................",
    ],
    # C：对称、敦实，缩小到 24px 依然清楚
    "c": [
        "................",
        ".......##.......",
        "......####......",
        "......####......",
        ".....######.....",
        "....########....",
        "....########....",
        "...##########...",
        "..############..",
        "..############..",
        "..############..",
        "..############..",
        "...##########...",
        "...##.####.##...",
        "....#..#..#.....",
        "................",
    ],
}


def render(rows, cell, color=(10, 10, 10, 255)):
    h = len(rows)
    w = len(rows[0])
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


if __name__ == "__main__":
    # 对比图：三个候选，各 16x16 放大到 128
    tiles = [render(rows, 8) for rows in CANDIDATES.values()]
    pad = 16
    W = sum(t.width for t in tiles) + pad * (len(tiles) + 1)
    H = max(t.height for t in tiles) + pad * 2
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    x = pad
    for t in tiles:
        canvas.paste(t, (x, pad), t)
        x += t.width + pad
    canvas.save(os.path.join(OUT, "_logo-candidates.png"))

    # 最终版先都出一份，选定后保留 c
    for name, rows in CANDIDATES.items():
        img = render(rows, 32)          # 16*32 = 512
        img.save(os.path.join(OUT, f"logo-{name}-512.png"))
        small = render(rows, 3)          # 48px，看小尺寸效果
        small.save(os.path.join(OUT, f"logo-{name}-48.png"))

    print("生成完成")
    for f in sorted(os.listdir(OUT)):
        if f.startswith("logo") or f.startswith("_"):
            print(" ", f, os.path.getsize(os.path.join(OUT, f)))
