<template>
  <view class="page account-page">
    <view class="section">
      <view class="title">我的分析台</view>
      <view class="subtitle">管理订阅状态、保存阵容和账号级共存分析。</view>
    </view>

    <view class="section band">
      <view class="card-title">账号</view>
      <view v-if="loggedIn && userProfile" class="user-info">
        <view class="user-id">用户 ID：{{ userProfile.id }}</view>
        <view class="muted">保存阵容 {{ userProfile.lineupCount }} 套 · 抽卡记录 {{ userProfile.drawCount }} 条</view>
      </view>
      <view v-else-if="loggedIn" class="muted">已登录，正在加载用户信息...</view>
      <view v-else class="muted">未登录。登录后数据可云端同步。</view>
      <view class="config-actions">
        <button v-if="!loggedIn" class="mini-btn" @tap="doLogin" :loading="loginLoading" :disabled="loginLoading">微信登录</button>
        <button v-if="loggedIn" class="mini-btn" @tap="doLogout">退出登录</button>
      </view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view>
          <view class="card-title">订阅状态</view>
          <view class="muted">{{ entitlements.tier === 'premium' ? '高级订阅已启用' : '当前为免费层' }}</view>
        </view>
        <switch :checked="entitlements.tier === 'premium'" color="#d6a85d" @change="togglePremium" />
      </view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view>
          <view class="card-title">服务端连接</view>
          <view class="muted">{{ apiConfig.mode === 'remote' ? '远程 API 模式' : '本地快照模式' }}</view>
        </view>
        <switch :checked="apiConfig.mode === 'remote'" color="#d6a85d" @change="toggleApiMode" />
      </view>
      <input class="config-input" :value="apiDraftBaseUrl" @input="onApiBaseUrlInput" placeholder="http://127.0.0.1:8787" />
      <view class="config-actions">
        <button class="mini-btn" @tap="saveApiConfig">保存地址</button>
        <button class="mini-btn" @tap="pingApi">检测连接</button>
      </view>
      <view v-if="apiStatus" class="note">{{ apiStatus }}</view>
      <view v-if="apiRemoteSummary" class="note">远程摘要：武将 {{ apiRemoteSummary.generalsCount }}，战法 {{ apiRemoteSummary.tacticsCount }}，装备 {{ apiRemoteSummary.equipmentCount }}，兵种 {{ apiRemoteSummary.troopTacticsCount }}。</view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view class="card-title">保存阵容</view>
        <button class="mini-btn" @tap="clearSaved">清空</button>
      </view>
      <view v-if="!savedLineupsView.length" class="empty">还没有保存阵容。先去评分页生成并保存。</view>
      <view v-for="item in savedLineupsView" :key="item.id" class="saved-item">
        <view class="row-between">
          <view class="saved-title">{{ item.generalsText }}</view>
          <view class="saved-actions">
            <text class="pill">{{ item.score }}</text>
            <text class="delete-btn" @tap="deleteLineup(item.id)">删除</text>
          </view>
        </view>
        <view class="muted">{{ item.scenario }} · {{ item.troop }}</view>
        <view class="muted small">{{ item.tacticsText }}</view>
      </view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view>
          <view class="card-title">账号级共存分析</view>
          <view class="muted">库存：{{ inventorySummary }}</view>
        </view>
        <button class="mini-btn" @tap="seedInventory">导入示例</button>
      </view>
      <button class="btn secondary" @tap="previewOptimize" :loading="optimizeLoading" :disabled="optimizeLoading">生成共存方案</button>
      <view v-if="optimizeHint" class="note">{{ optimizeHint }}</view>

      <view v-if="optimizeResult && optimizeResult.lineups.length" class="optimize-results">
        <view v-for="(lineup, idx) in optimizeResult.lineups" :key="lineup.priority" class="optimize-lineup band">
          <view class="row-between">
            <view class="lineup-role">{{ lineup.role }}</view>
            <view class="lineup-score-pill">{{ lineup.score }} 分</view>
          </view>
          <view class="lineup-info">
            <view class="muted">{{ lineup.troop }} · {{ lineup.generals.join(' / ') }}</view>
            <view class="muted small">{{ lineup.tactics.join(' · ') }}</view>
          </view>
          <view v-if="lineup.weaknesses.length" class="lineup-weakness">
            <text class="muted">短板：{{ lineup.weaknesses[0] }}</text>
          </view>
          <button class="mini-btn" @tap="saveOptimizeLineup(idx)">保存此队</button>
        </view>

        <view v-if="optimizeResult.conflicts.length" class="conflict-section">
          <view class="card-title">战法冲突</view>
          <view v-for="c in optimizeResult.conflicts" :key="c.tacticName" class="conflict-item">
            <text class="muted">{{ c.tacticName }}：{{ c.usedBy.join(' 和 ') }} 共用</text>
          </view>
        </view>

        <view v-if="optimizeResult.unused.generals.length || optimizeResult.unused.tactics.length" class="unused-section">
          <view class="card-title">剩余库存</view>
          <view v-if="optimizeResult.unused.generals.length" class="muted">未编入武将：{{ optimizeResult.unused.generals.map(g => g.name).join('、') }} 等 {{ optimizeResult.unused.generals.length }} 名</view>
          <view v-if="optimizeResult.unused.tactics.length" class="muted">未编入战法：{{ optimizeResult.unused.tactics.map(t => t.name).join('、') }} 等 {{ optimizeResult.unused.tactics.length }} 个</view>
        </view>

        <view v-if="optimizeResult.summary" class="summary-section">
          <view class="muted">共 {{ optimizeResult.summary.totalLineups }} 队，总分 {{ optimizeResult.summary.totalScore }}，均分 {{ optimizeResult.summary.averageScore }}</view>
        </view>
      </view>
    </view>

    <view class="section band">
      <view class="card-title">数据快照</view>
      <view class="note">武将 {{ meta.generalsCount }}，战法 {{ meta.tacticsCount }}，装备 {{ meta.equipmentCount }}，兵种 {{ meta.troopTacticsCount }}。</view>
    </view>
  </view>
