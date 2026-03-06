import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { generate, generateValidated } from "./frontend-generator.js";
import type { DOMSnapshot, FrameworkInfo } from "@crayon/types";
import type { GenerationResult, FrontendGeneratorInput } from "./frontend-generator.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function createSnapshot(html: string, url = "https://example.com"): DOMSnapshot {
  return {
    id: "test-snapshot",
    timestamp: Date.now(),
    url,
    type: "full",
    html,
    viewport: { width: 1920, height: 1080 },
  };
}

function createFrameworkInfo(framework: "react" | "vue" | "angular" | "vanilla"): FrameworkInfo {
  return {
    framework,
    confidence: 0.9,
    signals: [],
  };
}

describe("generate", () => {
  describe("project structure", () => {
    it("generates all required Vite project files", async () => {
      const snapshot = createSnapshot("<div><h1>Hello</h1></div>");
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const filePaths = result.files.map((f) => f.path);

      expect(filePaths).toContain("package.json");
      expect(filePaths).toContain("vite.config.ts");
      expect(filePaths).toContain("tsconfig.json");
      expect(filePaths).toContain("tsconfig.node.json");
      expect(filePaths).toContain("index.html");
      expect(filePaths).toContain("src/main.tsx");
      expect(filePaths).toContain("src/App.tsx");
      expect(filePaths).toContain("src/index.css");
    }, 30000);

    it("generates valid package.json with React dependencies", async () => {
      const snapshot = createSnapshot("<div>Hello</div>");
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pkgFile = result.files.find((f) => f.path === "package.json");
      expect(pkgFile).toBeDefined();

      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.dependencies.react).toBeDefined();
      expect(pkg.dependencies["react-dom"]).toBeDefined();
      expect(pkg.dependencies["react-router-dom"]).toBeDefined();
      expect(pkg.scripts.dev).toBe("vite");
      expect(pkg.scripts.build).toContain("vite build");
    }, 30000);

    it("generates valid vite.config.ts with React plugin", async () => {
      const snapshot = createSnapshot("<div>Hello</div>");
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const viteConfig = result.files.find((f) => f.path === "vite.config.ts");
      expect(viteConfig).toBeDefined();
      expect(viteConfig!.content).toContain("@vitejs/plugin-react");
      expect(viteConfig!.content).toContain("defineConfig");
    });
  });

  describe("DOM to component conversion", () => {
    it("converts simple HTML to React component", async () => {
      const snapshot = createSnapshot("<div><h1>Hello World</h1></div>");
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain("export function Home()");
      expect(pageFile!.content).toContain("<div>");
      expect(pageFile!.content).toContain("<h1>");
      expect(pageFile!.content).toContain("Hello World");
    }, 30000);

    it("preserves element classes", async () => {
      const snapshot = createSnapshot('<div class="container"><p class="text">Hello</p></div>');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain('className="container');
      expect(pageFile!.content).toContain('className="text');
    }, 30000);

    it("preserves element IDs", async () => {
      const snapshot = createSnapshot('<div id="main-content"><h1 id="title">Hello</h1></div>');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain('id="main-content"');
      expect(pageFile!.content).toContain('id="title"');
    }, 30000);

    it("handles self-closing tags correctly", async () => {
      const snapshot = createSnapshot('<div><img src="logo.png" alt="Logo" /><br /></div>');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain("<img");
      expect(pageFile!.content).toContain('src="logo.png"');
    }, 30000);

    it("handles nested elements", async () => {
      const snapshot = createSnapshot(`
        <div class="outer">
          <div class="inner">
            <span>Nested content</span>
          </div>
        </div>
      `);
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain('className="outer');
      expect(pageFile!.content).toContain('className="inner');
      expect(pageFile!.content).toContain("<span>");
    });
  });

  describe("inline styles extraction", () => {
    it("extracts inline styles to CSS file", async () => {
      const snapshot = createSnapshot('<div style="color: red; font-size: 16px;">Styled</div>');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const cssFile = result.files.find((f) => f.path.includes("styles/Home.css"));
      expect(cssFile).toBeDefined();
      expect(cssFile!.content).toContain("color: red");
      expect(cssFile!.content).toContain("font-size: 16px");
    }, 30000);

    it("adds generated class to component", async () => {
      const snapshot = createSnapshot('<div style="margin: 10px;">Content</div>');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain("className=");
      expect(pageFile!.content).toContain("style-");
    }, 30000);

    it("preserves existing class along with generated style class", async () => {
      const snapshot = createSnapshot(
        '<div class="container" style="padding: 20px;">Content</div>'
      );
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain("container");
      expect(pageFile!.content).toContain("style-");
    }, 30000);

    it("converts kebab-case CSS properties to camelCase in processing", async () => {
      const snapshot = createSnapshot(
        '<div style="background-color: blue; font-weight: bold;">Text</div>'
      );
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const cssFile = result.files.find((f) => f.path.includes("styles/Home.css"));
      expect(cssFile).toBeDefined();
      // Output should be kebab-case in CSS
      expect(cssFile!.content).toContain("background-color: blue");
      expect(cssFile!.content).toContain("font-weight: bold");
    });
  });

  describe("route generation", () => {
    it("generates routes from multiple pages", async () => {
      const snapshots = [
        createSnapshot("<div>Home</div>", "https://example.com/"),
        createSnapshot("<div>About</div>", "https://example.com/about"),
        createSnapshot("<div>Contact</div>", "https://example.com/contact"),
      ];
      const result = await generate(snapshots, createFrameworkInfo("react"));

      expect(result.routes).toHaveLength(3);
      expect(result.routes.map((r) => r.path)).toContain("/");
      expect(result.routes.map((r) => r.path)).toContain("/about");
      expect(result.routes.map((r) => r.path)).toContain("/contact");
    }, 30000);

    it("generates correct component names from URLs", async () => {
      const snapshots = [
        createSnapshot("<div>Home</div>", "https://example.com/"),
        createSnapshot("<div>User Profile</div>", "https://example.com/user-profile"),
        createSnapshot("<div>Settings</div>", "https://example.com/settings/account"),
      ];
      const result = await generate(snapshots, createFrameworkInfo("react"));

      const componentNames = result.routes.map((r) => r.component);
      expect(componentNames).toContain("Home");
      expect(componentNames).toContain("UserProfile");
      expect(componentNames).toContain("SettingsAccount");
    }, 30000);

    it("generates page files for each route", async () => {
      const snapshots = [
        createSnapshot("<div>Home</div>", "https://example.com/"),
        createSnapshot("<div>About</div>", "https://example.com/about"),
      ];
      const result = await generate(snapshots, createFrameworkInfo("react"));

      const pageFiles = result.files.filter((f) => f.path.startsWith("src/pages/"));
      expect(pageFiles).toHaveLength(2);

      const pagePaths = pageFiles.map((f) => f.path);
      expect(pagePaths).toContain("src/pages/Home.tsx");
      expect(pagePaths).toContain("src/pages/About.tsx");
    }, 30000);

    it("generates App.tsx with route definitions", async () => {
      const snapshots = [
        createSnapshot("<div>Home</div>", "https://example.com/"),
        createSnapshot("<div>About</div>", "https://example.com/about"),
      ];
      const result = await generate(snapshots, createFrameworkInfo("react"));

      const appFile = result.files.find((f) => f.path === "src/App.tsx");
      expect(appFile).toBeDefined();
      expect(appFile!.content).toContain("import { Routes, Route }");
      expect(appFile!.content).toContain('path="/"');
      expect(appFile!.content).toContain('path="/about"');
      expect(appFile!.content).toContain("element={<Home />}");
      expect(appFile!.content).toContain("element={<About />}");
    }, 30000);

    it("deduplicates routes for same path", async () => {
      const snapshots = [
        createSnapshot("<div>Home v1</div>", "https://example.com/"),
        createSnapshot("<div>Home v2</div>", "https://example.com/"),
      ];
      const result = await generate(snapshots, createFrameworkInfo("react"));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe("/");
    });
  });

  describe("edge cases", () => {
    it("handles empty snapshots array", async () => {
      const result = await generate([], createFrameworkInfo("react"));

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe("/");
      expect(result.routes[0].component).toBe("Home");
    }, 30000);

    it("handles snapshots without HTML", async () => {
      const snapshot: DOMSnapshot = {
        id: "test",
        timestamp: Date.now(),
        url: "https://example.com",
        type: "diff",
        viewport: { width: 1920, height: 1080 },
      };
      const result = await generate([snapshot], createFrameworkInfo("react"));

      // Should create a default home page
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].component).toBe("Home");
    }, 30000);

    it("handles complex real-world HTML", async () => {
      const snapshot = createSnapshot(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Test Page</title>
          </head>
          <body>
            <header class="main-header">
              <nav id="nav">
                <ul>
                  <li><a href="/">Home</a></li>
                  <li><a href="/about">About</a></li>
                </ul>
              </nav>
            </header>
            <main>
              <article class="content">
                <h1>Welcome</h1>
                <p>This is a paragraph.</p>
              </article>
            </main>
            <footer>
              <p>&copy; 2024</p>
            </footer>
          </body>
        </html>
      `);
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain("export function Home()");
    }, 30000);

    it("skips script and style tags", async () => {
      const snapshot = createSnapshot(`
        <div>
          <script>console.log("test");</script>
          <style>.test { color: red; }</style>
          <p>Visible content</p>
        </div>
      `);
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).not.toContain("<script>");
      expect(pageFile!.content).not.toContain("<style>");
      expect(pageFile!.content).toContain("Visible content");
    }, 30000);

    it("handles special characters in text content", async () => {
      const snapshot = createSnapshot("<div>Price: $100 &amp; Tax: &lt;10%&gt;</div>");
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
    }, 30000);

    it("handles attributes with special characters", async () => {
      const snapshot = createSnapshot('<img alt="Image with \\"quotes\\"" />');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
    }, 30000);

    it("ensures unique component names for duplicate routes", async () => {
      const snapshots = [
        createSnapshot("<div>Home 1</div>", "https://example.com/page"),
        createSnapshot("<div>Home 2</div>", "https://other.com/page"),
      ];
      const result = await generate(snapshots, createFrameworkInfo("react"));

      const componentNames = result.routes.map((r) => r.component);
      const uniqueNames = new Set(componentNames);
      expect(uniqueNames.size).toBe(componentNames.length);
    });
  });

  describe("framework output", () => {
    it("returns react as framework for React input", async () => {
      const snapshot = createSnapshot("<div>Hello</div>");
      const result = await generate([snapshot], createFrameworkInfo("react"));

      expect(result.framework).toBe("react");
    }, 30000);

    it("returns react as framework for Vue input (generates React)", async () => {
      const snapshot = createSnapshot("<div>Hello</div>");
      const result = await generate([snapshot], createFrameworkInfo("vue"));

      expect(result.framework).toBe("react");
    }, 30000);

    it("returns vanilla for vanilla input", async () => {
      const snapshot = createSnapshot("<div>Hello</div>");
      const result = await generate([snapshot], createFrameworkInfo("vanilla"));

      expect(result.framework).toBe("vanilla");
    });
  });

  describe("CSS file generation", () => {
    it("generates separate CSS file for each page", async () => {
      const snapshots = [
        createSnapshot('<div style="color: red;">Home</div>', "https://example.com/"),
        createSnapshot('<div style="color: blue;">About</div>', "https://example.com/about"),
      ];
      const result = await generate(snapshots, createFrameworkInfo("react"));

      const cssFiles = result.files.filter((f) => f.path.includes("/styles/"));
      expect(cssFiles).toHaveLength(2);
      expect(cssFiles.map((f) => f.path)).toContain("src/styles/Home.css");
      expect(cssFiles.map((f) => f.path)).toContain("src/styles/About.css");
    }, 30000);

    it("imports CSS file in page component", async () => {
      const snapshot = createSnapshot('<div style="margin: 10px;">Content</div>');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain('import "./styles/Home.css"');
    }, 30000);

    it("generates base index.css", async () => {
      const snapshot = createSnapshot("<div>Hello</div>");
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const indexCss = result.files.find((f) => f.path === "src/index.css");
      expect(indexCss).toBeDefined();
      expect(indexCss!.content).toContain("box-sizing: border-box");
    });
  });

  describe("attribute conversion", () => {
    it("converts class to className", async () => {
      const snapshot = createSnapshot('<div class="test">Hello</div>');
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).toContain("className");
      expect(pageFile!.content).not.toContain('class="');
    }, 30000);

    it("skips framework-specific attributes", async () => {
      const snapshot = createSnapshot(`
        <div data-reactroot="" data-v-abc123="" _ngcontent-abc="">
          Content
        </div>
      `);
      const result = await generate([snapshot], createFrameworkInfo("react"));

      const pageFile = result.files.find((f) => f.path.includes("pages/Home.tsx"));
      expect(pageFile).toBeDefined();
      expect(pageFile!.content).not.toContain("data-reactroot");
      expect(pageFile!.content).not.toContain("data-v-");
      expect(pageFile!.content).not.toContain("_ngcontent");
    });
  });
});

// ==================== NEW VALIDATION WRAPPER TESTS (SPEC 12) ====================

describe("generateValidated", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "crayon-test-"));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createGenerationResult(
    files: { path: string; content: string }[],
    packages: string[] = []
  ): GenerationResult {
    return {
      files,
      packages,
      components: files
        .filter(f => f.path.endsWith(".tsx"))
        .map(f => path.basename(f.path, ".tsx")),
      warnings: [],
      metadata: {
        provider: "test",
        model: "test-model",
        tokensUsed: 1000,
        durationMs: 500,
      },
    };
  }

  describe("TypeScript validation", () => {
    it("validates valid TypeScript files successfully", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() {
  return <div>Hello World</div>;
}`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project1"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // TypeScript validation should pass without errors
      expect(result.errors.filter(e => e.includes("TypeScript"))).toHaveLength(0);
    }, 30000); // Increase timeout for npm install

    it("detects TypeScript syntax errors", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() {
  return <div>Hello World<div>;  // Missing closing tag
}`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project2"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Should have TypeScript errors
      expect(result.errors.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Tailwind class validation", () => {
    it("accepts valid Tailwind classes", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() {
  return <div className="flex items-center justify-center p-4 bg-white">Hello</div>;
}`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project3"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Should have no warnings about Tailwind classes
      const tailwindWarnings = result.warnings.filter(w => w.includes("Unknown Tailwind class"));
      expect(tailwindWarnings).toHaveLength(0);
    }, 30000);

    it("warns about unknown CSS classes", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() {
  return <div className="some-custom-class-that-is-not-tailwind">Hello</div>;
}`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project4"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Should warn about unknown class
      const tailwindWarnings = result.warnings.filter(w => w.includes("Unknown Tailwind class"));
      expect(tailwindWarnings.length).toBeGreaterThan(0);
    }, 30000);

    it("does not crash on dynamic class names", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() {
  const classNameValue = "flex";
  return <div className={classNameValue}>Hello</div>;
}`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project5"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Function should complete without crashing
      expect(result.projectPath).toBe(path.join(tempDir, "project5"));
      expect(result.files.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("import validation", () => {
    it("validates imports against provided packages", async () => {
      const generationResult = createGenerationResult(
        [
          {
            path: "src/App.tsx",
            content: `import { useState } from "react";
import axios from "axios";

export function App() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`,
          },
        ],
        ["axios"]
      );

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project6"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Should not have import errors
      const importErrors = result.errors.filter(e => e.includes("Missing dependency"));
      expect(importErrors).toHaveLength(0);
    }, 30000);

    it("detects missing dependencies", async () => {
      const generationResult = createGenerationResult(
        [
          {
            path: "src/App.tsx",
            content: `import axios from "axios";
export function App() {
  return <div>Hello</div>;
}`,
          },
        ],
        [] // axios not in packages
      );

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project7"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Should have error about missing axios
      const importErrors = result.errors.filter(e => e.includes("Missing dependency"));
      expect(importErrors.length).toBeGreaterThan(0);
      expect(importErrors.some(e => e.includes("axios"))).toBe(true);
    }, 30000);

    it("ignores relative imports", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `import { Button } from "./components/Button";
export function App() {
  return <Button />;
}`,
        },
        {
          path: "src/components/Button.tsx",
          content: `export function Button() {
  return <button>Click me</button>;
}`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project8"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Should not error on relative imports
      const importErrors = result.errors.filter(e => e.includes("Missing dependency"));
      expect(importErrors).toHaveLength(0);
    }, 30000);
  });

  describe("project structure creation", () => {
    it("creates all necessary directories", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project9"),
        framework: "react",
      };

      await generateValidated(input);

      // Check directories exist
      await expect(fs.access(path.join(tempDir, "project9"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(tempDir, "project9", "src"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(tempDir, "project9", "public"))).resolves.toBeUndefined();
    }, 30000);

    it("writes all AI-generated files", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
        {
          path: "src/components/Button.tsx",
          content: `export function Button() { return <button>Click</button>; }`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project10"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Check files were written
      await expect(
        fs.access(path.join(tempDir, "project10", "src", "App.tsx"))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(tempDir, "project10", "src", "components", "Button.tsx"))
      ).resolves.toBeUndefined();

      expect(result.files).toContain("src/App.tsx");
      expect(result.files).toContain("src/components/Button.tsx");
    }, 30000);

    it("generates config files", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project11"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Check config files
      await expect(
        fs.access(path.join(tempDir, "project11", "package.json"))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(tempDir, "project11", "vite.config.ts"))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(tempDir, "project11", "tsconfig.json"))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(tempDir, "project11", "tailwind.config.ts"))
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(tempDir, "project11", "postcss.config.js"))
      ).resolves.toBeUndefined();

      expect(result.files).toContain("package.json");
      expect(result.files).toContain("vite.config.ts");
      expect(result.files).toContain("tsconfig.json");
      expect(result.files).toContain("tailwind.config.ts");
    }, 30000);

    it("generates index.html if not provided", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project12"),
        framework: "react",
      };

      const result = await generateValidated(input);

      // Check index.html was generated
      await expect(
        fs.access(path.join(tempDir, "project12", "index.html"))
      ).resolves.toBeUndefined();

      expect(result.files).toContain("index.html");
    }, 30000);

    it("uses provided index.html if present", async () => {
      const customHtml = `<!DOCTYPE html><html><body><div id="app"></div></body></html>`;
      const generationResult = createGenerationResult([
        {
          path: "index.html",
          content: customHtml,
        },
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project13"),
        framework: "react",
      };

      await generateValidated(input);

      const html = await fs.readFile(path.join(tempDir, "project13", "index.html"), "utf-8");
      expect(html).toContain("app");
      expect(html).toBe(customHtml);
    });
  });

  describe("package.json generation", () => {
    it("includes detected packages in dependencies", async () => {
      const generationResult = createGenerationResult(
        [
          {
            path: "src/App.tsx",
            content: `export function App() { return <div>Hello</div>; }`,
          },
        ],
        ["axios", "lodash", "date-fns"]
      );

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project14"),
        framework: "react",
      };

      await generateValidated(input);

      const pkgJson = JSON.parse(
        await fs.readFile(path.join(tempDir, "project14", "package.json"), "utf-8")
      );

      expect(pkgJson.dependencies).toHaveProperty("axios");
      expect(pkgJson.dependencies).toHaveProperty("lodash");
      expect(pkgJson.dependencies).toHaveProperty("date-fns");
    }, 30000);

    it("includes React and Vite dependencies", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project15"),
        framework: "react",
      };

      await generateValidated(input);

      const pkgJson = JSON.parse(
        await fs.readFile(path.join(tempDir, "project15", "package.json"), "utf-8")
      );

      expect(pkgJson.dependencies).toHaveProperty("react");
      expect(pkgJson.dependencies).toHaveProperty("react-dom");
      expect(pkgJson.devDependencies).toHaveProperty("vite");
      expect(pkgJson.devDependencies).toHaveProperty("typescript");
      expect(pkgJson.devDependencies).toHaveProperty("tailwindcss");
    }, 30000);

    it("includes build scripts", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
      ]);

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project16"),
        framework: "react",
      };

      await generateValidated(input);

      const pkgJson = JSON.parse(
        await fs.readFile(path.join(tempDir, "project16", "package.json"), "utf-8")
      );

      expect(pkgJson.scripts).toHaveProperty("dev");
      expect(pkgJson.scripts).toHaveProperty("build");
      expect(pkgJson.scripts.dev).toBe("vite");
      expect(pkgJson.scripts.build).toContain("vite build");
    });
  });

  describe("output structure", () => {
    it("returns correct output structure", async () => {
      const generationResult = createGenerationResult(
        [
          {
            path: "src/App.tsx",
            content: `export function App() { return <div>Hello</div>; }`,
          },
        ],
        ["axios"]
      );

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project17"),
        framework: "react",
      };

      const result = await generateValidated(input);

      expect(result.projectPath).toBe(path.join(tempDir, "project17"));
      expect(Array.isArray(result.files)).toBe(true);
      expect(Array.isArray(result.packages)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.buildSuccess).toBe("boolean");

      expect(result.packages).toContain("axios");
    }, 30000);

    it("preserves warnings from generation result", async () => {
      const generationResult = createGenerationResult([
        {
          path: "src/App.tsx",
          content: `export function App() { return <div>Hello</div>; }`,
        },
      ]);
      generationResult.warnings = ["Test warning from AI"];

      const input: FrontendGeneratorInput = {
        generationResult,
        projectPath: path.join(tempDir, "project18"),
        framework: "react",
      };

      const result = await generateValidated(input);

      expect(result.warnings).toContain("Test warning from AI");
    }, 30000);
  });
});
