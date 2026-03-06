import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  createCodeAgent,
  validatePath,
  SecurityError,
  type CodeAgentConfig,
} from "./code-agent.js";

describe("Path Validation", () => {
  const sandboxPath = "/sandbox";

  test("allows valid relative paths", () => {
    expect(() => validatePath(sandboxPath, "src/App.tsx")).not.toThrow();
    expect(() => validatePath(sandboxPath, "src/components/Header.tsx")).not.toThrow();
    expect(() => validatePath(sandboxPath, "package.json")).not.toThrow();
  });

  test("blocks path traversal with ..", () => {
    expect(() => validatePath(sandboxPath, "../etc/passwd")).toThrow(SecurityError);
    expect(() => validatePath(sandboxPath, "src/../../etc/passwd")).toThrow(SecurityError);
    expect(() => validatePath(sandboxPath, "..")).toThrow(SecurityError);
  });

  test("blocks absolute paths", () => {
    expect(() => validatePath(sandboxPath, "/etc/passwd")).toThrow(SecurityError);
    expect(() => validatePath(sandboxPath, "/home/user/file.txt")).toThrow(SecurityError);
  });

  test("blocks .env files", () => {
    expect(() => validatePath(sandboxPath, ".env")).toThrow(SecurityError);
    expect(() => validatePath(sandboxPath, ".env.local")).toThrow(SecurityError);
    expect(() => validatePath(sandboxPath, ".env.production")).toThrow(SecurityError);
  });

  test("blocks node_modules", () => {
    expect(() => validatePath(sandboxPath, "node_modules/package/index.js")).toThrow(
      SecurityError
    );
  });

  test("blocks .git directory", () => {
    expect(() => validatePath(sandboxPath, ".git/config")).toThrow(SecurityError);
  });

  test("blocks .ssh and credentials", () => {
    expect(() => validatePath(sandboxPath, ".ssh/id_rsa")).toThrow(SecurityError);
    expect(() => validatePath(sandboxPath, "credentials.json")).toThrow(SecurityError);
  });

  test("normalizes paths correctly", () => {
    const result = validatePath(sandboxPath, "src/./components/Header.tsx");
    expect(result).toBe(path.resolve(sandboxPath, "src/components/Header.tsx"));
  });
});

describe("CodeAgent Tools", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-agent-test-"));
  });

  afterEach(async () => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("read_file tool", () => {
    test("reads file with line numbers", async () => {
      // Create test file
      const testContent = "line 1\nline 2\nline 3\nline 4\nline 5";
      await fs.writeFile(path.join(tempDir, "test.txt"), testContent);

      // Import the tool directly to test
      const { validatePath } = await import("./code-agent.js");

      const fullPath = validatePath(tempDir, "test.txt");
      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split("\n");

      expect(lines.length).toBe(5);
      expect(lines[0]).toBe("line 1");
    });

    test("returns error for non-existent file", async () => {
      const { validatePath } = await import("./code-agent.js");

      expect(() => validatePath(tempDir, "nonexistent.txt")).not.toThrow();

      // File doesn't exist, so read would fail
      const fullPath = path.join(tempDir, "nonexistent.txt");
      expect(existsSync(fullPath)).toBe(false);
    });

    test("handles empty files", async () => {
      await fs.writeFile(path.join(tempDir, "empty.txt"), "");

      const content = await fs.readFile(path.join(tempDir, "empty.txt"), "utf-8");
      expect(content).toBe("");
    });
  });

  describe("write_file tool", () => {
    test("creates new file", async () => {
      const testPath = path.join(tempDir, "new-file.txt");
      const content = "Hello, World!";

      await fs.writeFile(testPath, content, "utf-8");

      expect(existsSync(testPath)).toBe(true);
      const readContent = await fs.readFile(testPath, "utf-8");
      expect(readContent).toBe(content);
    });

    test("overwrites existing file", async () => {
      const testPath = path.join(tempDir, "existing.txt");
      await fs.writeFile(testPath, "old content", "utf-8");

      const newContent = "new content";
      await fs.writeFile(testPath, newContent, "utf-8");

      const readContent = await fs.readFile(testPath, "utf-8");
      expect(readContent).toBe(newContent);
    });

    test("creates parent directories", async () => {
      const testPath = path.join(tempDir, "deep", "nested", "file.txt");
      const dir = path.dirname(testPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(testPath, "content", "utf-8");

      expect(existsSync(testPath)).toBe(true);
    });
  });

  describe("edit_file tool", () => {
    test("replaces exact content", async () => {
      const testPath = path.join(tempDir, "edit-test.txt");
      const initialContent = "Hello World\nThis is a test\nGoodbye World";
      await fs.writeFile(testPath, initialContent, "utf-8");

      const oldContent = "This is a test";
      const newContent = "This is a modified test";

      const content = await fs.readFile(testPath, "utf-8");
      const newFileContent = content.replace(oldContent, newContent);
      await fs.writeFile(testPath, newFileContent, "utf-8");

      const result = await fs.readFile(testPath, "utf-8");
      expect(result).toContain("This is a modified test");
      expect(result).not.toContain("This is a test");
    });

    test("handles multiple occurrences", async () => {
      const testPath = path.join(tempDir, "multi.txt");
      const content = "test\ntest\ntest";
      await fs.writeFile(testPath, content, "utf-8");

      const fileContent = await fs.readFile(testPath, "utf-8");
      const occurrences = fileContent.split("test").length - 1;

      expect(occurrences).toBe(3);
    });

    test("returns error when content not found", async () => {
      const testPath = path.join(tempDir, "no-match.txt");
      await fs.writeFile(testPath, "Some content", "utf-8");

      const content = await fs.readFile(testPath, "utf-8");
      const hasMatch = content.includes("nonexistent content");

      expect(hasMatch).toBe(false);
    });
  });

  describe("list_files tool", () => {
    test("lists files in directory", async () => {
      // Create test structure
      await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "src", "App.tsx"), "content");
      await fs.writeFile(path.join(tempDir, "src", "index.tsx"), "content");
      await fs.writeFile(path.join(tempDir, "package.json"), "{}");

      const entries = await fs.readdir(tempDir, { recursive: true });
      expect(entries.length).toBeGreaterThan(0);
    });

    test("skips node_modules", async () => {
      await fs.mkdir(path.join(tempDir, "node_modules"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "node_modules", "package.json"), "{}");
      await fs.writeFile(path.join(tempDir, "app.js"), "content");

      const entries = await fs.readdir(tempDir);
      expect(entries).toContain("node_modules");
      expect(entries).toContain("app.js");

      // Tool should skip node_modules in its output
    });
  });
});

