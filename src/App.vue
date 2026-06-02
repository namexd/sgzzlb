<script>
export default {
  globalData: {
    appName: "三战配将分析",
    subscriptionKey: "subscriptionTier",
    apiConfigKey: "apiConfig",
    savedLineupsKey: "savedLineups",
    inventoryKey: "playerInventory",
    drawPoolsKey: "drawPools",
    tokenKey: "userToken"
  },
  onLaunch() {
    console.log("App Launch");
  },
  onShow() {
    console.log("App Show");
  },
  onHide() {
    console.log("App Hide");
  }
};
</script>

<style>
page {
  min-height: 100vh;
  background: #11161d;
  color: #f4ead8;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  letter-spacing: 0;
}

view,
text,
button,
input,
textarea,
picker {
  box-sizing: border-box;
}
</style>
