<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">配将管理台</div>
        <p>运营数据管理后台</p>
      </div>
      <el-form :model="form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="form.token"
            placeholder="请输入管理员 Token"
            size="large"
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" @click="handleLogin" :loading="loading" style="width: 100%">
            登录
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login, logout, getDashboard } from "../api";

const router = useRouter();
const loading = ref(false);
const errorMsg = ref("");
const form = ref({ token: "" });

const handleLogin = async () => {
  if (!form.value.token) {
    errorMsg.value = "请输入管理员 Token";
    return;
  }
  loading.value = true;
  errorMsg.value = "";
  try {
    login(form.value.token);
    await getDashboard();
    router.push("/dashboard");
  } catch (e) {
    logout();
    errorMsg.value = "Token 无效，请重新输入";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse 60% 40% at 50% 30%, rgba(201, 152, 58, 0.04) 0%, transparent 60%),
    var(--ink-deep);
}

.login-card {
  width: 400px;
  padding: 48px 40px;
  background: var(--ink-surface);
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo {
  font-size: 24px;
  font-weight: 700;
  color: var(--gold);
  margin-bottom: 8px;
  letter-spacing: 0.06em;
}

.login-header p {
  color: var(--text-fade);
  font-size: 14px;
}

.error-msg {
  color: var(--loss);
  font-size: 14px;
  text-align: center;
  margin-top: 16px;
}
</style>
