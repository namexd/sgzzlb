import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OSS from "ali-oss";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.resolve(__dirname, "../data/cards");

const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
const bucket = process.env.OSS_BUCKET || "youhuigoulogo";
const endpoint = process.env.OSS_ENDPOINT || "oss-cn-beijing.aliyuncs.com";
const prefix = process.env.OSS_PREFIX || "articles/cards";
const cdnDomain = process.env.OSS_CDN_DOMAIN || "https://youhuigoulogo.oss-cn-beijing.aliyuncs.com";

if (!accessKeyId || !accessKeySecret) {
  console.error("错误: 请设置 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET 环境变量。");
  process.exit(1);
}

const client = new OSS({ accessKeyId, accessKeySecret, bucket, endpoint, secure: true });

async function main() {
  const files = fs.readdirSync(CARDS_DIR).filter((f) => /\.(png|jpg|jpeg|svg)$/i.test(f));
  console.log(`找到 ${files.length} 个卡片文件，开始上传到 OSS...`);
  console.log(`目标: ${cdnDomain}/${prefix}/\n`);

  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const localPath = path.join(CARDS_DIR, file);
    const ossKey = `${prefix}/${file}`;
    try {
      await client.put(ossKey, localPath);
      const url = `${cdnDomain}/${prefix}/${encodeURIComponent(file)}`;
      console.log(`  ✓ ${file} → ${url}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n完成: ${ok} 成功, ${fail} 失败, 共 ${files.length} 个文件。`);
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});
