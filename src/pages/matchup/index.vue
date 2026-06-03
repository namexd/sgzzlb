<template>
  <view class="page matchup-page">
    <view class="section">
      <view class="title">对位预览</view>
      <view class="subtitle">用同一套评分逻辑比较本方阵容和环境队伍，输出优势、风险和可信度。</view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view>
          <view class="label">对方来源</view>
          <view class="source-tabs">
            <text
              class="source-tab"
              :class="{ active: enemySource === 'template' }"
              @click="onEnemySourceChange('template')"
            >环境模板</text>
            <text
              class="source-tab"
              :class="{ active: enemySource === 'saved' }"
              @click="onEnemySourceChange('saved')"
            >我的阵容</text>
          </view>
        </view>
        <text class="pill">{{ entitlements.tier === 'premium' ? '高级对位' : '免费预览' }}</text>
      </view>

      <view v-if="enemySource === 'template'" class="enemy-picker">
        <view class="label">环境队伍</view>
        <picker
          :range="enemyTemplates"
          range-key="name"
          :value="enemyIndex"
          @change="onEnemyChange"
        >
          <view class="field">{{ enemyTemplates[enemyIndex].name }}</view>
        </picker>
      </view>

      <view v-if="enemySource === 'saved'" class="enemy-picker">
        <view class="label">选择保存阵容</view>
        <view v-if="!savedLineups.length" class="empty">还没有保存阵容。先去评分页保存。</view>
        <picker
          v-if="savedLineups.length"
          :range="savedLineups"
          range-key="generalsText"
          :value="savedEnemyIndex"
          @change="onSavedEnemyChange"
        >
          <view class="field">{{ savedLineups[savedEnemyIndex].generalsText || '选择阵容' }}</view>
        </picker>
      </view>

      <view v-if="apiStatus" class="sync-status">{{ apiStatus }}</view>
    </view>

    <view v-if="isLoading" class="section empty">正在生成对位预览...</view>

    <view v-if="!isLoading && ownSummary && enemySummary" class="section compare-grid">
      <view class="side band">
        <view class="side-title">本方</view>
        <view class="score">{{ ownSummary.score }}</view>
        <view class="muted">{{ ownSummary.troop }} · {{ ownSummary.confidence }}</view>
        <view class="names">{{ ownSummary.generalsText }}</view>
        <view class="risk">{{ ownSummary.topWeakness }}</view>
      </view>
      <view class="side band">
        <view class="side-title">{{ enemySummary.name }}</view>
        <view class="score">{{ enemySummary.score }}</view>
        <view class="muted">{{ enemySummary.troop }} · {{ enemySummary.confidence }}</view>
        <view class="names">{{ enemySummary.generalsText }}</view>
        <view class="risk">{{ enemySummary.topWeakness }}</view>
      </view>
    </view>

    <view v-if="result" class="section band verdict">
      <view class="row-between">
        <view class="verdict-title">{{ result.level }}</view>
        <text class="pill">分差 {{ result.scoreDelta }}</text>
      </view>
      <view class="summary">{{ result.summary }}</view>
      <view class="summary">{{ result.risk }}</view>
      <view class="summary">{{ result.troopNote }}</view>
      <view class="confidence">可信度：{{ result.confidence }}</view>
      <view class="battle-actions">
        <button class="mini-btn" @click="openBattleForm">记录战斗结果</button>
        <button class="mini-btn" @click="loadBattleStats">查看战报统计</button>
      </view>
    </view>

    <!-- Battle Report Form Modal -->
    <view v-if="showBattleForm" class="modal-mask" @click="closeBattleForm">
      <view class="modal-content" @click.stop>
        <view class="modal-title">记录战斗结果</view>
        <view class="result-tabs">
          <text
            class="result-tab"
            :class="{ win: battleForm.result === 'win' }"
            @click="setBattleResult('win')"
          >胜利</text>
          <text
            class="result-tab"
            :class="{ loss: battleForm.result === 'loss' }"
            @click="setBattleResult('loss')"
          >失败</text>
          <text
            class="result-tab"
            :class="{ draw: battleForm.result === 'draw' }"
            @click="setBattleResult('draw')"
          >平局</text>
        </view>
        <view class="form-row">
          <text class="form-label">我方战损</text>
          <input
            class="form-input"
            type="number"
            :value="battleForm.damageTaken"
            @input="onBattleInput('damageTaken', $event)"
            placeholder="0"
          />
        </view>
        <view class="form-row">
          <text class="form-label">对方战损</text>
          <input
            class="form-input"
            type="number"
            :value="battleForm.damageDealt"
            @input="onBattleInput('damageDealt', $event)"
            placeholder="0"
          />
        </view>
        <view class="form-row">
          <text class="form-label">回合数</text>
          <input
            class="form-input"
            type="number"
            :value="battleForm.rounds"
            @input="onBattleInput('rounds', $event)"
            placeholder="0"
          />
        </view>
        <view class="form-row">
          <text class="form-label">备注</text>
          <input
            class="form-input"
            :value="battleForm.note"
            @input="onBattleInput('note', $event)"
            placeholder="可选"
          />
        </view>
        <view class="modal-actions">
          <button class="mini-btn" @click="closeBattleForm">取消</button>
          <button class="mini-btn primary" @click="submitBattleReport">提交</button>
        </view>
      </view>
    </view>

    <!-- Battle Stats Modal -->
    <view v-if="showStats" class="modal-mask" @click="closeStats">
      <view class="modal-content modal-large" @click.stop>
        <view class="modal-title">战报统计</view>
        <view v-if="battleStats" class="stats-grid">
          <view class="stat-item">
            <view class="stat-value">{{ battleStats.total }}</view>
            <view class="stat-label">总场次</view>
          </view>
          <view class="stat-item">
            <view class="stat-value">{{ battleStats.winRate }}%</view>
            <view class="stat-label">胜率</view>
          </view>
          <view class="stat-item">
            <view class="stat-value">{{ battleStats.wins }}</view>
            <view class="stat-label">胜利</view>
          </view>
          <view class="stat-item">
            <view class="stat-value">{{ battleStats.losses }}</view>
            <view class="stat-label">失败</view>
          </view>
        </view>
        <view v-if="battleStats && battleStats.byTroop && battleStats.byTroop.length" class="troop-stats">
          <view class="card-title">兵种对位胜率</view>
          <view v-for="item in battleStats.byTroop" :key="item.ownTroop + item.enemyTroop" class="troop-row">
            <text class="muted">{{ item.ownTroop }} vs {{ item.enemyTroop }}</text>
            <text class="muted">{{ item.wins }}/{{ item.total }} ({{ item.winRate }}%)</text>
          </view>
        </view>
        <view v-if="battleRecords.length" class="recent-records">
          <view class="card-title">最近战报</view>
          <view v-for="rec in battleRecords" :key="rec.id" class="record-row">
            <text class="record-result" :class="rec.result">{{ rec.result === 'win' ? '胜' : rec.result === 'loss' ? '负' : '平' }}</text>
            <text class="muted">{{ rec.own_generals || '' }} vs {{ rec.enemy_generals || '' }}</text>
            <text class="delete-btn" @click="deleteBattleRecord(rec.id)">删除</text>
          </view>
        </view>
        <view class="modal-actions">
          <button class="mini-btn" @click="closeStats">关闭</button>
        </view>
      </view>
    </view>

    <view class="feedback-entry" @tap="goToFeedback">对功能有意见？去反馈 →</view>
  </view>
