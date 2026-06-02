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
.roadmap-page { min-height: 100vh; padding: 24rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #f7e4bc; margin-bottom: 24rpx; }
.band { padding: 24rpx; border: 1rpx solid rgba(214, 168, 93, 0.22); background: rgba(249, 239, 216, 0.06); border-radius: 8rpx; margin-bottom: 16rpx; }
.card-title { color: #f7e4bc; font-size: 30rpx; font-weight: 700; }
.note { margin-top: 14rpx; color: #b9c2cf; font-size: 24rpx; }
</style>
