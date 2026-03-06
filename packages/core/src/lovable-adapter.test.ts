/**
 * Tests for Lovable Adapter
 */

import { describe, it, expect } from "vitest";
import {
  parseFiles,
  parsePackages,
  parseComponents,
  detectTruncation,
  validateRelativeImports,
  type GenerationFile,
} from "./lovable-adapter.js";

describe("parseFiles", () => {
  it("should parse single file from XML tags", () => {
    const content = `
      <file path="src/App.tsx">
import React from 'react';

function App() {
  return <div>Hello World</div>;
}

export default App;
      </file>
    `;

    const files = parseFiles(content);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/App.tsx");
    expect(files[0].content).toContain("import React");
    expect(files[0].content).toContain("function App()");
  });

  it("should parse multiple files from XML tags", () => {
    const content = `
      <file path="src/App.tsx">
import React from 'react';
      </file>

      <file path="src/Header.tsx">
export function Header() {
  return <header>Header</header>;
}
      </file>
    `;

    const files = parseFiles(content);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("src/App.tsx");
    expect(files[1].path).toBe("src/Header.tsx");
  });

  it("should handle files with special characters", () => {
    const content = `
      <file path="src/components/Button.tsx">
const Button = () => {
  return <button className="bg-blue-500">Click me</button>;
};
      </file>
    `;

    const files = parseFiles(content);
    expect(files).toHaveLength(1);
    expect(files[0].content).toContain('className="bg-blue-500"');
  });

  it("should return empty array when no files found", () => {
    const content = "Some random text without file tags";
    const files = parseFiles(content);
    expect(files).toHaveLength(0);
  });

  it("should handle files with nested XML-like content", () => {
    const content = `
      <file path="src/App.tsx">
function App() {
  return <div><span>Text</span></div>;
}
      </file>
    `;

    const files = parseFiles(content);
    expect(files).toHaveLength(1);
    expect(files[0].content).toContain("<div><span>Text</span></div>");
  });
});

describe("parsePackages", () => {
  it("should parse packages from <package> tags", () => {
    const content = `
      <package>react-router-dom</package>
      <package>@radix-ui/react-dialog</package>
      <file path="src/App.tsx">
import React from 'react';
      </file>
    `;

    const packages = parsePackages(content);
    expect(packages).toContain("react-router-dom");
    expect(packages).toContain("@radix-ui/react-dialog");
  });

  it("should parse packages from <packages> tag with comma separation", () => {
    const content = `
      <packages>react-router-dom, @radix-ui/react-dialog, axios</packages>
    `;

    const packages = parsePackages(content);
    expect(packages).toContain("react-router-dom");
    expect(packages).toContain("@radix-ui/react-dialog");
    expect(packages).toContain("axios");
  });

  it("should parse packages from import statements", () => {
    const content = `
      import { useState } from 'react';
      import { BrowserRouter } from 'react-router-dom';
      import axios from 'axios';
      import './styles.css';
      import { helper } from './utils/helper';
    `;

    const packages = parsePackages(content);
    expect(packages).toContain("react-router-dom");
    expect(packages).toContain("axios");
    expect(packages).not.toContain("react"); // Should skip react built-ins
  });

  it("should handle scoped packages correctly", () => {
    const content = `
      import { Dialog } from '@radix-ui/react-dialog';
      import { Button } from '@radix-ui/react-button';
    `;

    const packages = parsePackages(content);
    expect(packages).toContain("@radix-ui/react-dialog");
    expect(packages).toContain("@radix-ui/react-button");
  });

  it("should ignore relative imports", () => {
    const content = `
      import { Component } from './Component';
      import { util } from '../utils';
      import { config } from '/config';
    `;

    const packages = parsePackages(content);
    expect(packages).toHaveLength(0);
  });

  it("should ignore Node.js built-ins", () => {
    const content = `
      import fs from 'fs';
      import path from 'path';
      import http from 'http';
      import axios from 'axios';
    `;

    const packages = parsePackages(content);
    expect(packages).toContain("axios");
    expect(packages).not.toContain("fs");
    expect(packages).not.toContain("path");
    expect(packages).not.toContain("http");
  });

  it("should return unique sorted packages", () => {
    const content = `
      <package>axios</package>
      <package>react-router-dom</package>
      <package>axios</package>
      import axios from 'axios';
    `;

    const packages = parsePackages(content);
    expect(packages).toEqual(["axios", "react-router-dom"]);
  });
});

