<template>
  <view class="page account-page">
    <view class="title">我的分析台</view>
    <view class="subtitle">管理订阅状态、保存阵容</view>

    <view class="section band">
      <view class="card-title">订阅状态</view>
      <view class="muted">{{ entitlements.tier === 'premium' ? '高级订阅已启用' : '当前为免费层' }}</view>
    </view>

    <view class="section band">
      <view class="card-title">服务端连接</view>
      <view class="muted">{{ apiConfig.mode === 'remote' ? '远程 API 模式' : '本地快照模式' }}</view>
      <view class="config-actions" style="margin-top: 14rpx;">
        <button class="mini-btn" @tap="toggleApiMode">{{ apiConfig.mode === 'remote' ? '切回本地' : '切换远程' }}</button>
      </view>
    </view>
  </view>
</template>

<script>
import * as api from "../../services/api";

export default {
  data() {
    return {
      entitlements: { tier: "free" },
      apiConfig: { mode: "local" }
    };
  },
  onShow() {
    this.apiConfig = api.getApiConfig();
  },
  methods: {
    toggleApiMode() {
      const newMode = this.apiConfig.mode === "remote" ? "local" : "remote";
      this.apiConfig = api.setApiConfig({ mode: newMode });
    }
  }
};
</script>

<style scoped>
.account-page { min-height: 100vh; padding: 24rpx; }
.title { font-size: 36rpx; font-weight: 700; color: #f7e4bc; }
.subtitle { margin-top: 8rpx; font-size: 24rpx; color: #98a3b3; margin-bottom: 24rpx; }
.band { padding: 24rpx; border: 1rpx solid rgba(214, 168, 93, 0.22); background: rgba(249, 239, 216, 0.06); border-radius: 8rpx; margin-bottom: 24rpx; }
.card-title { color: #f7e4bc; font-size: 30rpx; font-weight: 700; }
.muted { color: #8d97a5; margin-top: 8rpx; font-size: 24rpx; }
.config-actions { display: flex; gap: 14rpx; }
.mini-btn { min-width: 116rpx; height: 54rpx; padding: 0 18rpx; border-radius: 6rpx; border: 1rpx solid rgba(214, 168, 93, 0.36); color: #f1d29a; background: rgba(214, 168, 93, 0.08); font-size: 23rpx; display: flex; align-items: center; justify-content: center; }
</style>
