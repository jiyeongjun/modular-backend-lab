import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type Violation = Readonly<{
  file: string;
  message: string;
}>;

const requiredStrictCompilerOptions = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "noFallthroughCasesInSwitch",
  "noImplicitReturns",
  "useUnknownInCatchVariables",
  "forceConsistentCasingInFileNames",
] as const;

const queueBackendPackages = [
  "@aws-sdk/client-sqs",
  "@aws-sdk/client-kafka",
  "@confluentinc/kafka-javascript",
  "@redis/client",
  "aws-msk-iam-sasl-signer-js",
  "bullmq",
  "ioredis",
  "iovalkey",
  "kafkajs",
  "node-rdkafka",
  "redis",
  "valkey",
  "valkey-glide",
] as const;

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function isLayer(file: string, layer: "domain" | "application"): boolean {
  return file.includes(`${path.sep}${layer}${path.sep}`);
}

function hasImport(source: string, packagePattern: RegExp): boolean {
  return source
    .split("\n")
    .filter((line) => line.trimStart().startsWith("import"))
    .some((line) => packagePattern.test(line));
}

function getImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importPatterns = [
    /(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g,
    /import\s+(?:type\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.push(specifier);
      }
    }
  }

  return specifiers;
}

function resolveImport(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.normalize(path.resolve(path.dirname(file), specifier));
}

function toPortablePath(file: string): string {
  return file.split(path.sep).join("/");
}

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function hasDocumentedNonNullAssertion(source: string): boolean {
  return source.includes("convention-scan allow non-null assertion");
}