</template>

<script>
import catalog from "../../utils/catalog";
import { getEntitlements } from "../../utils/subscription";
import {
  previewMatchupAsync,
  addBattleReportAsync,
  getBattleReportStatsAsync,
  getBattleReportsAsync,
  deleteBattleReportAsync
} from "../../services/api";

const ENEMY_TEMPLATES = [
  {
    name: "太尉盾",
    troop: "盾兵",
    scenario: "pk",
    generals: ["司马懿", "曹操", "满宠"],
    tactics: ["士别三日", "用武通神", "魅惑", "抚辑军民", "锋矢阵", "刮骨疗毒"]
  },
  {
    name: "吴骑",
    troop: "骑兵",
    scenario: "war",
    generals: ["孙尚香", "凌统", "周泰"],
    tactics: ["裸衣血战", "虎踞鹰扬", "卧薪尝胆", "横扫千军", "盛气凌敌", "西凉铁骑"]
  },
  {
    name: "麒麟弓",
    troop: "弓兵",
    scenario: "pk",
    generals: ["姜维", "庞统", "诸葛亮"],
    tactics: ["夺魂挟魄", "杯蛇鬼车", "太平道法", "士别三日", "八门金锁阵", "婴城自守"]
  },
  {
    name: "关关张",
    troop: "枪兵",
    scenario: "war",
    generals: ["关羽", "关银屏", "张飞"],
    tactics: ["威谋靡亢", "箕形阵", "据水断桥", "青州兵", "横扫千军", "盛气凌敌"]
  },
  {
    name: "虎臣弓",
    troop: "弓兵",
    scenario: "pk",
    generals: ["甘宁", "太史慈", "程普"],
    tactics: ["万箭齐发", "避实击虚", "折冲御侮", "白马义从", "当锋摧决", "弯弓饮羽"]
  },
  {
    name: "三势吕",
    troop: "骑兵",
    scenario: "pk",
    generals: ["吕布", "郭嘉", "黄月英"],
    tactics: ["一骑当千", "暴戾无仁", "虎豹骑", "铁骑驱驰", "三势阵", "横戈跃马"]
  },
  {
    name: "桃园盾",
    troop: "盾兵",
    scenario: "war",
    generals: ["刘备", "关羽", "张飞"],
    tactics: ["陷阵营", "暂避其锋", "落凤", "横扫千军", "盛气凌敌", "刮骨疗毒"]
  },
  {
    name: "蜀智",
    troop: "弓兵",
    scenario: "pk",
    generals: ["诸葛亮", "庞统", "法正"],
    tactics: ["夺魂挟魄", "杯蛇鬼车", "太平道法", "无当飞军", "八门金锁阵", "婴城自守"]
  },
  {
    name: "魏骑",
    troop: "骑兵",
    scenario: "pk",
    generals: ["曹操", "夏侯惇", "程昱"],
    tactics: ["锋矢阵", "抚辑军民", "刮骨疗毒", "士别三日", "用武通神", "焰逐风飞"]
  },
  {
    name: "群弓",
    troop: "弓兵",
    scenario: "war",
    generals: ["袁绍", "朱儁", "陈宫"],
    tactics: ["万箭齐发", "无当飞军", "焰逐风飞", "暂避其锋", "八门金锁阵", "婴城自守"]
  },
  {
    name: "吴枪",
    troop: "枪兵",
    scenario: "pk",
    generals: ["孙权", "鲁肃", "周瑜"],
    tactics: ["兵无常势", "焰逐风飞", "刮骨疗毒", "当锋摧决", "折冲御侮", "白马义从"]
  },
  {
    name: "碰瓷骑",
    troop: "骑兵",
    scenario: "war",
    generals: ["马超", "马云禄", "庞德"],
    tactics: ["裸衣血战", "虎踞鹰扬", "西凉铁骑", "铁骑驱驰", "横戈跃马", "暴戾无仁"]
  }
];

