import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MODULE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const LAYERS = ["domain", "application", "ports", "infra", "http", "tests"] as const;
const INDEX_LAYERS = ["domain", "application", "ports", "infra", "http"] as const;

type WriteResult = "created" | "skipped";

async function writeIfMissing(filePath: string, contents: string): Promise<WriteResult> {
  try {
    await writeFile(filePath, contents, { flag: "wx" });
    return "created";
  } catch (error) {
    if (hasErrorCode(error, "EEXIST")) {
      return "skipped";
    }
    throw error;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function readModuleName(): string {
  const moduleName = process.argv[2];

  if (moduleName === undefined || !MODULE_NAME_PATTERN.test(moduleName)) {
    throw new Error("Usage: pnpm scaffold:module <kebab-case-module-name>");
  }

  return moduleName;
}

async function main(): Promise<void> {
  const moduleName = readModuleName();
  const moduleRoot = path.join(process.cwd(), "src", "modules", moduleName);

  for (const layer of LAYERS) {
    await mkdir(path.join(moduleRoot, layer), { recursive: true });
  }

  for (const layer of INDEX_LAYERS) {
    const indexPath = path.join(moduleRoot, layer, "index.ts");
    const result = await writeIfMissing(indexPath, "export {};\n");
    console.log(`${result}: ${path.relative(process.cwd(), indexPath)}`);
  }

  console.log(`ready: ${path.relative(process.cwd(), moduleRoot)}`);
}

await main();
