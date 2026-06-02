const OSS = require("ali-oss");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CDN = "https://youhuigoulogo.oss-cn-beijing.aliyuncs.com";
const DEFAULT_PREFIX = "articles/cards";

function getOssClient() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少 OSS_ACCESS_KEY_ID 或 OSS_ACCESS_KEY_SECRET 环境变量。");
  }
  return new OSS({
    accessKeyId,
    accessKeySecret,
    bucket: process.env.OSS_BUCKET || "youhuigoulogo",
    endpoint: process.env.OSS_ENDPOINT || "oss-cn-beijing.aliyuncs.com",
    secure: true
  });
}

function getOssKey(filename) {
  const prefix = process.env.OSS_PREFIX || DEFAULT_PREFIX;
  return `${prefix}/${filename}`;
}

function getImageUrl(filename) {
  const cdn = process.env.OSS_CDN_DOMAIN || DEFAULT_CDN;
  const prefix = process.env.OSS_PREFIX || DEFAULT_PREFIX;
  return `${cdn}/${prefix}/${encodeURIComponent(filename)}`;
}

async function uploadImage(localPath, filename) {
  const client = getOssClient();
  const ossKey = getOssKey(filename);
  const result = await client.put(ossKey, localPath);
  return {
    url: result.url || getImageUrl(filename),
    ossKey
  };
}

async function uploadBuffer(buffer, filename, mimeType) {
  const client = getOssClient();
  const ossKey = getOssKey(filename);
  const result = await client.put(ossKey, buffer, {
    headers: { "Content-Type": mimeType || "image/png" }
  });
  return {
    url: result.url || getImageUrl(filename),
    ossKey
  };
}

module.exports = {
  getOssClient,
  uploadImage,
  uploadBuffer,
  getImageUrl,
  getOssKey,
  DEFAULT_CDN,
  DEFAULT_PREFIX
};
