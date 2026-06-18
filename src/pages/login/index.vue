<template>
  <view class="page login-page">
    <view class="logo-section">
      <view class="logo">配将</view>
      <view class="app-name">三战配将分析</view>
    </view>

    <view class="form-card">
      <!-- Tab switch -->
      <view class="tabs">
        <view :class="['tab', { active: mode === 'login' }]" @tap="mode = 'login'">登录</view>
        <view :class="['tab', { active: mode === 'register' }]" @tap="mode = 'register'">注册</view>
      </view>

      <!-- Login form -->
      <view v-if="mode === 'login'" class="form-body">
        <view class="field-label">用户名</view>
        <input class="field-input" v-model="loginForm.username" placeholder="请输入用户名" />

        <view class="field-label">密码</view>
        <input class="field-input" v-model="loginForm.password" type="password" placeholder="请输入密码" />

        <view v-if="errorMsg" class="error-msg">{{ errorMsg }}</view>

        <button class="submit-btn" @tap="doLogin" :loading="loading" :disabled="loading">登录</button>
      </view>

      <!-- Register form -->
      <view v-if="mode === 'register'" class="form-body">
        <view class="field-label">用户名</view>
        <input class="field-input" v-model="registerForm.username" placeholder="3个字符以上，字母数字下划线" />

        <view class="field-label">昵称</view>
        <input class="field-input" v-model="registerForm.nickname" placeholder="选填，不填则用用户名" />

        <view class="field-label">密码</view>
        <input class="field-input" v-model="registerForm.password" type="password" placeholder="至少 6 个字符" />

        <view class="field-label">确认密码</view>
        <input class="field-input" v-model="registerForm.confirmPassword" type="password" placeholder="再次输入密码" />

        <view v-if="errorMsg" class="error-msg">{{ errorMsg }}</view>

        <button class="submit-btn" @tap="doRegister" :loading="loading" :disabled="loading">注册</button>
      </view>
    </view>

    <view class="skip-link" @tap="skipLogin">先不登录，继续使用 →</view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      mode: "login",
      loading: false,
      errorMsg: "",
      loginForm: {
        username: "",
        password: ""
      },
      registerForm: {
        username: "",
        nickname: "",
        password: "",
        confirmPassword: ""
      }
    };
  },
  methods: {
    async doLogin() {
      this.errorMsg = "";
      if (!this.loginForm.username || !this.loginForm.password) {
        this.errorMsg = "请输入用户名和密码。";
        return;
      }
      this.loading = true;
      try {
        const { requestRemote } = await import("../../services/api");
        const res = await requestRemote("/api/v1/auth/login", {
          method: "POST",
          data: this.loginForm
        });
        if (res.ok) {
          this.saveAuth(res.token, res.user);
          this.navigateBack();
        } else {
          this.errorMsg = res.message || "登录失败。";
        }
      } catch (e) {
        this.errorMsg = this.formatRequestError(e);
      } finally {
        this.loading = false;
      }
    },
    async doRegister() {
      this.errorMsg = "";
      const form = this.registerForm;
      if (!form.username || form.username.length < 3) {
        this.errorMsg = "用户名至少 3 个字符。";
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
        this.errorMsg = "用户名只能包含字母、数字和下划线。";
        return;
      }
      if (!form.password || form.password.length < 6) {
        this.errorMsg = "密码至少 6 个字符。";
        return;
      }
      if (form.password !== form.confirmPassword) {
        this.errorMsg = "两次输入的密码不一致。";
        return;
      }

      this.loading = true;
      try {
        const { requestRemote } = await import("../../services/api");
        const res = await requestRemote("/api/v1/auth/register", {
          method: "POST",
          data: { username: form.username, password: form.password, nickname: form.nickname }
        });
        if (res.ok) {
          this.saveAuth(res.token, res.user);
          this.navigateBack();
        } else {
          this.errorMsg = res.message || "注册失败。";
        }
      } catch (e) {
        this.errorMsg = this.formatRequestError(e);
      } finally {
        this.loading = false;
      }
    },
    formatRequestError(error) {
      const message = error && error.message ? error.message : "";
      if (!message) return "系统错误，请稍后再试。";
      if (/request:fail|timeout|network|failed to fetch|无法连接/i.test(message)) {
        return "无法连接服务器，请检查网络后重试。";
      }
      if (/请求失败：5\d\d/.test(message)) {
        return "系统错误，请稍后再试。";
      }
      return message;
    },
    saveAuth(token, user) {
      uni.setStorageSync("authToken", token);
      uni.setStorageSync("currentUser", { id: user.id, username: user.username, nickname: user.nickname });
    },
    skipLogin() {
      uni.switchTab({ url: "/pages/analyze/index" });
    },
    navigateBack() {
      uni.switchTab({ url: "/pages/account/index" });
    }
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 48rpx 40rpx;
  background: var(--ink-deepest);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-section {
  text-align: center;
  margin-top: 80rpx;
  margin-bottom: 60rpx;
}

.logo {
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold-dim) 100%);
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: 700;
  color: var(--ink-deepest);
  margin: 0 auto 20rpx;
  box-shadow: var(--shadow-md);
}

.app-name {
  color: var(--gold-bright);
  font-size: 36rpx;
  font-weight: 700;
}

.form-card {
  width: 100%;
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.tabs {
  display: flex;
  border-bottom: 1rpx solid var(--border-faint);
}

.tab {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-stone);
  font-size: 30rpx;
  transition: all var(--ease);
}

.tab.active {
  color: var(--gold);
  font-weight: 600;
  border-bottom: 4rpx solid var(--gold);
}

.form-body {
  padding: var(--sp-xl);
}

.field-label {
  color: var(--gold);
  font-size: 26rpx;
  margin-bottom: var(--sp-sm);
}

.field-input {
  width: 100%;
  height: 88rpx;
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  border-radius: var(--r-sm);
  padding: 0 var(--sp-lg);
  color: var(--text-ink);
  font-size: 30rpx;
  margin-bottom: var(--sp-lg);
  box-sizing: border-box;
  transition: border-color var(--ease);
}

.error-msg {
  color: var(--loss);
  font-size: 24rpx;
  margin: var(--sp-sm) 0;
  padding: var(--sp-md);
  background: rgba(231, 76, 60, 0.1);
  border-radius: var(--r-md);
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold-dim) 100%);
  color: var(--ink-deepest);
  font-size: 32rpx;
  font-weight: 600;
  border-radius: var(--r-md);
  margin-top: var(--sp-md);
  border: none;
  transition: opacity var(--ease);
}

.submit-btn[disabled] {
  opacity: 0.6;
}

.skip-link {
  margin-top: 40rpx;
  color: var(--text-fade);
  font-size: 26rpx;
}
</style>