export default {
  data() {
    return {
      entitlements: { tier: "free" },
      enemyTemplates: ENEMY_TEMPLATES,
      enemyIndex: 0,
      enemySource: "template",
      savedLineups: [],
      savedEnemyIndex: 0,
      ownSummary: null,
      enemySummary: null,
      result: null,
      isLoading: false,
      apiStatus: "",
      showBattleForm: false,
      battleForm: null,
      battleStats: null,
      showStats: false,
      battleRecords: []
    };
  },

  onShow() {
    const saved = uni.getStorageSync("savedLineups") || [];
    const savedView = saved.map((item) => ({
      ...item,
      generalsText: (item.generals || []).join(" / ")
    }));
    this.entitlements = getEntitlements();
    this.savedLineups = savedView;
    this.refresh();
  },

  methods: {
    onEnemyChange(event) {
      this.enemyIndex = Number(event.detail.value);
      this.refresh();
    },

    onEnemySourceChange(source) {
      this.enemySource = source;
      this.refresh();
    },

    onSavedEnemyChange(event) {
      this.savedEnemyIndex = Number(event.detail.value);
      this.refresh();
    },

    refresh() {
      const saved = this.savedLineups.length ? this.savedLineups : [];
      const ownInput = saved.length ? this.savedToInput(saved[0]) : this.defaultOwnInput();

      let enemyInput;
      let enemyName;
      if (this.enemySource === "saved" && this.savedLineups.length > 0) {
        const idx = Math.min(this.savedEnemyIndex, this.savedLineups.length - 1);
        const enemySaved = this.savedLineups[idx];
        enemyInput = this.savedToInput(enemySaved);
        enemyName = enemySaved.generals ? enemySaved.generals.join(" / ") : "自选阵容";
      } else {
        const template = this.enemyTemplates[this.enemyIndex];
        enemyInput = this.templateToInput(template);
        enemyName = template.name;
      }

      const payload = { own: ownInput, enemy: enemyInput };
      this.savedCount = saved.length;
      this.isLoading = true;
      this.apiStatus = "";

      previewMatchupAsync(payload)
        .then((preview) => {
          this.isLoading = false;
          this.ownSummary = this.toSummary(saved[0], ownInput, preview.own);
          this.enemySummary = this.toSummary({ name: enemyName }, enemyInput, preview.enemy);
          this.result = preview.result;
        })
        .catch(() => {
          this.isLoading = false;
          this.apiStatus = "对位分析失败，请稍后重试。";
        });
    },

    defaultOwnInput() {
      return this.templateToInput({
        troop: "弓兵",
        scenario: "pk",
        generals: ["赵云", "诸葛亮", "周瑜"],
        tactics: ["一身是胆", "卧薪尝胆", "神机妙算", "刮骨疗毒", "火炽原燎", "焰逐风飞"]
      });
    },

    savedToInput(saved) {
      const generals = saved.generals || [];
      const tactics = saved.tactics || [];
      return {
        troop: saved.troop || "骑兵",
        scenario: saved.scenario === "开荒" ? "pioneer" : saved.scenario === "打架" ? "war" : "pk",
        generalIds: this.namesToGeneralIds(generals),
        tacticIds: this.namesToTacticIds(tactics),
        redLevels: [0, 0, 0]
      };
    },

    templateToInput(template) {
      return {
        troop: template.troop,
        scenario: template.scenario,
        generalIds: this.namesToGeneralIds(template.generals),
        tacticIds: this.namesToTacticIds(template.tactics),
        redLevels: [0, 0, 0]
      };
    },

    namesToGeneralIds(names) {
      const generals = catalog.getGenerals();
      return names.map((name, index) => {
        const found = generals.find((item) => item.name === name);
        return found ? found.id : generals[index].id;
      });
    },

    namesToTacticIds(names) {
      const tactics = catalog.getAllTactics();
      return names.map((name, index) => {
        const found = tactics.find((item) => item.name === name);
        return found ? found.id : tactics[index].id;
      });
    },

    toSummary(source, input, report) {
      const generals = (input.generalIds || []).map((id) => catalog.findGeneralById(id)).filter(Boolean);
      return {
        name: source && source.name ? source.name : "我的最近保存阵容",
        troop: input.troop,
        score: report.totalScore,
        confidence: report.confidence,
        generalsText: generals.map((item) => item.name).join(" / "),
        topWeakness: report.weaknesses[0]
      };
    },

    openBattleForm() {
      if (!this.ownSummary || !this.enemySummary) return;
      this.showBattleForm = true;
      this.battleForm = {
        result: "win",
        damageTaken: 0,
        damageDealt: 0,
        rounds: 0,
        note: ""
      };
    },

    closeBattleForm() {
      this.showBattleForm = false;
      this.battleForm = null;
    },

    setBattleResult(result) {
      if (this.battleForm) {
        this.battleForm = { ...this.battleForm, result };
      }
    },

    onBattleInput(field, e) {
      if (!this.battleForm) return;
      const value = field === "note" ? e.detail.value : Number(e.detail.value) || 0;
      this.battleForm = { ...this.battleForm, [field]: value };
    },

    submitBattleReport() {
      const form = this.battleForm;
      if (!form || !this.ownSummary || !this.enemySummary) return;

      const report = {
        ownGenerals: this.ownSummary.generalsText.split(" / "),
        ownTactics: [],
        ownTroop: this.ownSummary.troop,
        ownScore: this.ownSummary.score,
        enemyGenerals: this.enemySummary.generalsText.split(" / "),
        enemyTactics: [],
        enemyTroop: this.enemySummary.troop,
        enemyScore: this.enemySummary.score,
        result: form.result,
        damageTaken: form.damageTaken,
        damageDealt: form.damageDealt,
        rounds: form.rounds,
        note: form.note
      };

      addBattleReportAsync(report)
        .then(() => {
          this.showBattleForm = false;
          this.battleForm = null;
          uni.showToast({ title: "战报已记录", icon: "success" });
        })
        .catch(() => {
          uni.showToast({ title: "记录失败", icon: "none" });
        });
    },

    loadBattleStats() {
      Promise.all([
        getBattleReportStatsAsync(),
        getBattleReportsAsync({ limit: 20 })
      ])
        .then(([statsRes, reportsRes]) => {
          this.battleStats = statsRes.stats || statsRes;
          this.battleRecords = reportsRes.items || [];
          this.showStats = true;
        })
        .catch(() => {
          uni.showToast({ title: "加载失败", icon: "none" });
        });
    },

    closeStats() {
      this.showStats = false;
    },

    goToFeedback() {
      uni.navigateTo({ url: "/pages/feedback/index" });
    },

    deleteBattleRecord(id) {
      if (!id) return;
      deleteBattleReportAsync(id).then(() => {
        this.battleRecords = this.battleRecords.filter((r) => r.id !== id);
      });
    }
  }
};
</script>