describe("parseComponents", () => {
  it("should parse component from function declaration", () => {
    const files: GenerationFile[] = [
      {
        path: "src/Header.tsx",
        content: "export function Header() { return <header>Header</header>; }",
      },
    ];

    const components = parseComponents(files);
    expect(components).toContain("Header");
  });

  it("should parse component from const declaration", () => {
    const files: GenerationFile[] = [
      {
        path: "src/Button.tsx",
        content: "export const Button = () => { return <button>Click</button>; }",
      },
    ];

    const components = parseComponents(files);
    expect(components).toContain("Button");
  });

  it("should parse default export component", () => {
    const files: GenerationFile[] = [
      {
        path: "src/App.tsx",
        content: "export default function App() { return <div>App</div>; }",
      },
    ];

    const components = parseComponents(files);
    expect(components).toContain("App");
  });

  it("should parse multiple components from multiple files", () => {
    const files: GenerationFile[] = [
      {
        path: "src/Header.tsx",
        content: "export function Header() { return <header>Header</header>; }",
      },
      {
        path: "src/Footer.tsx",
        content: "export const Footer = () => { return <footer>Footer</footer>; }",
      },
      {
        path: "src/App.tsx",
        content: "export default function App() { return <div>App</div>; }",
      },
    ];

    const components = parseComponents(files);
    expect(components).toContain("Header");
    expect(components).toContain("Footer");
    expect(components).toContain("App");
    expect(components).toHaveLength(3);
  });

  it("should only match capitalized component names", () => {
    const files: GenerationFile[] = [
      {
        path: "src/utils.ts",
        content: "export function helper() { return 'help'; }",
      },
      {
        path: "src/Component.tsx",
        content: "export function Component() { return <div>Component</div>; }",
      },
    ];

    const components = parseComponents(files);
    expect(components).toContain("Component");
    expect(components).not.toContain("helper");
  });

  it("should return unique sorted components", () => {
    const files: GenerationFile[] = [
      {
        path: "src/Button.tsx",
        content: `
          export const Button = () => <button>Click</button>;
          export function ButtonGroup() { return <div>Group</div>; }
        `,
      },
    ];

    const components = parseComponents(files);
    expect(components).toEqual(["Button", "ButtonGroup"]);
  });
});

describe("detectTruncation", () => {
  it("should detect unclosed file tags", () => {
    const content = `
      <file path="src/App.tsx">
import React from 'react';
      <file path="src/Header.tsx">
export function Header() {}
      </file>
    `;

    const files = parseFiles(content);
    const warnings = detectTruncation(content, files);
    expect(warnings.some(w => w.includes("unclosed file tags"))).toBe(true);
  });

  it("should detect mismatched braces", () => {
    const files: GenerationFile[] = [
      {
        path: "src/App.tsx",
        content: "function App() { return <div>App</div>;",
      },
    ];

    const warnings = detectTruncation("", files);
    expect(warnings.some(w => w.includes("mismatched braces"))).toBe(true);
  });

  it("should detect mismatched brackets", () => {
    const files: GenerationFile[] = [
      {
        path: "src/data.ts",
        content: "const items = [1, 2, 3;",
      },
    ];

    const warnings = detectTruncation("", files);
    expect(warnings.some(w => w.includes("mismatched brackets"))).toBe(true);
  });

  it("should detect suspiciously short files", () => {
    const files: GenerationFile[] = [
      {
        path: "src/App.tsx",
        content: "import React;",
      },
    ];

    const warnings = detectTruncation("", files);
    expect(warnings.some(w => w.includes("suspiciously short"))).toBe(true);
  });

  it("should not warn about short config files", () => {
    const files: GenerationFile[] = [
      {
        path: "vite.config.ts",
        content: "export {}",
      },
    ];

    const warnings = detectTruncation("", files);
    expect(warnings.some(w => w.includes("suspiciously short"))).toBe(false);
  });

  it("should detect ellipsis placeholders", () => {
    const files: GenerationFile[] = [
      {
        path: "src/App.tsx",
        content: `
function App() {
  // ... rest of the implementation
  return <div>App</div>;
}
        `,
      },
    ];

    const warnings = detectTruncation("", files);
    expect(warnings.some(w => w.includes("ellipsis"))).toBe(true);
  });

  it("should return empty array for valid complete files", () => {
    const content = `
      <file path="src/App.tsx">
import React from 'react';

function App() {
  return <div>Complete App</div>;
}

export default App;
      </file>
    `;

    const files = parseFiles(content);
    const warnings = detectTruncation(content, files);
    expect(warnings).toHaveLength(0);
  });

  it("should detect multiple issues in one file", () => {
    const files: GenerationFile[] = [
      {
        path: "src/App.tsx",
        content: "function App() { const items = [1, 2;",
      },
    ];

    const warnings = detectTruncation("", files);
    expect(warnings.length).toBeGreaterThan(1);
    expect(warnings.some(w => w.includes("mismatched braces"))).toBe(true);
    expect(warnings.some(w => w.includes("mismatched brackets"))).toBe(true);
  });
});

