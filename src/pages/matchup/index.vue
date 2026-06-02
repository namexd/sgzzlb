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
      <view class="confidence">可信度：{{ result.confidence }}。这不是完整战斗引擎，正式结论仍需真实战报校验。</view>
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

    <view class="section band">
      <view class="side-title">当前数据来源</view>
      <view class="summary">本方优先使用你在评分页保存的最新阵容；如果还没保存，会使用默认示例阵容。</view>
      <view class="muted">已保存阵容：{{ savedCount }} 套</view>
    </view>
  </view>
</template>

<script>
import catalog from "../../utils/catalog";
import { getEntitlements } from "../../utils/subscription";
import {
  previewMatchupAsync,
  isRemoteMode,
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
      savedCount: 0,
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
      const saved = uni.getStorageSync("savedLineups") || [];
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
      const remote = isRemoteMode();
      this.savedCount = saved.length;
      this.isLoading = true;
      this.apiStatus = remote ? "正在请求远程对位服务..." : "使用本地规则预览对位。";

      previewMatchupAsync(payload)
        .then((preview) => {
          this.applyPreview(saved[0], ownInput, enemyInput, preview, remote ? "对位结果来自远程 API。" : "对位结果来自本地规则。", enemyName);
        })
        .catch((error) => {
          this.isLoading = false;
          this.apiStatus = `对位请求失败：${error.message}`;
        });
    },

    applyPreview(saved, ownInput, enemyInput, preview, statusText, enemyName) {
      this.isLoading = false;
      this.apiStatus = statusText;
      this.ownSummary = this.toSummary(saved, ownInput, preview.own);
      this.enemySummary = this.toSummary({ name: enemyName }, enemyInput, preview.enemy);
      this.result = preview.result;
    },

    defaultOwnInput() {
      return this.templateToInput({
        troop: "盾兵",
        scenario: "pk",
        generals: ["曹操", "刘备", "孙权"],
        tactics: ["乱世奸雄", "梦中弑臣", "义心昭烈", "义心昭烈", "坐断东南", "卧薪尝胆"]
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

      this.apiStatus = "正在记录战报...";
      addBattleReportAsync(report)
        .then(() => {
          this.showBattleForm = false;
          this.battleForm = null;
          this.apiStatus = "战报已记录。";
        })
        .catch((err) => {
          this.apiStatus = `战报记录失败：${err.message}`;
        });
    },

    loadBattleStats() {
      this.apiStatus = "正在加载战报统计...";
      Promise.all([
        getBattleReportStatsAsync(),
        getBattleReportsAsync({ limit: 20 })
      ])
        .then(([statsRes, reportsRes]) => {
          this.battleStats = statsRes.stats || statsRes;
          this.battleRecords = reportsRes.items || [];
          this.showStats = true;
          this.apiStatus = "";
        })
        .catch((err) => {
          this.apiStatus = `加载战报失败：${err.message}`;
        });
    },

    closeStats() {
      this.showStats = false;
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
  padding: 24rpx;
  background: #0e1520;
  color: #e0d6c6;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f7e4bc;
}

.subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #98a3b3;
  margin-bottom: 24rpx;
}

.section {
  margin-bottom: 24rpx;
}

.band {
  padding: 24rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  background: rgba(249, 239, 216, 0.06);
  border-radius: 8rpx;
}

.row-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.pill {
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(214, 168, 93, 0.15);
  color: #d6a85d;
  font-size: 22rpx;
  white-space: nowrap;
}

.label {
  margin-bottom: 10rpx;
  color: #8d97a5;
  font-size: 22rpx;
}

.field {
  padding: 16rpx 20rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  border-radius: 6rpx;
  color: #f4ead8;
  background: rgba(8, 12, 18, 0.45);
  font-size: 26rpx;
}

.empty {
  padding: 20rpx;
  color: #8d97a5;
  font-size: 24rpx;
  text-align: center;
}

.gate {
  margin-top: 16rpx;
  color: #d6a85d;
  font-size: 24rpx;
  line-height: 1.5;
}

.sync-status {
  margin-top: 14rpx;
  color: #d6a85d;
  font-size: 24rpx;
  line-height: 1.5;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.side {
  min-height: 270rpx;
}

.side-title {
  color: #f7e4bc;
  font-size: 28rpx;
  font-weight: 700;
}

.score {
  margin-top: 12rpx;
  color: #f4ca78;
  font-size: 56rpx;
  font-weight: 800;
  line-height: 1;
}

.muted {
  color: #8d97a5;
  font-size: 24rpx;
}

.names,
.risk,
.summary,
.confidence {
  margin-top: 14rpx;
  color: #b9c2cf;
  font-size: 24rpx;
  line-height: 1.55;
}

.risk {
  color: #e2b884;
}

.verdict-title {
  color: #f4ca78;
  font-size: 40rpx;
  font-weight: 800;
}

.confidence {
  color: #8d97a5;
}

.card-title {
  color: #f7e4bc;
  font-size: 30rpx;
  font-weight: 700;
}

.source-tabs {
  display: flex;
  gap: 16rpx;
  margin-top: 10rpx;
  margin-bottom: 14rpx;
}

.source-tab {
  padding: 8rpx 24rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  color: #8d97a5;
  font-size: 24rpx;
}

.source-tab.active {
  border-color: #d6a85d;
  color: #d6a85d;
  background: rgba(214, 168, 93, 0.1);
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
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  color: #d6a85d;
  border: 1rpx solid rgba(214, 168, 93, 0.3);
  border-radius: 6rpx;
  background: transparent;
  line-height: 1.6;
}

.mini-btn.primary {
  background: rgba(214, 168, 93, 0.2);
  border-color: #d6a85d;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 640rpx;
  max-height: 80vh;
  overflow-y: auto;
  background: #1a2332;
  border-radius: 12rpx;
  padding: 30rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.2);
}

.modal-large {
  width: 700rpx;
}

.modal-title {
  color: #f7e4bc;
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.result-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.result-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 8rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.15);
  color: #8d97a5;
  font-size: 26rpx;
}