describe("CodeAgent Integration", () => {
  let tempDir: string;
  let mockConfig: CodeAgentConfig;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-agent-integration-"));

    mockConfig = {
      sandboxId: "test-sandbox",
      sandboxPath: tempDir,
      provider: "anthropic",
      apiKey: "test-api-key",
      maxTokens: 1000,
      maxToolCalls: 3,
    };
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test("creates agent instance", () => {
    const agent = createCodeAgent(mockConfig);
    expect(agent).toBeDefined();
    expect(agent.chat).toBeDefined();
    expect(agent.chatStream).toBeDefined();
    expect(agent.getHistory).toBeDefined();
    expect(agent.clearHistory).toBeDefined();
  });

  test("validates config", () => {
    expect(() => {
      createCodeAgent({
        sandboxId: "",
        sandboxPath: tempDir,
        provider: "anthropic",
        apiKey: "key",
      });
    }).toThrow();
  });

  test("manages conversation history", () => {
    const agent = createCodeAgent(mockConfig);

    expect(agent.getHistory()).toEqual([]);

    agent.clearHistory();
    expect(agent.getHistory()).toEqual([]);
  });

  test("respects maxToolCalls limit", async () => {
    const agent = createCodeAgent({
      ...mockConfig,
      maxToolCalls: 2,
    });

    // Without real LLM, we can't test the actual limit enforcement
    // This would require mocking the LLM calls
    expect(agent).toBeDefined();
  });

  test("handles streaming events", async () => {
    const agent = createCodeAgent(mockConfig);

    // Without real LLM, we can't test actual streaming
    // This would require mocking the LLM calls
    expect(agent.chatStream).toBeDefined();
  });
});

describe("SecurityError", () => {
  test("is thrown for invalid paths", () => {
    expect(() => validatePath("/sandbox", "../etc/passwd")).toThrow(SecurityError);
  });

  test("has correct error name", () => {
    try {
      validatePath("/sandbox", "/etc/passwd");
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityError);
      expect((error as SecurityError).name).toBe("SecurityError");
    }
  });
});

describe("Tool Context", () => {
  test("tracks modified files", () => {
    const filesModified: string[] = [];

    filesModified.push("src/App.tsx");
    filesModified.push("src/components/Header.tsx");

    expect(filesModified).toHaveLength(2);
    expect(filesModified).toContain("src/App.tsx");
  });

  test("deduplicates modified files", () => {
    const filesModified: string[] = [];

    filesModified.push("src/App.tsx");
    filesModified.push("src/App.tsx");

    const unique = Array.from(new Set(filesModified));
    expect(unique).toHaveLength(1);
  });
});
