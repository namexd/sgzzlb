import fs from "node:fs/promises";
import path from "node:path";

const ENDPOINT = "https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json";
const GAME_ID = 10000100;

const TABLES = [
  {
    key: "generals",
    name: "武将库",
    tbId: "350659087930767364",
    categoryIds: "350958444404029449,350958444404029450,350958444404029451,350958444404029452"
  },
  {
    key: "tactics",
    name: "战法库",
    tbId: "350659307657771017",
    categoryIds: "" // 不过滤分类，获取全部战法（含事件战法）
  },
  {
    key: "equipment",
    name: "装备库",
    tbId: "350659411548294145",
    categoryIds: "352054216407136265,352054216407136266,352054216407136267,352054216407136268"
  },
  {
    key: "troopTactics",
    name: "兵种库",
    tbId: "553976671589912577",
    categoryIds: "553977003162226697,553977003162226698,553977003162226699"
  }
];

const IMAGE_FIELD_PATTERN = /icon|图标|立绘|图片|组合内图|PCicon|移动icon/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOfficialApi(api, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://sgzzlb.lingxigames.com",
          Referer: "https://sgzzlb.lingxigames.com/station/"
        },
        body: JSON.stringify({
          api,
          params: {
            gameId: GAME_ID,
            ...params
          }
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.resultView || JSON.stringify(json.state || {}));
      }
      return json.result;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      await sleep(300 * attempt);
    }
  }
  throw new Error("官方接口请求失败");
}

