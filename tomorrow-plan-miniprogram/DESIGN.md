# DESIGN.md — 明日清单

> 这份文件的用途：让任何接手的人（或 AI）在读代码之前，先知道这个产品**长什么样、为什么这么长**。
> 改任何界面前先读这里；改完如果视觉规则变了，回来同步更新。
> 写法参考 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)。

---

## 1. 一句话定位

一个在微信里记录「某天要做什么」的贴纸手账。
视觉参考 [Sugar（recent.design）](https://recent.design/i/gnchqqe-sugar)：**纯白画布、点阵底、高饱和色块、胶囊贴纸、超粗字**。

它应该像一页贴满便签的纸，而不是一份企业级仪表盘。

## 2. 三条不可动的原则

1. **白底 + 点阵**。底色永远是白的或极浅灰，上面铺一层淡点阵，像贴纸画布。
2. **颜色只用来标记，不用来装饰**。蓝=主行动，红=卡住/重要，绿=完成，紫=学习。剩下的地方全是黑灰。
3. **形状是胶囊和圆角方块**。按钮、标签、日期 chip 一律 999rpx 胶囊；卡片 28rpx 圆角。没有直角。

## 3. 颜色

### 底 / 面

| Token | 值 | 用在哪 |
| --- | --- | --- |
| `canvas` | `#f4f4f1` | 页面底色（上面铺 `#dededa` 点阵） |
| `surface` | `#ffffff` | 卡片、按钮、输入框上层 |
| `field` | `#f2f2ef` | 输入框内部 |
| `line` | `#e4e4df` | 描边、分割线 |
| `line-soft` | `#ecece7` | 硬阴影的底色 |

### 文字

| Token | 值 | 用在哪 |
| --- | --- | --- |
| `ink` | `#111111` | 正文、标题 |
| `ink-2` | `#3d3d3d` | 次级文字、chip |
| `ink-3` | `#5a5a5a` | 按钮次要文字 |
| `muted` | `#8f8f8f` | 说明、占位 |
| `faint` | `#b0b0b0` | 极弱提示 |

### 强调色（四种，各有固定含义）

| Token | 值 | 含义 |
| --- | --- | --- |
| `blue` | `#1e7bf5` | 主行动、进行中、工作 |
| `blue-deep` | `#0b5fd0` | 按钮厚度、按下态 |
| `blue-dark` | `#0b4fa8` | 按钮底部实心阴影 |
| `red` | `#d9301a` | 卡住、重要、延迟 |
| `green` | `#12921c` | 完成、快好了、健康 |
| `purple` | `#5a3ff0` | 学习、有进展 |
| `lime` | `#d6f73b` | 纯装饰贴纸点，不承载语义 |
| `amber` | `#b27a00` | 生活类 |

背景配对（浅底 + 深字）：

| 用途 | 底 | 字 |
| --- | --- | --- |
| 工作 / 进行中 | `#e4efff` | `#1e7bf5` |
| 生活 | `#fff3d6` | `#b27a00` |
| 健康 / 快好了 | `#e4f8e6` | `#12921c` |
| 学习 / 有进展 | `#efebff` | `#5a3ff0` |
| 卡住 / 重要 | `#ffe9e4` | `#d9301a` |
| 其他 / 还没动 | `#f1f1ee` | `#6e6e6e` |

## 4. 字体

只用系统字体。Sugar 的观感靠**字重**而不是字体本身。

```css
font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue",
  Helvetica, "Microsoft YaHei", sans-serif;
```

| 用途 | 字号 | 字重 | 字距 |
| --- | --- | --- | --- |
| 页面标题 | 44–46rpx | **800** | -0.5rpx |
| 首页 hero | 60rpx | **800** | -0.5rpx |
| 卡片标题 | 30rpx | 700 | 0 |
| 正文 | 29–31rpx | 400 | 0 |
| 说明 | 24–25rpx | 400 | 0 |
| 标签 | 21rpx | **700** | 0 |
| 英文 eyebrow | 21rpx | 500 | 7rpx |

**大标题一定要 800**，这是这套风格最明显的特征。字距收紧到 -0.5rpx。

## 5. 圆角 / 阴影

| 元素 | 圆角 |
| --- | --- |
| 卡片 | 28rpx |
| 按钮 / chip / 标签 | **999rpx（胶囊）** |
| 输入框 | 14rpx |
| 小方块装饰 | 6rpx |

**阴影是硬的，不是软的**——底部一条实心色，模拟贴纸浮起：

```css
box-shadow: 0 6rpx 0 #ecece7, 0 12rpx 26rpx rgba(17, 17, 17, 0.05);  /* 卡片 */
box-shadow: 0 8rpx 0 #0b4fa8, 0 14rpx 24rpx rgba(30, 123, 245, 0.22); /* 蓝按钮 */
transform: translateY(6rpx);                                          /* 按下 */
```

## 6. 组件

### 主按钮 `.btn-primary`
高 96rpx、胶囊、纯色 `#1e7bf5`、白字 32rpx/800、厚度阴影 `0 8rpx 0 #0b4fa8`。
按下沉 6rpx，阴影缩到 2rpx。禁用：`#d9d9d4` + `#c9c9c4`。

### 次按钮 `.btn-ghost`
白底、2rpx `#e4e4df` 描边、黑字 600、厚度 `0 6rpx 0 #e8e8e3`。

### 危险按钮 `.btn-danger`
`#fff1ec` 底、`#d9301a` 字、`#f0c9c2` 描边、厚度 `0 6rpx 0 #f6dbd5`。

### 卡片 `.card`
白底、2rpx `#e4e4df`、28rpx 圆角、硬阴影。

### 标签 `.tag`
胶囊、21rpx/700、`padding: 5rpx 18rpx`，按第 3 节的配对表取色。

### 日期 chip `.date-chip`
白底胶囊；选中时整颗变蓝、字变白 800、厚度 `#0b4fa8`。

### 时间轴
左时间列 104rpx 右对齐，中间 2rpx 竖线 `#e6e6e1`，节点 20rpx 空心圆（描边 `#d4d4ce`）。

## 7. 布局

- 页面内距 **32rpx**，底部 **120rpx**
- 卡片间距 **22rpx**，卡内 **26rpx**
- 一切数值用 2rpx 的倍数

## 8. 动效

短、干脆，全部 ≤ 300ms。

| 场景 | 效果 |
| --- | --- |
| 按钮按下 | 下沉 6rpx + 硬阴影收缩（**不加缩放、不加弹簧**） |
| 卡片点击 | 背景 `#fafaf8` |
| 贴纸装饰 | 3.6s `translateY(-8rpx) rotate` 缓慢摇摆 |
| 底部弹层 | 220ms `cubic-bezier(.2,.8,.3,1)` |

## 9. 文案语气

**中性陈述，不夸不骂不催。**

| ✅ | ❌ |
| --- | --- |
| 计划 3 项，完成 1 项（33%）。 | 今天只完成了一点点，加油！ |
| 没打勾的是：找素材、健身。 | 你今天有点懈怠哦 |
| 还没动 | 今天又躺平了 |

按钮用「动作 + 结果」：`拆一下` / `排进明天` / `生成评估` / `开启今晚的提醒`。

## 10. 装饰

只用 CSS 画，不引外部图片，也**不用 emoji**（各端渲染不一致）：

```css
.sticker-dot {           /* 柠檬绿圆点 + 黑描边 */
  width: 26rpx; height: 26rpx; border-radius: 50%;
  background: #d6f73b; border: 3rpx solid #111111;
}
.sticker-square {        /* 红色旋转方块 */
  width: 26rpx; height: 26rpx; border-radius: 6rpx;
  background: #e8351c; border: 3rpx solid #111111; transform: rotate(-12deg);
}
```

## 11. 实现映射

| 规则 | 落在哪 |
| --- | --- |
| 全局色板、按钮、标签、点阵底、装饰 | `app.wxss` |
| 首页 | `pages/index/index.wxss` |
| 时间轴、编辑弹层 | `pages/plan/plan.wxss` |
| 拆解卡 | `pages/breakdown/breakdown.wxss` |
| 复盘、趋势柱 | `pages/review/review.wxss` |
| 设置 | `pages/settings/settings.wxss` |
| 浏览器预览页（同一套视觉的 HTML 版） | `preview.html` 顶部 `<style>` |

## 12. 自检清单

- [ ] 大标题是 800 字重吗？
- [ ] 按钮/标签/日期 chip 是胶囊（999rpx）吗？
- [ ] 阴影是「底部一条实心色」的硬阴影，还是普通高斯模糊？
- [ ] 有没有在装饰处用了语义色？（颜色只能标记状态）
- [ ] 页面底色有点阵吗？还是光秃秃一片？
- [ ] 文案里有没有「加油 / 建议 / 太棒了」？
- [ ] 有没有引入 emoji 当图标？