</template>

<script>
import catalog from "../../utils/catalog";
import { getEntitlements, setTier, syncEntitlements } from "../../utils/subscription";
import { getApiConfig, setApiConfig, isLoggedIn, logout, wxLogin, getProfile, getCatalogSummary, optimizeAccountAsync, deleteLineupAsync } from "../../services/api";

const EXAMPLE_GENERALS = ["曹操", "刘备", "孙权", "关羽", "张飞", "诸葛亮", "周瑜", "司马懿", "陆逊"];
const EXAMPLE_TACTICS = ["乱世奸雄", "梦中弑臣", "义心昭烈", "卧薪尝胆", "横扫千军", "盛气凌敌", "刮骨疗毒", "暂避其锋", "锋矢阵", "八门金锁阵", "婴城自守", "白马义从"];

export default {
  data() {
    return {
      entitlements: { tier: "free" },
      loggedIn: false,
      userProfile: null,
      loginLoading: false,
      apiConfig: { mode: "local", baseUrl: "http://127.0.0.1:8787" },
      apiDraftBaseUrl: "http://127.0.0.1:8787",
      apiStatus: "",
      apiRemoteSummary: null,
      savedLineupsView: [],
      generalIds: [],
      tacticIds: [],
      inventorySummary: "未设置",
      optimizeLoading: false,
      optimizeHint: "",
      optimizeResult: null,
      meta: {}
    };
  },
  onShow() {
    this.refresh();
  },
  methods: {
    refresh() {
      this.loggedIn = isLoggedIn();
      this.entitlements = getEntitlements();
      this.apiConfig = getApiConfig();
      this.apiDraftBaseUrl = this.apiConfig.baseUrl;
      this.meta = catalog.getMeta() || {};
      this.loadSaved();
      if (this.loggedIn) this.loadProfile();
    },
    loadProfile() {
      getProfile().then((d) => { this.userProfile = d; }).catch(() => {});
    },
    doLogin() {
      this.loginLoading = true;
      wxLogin().then(() => {
        this.loginLoading = false;
        this.loggedIn = true;
        syncEntitlements().then((e) => { this.entitlements = e; });
        this.loadProfile();
      }).catch((err) => {
        this.loginLoading = false;
        uni.showToast({ title: "登录失败", icon: "none" });
      });
    },
    doLogout() {
      logout();
      this.loggedIn = false;
      this.userProfile = null;
    },
    togglePremium(e) {
      setTier(e.detail.value ? "premium" : "free");
      this.entitlements = getEntitlements();
    },
    toggleApiMode(e) {
      this.apiConfig = setApiConfig({ mode: e.detail.value ? "remote" : "local" });
    },
    onApiBaseUrlInput(e) { this.apiDraftBaseUrl = e.detail.value; },
    saveApiConfig() {
      this.apiConfig = setApiConfig({ baseUrl: this.apiDraftBaseUrl });
      uni.showToast({ title: "已保存", icon: "success" });
    },
    pingApi() {
      this.apiStatus = "正在检测...";
      getCatalogSummary().then((d) => { this.apiStatus = "连接成功。"; this.apiRemoteSummary = d; }).catch((err) => { this.apiStatus = "失败：" + err.message; this.apiRemoteSummary = null; });
    },
    loadSaved() {
      const saved = uni.getStorageSync("savedLineups") || [];
      this.savedLineupsView = saved.map((item) => ({ ...item, generalsText: (item.generals || []).join(" / "), tacticsText: (item.tactics || []).join(" · ") }));
    },
    clearSaved() {
      uni.setStorageSync("savedLineups", []);
      this.savedLineupsView = [];
    },
    deleteLineup(id) {
      deleteLineupAsync(id).then(() => this.loadSaved());
    },
    seedInventory() {
      const generals = catalog.getGenerals();
      const tactics = catalog.getAllTactics();
      this.generalIds = EXAMPLE_GENERALS.map((n) => (generals.find((g) => g.name === n) || {}).id).filter(Boolean);
      this.tacticIds = EXAMPLE_TACTICS.map((n) => (tactics.find((t) => t.name === n) || {}).id).filter(Boolean);
      this.inventorySummary = `${this.generalIds.length} 武将 · ${this.tacticIds.length} 战法`;
      this.optimizeResult = null;
    },
    previewOptimize() {
      if (this.generalIds.length < 3) { this.optimizeHint = "请先导入库存。"; return; }
      this.optimizeLoading = true;
      this.optimizeHint = "";
      optimizeAccountAsync({ generalIds: this.generalIds, tacticIds: this.tacticIds, scenario: "pk" })
        .then((r) => { this.optimizeResult = r; this.optimizeLoading = false; })
        .catch((err) => { this.optimizeHint = "失败：" + err.message; this.optimizeLoading = false; });
    },
    saveOptimizeLineup(idx) {
      const lineup = this.optimizeResult.lineups[idx];
      if (!lineup) return;
      const saved = uni.getStorageSync("savedLineups") || [];
      const item = { id: `opt_${Date.now()}`, createdAt: new Date().toISOString(), scenario: "PK赛季", troop: lineup.troop, score: lineup.score, generals: lineup.generals, tactics: lineup.tactics };
      uni.setStorageSync("savedLineups", [item, ...saved]);
      this.loadSaved();
      uni.showToast({ title: "已保存", icon: "success" });
    }
  }
};
</script>

