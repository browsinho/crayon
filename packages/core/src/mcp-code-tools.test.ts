import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  validatePath,
  SecurityError,
  readFile,
  writeFile,
  editFile,
  listFiles,
  runBuild,
  type CodeToolContext,
} from "./mcp-code-tools.js";

describe("MCP Code Tools", () => {
  let testDir: string;
  let context: CodeToolContext;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(process.cwd(), "test-sandbox-" + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    context = { sandboxPath: testDir };
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe("validatePath", () => {
    test("allows valid relative paths", () => {
      expect(() => validatePath(testDir, "src/App.tsx")).not.toThrow();
      expect(() => validatePath(testDir, "components/Header.tsx")).not.toThrow();
      expect(() => validatePath(testDir, "nested/deep/file.txt")).not.toThrow();
    });

    test("blocks path traversal with ..", () => {
      expect(() => validatePath(testDir, "../etc/passwd")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "src/../../etc")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "../../sensitive")).toThrow(SecurityError);
    });

    test("blocks absolute paths", () => {
      expect(() => validatePath(testDir, "/etc/passwd")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "/var/log/syslog")).toThrow(SecurityError);
    });

    test("blocks .env files", () => {
      expect(() => validatePath(testDir, ".env")).toThrow(SecurityError);
      expect(() => validatePath(testDir, ".env.local")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "config/.env")).toThrow(SecurityError);
      expect(() => validatePath(testDir, ".ENV")).toThrow(SecurityError);
    });

    test("blocks node_modules", () => {
      expect(() => validatePath(testDir, "node_modules/lodash")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "node_modules/react/index.js")).toThrow(SecurityError);
    });

    test("blocks .git", () => {
      expect(() => validatePath(testDir, ".git/config")).toThrow(SecurityError);
      expect(() => validatePath(testDir, ".git/HEAD")).toThrow(SecurityError);
    });

    test("blocks .ssh", () => {
      expect(() => validatePath(testDir, ".ssh")).toThrow(SecurityError);
      expect(() => validatePath(testDir, ".ssh/id_rsa")).toThrow(SecurityError);
    });

    test("blocks credential files", () => {
      expect(() => validatePath(testDir, "credentials.json")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "config/Credentials.txt")).toThrow(SecurityError);
    });

    test("blocks .pem files", () => {
      expect(() => validatePath(testDir, "key.pem")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "cert.PEM")).toThrow(SecurityError);
    });

    test("blocks .key files", () => {
      expect(() => validatePath(testDir, "private.key")).toThrow(SecurityError);
      expect(() => validatePath(testDir, "ssl.KEY")).toThrow(SecurityError);
    });

    test("returns full resolved path for valid input", () => {
      const result = validatePath(testDir, "src/App.tsx");
      expect(result).toBe(path.resolve(testDir, "src/App.tsx"));
    });
  });

  describe("readFile", () => {
    test("returns file content with line numbers", async () => {
      const content = "Line 1\nLine 2\nLine 3\n";
      await fs.writeFile(path.join(testDir, "test.txt"), content);

      const result = await readFile({ path: "test.txt" }, context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("1 |");
      expect(result.output).toContain("Line 1");
      expect(result.output).toContain("test.txt");
      expect(result.data?.linesRead).toBe(4); // 3 lines + empty line at end
    });

    test("respects startLine and endLine", async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(path.join(testDir, "test.txt"), lines.join("\n"));

      const result = await readFile(
        { path: "test.txt", startLine: 5, endLine: 10 },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain("5 |");
      expect(result.output).toContain("Line 5");
      expect(result.output).toContain("10 |");
      expect(result.output).toContain("Line 10");
      expect(result.output).not.toContain("1 |");
      expect(result.output).not.toContain("11 |");
    });

    test("truncates large files and shows message", async () => {
      const lines = Array.from({ length: 600 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(path.join(testDir, "large.txt"), lines.join("\n"));

      const result = await readFile({ path: "large.txt" }, context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("truncated");
      expect(result.data?.linesRead).toBe(500);
    });

    test("returns error for non-existent file", async () => {
      const result = await readFile({ path: "nonexistent.txt" }, context);

      expect(result.success).toBe(false);
      expect(result.output).toContain("not found");
    });

    test("returns error for blocked path", async () => {
      const result = await readFile({ path: ".env" }, context);

      expect(result.success).toBe(false);
      expect(result.output).toContain("Access denied");
    });
  });

  describe("writeFile", () => {
    test("creates new file", async () => {
      const result = await writeFile(
        { path: "new-file.txt", content: "Hello World" },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain("Created");
      expect(result.data?.action).toBe("create");
      expect(result.data?.path).toBe("new-file.txt");

      const content = await fs.readFile(path.join(testDir, "new-file.txt"), "utf-8");
      expect(content).toBe("Hello World");
    });

    test("overwrites existing file", async () => {
      await fs.writeFile(path.join(testDir, "existing.txt"), "Old content");

      const result = await writeFile(
        { path: "existing.txt", content: "New content" },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain("Overwrote");
      expect(result.data?.action).toBe("overwrite");

      const content = await fs.readFile(path.join(testDir, "existing.txt"), "utf-8");
      expect(content).toBe("New content");
    });

    test("creates parent directories", async () => {
      const result = await writeFile(
        { path: "deep/nested/dir/file.txt", content: "Hello" },
        context
      );

      expect(result.success).toBe(true);
      expect(existsSync(path.join(testDir, "deep/nested/dir/file.txt"))).toBe(true);
    });

    test("shows file size in output", async () => {
      const result = await writeFile(
        { path: "test.txt", content: "Hello" },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\.\d+ KB/);
    });

    test("returns error for blocked path", async () => {
      const result = await writeFile(
        { path: ".env", content: "SECRET=xxx" },
        context
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("Access denied");
    });
  });

  describe("editFile", () => {
    test("replaces exact content", async () => {
      await fs.writeFile(path.join(testDir, "edit-test.txt"), "Hello World\nGoodbye Moon");

      const result = await editFile(
        { path: "edit-test.txt", oldContent: "World", newContent: "Universe" },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain("Edited");
      expect(result.data?.action).toBe("edit");

      const content = await fs.readFile(path.join(testDir, "edit-test.txt"), "utf-8");
      expect(content).toBe("Hello Universe\nGoodbye Moon");
    });

    test("fails when content not found", async () => {
      await fs.writeFile(path.join(testDir, "edit-test.txt"), "Hello World");

      const result = await editFile(
        { path: "edit-test.txt", oldContent: "Nonexistent", newContent: "New" },
        context
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("Could not find");
    });

    test("fails when content matches multiple times", async () => {
      await fs.writeFile(path.join(testDir, "multi.txt"), "foo bar foo");

      const result = await editFile(
        { path: "multi.txt", oldContent: "foo", newContent: "baz" },
        context
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("found 2 times");
    });

    test("generates diff output", async () => {
      await fs.writeFile(path.join(testDir, "diff-test.txt"), "Hello World");

      const result = await editFile(
        { path: "diff-test.txt", oldContent: "World", newContent: "Universe" },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain("-");
      expect(result.output).toContain("+");
    });

    test("returns error for non-existent file", async () => {
      const result = await editFile(
        { path: "nonexistent.txt", oldContent: "old", newContent: "new" },
        context
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("not found");
    });

    test("returns error for blocked path", async () => {
      const result = await editFile(
        { path: ".env", oldContent: "old", newContent: "new" },
        context
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("Access denied");
    });

    test("handles multiline edits", async () => {
      const original = "Line 1\nLine 2\nLine 3";
      await fs.writeFile(path.join(testDir, "multiline.txt"), original);

      const result = await editFile(
        {
          path: "multiline.txt",
          oldContent: "Line 1\nLine 2",
          newContent: "New Line 1\nNew Line 2",
        },
        context
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(path.join(testDir, "multiline.txt"), "utf-8");
      expect(content).toBe("New Line 1\nNew Line 2\nLine 3");
    });
  });

  describe("listFiles", () => {
    beforeEach(async () => {
      // Create test directory structure
      await fs.mkdir(path.join(testDir, "src"), { recursive: true });
      await fs.mkdir(path.join(testDir, "lib"), { recursive: true });
      await fs.writeFile(path.join(testDir, "README.md"), "# Test");
      await fs.writeFile(path.join(testDir, "src/index.ts"), "console.log('hi')");
      await fs.writeFile(path.join(testDir, "lib/util.ts"), "export const x = 1");
    });

    test("returns directory tree", async () => {
      const result = await listFiles({}, context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("├──");
      expect(result.output).toContain("src");
      expect(result.output).toContain("lib");
      expect(result.output).toContain("README.md");
    });

    test("shows file sizes", async () => {
      const result = await listFiles({}, context);

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\.\d+ KB/);
    });

    test("shows summary counts", async () => {
      const result = await listFiles({}, context);

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+ files, \d+ directories/);
      expect(result.data?.filesCount).toBeGreaterThan(0);
      expect(result.data?.dirsCount).toBeGreaterThan(0);
    });

    test("skips node_modules", async () => {
      await fs.mkdir(path.join(testDir, "node_modules/react"), { recursive: true });
      await fs.writeFile(path.join(testDir, "node_modules/react/index.js"), "");

      const result = await listFiles({}, context);

      expect(result.success).toBe(true);
      expect(result.output).not.toContain("node_modules");
    });

    test("skips .git", async () => {
      await fs.mkdir(path.join(testDir, ".git"), { recursive: true });
      await fs.writeFile(path.join(testDir, ".git/config"), "");

      const result = await listFiles({}, context);

      expect(result.success).toBe(true);
      expect(result.output).not.toContain(".git");
    });

    test("respects depth limit", async () => {
      await fs.mkdir(path.join(testDir, "a/b/c/d"), { recursive: true });
      await fs.writeFile(path.join(testDir, "a/b/c/d/deep.txt"), "deep");

      const result = await listFiles({ depth: 2 }, context);

      expect(result.success).toBe(true);
      // Should show a/b but not c/d
      expect(result.output).toContain("a");
      expect(result.output).toContain("b");
    });

    test("can list subdirectory", async () => {
      const result = await listFiles({ path: "src" }, context);

      expect(result.success).toBe(true);
      expect(result.output).toContain("index.ts");
      expect(result.output).not.toContain("lib");
    });

    test("returns error for blocked path", async () => {
      // Try to list node_modules which should be blocked
      const result = await listFiles({ path: "node_modules/react" }, context);

      expect(result.success).toBe(false);
      expect(result.output).toContain("Access denied");
    });
  });

  describe("runBuild", () => {
    test("returns error when no containerId", async () => {
      const result = await runBuild({}, context);

      expect(result.success).toBe(false);
      expect(result.output).toContain("No container ID");
    });

    test("returns error when containerId is provided but invalid", async () => {
      const contextWithContainer = {
        ...context,
        containerId: "invalid-container-id",
      };

      const result = await runBuild({}, contextWithContainer);

      expect(result.success).toBe(false);
      // Should fail when trying to execute docker command
    });

    // Note: Testing successful build would require a real Docker container
    // which is not practical in unit tests. Integration tests should cover this.
  });

  describe("CODE_TOOL_DEFINITIONS", () => {
    test("exports tool definitions array", async () => {
      const { CODE_TOOL_DEFINITIONS } = await import("./mcp-code-tools.js");

      expect(CODE_TOOL_DEFINITIONS).toBeInstanceOf(Array);
      expect(CODE_TOOL_DEFINITIONS).toHaveLength(5);
    });

    test("each definition has required fields", async () => {
      const { CODE_TOOL_DEFINITIONS } = await import("./mcp-code-tools.js");

      for (const def of CODE_TOOL_DEFINITIONS) {
        expect(def).toHaveProperty("name");
        expect(def).toHaveProperty("description");
        expect(def).toHaveProperty("inputSchema");
        expect(typeof def.name).toBe("string");
        expect(typeof def.description).toBe("string");
        expect(typeof def.inputSchema).toBe("object");
      }
    });

    test("tool names match expected MCP format", async () => {
      const { CODE_TOOL_DEFINITIONS } = await import("./mcp-code-tools.js");

      const expectedNames = [
        "sandbox_read_file",
        "sandbox_write_file",
        "sandbox_edit_file",
        "sandbox_list_files",
        "sandbox_run_build",
      ];

      const actualNames = CODE_TOOL_DEFINITIONS.map(d => d.name);
      expect(actualNames).toEqual(expectedNames);
    });
  });
});
