"""底部导航的像素图标（81x81，9x9 格，每格 9px，硬边无抗锯齿）。"""

import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "images")
os.makedirs(OUT, exist_ok=True)

GRID = 9
CELL = 9
GRAY = (154, 154, 154, 255)
ORANGE = (255, 107, 26, 255)

ICONS = {
    # 清单：三行「方块 + 横杠」
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
    # 日历：格子底纹 + 顶部两条挂钉
    "calendar": [
        "010000010",
        "111111111",
        "101010101",
        "111111111",
        "101010101",
        "111111111",
        "101010101",
        "111111111",
        "000000000",
    ],
    # 拆解：一竖分叉成 Y
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
    # 复盘：一簇火焰
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
    img.save(os.path.join(OUT, name + ".png"))


if __name__ == "__main__":
    for key, rows in ICONS.items():
        draw(key, rows, GRAY)
        draw(key + "-on", rows, ORANGE)
    for f in sorted(os.listdir(OUT)):
        if f.startswith(("list", "split", "review", "calendar")):
            print(f"{f:16} {os.path.getsize(os.path.join(OUT, f)):>6} bytes")
