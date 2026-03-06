import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname);

describe("monorepo setup", () => {
  it("has package.json with required fields", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(ROOT, "package.json"), "utf-8")
    );

    expect(packageJson.name).toBe("crayon");
    expect(packageJson.private).toBe(true);
    expect(packageJson.packageManager).toMatch(/^pnpm@/);
    expect(packageJson.scripts).toHaveProperty("build");
    expect(packageJson.scripts).toHaveProperty("test");
    expect(packageJson.scripts).toHaveProperty("lint");
  });

  it("has pnpm-workspace.yaml with packages config", () => {
    const workspaceFile = resolve(ROOT, "pnpm-workspace.yaml");
    expect(existsSync(workspaceFile)).toBe(true);

    const content = readFileSync(workspaceFile, "utf-8");
    expect(content).toContain("packages/*");
    expect(content).toContain("apps/*");
  });

  it("has turbo.json with task configuration", () => {
    const turboJson = JSON.parse(
      readFileSync(resolve(ROOT, "turbo.json"), "utf-8")
    );

    expect(turboJson.tasks).toHaveProperty("build");
    expect(turboJson.tasks).toHaveProperty("test");
    expect(turboJson.tasks).toHaveProperty("lint");
    expect(turboJson.tasks.build.dependsOn).toContain("^build");
  });

  it("has tsconfig.json with strict mode", () => {
    const tsconfig = JSON.parse(
      readFileSync(resolve(ROOT, "tsconfig.json"), "utf-8")
    );

    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
  });

  it("has packages and apps directories", () => {
    expect(existsSync(resolve(ROOT, "packages"))).toBe(true);
    expect(existsSync(resolve(ROOT, "apps"))).toBe(true);
  });
});
