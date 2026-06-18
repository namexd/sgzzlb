import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { fetchOfficialCatalogSnapshot } = require("../server/officialCatalogFetcher");

async function main() {
  const catalog = await fetchOfficialCatalogSnapshot({
    logger: (message) => console.log(message),
    fetchedBy: "fetch-official-catalog-script"
  });

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
