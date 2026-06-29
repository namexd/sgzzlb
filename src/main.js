import { createSSRApp } from "vue";
import App from "./App.vue";
import { requireLogin } from "./utils/authGuard";

export function createApp() {
  const app = createSSRApp(App);
  app.mixin({
    onShow() {
      requireLogin();
    }
  });
  return { app };
}