async function fetchList(table) {
  // 官方前端使用 20；更大的 size 会返回 5000004。
  const size = 20;
  const params = { tbId: table.tbId, page: 0, size };
  if (table.categoryIds) {
    params.categoryIds = table.categoryIds;
  }
  const first = await callOfficialApi("/api/l/owresource/getQueryDataInfoListByCategory", params);
  const total = first.totalCount || 0;
  const pages = Math.ceil(total / size);
  const items = [...(first.items || [])];

  for (let page = 1; page < pages; page += 1) {
    const pageParams = { tbId: table.tbId, page, size };
    if (table.categoryIds) {
      pageParams.categoryIds = table.categoryIds;
    }
    const result = await callOfficialApi("/api/l/owresource/getQueryDataInfoListByCategory", pageParams);
    items.push(...(result.items || []));
  }

  return { total, items };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function fetchDetail(table, item) {
  const result = await callOfficialApi("/api/l/owresource/getQueryDataInfoByPriId", {
    tbId: table.tbId,
    priRowId: item.priRowId
  });
  const detail = result.items?.[0];
  if (!detail) {
    throw new Error(`${table.name} ${item.priVal} 缺少详情`);
  }
  return detail;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseExtInfo(extInfo) {
  if (!extInfo) return {};
  try {
    return JSON.parse(extInfo);
  } catch {
    return {};
  }
}

function detailsToMap(details = []) {
  const map = {};
  const categories = {};
  const mediaFields = [];
  const rawDetails = [];

  for (const item of details) {
    const key = item.key || "";
    const extInfo = parseExtInfo(item.extInfo);
    const isImage = item.colType === 4 || IMAGE_FIELD_PATTERN.test(key);

    if (isImage) {
      mediaFields.push(key);
      continue;
    }

    map[key] = item.val ?? "";
    if (extInfo.categoryId) {
      categories[key] = extInfo.categoryId;
    }
    rawDetails.push({
      key,
      value: item.val ?? "",
      type: item.colType
    });
  }

  return { map, categories, mediaFields, rawDetails };
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeAsset(kind, name, faction = "") {
  const subject = faction ? `${faction}阵营${name}` : name;
  return {
    status: "needs_generation",
    model: "image2",
    policy: "original_style_only",
    prompt: `原创三国策略卡牌，${subject}，半身人物，克制暗金军帐色彩，自有边框设计，不参考任何官网图、游戏立绘或竞品截图`
  };
}

function normalizeGeneral(detail) {
  const { map, mediaFields, rawDetails } = detailsToMap(detail.details);
  const faction = map["阵营"] || "";
  return {
    id: detail.priRowId,
    name: detail.priVal,
    faction,
    star: map["星级"] || "",
    cost: parseNumber(map["cost"]),
    season: map["所属赛季"] || "",
    tags: splitList(map["武将标签"]),
    tactics: {
      innate: map["自带战法"] || "",
      inherited: map["传承战法"] || "",
      innateDescription: map["自带战法描述"] || "",
      inheritedDescription: map["传承战法描述"] || ""
    },
    stats: {
      force: parseNumber(map["武力"]),
      intellect: parseNumber(map["智力"]),
      command: parseNumber(map["统率"]),
      speed: parseNumber(map["速度"]),
      politics: parseNumber(map["政治"]),
      charm: parseNumber(map["魅力"])
    },
    arms: {
      cavalry: map["兵种适性骑兵"] || "",
      shield: map["兵种适性盾兵"] || "",
      bow: map["兵种适性弓兵"] || "",
      spear: map["兵种适性枪兵"] || "",
      siege: map["兵种适性器械"] || ""
    },
    bonds: [
      map["缘分1名称"] && { name: map["缘分1名称"], description: map["缘分1介绍文案"] || "" },
      map["缘分2名称"] && { name: map["缘分2名称"], description: map["缘分2介绍文案"] || "" },
      map["缘分3名称"] && { name: map["缘分3名称"], description: map["缘分3介绍文案"] || "" }
    ].filter(Boolean),
    asset: makeAsset("general", detail.priVal, faction),
    source: {
      table: "武将库",
      rowId: detail.priRowId,
      mediaFieldsExcluded: mediaFields
    },
    rawDetails
  };
}

function normalizeTactic(detail, tableName = "战法库") {
  const { map, mediaFields, rawDetails } = detailsToMap(detail.details);
  return {
    id: detail.priRowId,
    name: detail.priVal,
    quality: map["战法品质"] || "",
    type: map["战法类型"] || "",
    source: map["战法来源"] || "",
    sourceGeneral: map["来源武将"] || "",
    troopLimit: splitList(map["兵种限制"]),
    target: map["战法目标"] || "",
    description: map["战法描述"] || "",
    season: map["所属赛季"] || "",
    asset: makeAsset("tactic", detail.priVal),
    sourceRef: {
      table: tableName,
      rowId: detail.priRowId,
      mediaFieldsExcluded: mediaFields
    },
    rawDetails
  };
}

function normalizeEquipment(detail) {
  const { map, mediaFields, rawDetails } = detailsToMap(detail.details);
  return {
    id: detail.priRowId,
    name: detail.priVal,
    quality: map["装备品质"] || "",
    type: map["装备类型"] || "",
    effect: map["装备特技"] || map["描述"] || map["装备描述"] || "",
    sourceRef: {
      table: "装备库",
      rowId: detail.priRowId,
      mediaFieldsExcluded: mediaFields
    },
    rawDetails
  };
}

function normalizeRecord(table, detail) {
  if (table.key === "generals") return normalizeGeneral(detail);
  if (table.key === "tactics") return normalizeTactic(detail, table.name);
  if (table.key === "troopTactics") return normalizeTactic(detail, table.name);
  return normalizeEquipment(detail);
}

async function fetchTable(table) {
  console.log(`抓取${table.name}列表...`);
  const list = await fetchList(table);
  console.log(`${table.name}: ${list.total} 条，开始抓取详情`);
  const details = await mapWithConcurrency(list.items, 8, async (item, index) => {
    if ((index + 1) % 25 === 0) {
      console.log(`${table.name}: 已抓取 ${index + 1}/${list.total}`);
    }
    const detail = await fetchDetail(table, item);
    return normalizeRecord(table, detail);
  });
  return {
    expectedCount: list.total,
    records: details
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const catalog = {
    meta: {
      generatedAt,
      source: "https://sgzzlb.lingxigames.com/station/",
      endpoint: ENDPOINT,
      gameId: GAME_ID,
      officialMediaUrlsExcluded: true,
      legalNote: "商业化上线前需确认官方资料字段、长篇文案和素材展示边界。"
    },
    generals: [],
    tactics: [],
    equipment: [],
    troopTactics: []
  };

  for (const table of TABLES) {
    const result = await fetchTable(table);
    catalog[table.key] = result.records;
    catalog.meta[`${table.key}Count`] = result.records.length;
    catalog.meta[`${table.key}ExpectedCount`] = result.expectedCount;
  }

  const outputPath = path.join(process.cwd(), "data", "catalog.json");
  const modulePath = path.join(process.cwd(), "data", "catalog.js");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const serialized = JSON.stringify(catalog, null, 2);
  await fs.writeFile(outputPath, `${serialized}\n`, "utf8");
  await fs.writeFile(modulePath, `module.exports = ${serialized};\n`, "utf8");
  console.log(`已写入 ${outputPath}`);
  console.log(`已写入 ${modulePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
