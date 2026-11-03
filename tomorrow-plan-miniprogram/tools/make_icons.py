"""画底部导航的三个像素图标（81x81），以及吉祥物像素图的 CSS 生成。

像素图标用 9x9 的格子画：每个格子 9px，硬边、无抗锯齿 —— 和 Firefly 那个
像素幽灵是同一套语言。
"""

import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

GRID = 9          # 9x9 像素格
CELL = 9          # 每格 9px -> 81x81
GRAY = (176, 176, 176, 255)
BLUE = (28, 176, 246, 255)


# 9x9 点阵，1=实心
ICONS = {
    "list": [
        "000000000",
        "111011110",
        "111011110",
        "000000000",
        "111011110",
        "111011110",
        "000000000",
        "111011110",
        "111011110",
    ],
    "split": [
        "110000011",
        "011000110",
        "001101100",
        "000111000",
        "000111000",
        "000111000",
        "000111000",
        "000000000",
        "000000000",
    ],
    "review": [
        "000010000",
        "000111000",
        "001111100",
        "011111110",
        "111111111",
        "111111111",
        "011111110",
        "001111100",
        "000000000",
    ],
}

def draw(name, rows, color):
    img = Image.new("RGBA", (GRID * CELL, GRID * CELL), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "1":
                continue
            for dy in range(CELL):
                for dx in range(CELL):
                    px[x * CELL + dx, y * CELL + dy] = color
    path = os.path.join(OUT, name + ".png")
    img.save(path)
    return path


if __name__ == "__main__":
    for key, rows in ICONS.items():
        draw(key + "", rows, GRAY)
        draw(key + "-on", rows, BLUE)
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        print(f"{f:16} {os.path.getsize(p):>6} bytes")
