<template>
  <view class="page feedback-page">
    <view class="section header">
      <view class="back-btn" @tap="goBack">← 返回</view>
      <view class="title">意见反馈</view>
    </view>

    <view class="section form-card">
      <view class="form-label">反馈内容</view>
      <textarea
        class="feedback-input"
        v-model="content"
        placeholder="建议或问题"
        :maxlength="1000"
        auto-height
      />
      <view class="char-count">{{ content.length }}/1000</view>

      <view v-if="errorMsg" class="error-msg">{{ errorMsg }}</view>

      <view class="form-label">联系方式（选填）</view>
      <input
        class="contact-input"
        v-model="contact"
        placeholder="微信号或邮箱"
        :maxlength="128"
      />

      <button class="submit-btn" @tap="submitFeedback" :loading="submitting" :disabled="submitting">
        提交反馈
      </button>
    </view>

    <view v-if="submitted" class="section success-card">
      <view class="success-icon">✓</view>
      <view class="success-text">反馈已提交</view>
    </view>
  </view>
</template>

<script>
const PROFANITY_LIST = [
  "操你", "你妈", "他妈", "狗日", "傻逼", "煞笔", "牛逼", "卧槽", "我靠",
  "草泥马", "尼玛", "妈的", "妈逼", "fuck", "shit", "bitch", "ass", "damn",
  "sb", "nmsl", "wocao", "cnm", "nmb", "tmd", "jj", "jb", "dick",
  "垃圾", "废物", "蠢货", "白痴", "智障", "脑残", "弱智",
  "滚蛋", "去死", "混蛋", "王八蛋", "贱人", "婊子"
];

// 至少包含一个中文字符
const CHINESE_REGEX = /[一-鿿]/;
// 过滤连续重复字符
const REPEATED_CHAR = /(.)\1{4,}/;
// 过滤键盘连续乱输
const MASHING_PATTERNS = /^(asdf|qwer|zxcv|hjkl|uiop|nm,.)/i;
// 字符种类过少时视为无效内容
function isMeaningless(text) {
  const cleaned = text.replace(/[\s\.,!?，。！？、\-\n]/g, "");
  if (cleaned.length < 5) return true;
  const uniqueChars = new Set(cleaned).size;
  if (uniqueChars < 3 && cleaned.length > 5) return true;
  if (REPEATED_CHAR.test(cleaned)) return true;
  if (MASHING_PATTERNS.test(cleaned)) return true;
  // 大量数字或字母通常不是有效中文反馈
  const chineseCount = (cleaned.match(/[一-鿿]/g) || []).length;
  if (cleaned.length > 10 && chineseCount < cleaned.length * 0.2) return true;
  return false;
}

function containsProfanity(text) {
  const lower = text.toLowerCase();
  return PROFANITY_LIST.some(word => lower.includes(word));
}

function validateContent(text) {
  const trimmed = text.trim();
  if (trimmed.length < 5) return "至少 5 个字";
  if (trimmed.length > 1000) return "最多 1000 字";
  if (!CHINESE_REGEX.test(trimmed)) return "仅支持中文反馈";
  if (isMeaningless(trimmed)) return "内容无效";
  if (containsProfanity(trimmed)) return "请文明用语";
  return "";
}

export default {
  data() {
    return {
      content: "",
      contact: "",
      errorMsg: "",
      submitting: false,
      submitted: false
    };
  },
  methods: {
    goBack() {
      uni.navigateBack();
    },
    async submitFeedback() {
      this.errorMsg = "";
      const validation = validateContent(this.content);
      if (validation) {
        this.errorMsg = validation;
        return;
      }
      this.submitting = true;
      try {
        const { requestRemote, shouldUseRemote } = await import("../../services/api");
        const payload = { content: this.content.trim(), contact: this.contact.trim() };
        let res;
        if (shouldUseRemote()) {
          res = await requestRemote("/api/v1/feedback", { method: "POST", data: payload });
        } else {
          // 本地模式：尝试直连本地服务器，失败则存本地
          try {
            res = await requestRemote("/api/v1/feedback", { method: "POST", data: payload });
          } catch (serverErr) {
            const { getStorage, setStorage } = await import("../../utils/storage");
            const pending = getStorage("pendingFeedback") || [];
            pending.push({ ...payload, createdAt: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-") });
            setStorage("pendingFeedback", pending);
            res = { ok: true };
          }
        }
        if (res && res.ok) {
          this.submitted = true;
          this.content = "";
          this.contact = "";
          setTimeout(() => { this.submitted = false; }, 3000);
        } else {
          this.errorMsg = (res && res.message) || "提交失败，请重试。";
        }
      } catch (e) {
        this.errorMsg = "提交失败：" + (e.message || "请重试");
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.feedback-page {
  min-height: 100vh;
  padding: var(--sp-lg);
  padding-bottom: 100rpx;
}

.header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: var(--sp-lg);
}

.back-btn {
  color: var(--gold);
  font-size: 28rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--gold-bright);
}

.tip-card {
  background: var(--gold-ghost);
  border: 1rpx solid var(--border-accent);
  border-radius: var(--r-md);
  padding: 20rpx var(--sp-lg);
  margin-bottom: var(--sp-lg);
}

.tip-text {
  color: var(--gold);
  font-size: 24rpx;
  line-height: 1.6;
}

.form-card {
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  border-radius: var(--r-md);
  padding: var(--sp-lg);
  box-shadow: var(--shadow-sm);
}

.form-label {
  color: var(--gold-bright);
  font-size: 26rpx;
  font-weight: 600;
  margin-bottom: var(--sp-sm);
  margin-top: var(--sp-md);
}

.form-label:first-child {
  margin-top: 0;
}

.feedback-input {
  width: 100%;
  min-height: 240rpx;
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  border-radius: var(--r-md);
  padding: 20rpx;
  color: var(--text-ink);
  font-size: 28rpx;
  line-height: 1.6;
  box-sizing: border-box;
  transition: border-color var(--ease);
}

.char-count {
  text-align: right;
  color: var(--text-fade);
  font-size: 22rpx;
  margin-top: var(--sp-xs);
}

.contact-input {
  width: 100%;
  height: 80rpx;
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  border-radius: var(--r-md);
  padding: 0 20rpx;
  color: var(--text-ink);
  font-size: 28rpx;
  box-sizing: border-box;
  transition: border-color var(--ease);
}

.error-msg {
  color: var(--loss);
  font-size: 24rpx;
  margin-top: var(--sp-sm);
  padding: var(--sp-sm) var(--sp-md);
  background: rgba(231, 76, 60, 0.1);
  border-radius: var(--r-sm);
}

.submit-btn {
  margin-top: var(--sp-xl);
  background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold-dim) 100%);
  color: var(--ink-deepest);
  font-size: 30rpx;
  font-weight: 600;
  border-radius: var(--r-md);
  height: 88rpx;
  line-height: 88rpx;
  transition: opacity var(--ease);
}

.submit-btn[disabled] {
  opacity: 0.5;
}

.success-card {
  text-align: center;
  padding: 40rpx;
  background: rgba(46, 204, 113, 0.1);
  border: 1rpx solid rgba(46, 204, 113, 0.3);
  border-radius: var(--r-md);
  margin-top: var(--sp-lg);
}

.success-icon {
  font-size: 60rpx;
  color: var(--win);
  margin-bottom: var(--sp-sm);
}

.success-text {
  color: var(--win);
  font-size: 28rpx;
}
</style>