<style scoped>
.matchup-page {
  min-height: 100vh;
  padding: var(--sp-lg);
  padding-bottom: 60rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--gold-bright);
}

.subtitle {
  margin-top: var(--sp-xs);
  font-size: 24rpx;
  color: var(--text-stone);
  margin-bottom: var(--sp-lg);
}

.section {
  margin-bottom: var(--sp-lg);
}

.band {
  padding: var(--sp-lg);
  border: 1rpx solid var(--border-accent);
  background: var(--ink-surface);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--ease);
}

.row-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.pill {
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
  background: var(--gold-ghost);
  color: var(--gold);
  font-size: 22rpx;
  white-space: nowrap;
}

.label {
  margin-bottom: 10rpx;
  color: var(--text-stone);
  font-size: 22rpx;
}

.field {
  padding: var(--sp-md) 20rpx;
  border: 1rpx solid var(--border-accent);
  border-radius: var(--r-sm);
  color: var(--text-ink);
  background: var(--ink-deep);
  font-size: 26rpx;
  transition: border-color var(--ease);
}

.empty {
  padding: 20rpx;
  color: var(--text-stone);
  font-size: 24rpx;
  text-align: center;
}

.gate {
  margin-top: var(--sp-md);
  color: var(--gold);
  font-size: 24rpx;
  line-height: 1.5;
}

