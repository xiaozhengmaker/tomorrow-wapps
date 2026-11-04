// 布局重构：首页清单上移 + 输入收进底部悬浮按钮 + 勾选热区放大
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

// ---------- 1) index.wxml 整体重排 ----------
const WXML = `<view class="page">

  <!-- 顶部：火焰 + 日期 + 今日进度（压成一行，把首屏让给清单） -->
  <view class="topbar">
    <view class="topbar-mascot mascot-float {{petting ? 'mascot-pet' : ''}}" bindtap="petMascot">
      <view class="mascot-box"><view class="mascot"></view></view>
    </view>
    <view class="topbar-main">
      <view class="topbar-date">{{todayLabel}}</view>
      <view class="topbar-stat">{{todayStat}}</view>
    </view>
    <view class="streak" wx:if="{{streak > 0}}">
      <view class="flame"></view>
      <text class="num">{{streak}}</text>
    </view>
  </view>

  <!-- 清单：第一屏就是它 -->
  <view
    class="card plan-card card-tint-blue"
    wx:for="{{cards}}"
    wx:key="date"
    data-date="{{item.date}}"
    bindtap="gotoPlan"
  >
    <view class="plan-head">
      <view class="plan-head-left">
        <text class="plan-badge">{{item.badge}}</text>
        <text class="plan-weekday">{{item.weekday}}</text>
      </view>
      <text class="plan-ratio">{{item.doneCount}}/{{item.total}}</text>
    </view>

    <view class="plan-bar">
      <view class="plan-bar-fill" style="width:{{item.percent}}%"></view>
    </view>

    <view class="mini-row" wx:for="{{item.preview}}" wx:for-item="row" wx:key="id">
      <text class="mini-time">{{row.time}}</text>
      <text class="mini-title {{row.done ? 'mini-done' : ''}}">{{row.title}}</text>
    </view>

    <view class="plan-foot">
      <text class="plan-more" wx:if="{{item.total > 3}}">还有 {{item.total - 3}} 项</text>
      <text class="plan-more" wx:else></text>
      <text class="plan-link">查看全部 ›</text>
    </view>
  </view>

  <view class="empty-hint" wx:if="{{cards.length === 0}}">
    <view class="empty-title">今天和明天都还空着</view>
    <view class="empty-sub">点下面的按钮，随便写两句就行</view>
  </view>

  <!-- 复盘提醒：往下挪，不挡清单 -->
  <view class="nudge" wx:if="{{needReview}}" bindtap="goReview">
    <view class="nudge-main">
      <view class="nudge-title">今天还没复盘</view>
      <view class="nudge-sub">{{remindTime}} 了，花两分钟写两句</view>
    </view>
    <text class="nudge-arrow">›</text>
  </view>

  <!-- 底部悬浮入口 -->
  <view class="fab" wx:if="{{!composerOpen}}" bindtap="openComposer">
    <text class="fab-plus">+</text>
    <text>写点什么</text>
  </view>

  <!-- 输入面板 -->
  <view class="composer-mask" wx:if="{{composerOpen}}" bindtap="closeComposer"></view>

  <view class="composer {{composerOpen ? 'is-open' : ''}}" wx:if="{{composerOpen}}">
    <view class="composer-head">
      <text class="composer-title">写点什么</text>
      <text class="composer-close" bindtap="closeComposer">收起</text>
    </view>

    <view class="date-row">
      <text class="date-label">排到</text>
      <view class="date-chips">
        <view
          class="date-chip {{target === item.date ? 'is-on' : ''}}"
          wx:for="{{quickDates}}"
          wx:key="key"
          data-date="{{item.date}}"
          bindtap="pickDate"
        >{{item.label}}</view>
        <picker mode="date" value="{{target}}" bindchange="onDateChange">
          <view class="date-chip {{isCustomDate ? 'is-on' : ''}}">{{isCustomDate ? targetLabel : '选日期'}}</view>
        </picker>
      </view>
    </view>

    <textarea
      class="input-area"
      value="{{draft}}"
      placeholder="明天上午九点跟客户开会，大概一小时&#10;下午把周报写完"
      placeholder-class="input-ph"
      maxlength="600"
      auto-height
      show-confirm-bar="{{false}}"
      cursor-spacing="140"
      focus="{{composerOpen}}"
      bindinput="onInput"
    ></textarea>

    <view class="input-tools">
      <view class="chip" bindtap="fillSample">填入示例</view>
      <view class="chip chip-gap" wx:if="{{draft}}" bindtap="clearInput">清空</view>
      <text class="input-count">{{draft.length}}/600</text>
    </view>

    <view class="btn-primary {{canSubmit ? '' : 'is-disabled'}}" bindtap="generate">
      排进{{targetLabel}}
    </view>
  </view>

</view>
`

fs.writeFileSync(path.join(root, 'pages/index/index.wxml'), WXML, 'utf8')
console.log('index.wxml 已重排')

// ---------- 2) index.js：composer 状态 + 顶栏数据 ----------
const jsFile = path.join(root, 'pages/index/index.js')
let js = fs.readFileSync(jsFile, 'utf8')

js = js.replace(
  "    quickDates: [],\n    isCustomDate: false\n  },",
  "    quickDates: [],\n    isCustomDate: false,\n    composerOpen: false,\n    todayLabel: '',\n    todayStat: ''\n  },"
)

js = js.replace(
  '  /** 摸一下吉祥物',
  `  /** 打开 / 收起输入面板 */
  openComposer: function () {
    this.setData({ composerOpen: true })
  },

  closeComposer: function () {
    this.setData({ composerOpen: false })
  },

  /** 摸一下吉祥物`
)

js = js.replace(
  '      quickDates: this.buildQuickDates()\n    })',
  `      quickDates: this.buildQuickDates(),
      todayLabel: dateUtil.friendlyDate(dateUtil.today()),
      todayStat: (cards[0] ? cards[0].doneCount + '/' + cards[0].total + ' 已完成' : '今天还空着')
    })`
)

// 生成成功后自动收起面板
js = js.replace("  generate: function () {", "  generate: function () {\n    this.setData({ composerOpen: false })")

fs.writeFileSync(jsFile, js, 'utf8')
console.log('index.js 已加 composer / 顶栏数据')

// ---------- 3) 勾选热区放大 ----------
const planWxss = path.join(root, 'pages/plan/plan.wxss')
let pw = fs.readFileSync(planWxss, 'utf8')
pw += `

/* ================= 布局重构：勾选热区放大 ================= */

.row-check {
  width: 72rpx;
  height: 72rpx;
  margin-left: 8rpx;
}

/* 右半行都能点 */
.row-check::after {
  content: '';
  position: absolute;
  right: -24rpx;
  top: -24rpx;
  bottom: -24rpx;
  width: 140rpx;
}
`
fs.writeFileSync(planWxss, pw, 'utf8')
console.log('plan.wxss 热区已放大')