.result-tab.win {
  border-color: #27ae60;
  color: #27ae60;
  background: rgba(39, 174, 96, 0.1);
}

.result-tab.loss {
  border-color: #e74c3c;
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

.result-tab.draw {
  border-color: #f39c12;
  color: #f39c12;
  background: rgba(243, 156, 18, 0.1);
}

.form-row {
  margin-bottom: 18rpx;
}

.form-label {
  color: #8d97a5;
  font-size: 22rpx;
  margin-bottom: 8rpx;
  display: block;
}

.form-input {
  width: 100%;
  height: 72rpx;
  padding: 0 18rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  border-radius: 6rpx;
  color: #f4ead8;
  background: rgba(8, 12, 18, 0.45);
  font-size: 26rpx;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 24rpx;
  justify-content: flex-end;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14rpx;
  margin-bottom: 24rpx;
}

.stat-item {
  text-align: center;
  padding: 14rpx 0;
  background: rgba(8, 12, 18, 0.35);
  border-radius: 8rpx;
}

.stat-value {
  color: #f4ca78;
  font-size: 32rpx;
  font-weight: 700;
}

.stat-label {
  color: #8d97a5;
  font-size: 20rpx;
  margin-top: 4rpx;
}

.troop-stats,
.recent-records {
  margin-top: 18rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
}

.troop-row {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
}

.record-result {
  font-size: 24rpx;
  font-weight: 700;
  width: 40rpx;
  text-align: center;
}

.record-result.win {
  color: #27ae60;
}

.record-result.loss {
  color: #e74c3c;
}

.record-result.draw {
  color: #f39c12;
}

.delete-btn {
  margin-left: auto;
  color: #e74c3c;
  font-size: 22rpx;
}
</style>