.sync-status {
  margin-top: 14rpx;
  color: var(--gold);
  font-size: 24rpx;
  line-height: 1.5;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-md);
}

.side {
  min-height: 270rpx;
}

.side-title {
  color: var(--gold-bright);
  font-size: 28rpx;
  font-weight: 700;
}

.score {
  margin-top: var(--sp-sm);
  color: var(--gold-bright);
  font-size: 56rpx;
  font-weight: 800;
  line-height: 1;
}

.muted {
  color: var(--text-stone);
  font-size: 24rpx;
}

.names,
.risk,
.summary,
.confidence {
  margin-top: 14rpx;
  color: var(--text-ink);
  font-size: 24rpx;
  line-height: 1.55;
}

.risk {
  color: var(--gold-dim);
}

.verdict-title {
  color: var(--gold-bright);
  font-size: 40rpx;
  font-weight: 800;
}

.confidence {
  color: var(--text-stone);
}

.card-title {
  color: var(--gold-bright);
  font-size: 30rpx;
  font-weight: 700;
}

.source-tabs {
  display: flex;
  gap: var(--sp-md);
  margin-top: 10rpx;
  margin-bottom: 14rpx;
}

.source-tab {
  padding: var(--sp-xs) var(--sp-lg);
  border-radius: var(--r-sm);
  border: 1rpx solid var(--border-accent);
  color: var(--text-stone);
  font-size: 24rpx;
  transition: all var(--ease);
}