describe("validateRelativeImports", () => {
  it("should detect unresolved relative imports", () => {
    const files = [
      {
        path: "src/App.tsx",
        content: `import { HomePage } from "./pages/HomePage";\nimport { Missing } from "./components/Missing";`
      },
      { path: "src/pages/HomePage.tsx", content: "export function HomePage() {}" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Missing");
  });

  it("should pass when all imports resolve", () => {
    const files = [
      { path: "src/App.tsx", content: `import { HomePage } from "./pages/HomePage";` },
      { path: "src/pages/HomePage.tsx", content: "export function HomePage() {}" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(0);
  });

  it("should handle index files", () => {
    const files = [
      { path: "src/App.tsx", content: `import { Button } from "./components";` },
      { path: "src/components/index.tsx", content: "export function Button() {}" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(0);
  });

  it("should handle parent directory imports", () => {
    const files = [
      { path: "src/pages/HomePage.tsx", content: `import { Button } from "../components/Button";` },
      { path: "src/components/Button.tsx", content: "export function Button() {}" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(0);
  });

  it("should handle same-directory imports", () => {
    const files = [
      { path: "src/components/Button.tsx", content: `import { Icon } from "./Icon";` },
      { path: "src/components/Icon.tsx", content: "export function Icon() {}" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(0);
  });

  it("should handle imports with explicit extensions", () => {
    const files = [
      { path: "src/App.tsx", content: `import { utils } from "./utils.ts";` },
      { path: "src/utils.ts", content: "export const utils = {};" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(0);
  });

  it("should handle multiple unresolved imports", () => {
    const files = [
      {
        path: "src/App.tsx",
        content: `
import { Missing1 } from "./components/Missing1";
import { Missing2 } from "./pages/Missing2";
import { Valid } from "./components/Valid";
        `
      },
      { path: "src/components/Valid.tsx", content: "export function Valid() {}" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(2);
    expect(errors.some(e => e.includes("Missing1"))).toBe(true);
    expect(errors.some(e => e.includes("Missing2"))).toBe(true);
  });

  it("should handle CSS imports without error", () => {
    const files = [
      { path: "src/App.tsx", content: `import "./styles.css";` },
      { path: "src/styles.css", content: "body { margin: 0; }" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(0);
  });

  it("should detect missing CSS imports", () => {
    const files = [
      { path: "src/App.tsx", content: `import "./missing.css";` },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("missing.css");
  });

  it("should handle files in root directory", () => {
    const files = [
      { path: "App.tsx", content: `import { utils } from "./utils";` },
      { path: "utils.ts", content: "export const utils = {};" },
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(0);
  });

  it("should detect unresolved imports that indicate truncation", () => {
    // This simulates what happens when LLM truncates output
    // The App.tsx references components that were never generated
    const files = [
      {
        path: "src/App.tsx",
        content: `
import { LoginPage } from "./components/LoginPage";
import { Dashboard } from "./components/Dashboard";
import { VerificationPage } from "./components/VerificationPage";

function App() {
  return <LoginPage />;
}
        `
      },
      { path: "src/components/LoginPage.tsx", content: "export function LoginPage() {}" },
      { path: "src/components/Dashboard.tsx", content: "export function Dashboard() {}" },
      // Note: VerificationPage is missing - simulating truncation
    ];

    const errors = validateRelativeImports(files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("VerificationPage");
  });
});
