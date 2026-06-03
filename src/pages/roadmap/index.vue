<template>
  <view class="page roadmap-page">
    <view class="title">产品路线</view>
    <view class="section band">
      <view class="card-title">V1 可解释评分 MVP</view>
      <view class="note">已完成：评分工作台、资料库、对位预览、管理后台</view>
    </view>
    <view class="section band">
      <view class="card-title">V1.5 账号级共存引擎</view>
      <view class="note">规划中：多队共存、战法冲突检测、赛季组合推荐</view>
    </view>
    <view class="section band">
      <view class="card-title">V2 战报数据训练场</view>
      <view class="note">规划中：战报导入、胜率分析、样本可信度</view>
    </view>
  </view>
</template>

<script>
export default { data() { return {}; } };
</script>

<style scoped>
.roadmap-page { min-height: 100vh; padding: var(--sp-lg); }
.title { font-size: 36rpx; font-weight: 700; color: var(--gold-bright); margin-bottom: var(--sp-lg); }
.band { padding: var(--sp-lg); border: 1rpx solid var(--border-accent); background: var(--ink-surface); border-radius: var(--r-md); margin-bottom: var(--sp-md); box-shadow: var(--shadow-sm); transition: box-shadow var(--ease); }
.card-title { color: var(--gold-bright); font-size: 30rpx; font-weight: 700; }
.note { margin-top: 14rpx; color: var(--text-ink); font-size: 24rpx; }
</style>
