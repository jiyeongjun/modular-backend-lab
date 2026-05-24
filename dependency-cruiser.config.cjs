/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-has-no-adapter-dependencies",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain" },
      to: {
        path: "^src/(infra|http|jobs|workers)|^src/modules/[^/]+/(application|ports|infra|http)",
      },
    },
    {
      name: "application-has-no-runtime-adapter-dependencies",
      severity: "error",
      from: { path: "^src/modules/[^/]+/application" },
      to: { path: "^src/(infra|http|jobs|workers)|^src/modules/[^/]+/(infra|http)" },
    },
    {
      name: "ports-have-no-adapter-dependencies",
      severity: "error",
      from: { path: "^src/modules/[^/]+/ports" },
      to: { path: "^src/(infra|http|jobs|workers)|^src/modules/[^/]+/(infra|http)" },
    },
    {
      name: "shared-does-not-import-modules",
      severity: "error",
      from: { path: "^src/shared" },
      to: { path: "^src/modules" },
    },
    {
      name: "jobs-do-not-import-http",
      severity: "error",
      from: { path: "^src/jobs" },
      to: { path: "^src/http|^src/modules/[^/]+/http" },
    },
    {
      name: "infra-does-not-import-http",
      severity: "error",
      from: { path: "^src/infra" },
      to: { path: "^src/http|^src/modules/[^/]+/http" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".json"],
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
