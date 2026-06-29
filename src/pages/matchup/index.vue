<template>
  <view class="page matchup-page">
    <view class="match-bg"></view>

    <view class="match-header">
      <view class="back-btn" @tap="goToFeedback">‹</view>
      <view class="header-copy">
        <view class="page-title">阵容对位分析</view>
        <view class="page-subtitle">胜率 · 战损 · 克制链</view>
      </view>
      <view class="help-btn">!</view>
    </view>

    <view class="source-panel">
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
      <picker
        v-if="enemySource === 'template'"
        :range="enemyTemplates"
        range-key="name"
        :value="enemyIndex"
        @change="onEnemyChange"
      >
        <view class="field">{{ selectedEnemyTemplate.name }}</view>
      </picker>
      <picker
        v-if="enemySource === 'saved' && savedLineups.length"
        :range="savedLineups"
        range-key="generalsText"
        :value="savedEnemyIndex"
        @change="onSavedEnemyChange"
      >
        <view class="field">{{ savedLineups[savedEnemyIndex].generalsText || '选择阵容' }}</view>
      </picker>
      <view v-if="enemySource === 'saved' && !savedLineups.length" class="empty-line">阵容为空</view>
    </view>

    <view class="battle-stage">
      <view class="camp camp-own">
        <view class="camp-title">我方阵容</view>
        <view class="mini-cards">
          <view v-for="item in ownGeneralCards" :key="item.name" class="mini-card">
            <image v-if="item.imageUrl" class="mini-img" :src="item.imageUrl" mode="aspectFit" />
            <view v-else class="mini-placeholder">{{ item.name[0] }}</view>
            <view v-if="!item.imageUrl" class="mini-name">{{ item.name }}</view>
            <view v-if="!item.imageUrl" class="mini-level">Lv.50</view>
          </view>
        </view>
      </view>

      <view class="vs-mark">VS</view>

      <view class="camp camp-enemy">
        <view class="camp-title">敌方阵容</view>
        <view class="mini-cards">
          <view v-for="item in enemyGeneralCards" :key="item.name" class="mini-card">
            <image v-if="item.imageUrl" class="mini-img" :src="item.imageUrl" mode="aspectFit" />
            <view v-else class="mini-placeholder">{{ item.name[0] }}</view>
            <view v-if="!item.imageUrl" class="mini-name">{{ item.name }}</view>
            <view v-if="!item.imageUrl" class="mini-level">Lv.50</view>
          </view>
        </view>
      </view>
    </view>

    <view class="score-compare">
      <view class="compare-title">综合评分对比</view>
      <view class="score-row">
        <view class="score-side own">
          <view class="score-label">我方评分</view>
          <view class="score-number">{{ ownScoreText }}</view>
        </view>
        <view class="score-divider">战</view>
        <view class="score-side enemy">
          <view class="score-label">敌方评分</view>
          <view class="score-number">{{ enemyScoreText }}</view>
        </view>
      </view>

      <view v-for="row in matchupRows" :key="row.label" class="metric-row">
        <view class="metric-value own">{{ row.own }}</view>
        <view class="metric-bar own"><view :style="{ width: row.ownPercent + '%' }"></view></view>
        <view class="metric-label">{{ row.label }}</view>
        <view class="metric-bar enemy"><view :style="{ width: row.enemyPercent + '%' }"></view></view>
        <view class="metric-value enemy">{{ row.enemy }}</view>
      </view>
    </view>

    <view class="win-panel">
      <view class="win-header">
        <view>
          <view class="win-title">胜率预测</view>
          <view class="win-subtitle">静态评分仅供参考，可用战报模拟复核克制、战法概率和稳定性。</view>
        </view>
        <view class="win-simulate-btn" @tap="openSimulation">立即模拟</view>
      </view>
      <view class="win-content">
        <view class="win-side own">
          <view>我方胜率</view>
          <text>{{ ownWinRate }}%</text>
        </view>
        <view class="win-ring"><view>胜</view></view>
        <view class="win-side enemy">
          <view>敌方胜率</view>
          <text>{{ enemyWinRate }}%</text>
        </view>
      </view>
      <view class="win-tip">{{ result ? result.summary : '对位预览' }}</view>
    </view>

    <view class="bottom-actions">
      <view class="simulation-entry" @tap="openSimulation">
        <text class="simulation-title">战报模拟</text>
        <text class="simulation-desc">批量胜率 · 稳定性</text>
      </view>
      <view class="adjust-btn" @tap="goToFeedback">调整阵容</view>
      <view class="icon-action" @tap="openBattleForm">记录战报</view>
      <view class="icon-action" @tap="loadBattleStats">战报统计</view>
    </view>

    <view v-if="apiStatus" class="sync-status">{{ apiStatus }}</view>

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

    <view v-if="showSimulation" class="modal-mask" @click="closeSimulation">
      <view class="modal-content modal-large" @click.stop>
        <view class="modal-title">战报模拟</view>
        <view class="simulation-form">
          <view class="simulation-option-row">
            <view class="simulation-option">
              <text class="form-label">模拟场次</text>
              <input
                class="form-input"
                type="number"
                :value="simulationOptions.iterations"
                @input="onSimulationOptionInput('iterations', $event)"
                placeholder="1-100"
              />
            </view>
            <view class="simulation-option">
              <text class="form-label">最大回合</text>
              <input
                class="form-input"
                type="number"
                :value="simulationOptions.maxRounds"
                @input="onSimulationOptionInput('maxRounds', $event)"
                placeholder="1-8"
              />
            </view>
          </view>
          <view class="seed-tabs">
            <text
              class="seed-tab"
              :class="{ active: simulationOptions.seedMode === 'random' }"
              @click="setSimulationSeedMode('random')"
            >随机 seed</text>
            <text
              class="seed-tab"
              :class="{ active: simulationOptions.seedMode === 'fixed' }"
              @click="setSimulationSeedMode('fixed')"
            >固定 seed</text>
          </view>
          <view v-if="simulationOptions.seedMode === 'fixed'" class="form-row">
            <text class="form-label">固定 seed</text>
            <input
              class="form-input"
              :value="simulationOptions.seed"
              @input="onSimulationOptionInput('seed', $event)"
              placeholder="例如：关关张-vs-太尉盾"
            />
          </view>
          <view v-if="simulationRemoteEnabled" class="form-row">
            <text class="form-label">资料版本</text>
            <picker
              class="form-picker"
              :range="catalogVersionOptions"
              range-key="label"
              :value="selectedCatalogVersionIndex"
              @change="onSimulationCatalogVersionChange"
            >
              <view class="picker-value">{{ selectedCatalogVersionLabel }}</view>
            </picker>
            <view class="simulation-note">选择赛季资料版本后，本次模拟会锁定该版本；未选择时使用服务器默认发布资料。</view>
          </view>
          <view v-if="catalogVersionsError" class="simulation-note warning">{{ catalogVersionsError }}</view>
          <view v-if="!simulationRemoteEnabled" class="simulation-note warning">
            当前为本地模式，完整战报模拟需要远程 API。请在设置中切换远程 API，并配置服务器地址后再运行。
          </view>
        </view>

        <view v-if="simulation" class="simulation-summary">
          <view class="stats-grid">
            <view class="stat-item">
              <view class="stat-value">{{ simulationWinText }}</view>
              <view class="stat-label">模拟结果</view>
            </view>
            <view class="stat-item">
              <view class="stat-value">{{ simulationRoundText }}</view>
              <view class="stat-label">回合/场次</view>
            </view>
            <view class="stat-item">
              <view class="stat-value">{{ simulationOwnRemain }}</view>
              <view class="stat-label">我方剩余</view>
            </view>
            <view class="stat-item">
              <view class="stat-value">{{ simulationEnemyRemain }}</view>
              <view class="stat-label">敌方剩余</view>
            </view>
          </view>

          <view v-if="simulationCatalogContext" class="simulation-section">
            <view class="card-title">资料版本</view>
            <view class="detail-row">
              <text class="detail-label">赛季</text>
              <text class="detail-value">{{ simulationCatalogContext.seasonLabel || simulationCatalogContext.seasonKey || '默认资料' }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">版本</text>
              <text class="detail-value">{{ simulationCatalogContext.versionKey || '静态基线' }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">状态</text>
              <text class="detail-value">{{ simulationCatalogContext.status || 'baseline' }}</text>
            </view>
          </view>

          <view v-if="simulation.aggregate" class="simulation-section">
            <view class="card-title">稳定性解释</view>
            <view class="simulation-note">
              胜率 {{ simulation.summary.winRate }}%，稳定性 {{ simulation.aggregate.stability }}，模拟评分建议 {{ simulation.aggregate.scoreSuggestion }}。
            </view>
            <view v-for="(reason, index) in simulation.aggregate.stabilityReasons" :key="index" class="reason-item">{{ reason }}</view>
            <view v-if="simulation.aggregate.distribution" class="sample-card">
              <view>最佳兵力差：{{ formatNumber(simulation.aggregate.distribution.bestMargin) }}</view>
              <view>中位兵力差：{{ formatNumber(simulation.aggregate.distribution.medianMargin) }}</view>
              <view>最差兵力差：{{ formatNumber(simulation.aggregate.distribution.worstMargin) }}</view>
            </view>
          </view>

          <view v-if="simulationHighlightRows.length" class="simulation-section">
            <view class="card-title">关键摘要</view>
            <view v-for="row in simulationHighlightRows" :key="row.label" class="detail-row">
              <text class="detail-label">{{ row.label }}</text>
              <text class="detail-value">{{ row.value }}</text>
            </view>
          </view>

          <view v-if="simulationRuleCoverage" class="simulation-section">
            <view class="card-title">规则覆盖</view>
            <view class="coverage-grid">
              <view class="coverage-item"><text>显式</text><text>{{ simulationRuleCoverage.explicit }}</text></view>
              <view class="coverage-item"><text>估算</text><text>{{ simulationRuleCoverage.estimated }}</text></view>
              <view class="coverage-item"><text>未命中</text><text>{{ simulationRuleCoverage.missed }}</text></view>
              <view class="coverage-item"><text>估算率</text><text>{{ Math.round((simulationRuleCoverage.estimatedRate || 0) * 100) }}%</text></view>
            </view>
            <view class="simulation-note">显式规则：{{ joinNames(simulationRuleCoverage.explicitTactics) }}</view>
            <view class="simulation-note">估算规则：{{ joinNames(simulationRuleCoverage.fallbackTactics) }}</view>
            <view v-if="simulationRuleCoverage.missedTactics && simulationRuleCoverage.missedTactics.length" class="simulation-note">
              未命中规则：{{ joinNames(simulationRuleCoverage.missedTactics) }}
            </view>
            <view v-if="simulationCoverageRows.length" class="coverage-list">
              <view v-for="item in simulationCoverageRows" :key="item.tacticId + item.tacticName + item.status" class="coverage-row">
                <text>{{ item.tacticName }}</text>
                <text :class="['coverage-badge', item.status]">{{ coverageStatusText(item.status) }}</text>
              </view>
            </view>
            <view v-if="simulationRuleCoverage.missed > 0 || simulationRuleCoverage.estimated > 0" class="simulation-note warning">
              当前存在通用估算或未覆盖战法，模拟结果只用于搭配方向判断。
            </view>
          </view>

          <view v-if="simulation.bestSample || simulation.worstSample" class="simulation-section">
            <view class="card-title">关键样本</view>
            <view v-if="simulation.bestSample" class="sample-card">最佳样本：{{ formatSampleSummary(simulation.bestSample.summary) }}</view>
            <view v-if="simulation.worstSample" class="sample-card">最差样本：{{ formatSampleSummary(simulation.worstSample.summary) }}</view>
          </view>

          <view v-if="simulationRounds.length" class="battle-log">
            <view class="log-toggle" @click="toggleSimulationLog">
              <text class="card-title">{{ simulation.rounds ? '回合日志' : '样本回合日志' }}</text>
              <text class="muted">{{ simulationLogExpanded ? '收起' : '展开' }}</text>
            </view>
            <view v-if="simulationLogExpanded">
              <view v-for="round in simulationRounds" :key="round.round + round.phase" class="log-block">
                <view class="log-title">{{ round.round === 0 ? '准备阶段' : '第' + round.round + '回合' }} · {{ round.phase }}</view>
                <view v-for="(action, index) in round.actions" :key="index" class="log-line">{{ action.text }}</view>
              </view>
            </view>
          </view>

          <view v-if="simulationAssumptions.length" class="simulation-section">
            <view class="card-title">模拟假设</view>
            <view v-for="(item, index) in simulationAssumptions" :key="index" class="assumption-line">{{ item }}</view>
          </view>
        </view>
        <view v-else class="empty-line">{{ simulationLoading ? '正在模拟战报...' : (simulationError || '暂无模拟结果') }}</view>
        <view class="modal-actions">
          <button class="mini-btn" @click="closeSimulation">关闭</button>
          <button class="mini-btn primary" @click="runSimulation">{{ simulation ? '重新模拟' : '开始模拟' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import catalog from "../../utils/catalog";
import { getEntitlements } from "../../utils/subscription";
import { removeStorage } from "../../utils/storage";
import {
  previewMatchupAsync,
  simulateBattleAsync,
  addBattleReportAsync,
  getBattleReportStatsAsync,
  deleteBattleReportAsync,
  getCatalogVersions,
  getLineupsAsync,
  isRemoteMode,
  saveLineupAsync
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
      battleRecords: [],
      currentPayload: null,
      simulation: null,
      showSimulation: false,
      simulationLoading: false,
      simulationError: "",
      simulationLogExpanded: false,
      simulationRemoteMode: isRemoteMode(),
      catalogVersions: [],
      catalogVersionsError: "",
      selectedCatalogVersionIndex: 0,
      simulationOptions: {
        iterations: 20,
        maxRounds: 8,
        seedMode: "random",
        seed: "",
        catalogVersionId: ""
      }
    };
  },

  computed: {
    ownScoreRaw() {
      return Number(this.ownSummary && this.ownSummary.score) || 91;
    },

    enemyScoreRaw() {
      return Number(this.enemySummary && this.enemySummary.score) || 79;
    },

    ownScoreText() {
      return this.formatLargeScore(this.ownScoreRaw);
    },

    enemyScoreText() {
      return this.formatLargeScore(this.enemyScoreRaw);
    },

    ownWinRate() {
      const delta = this.ownScoreRaw - this.enemyScoreRaw;
      return Math.max(35, Math.min(75, Math.round(50 + delta * 1.1)));
    },

    enemyWinRate() {
      return 100 - this.ownWinRate;
    },

    simulationWinText() {
      if (!this.simulation || !this.simulation.summary) return "--";
      if (this.simulation.aggregate) return `${this.simulation.summary.winRate}%`;
      const result = this.simulation.summary.result;
      return result === "win" ? "胜" : result === "loss" ? "负" : "平";
    },

    simulationOwnRemain() {
      if (!this.simulation) return "--";
      const value = this.simulation.aggregate ? this.simulation.aggregate.averageOwnRemaining : this.simulation.summary.ownRemaining;
      return Number(value || 0).toLocaleString();
    },

    simulationEnemyRemain() {
      if (!this.simulation) return "--";
      const value = this.simulation.aggregate ? this.simulation.aggregate.averageEnemyRemaining : this.simulation.summary.enemyRemaining;
      return Number(value || 0).toLocaleString();
    },

    simulationRoundText() {
      if (!this.simulation || !this.simulation.summary) return "--";
      return this.simulation.summary.iterations || this.simulation.summary.rounds || "--";
    },

    simulationRemoteEnabled() {
      return this.simulationRemoteMode;
    },

    catalogVersionOptions() {
      const versions = (this.catalogVersions || []).map((item) => ({
        ...item,
        label: `${item.seasonLabel || item.seasonKey || "赛季"} · ${item.versionKey || item.id}`
      }));
      return [{ id: "", label: "服务器默认发布资料" }, ...versions];
    },

    selectedCatalogVersionLabel() {
      const selected = this.catalogVersionOptions[this.selectedCatalogVersionIndex] || this.catalogVersionOptions[0];
      return selected ? selected.label : "服务器默认发布资料";
    },

    selectedCatalogVersion() {
      const selected = this.catalogVersionOptions[this.selectedCatalogVersionIndex] || null;
      return selected && selected.id ? selected : null;
    },

    selectedEnemyTemplate() {
      return this.enemyTemplates[this.enemyIndex] || this.enemyTemplates[0];
    },

    simulationCatalogContext() {
      return this.simulation && this.simulation.catalogContext ? this.simulation.catalogContext : null;
    },

    simulationRuleCoverage() {
      return this.simulation && this.simulation.ruleCoverage ? this.simulation.ruleCoverage : null;
    },

    simulationCoverageRows() {
      const coverage = this.simulationRuleCoverage;
      return coverage && Array.isArray(coverage.coverageByTactic) ? coverage.coverageByTactic : [];
    },

    simulationAssumptions() {
      if (!this.simulation) return [];
      const assumptions = [...(this.simulation.assumptions || [])];
      [this.simulation.bestSample, this.simulation.worstSample].forEach((sample) => {
        (sample && sample.assumptions ? sample.assumptions : []).forEach((item) => assumptions.push(item));
      });
      return [...new Set(assumptions)];
    },

    simulationRounds() {
      if (!this.simulation) return [];
      if (Array.isArray(this.simulation.rounds)) return this.simulation.rounds;
      const sample = Array.isArray(this.simulation.samples) && this.simulation.samples.length
        ? this.simulation.samples[0]
        : null;
      return sample && Array.isArray(sample.rounds) ? sample.rounds : [];
    },

    simulationHighlightRows() {
      if (!this.simulation) return [];
      const highlights = this.simulation.highlights || (this.simulation.bestSample && this.simulation.bestSample.highlights) || {};
      const rows = [];
      if (highlights.ownTopDamage) rows.push({ label: "我方最高伤害", value: `${highlights.ownTopDamage.name} · ${this.formatNumber(highlights.ownTopDamage.amount)}` });
      if (highlights.enemyTopDamage) rows.push({ label: "敌方最高伤害", value: `${highlights.enemyTopDamage.name} · ${this.formatNumber(highlights.enemyTopDamage.amount)}` });
      if (highlights.topHealing) rows.push({ label: "最高治疗", value: `${highlights.topHealing.name} · ${this.formatNumber(highlights.topHealing.amount)}` });
      if (highlights.topControl) rows.push({ label: "关键控制", value: `${highlights.topControl.name} · ${highlights.topControl.turns} 回合` });
      if (highlights.largestDamage) rows.push({ label: "单次最高伤害", value: `${highlights.largestDamage.actor} → ${highlights.largestDamage.target} · ${this.formatNumber(highlights.largestDamage.amount)}` });
      if (highlights.largestHealing) rows.push({ label: "单次最高治疗", value: `${highlights.largestHealing.actor} → ${highlights.largestHealing.target} · ${this.formatNumber(highlights.largestHealing.amount)}` });
      if (highlights.ownKeyTactics && highlights.ownKeyTactics.length) rows.push({ label: "我方关键战法", value: highlights.ownKeyTactics.map((item) => `${item.name}×${item.count}`).join("、") });
      if (highlights.enemyKeyTactics && highlights.enemyKeyTactics.length) rows.push({ label: "敌方关键战法", value: highlights.enemyKeyTactics.map((item) => `${item.name}×${item.count}`).join("、") });
      if (highlights.keyEvents && highlights.keyEvents.length) rows.push({ label: "关键事件", value: highlights.keyEvents.map((item) => item.text || item.type).slice(0, 3).join("；") });
      return rows;
    },

    ownGeneralCards() {
      const text = this.ownSummary && this.ownSummary.generalsText ? this.ownSummary.generalsText : "曹操 / 诸葛亮 / 张辽";
      return this.makeGeneralCards(text.split(" / "));
    },

    enemyGeneralCards() {
      const text = this.enemySummary && this.enemySummary.generalsText ? this.enemySummary.generalsText : "孙权 / 孙策 / 周瑜";
      return this.makeGeneralCards(text.split(" / "));
    },

    matchupRows() {
      const labels = ["武将强度", "阵容搭配", "技能联动", "兵种克制", "战法配置"];
      const ownDims = (this.ownSummary && this.ownSummary.dimensions) || [];
      const enemyDims = (this.enemySummary && this.enemySummary.dimensions) || [];
      return labels.map((label, index) => {
        const own = ownDims[index] ? ownDims[index].score : Math.max(70, this.ownScoreRaw - index * 2);
        const enemy = enemyDims[index] ? enemyDims[index].score : Math.max(62, this.enemyScoreRaw - index * 3);
        return {
          label,
          own: this.formatSmallScore(own),
          enemy: this.formatSmallScore(enemy),
          ownPercent: Math.max(8, Math.min(100, own)),
          enemyPercent: Math.max(8, Math.min(100, enemy))
        };
      });
    }
  },

  async onShow() {
    const pending = uni.getStorageSync("pendingMatchupLineup") || null;
    const pendingAction = uni.getStorageSync("pendingMatchupAction") || "";
    if (pending && pending.id) {
      await saveLineupAsync({ lineup: pending }).catch(() => null);
      removeStorage("pendingMatchupLineup");
      removeStorage("pendingMatchupAction");
    }
    const saved = await getLineupsAsync().catch(() => []);
    const savedView = saved.map((item) => ({
      ...item,
      generalsText: (item.generals || []).join(" / ")
    }));
    this.entitlements = getEntitlements();
    this.simulationRemoteMode = isRemoteMode();
    if (this.simulationRemoteMode) this.loadCatalogVersions();
    this.savedLineups = savedView;
    this.refresh(pendingAction === "simulate");
  },

  methods: {
    formatLargeScore(score) {
      const value = Math.round((Number(score) || 0) * 9800 + 2560);
      return value.toLocaleString();
    },

    formatSmallScore(score) {
      const value = Math.round((Number(score) || 0) * 1000 + 560);
      return value.toLocaleString();
    },

    makeGeneralCards(names) {
      const generals = catalog.getGenerals();
      return (names || []).slice(0, 3).map((name) => {
        const cleanName = String(name || "").trim();
        const found = generals.find((item) => item.name === cleanName) || {};
        return {
          name: cleanName || found.name || "武将",
          faction: found.faction || "",
          imageUrl: found.asset && found.asset.imageUrl ? found.asset.imageUrl : ""
        };
      });
    },

    loadCatalogVersions() {
      this.catalogVersionsError = "";
      getCatalogVersions({ status: "published" })
        .then((res) => {
          this.catalogVersions = res.items || [];
          const selectedId = this.simulationOptions.catalogVersionId;
          const index = this.catalogVersionOptions.findIndex((item) => item.id === selectedId);
          this.selectedCatalogVersionIndex = index >= 0 ? index : 0;
        })
        .catch((error) => {
          this.catalogVersions = [];
          this.selectedCatalogVersionIndex = 0;
          this.simulationOptions = { ...this.simulationOptions, catalogVersionId: "" };
          this.catalogVersionsError = error.message || "资料版本加载失败";
        });
    },

    onSimulationCatalogVersionChange(event) {
      const index = Number(event.detail.value) || 0;
      const selected = this.catalogVersionOptions[index] || this.catalogVersionOptions[0];
      this.selectedCatalogVersionIndex = index;
      this.simulationOptions = { ...this.simulationOptions, catalogVersionId: selected && selected.id ? selected.id : "" };
      this.simulation = null;
      this.simulationError = "";
    },

    onEnemyChange(event) {
      const index = Number(event.detail.value) || 0;
      this.enemyIndex = Math.max(0, Math.min(index, this.enemyTemplates.length - 1));
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

    refresh(openSimulationAfterLoad = false) {
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
        const template = this.selectedEnemyTemplate;
        enemyInput = this.templateToInput(template);
        enemyName = template.name;
      }

      const payload = { own: ownInput, enemy: enemyInput };
      this.currentPayload = payload;
      this.savedCount = saved.length;
      this.isLoading = true;
      this.apiStatus = "";

      previewMatchupAsync(payload)
        .then((preview) => {
          this.isLoading = false;
          this.ownSummary = this.toSummary(saved[0], ownInput, preview.own);
          this.enemySummary = this.toSummary({ name: enemyName }, enemyInput, preview.enemy);
          this.result = preview.result;
          if (openSimulationAfterLoad) this.openSimulation();
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
        scenario: saved.scenarioId || (saved.scenario === "开荒" ? "pioneer" : saved.scenario === "打架" ? "war" : "pk"),
        generalIds: (saved.generalIds && saved.generalIds.length ? saved.generalIds : this.namesToGeneralIds(generals)).slice(0, 3),
        tacticIds: (saved.tacticIds && saved.tacticIds.length ? saved.tacticIds : this.namesToTacticIds(tactics)).slice(0, 6),
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

    toSummary(source, input, report = {}) {
      const generals = (input.generalIds || []).map((id) => catalog.findGeneralById(id)).filter(Boolean);
      const dimensions = Array.isArray(report.dimensions) ? report.dimensions : [];
      const weaknesses = Array.isArray(report.weaknesses) ? report.weaknesses : [];
      return {
        name: source && source.name ? source.name : "我的最近保存阵容",
        troop: input.troop,
        score: Number(report.totalScore) || 0,
        dimensions,
        confidence: report.confidence || "未知",
        generalsText: generals.map((item) => item.name).join(" / "),
        topWeakness: weaknesses[0] || "暂无明显短板"
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

    formatNumber(value) {
      return Number(value || 0).toLocaleString();
    },

    joinNames(names) {
      return names && names.length ? names.join("、") : "暂无";
    },

    formatSampleSummary(summary = {}) {
      const result = summary.result === "win" ? "胜" : summary.result === "loss" ? "负" : "平";
      return `${result}，我方 ${this.formatNumber(summary.ownRemaining)} / 敌方 ${this.formatNumber(summary.enemyRemaining)}，${summary.rounds || 0} 回合`;
    },

    openSimulation() {
      if (!this.currentPayload) return;
      this.showSimulation = true;
      this.simulationError = "";
      if (!this.simulation && this.simulationRemoteEnabled) this.runSimulation();
    },

    setSimulationSeedMode(seedMode) {
      this.simulationOptions = { ...this.simulationOptions, seedMode };
    },

    onSimulationOptionInput(field, event) {
      const rawValue = event && event.detail ? event.detail.value : "";
      if (field === "seed") {
        this.simulationOptions = { ...this.simulationOptions, seed: rawValue };
        return;
      }
      const number = Math.round(Number(rawValue) || 0);
      const limits = field === "iterations" ? { min: 1, max: 100, fallback: 20 } : { min: 1, max: 8, fallback: 8 };
      const value = Math.max(limits.min, Math.min(limits.max, number || limits.fallback));
      this.simulationOptions = { ...this.simulationOptions, [field]: value };
    },

    buildSimulationPayload() {
      const iterations = Math.max(1, Math.min(100, Math.round(Number(this.simulationOptions.iterations) || 20)));
      const maxRounds = Math.max(1, Math.min(8, Math.round(Number(this.simulationOptions.maxRounds) || 8)));
      const seed = this.simulationOptions.seedMode === "fixed" && this.simulationOptions.seed
        ? this.simulationOptions.seed
        : Date.now();
      const selectedVersion = this.selectedCatalogVersion;
      return {
        ...this.currentPayload,
        seed,
        iterations,
        catalogVersionId: selectedVersion ? selectedVersion.id : "",
        season: selectedVersion ? selectedVersion.seasonKey : "",
        options: { maxRounds }
      };
    },

    coverageStatusText(status) {
      return ({ explicit: "显式规则", fallback: "通用估算", missed: "未覆盖" })[status] || status || "未知";
    },

    toggleSimulationLog() {
      this.simulationLogExpanded = !this.simulationLogExpanded;
    },

    runSimulation() {
      if (!this.currentPayload) return;
      this.showSimulation = true;
      this.simulationLoading = true;
      this.simulationError = "";
      this.simulationLogExpanded = false;
      simulateBattleAsync(this.buildSimulationPayload())
        .then((result) => {
          this.simulation = result;
          this.simulationLoading = false;
        })
        .catch((error) => {
          this.simulationLoading = false;
          this.simulationError = error.message || "模拟失败";
          uni.showToast({ title: this.simulationError, icon: "none" });
        });
    },

    closeSimulation() {
      this.showSimulation = false;
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
  background: linear-gradient(135deg, #0a0e1a 0%, #1a1a2e 50%, #0a1628 100%);
  position: relative;
}

.matchup-page::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 40%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(239, 68, 68, 0.12) 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
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
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--r-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  transition: all var(--ease);
  position: relative;
  overflow: hidden;
}

.band::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1rpx;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
}

.row-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.pill {
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  font-size: 22rpx;
  white-space: nowrap;
  border: 1rpx solid rgba(99, 102, 241, 0.3);
}

.label {
  margin-bottom: 10rpx;
  color: var(--text-stone);
  font-size: 22rpx;
}

.field {
  padding: var(--sp-md) 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  border-radius: var(--r-md);
  color: var(--text-ink);
  background: rgba(255, 255, 255, 0.08);
  font-size: 26rpx;
  backdrop-filter: blur(5px);
  transition: all var(--ease);
}

.field:active {
  border-color: rgba(99, 102, 241, 0.5);
}

.empty {
  padding: 20rpx;
  color: var(--text-stone);
  font-size: 24rpx;
  text-align: center;
}

.gate {
  margin-top: var(--sp-md);
  color: var(--gold-bright);
  font-size: 24rpx;
  line-height: 1.5;
}

.sync-status {
  margin-top: 14rpx;
  color: var(--gold-bright);
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
  position: relative;
}

.side:first-child {
  border-color: rgba(59, 130, 246, 0.3);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(255, 255, 255, 0.06) 100%);
}

.side:last-child {
  border-color: rgba(239, 68, 68, 0.3);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(255, 255, 255, 0.06) 100%);
}

.side-title {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
}

.side:first-child .side-title {
  color: #60a5fa;
}

.side:last-child .side-title {
  color: #f87171;
}

.score {
  margin-top: var(--sp-sm);
  font-size: 64rpx;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
}

.side:first-child .score {
  color: #60a5fa;
  text-shadow: 0 0 30px rgba(96, 165, 250, 0.5);
}

.side:last-child .score {
  color: #f87171;
  text-shadow: 0 0 30px rgba(248, 113, 113, 0.5);
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
  color: var(--gold-bright);
  font-weight: 500;
}

.verdict-title {
  font-size: 44rpx;
  font-weight: 800;
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  border-radius: var(--r-md);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  color: var(--text-stone);
  font-size: 24rpx;
  backdrop-filter: blur(5px);
  transition: all var(--ease);
}

.source-tab.active {
  border-color: rgba(99, 102, 241, 0.5);
  color: #a5b4fc;
  background: rgba(99, 102, 241, 0.15);
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
  color: #a5b4fc;
  border: 1rpx solid rgba(99, 102, 241, 0.3);
  border-radius: var(--r-md);
  background: rgba(99, 102, 241, 0.1);
  line-height: 1.6;
  backdrop-filter: blur(5px);
  transition: all var(--ease);
}

.mini-btn:active {
  background: rgba(99, 102, 241, 0.2);
  transform: scale(0.98);
}

.mini-btn.primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(4, 6, 10, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.modal-content {
  width: 640rpx;
  max-height: 80vh;
  overflow-y: auto;
  background: rgba(30, 30, 50, 0.95);
  border-radius: var(--r-lg);
  padding: var(--sp-xl);
  border: 1rpx solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
}

.modal-large {
  width: 700rpx;
}

.modal-title {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: var(--sp-lg);
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
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
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  color: var(--text-stone);
  font-size: 26rpx;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);
  transition: all var(--ease);
}

.result-tab.win {
  border-color: rgba(34, 197, 94, 0.5);
  color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
}

.result-tab.loss {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.result-tab.draw {
  border-color: rgba(245, 158, 11, 0.5);
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
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
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  border-radius: var(--r-md);
  color: var(--text-ink);
  background: rgba(255, 255, 255, 0.08);
  font-size: 26rpx;
  box-sizing: border-box;
  backdrop-filter: blur(5px);
  transition: all var(--ease);
}

.form-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
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
  padding: 16rpx 0;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--r-md);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.stat-value {
  color: var(--gold-bright);
  font-size: 32rpx;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(201, 152, 58, 0.3);
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
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.troop-row {
  display: flex;
  justify-content: space-between;
  padding: var(--sp-xs) 0;
}

.simulation-note {
  margin-top: 16rpx;
  color: var(--text-stone);
  font-size: 24rpx;
  line-height: 1.6;
}

.battle-log {
  margin-top: 18rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.log-block {
  margin-top: 12rpx;
  padding: 14rpx;
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.log-title {
  color: #a5b4fc;
  font-size: 24rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.log-line {
  color: var(--text-stone);
  font-size: 22rpx;
  line-height: 1.6;
}

.simulation-form {
  margin-bottom: var(--sp-lg);
  padding: 18rpx;
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.simulation-option-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.seed-tabs {
  display: flex;
  gap: 14rpx;
  margin: 18rpx 0;
}

.seed-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: var(--r-md);
  color: var(--text-stone);
  font-size: 24rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.seed-tab.active {
  color: var(--gold-bright);
  border-color: rgba(201, 152, 58, 0.45);
  background: rgba(201, 152, 58, 0.14);
}

.simulation-summary,
.simulation-section {
  margin-top: 18rpx;
}

.simulation-note.warning {
  color: #fbbf24;
}

.reason-item,
.assumption-line {
  margin-top: 10rpx;
  padding: 12rpx 14rpx;
  border-radius: var(--r-sm);
  color: var(--text-stone);
  font-size: 22rpx;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.05);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}

.detail-label {
  flex: 0 0 180rpx;
  color: var(--text-stone);
  font-size: 22rpx;
}

.detail-value {
  flex: 1;
  color: var(--text-ink);
  font-size: 22rpx;
  line-height: 1.5;
  text-align: right;
}

.coverage-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 12rpx;
  margin-top: 12rpx;
}

.coverage-item {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  align-items: center;
  padding: 14rpx 0;
  border-radius: var(--r-md);
  color: var(--text-ink);
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.coverage-item text:last-child {
  color: var(--gold-bright);
  font-weight: 700;
}

.coverage-list {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.coverage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 12rpx;
  border-radius: var(--r-sm);
  color: var(--text-ink);
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.05);
}

.coverage-badge {
  flex: 0 0 auto;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: var(--text-ink);
  background: rgba(255, 255, 255, 0.08);
}

.coverage-badge.explicit {
  color: #86efac;
  background: rgba(34, 197, 94, 0.14);
}

.coverage-badge.fallback {
  color: #fde68a;
  background: rgba(245, 158, 11, 0.16);
}

.coverage-badge.missed {
  color: #fecaca;
  background: rgba(239, 68, 68, 0.16);
}

.form-picker,
.picker-value {
  width: 100%;
}

.picker-value {
  min-height: 72rpx;
  padding: 0 22rpx;
  border-radius: var(--r-md);
  color: var(--text-ink);
  font-size: 26rpx;
  line-height: 72rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.sample-card {
  margin-top: 12rpx;
  padding: 14rpx;
  border-radius: var(--r-md);
  color: var(--text-ink);
  font-size: 22rpx;
  line-height: 1.7;
  background: rgba(99, 102, 241, 0.1);
  border: 1rpx solid rgba(99, 102, 241, 0.18);
}

.log-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}

.record-result {
  font-size: 24rpx;
  font-weight: 700;
  width: 40rpx;
  text-align: center;
}

.record-result.win {
  color: #22c55e;
}

.record-result.loss {
  color: #ef4444;
}

.record-result.draw {
  color: #f59e0b;
}

.delete-btn {
  margin-left: auto;
  color: #ef4444;
  font-size: 22rpx;
}

@media screen and (min-width: 768px) {
  .score {
    font-size: 80rpx;
  }

  .verdict-title {
    font-size: 56rpx;
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

.matchup-page {
  min-height: 100vh;
  padding: 72rpx 28rpx 146rpx;
  background:
    linear-gradient(90deg, rgba(8, 29, 53, 0.92), rgba(14, 9, 10, 0.98) 50%, rgba(50, 15, 13, 0.92)),
    linear-gradient(180deg, #05080d 0%, #090b0f 100%);
  position: relative;
  overflow: hidden;
}

.matchup-page::before {
  display: none;
}

.match-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at 18% 36%, rgba(34, 128, 255, 0.2), transparent 32%),
    radial-gradient(circle at 84% 35%, rgba(229, 66, 55, 0.18), transparent 32%),
    linear-gradient(90deg, rgba(49, 121, 220, 0.08), transparent 48%, rgba(204, 60, 54, 0.08));
  pointer-events: none;
  z-index: 0;
}

.match-header,
.source-panel,
.battle-stage,
.score-compare,
.win-panel,
.bottom-actions,
.sync-status {
  position: relative;
  z-index: 1;
}

.match-header {
  min-height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
}

.back-btn {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 64rpx;
  color: #d8bb7c;
  font-size: 56rpx;
  line-height: 1;
}

.header-copy {
  width: 300rpx;
  text-align: center;
}

.page-title {
  color: #f0d7a0;
  font-size: 44rpx;
  font-weight: 900;
  text-shadow: 0 0 18rpx rgba(215, 176, 97, 0.18);
}

.page-subtitle {
  color: rgba(215, 205, 185, 0.58);
  font-size: 22rpx;
  margin-top: 8rpx;
}

.help-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 46rpx;
  height: 46rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(216, 187, 124, 0.62);
  color: #d8bb7c;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
}

.source-panel {
  display: grid;
  grid-template-columns: 230rpx 1fr;
  gap: 14rpx;
  margin-bottom: 24rpx;
}

.source-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8rpx;
  margin: 0;
}

.source-tab {
  height: 64rpx;
  padding: 0;
  border-radius: 6rpx;
  border: 1rpx solid rgba(216, 187, 124, 0.2);
  color: #928a7c;
  background: rgba(10, 12, 16, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}

.source-tab.active {
  color: #f0d7a0;
  background: rgba(153, 105, 36, 0.28);
  border-color: rgba(216, 187, 124, 0.48);
}

.field,
.empty-line {
  height: 64rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(216, 187, 124, 0.24);
  color: #f0d7a0;
  background: rgba(8, 10, 14, 0.7);
  display: flex;
  align-items: center;
  padding: 0 18rpx;
  font-size: 24rpx;
}

.battle-stage {
  display: grid;
  grid-template-columns: 1fr 60rpx 1fr;
  gap: 8rpx;
  align-items: center;
  min-height: 360rpx;
  margin-bottom: 24rpx;
}

.camp-title {
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f2d8a0;
  font-size: 30rpx;
  font-weight: 900;
  margin-bottom: 18rpx;
  background: rgba(28, 69, 129, 0.58);
  border: 1rpx solid rgba(81, 156, 255, 0.22);
}

.camp-enemy .camp-title {
  background: rgba(115, 39, 32, 0.62);
  border-color: rgba(232, 92, 78, 0.22);
}

.mini-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6rpx;
}

.mini-card {
  position: relative;
  min-height: 178rpx;
  overflow: hidden;
  border: 1rpx solid rgba(91, 157, 246, 0.44);
  background: #07111f;
}

.camp-enemy .mini-card {
  border-color: rgba(218, 78, 66, 0.44);
}

.mini-img,
.mini-placeholder {
  width: 100%;
  height: 178rpx;
}

.mini-img {
  object-fit: contain;
  background: radial-gradient(circle at 50% 38%, rgba(48, 120, 205, 0.2), rgba(4, 9, 16, 0.96));
}

.mini-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f2d8a0;
  font-size: 46rpx;
  font-weight: 900;
  background: linear-gradient(160deg, #26364b, #090d13);
}

.mini-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 42rpx;
  color: #f0d77f;
  font-size: 23rpx;
  font-weight: 900;
  text-align: center;
  text-shadow: 0 3rpx 8rpx rgba(0, 0, 0, 0.7);
}

.mini-level {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14rpx;
  color: #f7efe2;
  font-size: 20rpx;
  text-align: center;
}

.vs-mark {
  color: #f1bf55;
  font-size: 62rpx;
  font-weight: 900;
  text-align: center;
  transform: rotate(-8deg);
  text-shadow: 0 0 22rpx rgba(241, 191, 85, 0.42);
}

.score-compare {
  padding: 28rpx 18rpx;
  margin-bottom: 28rpx;
  border-top: 1rpx solid rgba(216, 187, 124, 0.2);
  border-bottom: 1rpx solid rgba(216, 187, 124, 0.2);
  background: rgba(5, 7, 10, 0.58);
}

.compare-title {
  text-align: center;
  color: #d8bb7c;
  font-size: 28rpx;
  font-weight: 900;
  margin-bottom: 14rpx;
}

.score-row {
  display: grid;
  grid-template-columns: 1fr 84rpx 1fr;
  align-items: center;
  margin-bottom: 24rpx;
}

.score-side {
  text-align: center;
}

.score-label {
  font-size: 24rpx;
}

.score-side.own .score-label,
.score-side.own .score-number,
.metric-value.own {
  color: #3f8cff;
}

.score-side.enemy .score-label,
.score-side.enemy .score-number,
.metric-value.enemy {
  color: #e35c55;
}

.score-number {
  font-size: 42rpx;
  font-weight: 900;
}

.score-divider {
  width: 58rpx;
  height: 58rpx;
  margin: 0 auto;
  border-radius: 50%;
  border: 1rpx solid rgba(216, 187, 124, 0.38);
  color: #d8bb7c;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 22, 12, 0.72);
  font-weight: 900;
}

.metric-row {
  display: grid;
  grid-template-columns: 104rpx 1fr 116rpx 1fr 104rpx;
  align-items: center;
  gap: 12rpx;
  min-height: 52rpx;
}

.metric-value {
  font-size: 24rpx;
}

.metric-label {
  color: #d8c9a8;
  font-size: 24rpx;
  text-align: center;
}

.metric-bar {
  height: 16rpx;
  border-radius: 999rpx;
  overflow: hidden;
  background: rgba(61, 68, 78, 0.54);
}

.metric-bar view {
  height: 100%;
  border-radius: 999rpx;
}

.metric-bar.own view {
  margin-left: auto;
  background: linear-gradient(90deg, #1c4a95, #3d95ff);
}

.metric-bar.enemy view {
  background: linear-gradient(90deg, #d64f55, #7d242b);
}

.win-panel {
  position: relative;
  z-index: 1;
  padding: 26rpx 24rpx;
  margin-bottom: 26rpx;
  border: 1rpx solid rgba(216, 187, 124, 0.24);
  background: rgba(4, 5, 7, 0.72);
}

.win-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 20rpx;
}

.win-title {
  color: #e0c481;
  font-size: 28rpx;
  font-weight: 900;
}

.win-subtitle {
  margin-top: 8rpx;
  color: rgba(197, 183, 148, 0.82);
  font-size: 22rpx;
  line-height: 1.45;
}

.win-simulate-btn {
  flex-shrink: 0;
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  color: #171008;
  font-size: 24rpx;
  font-weight: 900;
  background: linear-gradient(135deg, #f4d99e, #c99136 58%, #83541d);
  box-shadow: 0 10rpx 26rpx rgba(201, 145, 54, 0.28);
}

.win-content {
  display: grid;
  grid-template-columns: 1fr 156rpx 1fr;
  align-items: center;
}

.win-side {
  text-align: center;
  font-size: 26rpx;
}

.win-side.own {
  color: #3f8cff;
}

.win-side.enemy {
  color: #e35c55;
}

.win-side text {
  font-size: 56rpx;
  font-weight: 900;
}

.win-ring {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(#3f8cff 0deg, #3f8cff 226deg, #e35c55 226deg, #e35c55 360deg);
}

.win-ring view {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  background: #12100c;
  color: #f0d7a0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: 900;
}

.win-tip {
  text-align: center;
  color: #c5b794;
  font-size: 24rpx;
  margin-top: 18rpx;
}

.bottom-actions {
  display: grid;
  grid-template-columns: 1.55fr 1.05fr 0.82fr 0.82fr;
  align-items: stretch;
  gap: 14rpx;
}

.icon-action,
.adjust-btn,
.simulation-entry {
  min-height: 82rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d8bb7c;
  font-size: 23rpx;
}

.icon-action {
  border: 1rpx solid rgba(216, 187, 124, 0.2);
  background: rgba(8, 10, 13, 0.36);
}

.simulation-entry {
  flex-direction: column;
  gap: 4rpx;
  border: 1rpx solid rgba(244, 217, 158, 0.72);
  color: #201408;
  background: linear-gradient(135deg, #f7dfaa, #d1973d 52%, #8e5a20);
  box-shadow: 0 14rpx 32rpx rgba(201, 145, 54, 0.32);
}

.simulation-title {
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1;
}

.simulation-desc {
  font-size: 18rpx;
  font-weight: 700;
  opacity: 0.78;
  line-height: 1;
}

.adjust-btn {
  color: #f4d99e;
  font-size: 32rpx;
  font-weight: 900;
  border: 1rpx solid rgba(216, 187, 124, 0.48);
  background: linear-gradient(180deg, rgba(171, 121, 47, 0.76), rgba(82, 51, 19, 0.86));
}

.sync-status {
  color: #e0c481;
  text-align: center;
  margin-top: 18rpx;
}

.modal-content {
  background: #10151d;
  border: 1rpx solid rgba(216, 187, 124, 0.26);
}

.modal-title,
.card-title {
  color: #e0c481;
}

.matchup-page {
  background:
    radial-gradient(circle at 22% 24%, rgba(50, 137, 255, 0.24), transparent 30%),
    radial-gradient(circle at 80% 24%, rgba(227, 74, 63, 0.22), transparent 30%),
    linear-gradient(90deg, rgba(8, 29, 53, 0.92), rgba(14, 9, 10, 0.98) 50%, rgba(50, 15, 13, 0.92)),
    linear-gradient(180deg, #05080d 0%, #090b0f 100%);
}

.page-title {
  color: transparent;
  background: linear-gradient(180deg, #fff0bd 0%, #d6a852 55%, #fff0bd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 20rpx rgba(242, 216, 160, 0.24), 0 8rpx 18rpx rgba(0, 0, 0, 0.52);
}

.source-tab,
.field,
.camp-title,
.score-compare,
.win-panel,
.adjust-btn {
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12),
    inset 0 -16rpx 24rpx rgba(0, 0, 0, 0.26),
    0 10rpx 22rpx rgba(0, 0, 0, 0.22);
}

.source-tab.active,
.adjust-btn {
  background:
    linear-gradient(180deg, rgba(255, 237, 176, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(166, 112, 39, 0.66), rgba(65, 42, 18, 0.92));
  border-color: rgba(244, 213, 139, 0.56);
}

.camp-title {
  position: relative;
  overflow: hidden;
}

.camp-title::before {
  content: "";
  position: absolute;
  left: 12rpx;
  right: 12rpx;
  top: 0;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 245, 190, 0.62), transparent);
}

.mini-card {
  border: 0;
  background:
    linear-gradient(#07111f, #07111f) padding-box,
    linear-gradient(145deg, #ffe59b 0%, #2f91ff 42%, #0b1320 58%, #d5534d 100%) border-box;
  border: 2rpx solid transparent;
  box-shadow:
    0 14rpx 30rpx rgba(0, 0, 0, 0.48),
    0 0 18rpx rgba(49, 130, 255, 0.18),
    inset 0 0 0 1rpx rgba(255, 255, 255, 0.08);
}

.camp-enemy .mini-card {
  background:
    linear-gradient(#140c0d, #140c0d) padding-box,
    linear-gradient(145deg, #ffe59b 0%, #d5534d 42%, #170d10 62%, #d5534d 100%) border-box;
  border: 2rpx solid transparent;
  box-shadow:
    0 14rpx 30rpx rgba(0, 0, 0, 0.48),
    0 0 18rpx rgba(230, 80, 74, 0.18),
    inset 0 0 0 1rpx rgba(255, 255, 255, 0.08);
}

.mini-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background:
    linear-gradient(90deg, #f4d58b 0 14rpx, transparent 14rpx) left top / 44rpx 2rpx no-repeat,
    linear-gradient(#f4d58b 0 14rpx, transparent 14rpx) left top / 2rpx 44rpx no-repeat,
    linear-gradient(270deg, #f4d58b 0 14rpx, transparent 14rpx) right top / 44rpx 2rpx no-repeat,
    linear-gradient(#f4d58b 0 14rpx, transparent 14rpx) right top / 2rpx 44rpx no-repeat,
    linear-gradient(90deg, #f4d58b 0 14rpx, transparent 14rpx) left bottom / 44rpx 2rpx no-repeat,
    linear-gradient(0deg, #f4d58b 0 14rpx, transparent 14rpx) left bottom / 2rpx 44rpx no-repeat,
    linear-gradient(270deg, #f4d58b 0 14rpx, transparent 14rpx) right bottom / 44rpx 2rpx no-repeat,
    linear-gradient(0deg, #f4d58b 0 14rpx, transparent 14rpx) right bottom / 2rpx 44rpx no-repeat;
  opacity: 0.68;
}

.mini-card::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.14), transparent 28%, transparent 70%, rgba(255, 220, 140, 0.08));
  mix-blend-mode: screen;
}

.vs-mark {
  color: transparent;
  background: linear-gradient(180deg, #fff1a9, #ffb530 58%, #f1781b);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 28rpx rgba(255, 179, 44, 0.56), 0 8rpx 18rpx rgba(0, 0, 0, 0.62);
}

.score-compare,
.win-panel {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    linear-gradient(#090d13, #090d13) padding-box,
    linear-gradient(135deg, rgba(62, 142, 255, 0.7), rgba(216, 187, 124, 0.42) 48%, rgba(227, 74, 63, 0.72)) border-box;
  border: 2rpx solid transparent;
}

.score-compare::before,
.win-panel::before {
  content: "";
  position: absolute;
  inset: 8rpx;
  pointer-events: none;
  z-index: 2;
  background:
    linear-gradient(90deg, #d8bb7c 0 28rpx, transparent 28rpx) left top / 84rpx 2rpx no-repeat,
    linear-gradient(#d8bb7c 0 28rpx, transparent 28rpx) left top / 2rpx 84rpx no-repeat,
    linear-gradient(270deg, #d8bb7c 0 28rpx, transparent 28rpx) right top / 84rpx 2rpx no-repeat,
    linear-gradient(#d8bb7c 0 28rpx, transparent 28rpx) right top / 2rpx 84rpx no-repeat,
    linear-gradient(90deg, #d8bb7c 0 28rpx, transparent 28rpx) left bottom / 84rpx 2rpx no-repeat,
    linear-gradient(0deg, #d8bb7c 0 28rpx, transparent 28rpx) left bottom / 2rpx 84rpx no-repeat,
    linear-gradient(270deg, #d8bb7c 0 28rpx, transparent 28rpx) right bottom / 84rpx 2rpx no-repeat,
    linear-gradient(0deg, #d8bb7c 0 28rpx, transparent 28rpx) right bottom / 2rpx 84rpx no-repeat;
  opacity: 0.4;
}

.score-number {
  text-shadow: 0 0 18rpx currentColor;
}

.metric-bar {
  box-shadow: inset 0 0 10rpx rgba(0, 0, 0, 0.72);
}

.metric-bar view {
  box-shadow: 0 0 12rpx currentColor, inset 0 2rpx 4rpx rgba(255, 255, 255, 0.26);
}

.win-ring {
  box-shadow: 0 0 30rpx rgba(63, 140, 255, 0.22), inset 0 0 22rpx rgba(0, 0, 0, 0.38);
}

.adjust-btn {
  clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
  text-shadow: 0 3rpx 8rpx rgba(0, 0, 0, 0.55);
}

.back-btn,
.help-btn,
.score-divider {
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-action {
  line-height: 1.15;
}
</style>