<style>
.account-page { padding: 24rpx; }
.section { margin-bottom: 24rpx; }
.band { background: rgba(255, 255, 255, 0.04); border-radius: 12rpx; padding: 24rpx; border: 1rpx solid rgba(255, 255, 255, 0.08); }
.title { color: #f7e4bc; font-size: 36rpx; font-weight: 700; }
.subtitle { color: #8d97a5; font-size: 24rpx; margin-top: 8rpx; margin-bottom: 16rpx; }
.card-title { color: #f7e4bc; font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.muted { color: #8d97a5; font-size: 24rpx; line-height: 1.6; }
.note { color: #6b7a8d; font-size: 22rpx; margin-top: 10rpx; }
.empty { color: #6b7a8d; font-size: 24rpx; padding: 20rpx 0; }
.row-between { display: flex; justify-content: space-between; align-items: center; }
.config-input { width: 100%; height: 72rpx; padding: 0 18rpx; border: 1rpx solid rgba(214, 168, 93, 0.22); border-radius: 6rpx; color: #f4ead8; background: rgba(8, 12, 18, 0.45); font-size: 26rpx; box-sizing: border-box; margin-top: 12rpx; }
.config-actions { display: flex; gap: 14rpx; margin-top: 14rpx; }
.mini-btn { font-size: 24rpx; padding: 10rpx 24rpx; background: rgba(214, 168, 93, 0.15); border: 1rpx solid rgba(214, 168, 93, 0.3); color: #d6a85d; border-radius: 6rpx; line-height: 1.4; }
.btn { background: rgba(214, 168, 93, 0.2); border: 1rpx solid #d6a85d; color: #d6a85d; border-radius: 8rpx; font-size: 28rpx; margin-top: 16rpx; }
.btn.secondary { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.15); color: #b9c2cf; }
.pill { background: rgba(214, 168, 93, 0.2); color: #d6a85d; font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 4rpx; }
.saved-item { padding: 16rpx 0; border-bottom: 1rpx solid rgba(255, 255, 255, 0.06); }
.saved-title { color: #f4ead8; font-size: 26rpx; font-weight: 600; }
.saved-actions { display: flex; gap: 14rpx; align-items: center; }
.delete-btn { color: #e74c3c; font-size: 22rpx; }
.user-info { margin-bottom: 12rpx; }
.user-id { color: #f4ead8; font-size: 26rpx; }
.optimize-results { margin-top: 18rpx; }
.optimize-lineup { margin-bottom: 16rpx; }
.lineup-role { color: #d6a85d; font-size: 26rpx; font-weight: 600; }
.lineup-score-pill { color: #f4ca78; font-size: 26rpx; font-weight: 700; }
.lineup-info { margin-top: 10rpx; }
.lineup-weakness { margin-top: 8rpx; }
.conflict-section { margin-top: 18rpx; }
.conflict-item { padding: 8rpx 0; }
.unused-section { margin-top: 18rpx; }
.summary-section { margin-top: 14rpx; }
</style>