.source-tab.active {
  border-color: var(--gold);
  color: var(--gold);
  background: var(--gold-ghost);
}

.enemy-picker {
  margin-top: 10rpx;
}

.battle-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
}

.mini-btn {
  padding: 10rpx var(--sp-lg);
  font-size: 24rpx;
  color: var(--gold);
  border: 1rpx solid var(--border-accent);
  border-radius: var(--r-sm);
  background: transparent;
  line-height: 1.6;
  transition: all var(--ease);
}

.mini-btn.primary {
  background: var(--gold-ghost);
  border-color: var(--gold);
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--ink-deepest);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 640rpx;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--ink-mid);
  border-radius: var(--r-md);
  padding: var(--sp-xl);
  border: 1rpx solid var(--border-accent);
  box-shadow: var(--shadow-lg);
}

.modal-large {
  width: 700rpx;
}

.modal-title {
  color: var(--gold-bright);
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: var(--sp-lg);
}

.result-tabs {
  display: flex;
  gap: var(--sp-md);
  margin-bottom: var(--sp-lg);
}

.result-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: var(--r-md);
  border: 1rpx solid var(--border-subtle);
  color: var(--text-stone);
  font-size: 26rpx;
  transition: all var(--ease);
}

.result-tab.win {
  border-color: var(--win);
  color: var(--win);
  background: rgba(39, 174, 96, 0.1);
}

.result-tab.loss {
  border-color: var(--loss);
  color: var(--loss);
  background: rgba(231, 76, 60, 0.1);
}

.result-tab.draw {
  border-color: var(--draw);
  color: var(--draw);
  background: rgba(243, 156, 18, 0.1);
}

.form-row {
  margin-bottom: 18rpx;
}

.form-label {
  color: var(--text-stone);
  font-size: 22rpx;
  margin-bottom: var(--sp-xs);
  display: block;
}

.form-input {
  width: 100%;
  height: 72rpx;
  padding: 0 18rpx;
  border: 1rpx solid var(--border-accent);
  border-radius: var(--r-sm);
  color: var(--text-ink);
  background: var(--ink-deep);
  font-size: 26rpx;
  box-sizing: border-box;
  transition: border-color var(--ease);
}

.modal-actions {
  display: flex;
  gap: 14rpx;
  margin-top: var(--sp-lg);
  justify-content: flex-end;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14rpx;
  margin-bottom: var(--sp-lg);
}

.stat-item {
  text-align: center;
  padding: 14rpx 0;
  background: var(--ink-deep);
  border-radius: var(--r-md);
}

.stat-value {
  color: var(--gold-bright);
  font-size: 32rpx;
  font-weight: 700;
}

.stat-label {
  color: var(--text-stone);
  font-size: 20rpx;
  margin-top: var(--sp-xxs);
}

.troop-stats,
.recent-records {
  margin-top: 18rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid var(--border-faint);
}

.troop-row {
  display: flex;
  justify-content: space-between;
  padding: var(--sp-xs) 0;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid var(--border-faint);
}

.record-result {
  font-size: 24rpx;
  font-weight: 700;
  width: 40rpx;
  text-align: center;
}

.record-result.win {
  color: var(--win);
}

.record-result.loss {
  color: var(--loss);
}

.record-result.draw {
  color: var(--draw);
}

.delete-btn {
  margin-left: auto;
  color: var(--loss);
  font-size: 22rpx;
}

@media screen and (min-width: 768px) {
  .score {
    font-size: 72rpx;
  }

  .verdict-title {
    font-size: 52rpx;
  }

  .mini-btn {
    font-size: 28rpx;
    padding: 14rpx var(--sp-xl);
  }

  .field {
    font-size: 30rpx;
  }
}

.feedback-entry {
  text-align: center;
  color: var(--text-fade);
  font-size: 24rpx;
  padding: var(--sp-xl) 0 var(--sp-md);
}
</style>
