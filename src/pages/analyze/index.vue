<template>
  <view class="page analyze-page">
    <view class="section hero">
      <view>
        <view class="title">可解释阵容评分</view>
        <view class="subtitle">不是只给分数。每次评分都会说明强点、短板、对位风险和替代战法。</view>
      </view>
    </view>
    <view class="section band">
      <view class="card-title">评分功能开发中</view>
      <view class="note">此功能将在后续版本中实现。</view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {};
  }
};
</script>

<style scoped>
.analyze-page { min-height: 100vh; padding: 24rpx; }
.hero { margin-bottom: 24rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #f7e4bc; }
.subtitle { margin-top: 8rpx; font-size: 24rpx; color: #98a3b3; }
.band { padding: 24rpx; border: 1rpx solid rgba(214, 168, 93, 0.22); background: rgba(249, 239, 216, 0.06); border-radius: 8rpx; }
.card-title { color: #f7e4bc; font-size: 30rpx; font-weight: 700; }
.note { margin-top: 14rpx; color: #b9c2cf; font-size: 24rpx; }
</style>
