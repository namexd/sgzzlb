const { createApp } = require("./app");

const port = Number.parseInt(process.env.PORT || "8787", 10);
const host = process.env.HOST || "0.0.0.0";
const app = createApp();

app
  .start(port, host)
  .then(() => {
    const address = app.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`服务已启动：http://${host}:${actualPort}`);
  })
  .catch((error) => {
    console.error(`服务启动失败：${error.message}`);
    process.exitCode = 1;
  });

function shutdown(signal) {
  app
    .stop()
    .then(() => {
      console.log(`收到 ${signal}，服务已停止。`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`服务停止失败：${error.message}`);
      process.exit(1);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
