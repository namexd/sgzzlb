import { isLoggedIn } from "../services/api";

export const LOGIN_ROUTE = "/pages/login/index";

function getCurrentRoute() {
  try {
    const pages = getCurrentPages();
    const current = pages && pages[pages.length - 1];
    return current && current.route ? `/${current.route}` : "";
  } catch (e) {
    return "";
  }
}

export function requireLogin() {
  const currentRoute = getCurrentRoute();
  if (currentRoute === LOGIN_ROUTE) return true;
  if (isLoggedIn()) return true;

  uni.navigateTo({ url: LOGIN_ROUTE });
  return false;
}

export function redirectIfLoggedIn() {
  if (!isLoggedIn()) return false;
  uni.switchTab({ url: "/pages/account/index" });
  return true;
}