function isPackageImport(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function isQueueBackendPackage(specifier: string): boolean {
  return (
    queueBackendPackages.some((packageName) => isPackageImport(specifier, packageName)) ||
    specifier.startsWith("@redis/") ||
    specifier.startsWith("@valkey/")
  );
}

function isAsyncRuntimeBoundary(relative: string): boolean {
  const portable = toPortablePath(relative);
  return (
    portable.startsWith("src/infra/queue/") ||
    portable.startsWith("src/infra/event-stream/") ||
    portable.startsWith("src/workers/")
  );
}

function scanTsconfig(root: string): Violation[] {
  const tsconfigPath = path.join(root, "tsconfig.json");
  const source = readFileSync(tsconfigPath, "utf8");
  const parsed = JSON.parse(source) as { compilerOptions?: Record<string, unknown> };
  const compilerOptions = parsed.compilerOptions ?? {};
  const violations: Violation[] = [];

  for (const option of requiredStrictCompilerOptions) {
    if (compilerOptions[option] !== true) {
      violations.push({
        file: "tsconfig.json",
        message: `TypeScript strictness option ${option} must remain enabled`,
      });
    }
  }

  return violations;
}

function scanFile(root: string, file: string, source: string): Violation[] {
  const relative = path.relative(root, file);
  const violations: Violation[] = [];
  const inDomain = isLayer(file, "domain");
  const inApplication = isLayer(file, "application");
  const inCore = inDomain || inApplication;
  const sourceWithoutLineComments = stripLineComments(source);
  const importSpecifiers = getImportSpecifiers(sourceWithoutLineComments);

  if (inCore && hasImport(source, /from\s+["']hono(?:\/|["'])/)) {
    violations.push({ file: relative, message: "Hono import is not allowed in core layers" });
  }

  if (inCore && hasImport(source, /from\s+["']kysely(?:\/|["'])/)) {
    violations.push({ file: relative, message: "Kysely import is not allowed in core layers" });
  }

  if (inDomain && hasImport(source, /from\s+["']zod(?:\/|["'])/)) {
    violations.push({ file: relative, message: "Zod schemas are boundary validators only" });
  }

  if (inDomain && hasImport(source, /from\s+["']pino(?:\/|["'])/)) {
    violations.push({ file: relative, message: "Pino import is not allowed in domain logic" });
  }

  const queueBackendImports = importSpecifiers.filter(isQueueBackendPackage);
  if (queueBackendImports.length > 0 && !isAsyncRuntimeBoundary(relative)) {
    violations.push({
      file: relative,
      message: `Queue/event backend package imports are only allowed in src/infra/queue, src/infra/event-stream, or src/workers: ${Array.from(
        new Set(queueBackendImports),
      ).join(", ")}`,
    });
  }

  for (const specifier of importSpecifiers) {
    const resolved = resolveImport(file, specifier);
    if (!resolved) {
      continue;
    }

    const resolvedRelative = toPortablePath(path.relative(root, resolved));
    const importsAsyncAdapter =
      resolvedRelative.startsWith("src/infra/queue/") ||
      resolvedRelative.startsWith("src/infra/event-stream/");

    if (importsAsyncAdapter && !isAsyncRuntimeBoundary(relative)) {
      violations.push({
        file: relative,
        message:
          "Queue/event adapter imports are only allowed in src/infra/queue, src/infra/event-stream, or src/workers",
      });
    }
  }

  if (inCore && hasImport(source, /from\s+["']@opentelemetry\//)) {
    violations.push({ file: relative, message: "OpenTelemetry SDK imports are adapter-only" });
  }

  if (
    source.includes("process.env") &&
    !relative.startsWith(`src${path.sep}infra${path.sep}config`)
  ) {
    violations.push({ file: relative, message: "process.env may only be read in infra/config" });
  }

  if (relative.endsWith(".usecase.ts") && /\bContext\b/.test(source)) {
    violations.push({
      file: relative,
      message: "Usecases must not accept framework Context objects",
    });
  }

  if (/\.only\s*\(/.test(source)) {
    violations.push({ file: relative, message: "Focused tests must not be committed" });
  }

  if (/\b(?:describe|it|test)\.skip\s*\(/.test(source)) {
    violations.push({
      file: relative,
      message: "Skipped tests must be documented outside test code",
    });
  }

  if (relative.startsWith(`src${path.sep}`) && /\bas\s+any\b/.test(sourceWithoutLineComments)) {
    violations.push({ file: relative, message: "`as any` is not allowed in src" });
  }

  if (inCore && /\bany\b/.test(sourceWithoutLineComments)) {
    violations.push({
      file: relative,
      message: "Explicit `any` is not allowed in domain/application without documented reason",
    });
  }

  if (inCore && /\bas\s+(?:[A-Z][A-Za-z0-9_]*|Readonly<|Record<)/.test(sourceWithoutLineComments)) {
    violations.push({
      file: relative,
      message: "Broad type assertions are not allowed in domain/application",
    });
  }

  if (
    inCore &&
    !hasDocumentedNonNullAssertion(source) &&
    /\b[A-Za-z_$][\w$]*!\s*(?:[.;,)\]}]|\.)/.test(sourceWithoutLineComments)
  ) {
    violations.push({
      file: relative,
      message:
        "Non-null assertions are not allowed in domain/application without local justification",
    });
  }

  if (inCore && /from\s+["'][^"']*database\.js["']/.test(source)) {
    violations.push({
      file: relative,
      message: "DB row/database types must not be used as domain/application models",
    });
  }

  if (inCore && /Schema\b/.test(source) && /from\s+["'][^"']*schemas/.test(source)) {
    violations.push({
      file: relative,
      message: "Zod schemas must not be used as domain/application models",
    });
  }

  if (inCore && /type\s+\w*Error\s*=\s*\{[^}]*\bcode\s*:\s*string\b/s.test(source)) {
    violations.push({
      file: relative,
      message: "Expected errors should use discriminated unions instead of string code objects",
    });
  }

  const moduleMatch = relative.match(/^src[/\\]modules[/\\]([^/\\]+)[/\\]/);
  if (moduleMatch?.[1]) {
    const currentModule = moduleMatch[1];
    const importMatches = source.matchAll(/from\s+["']([^"']+)["']/g);

    for (const match of importMatches) {
      const specifier = match[1];
      if (!specifier) {
        continue;
      }
      const resolved = resolveImport(file, specifier);
      if (!resolved) {
        continue;
      }

      const resolvedRelative = path.relative(root, resolved);
      const target = resolvedRelative.match(/^src[/\\]modules[/\\]([^/\\]+)[/\\](infra|http)[/\\]/);
      if (target?.[1] && target[1] !== currentModule) {
        violations.push({
          file: relative,
          message: "Do not import another module's infra or http layer",
        });
      }
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const srcDir = path.join(root, "src");
  const files = await listFiles(srcDir);
  const violations: Violation[] = scanTsconfig(root);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    violations.push(...scanFile(root, file, source));
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}: ${violation.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`convention-scan passed (${files.length} files scanned)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
