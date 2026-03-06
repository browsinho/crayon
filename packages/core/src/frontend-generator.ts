/**
 * Frontend Generator - Validates AI-generated frontend code and creates production-ready Vite project
 *
 * Architecture change: This module now validates/packages AI-generated code from Lovable Adapter (spec 30)
 * instead of directly converting DOM to React.
 *
 * Responsibilities:
 * - Validate TypeScript/JSX files compile
 * - Validate Tailwind classes
 * - Create complete Vite project structure
 * - Install npm packages
 * - Run build verification
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { DOMSnapshot, FrameworkInfo } from "@crayon/types";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedRoute {
  path: string;
  component: string;
}

export interface GeneratedFrontend {
  framework: "react" | "vanilla";
  files: GeneratedFile[];
  routes: GeneratedRoute[];
}

// New interfaces for validation wrapper (spec 12)

export interface GenerationResult {
  files: {
    path: string;
    content: string;
  }[];
  packages: string[];
  components: string[];
  warnings: string[];
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    durationMs: number;
  };
}

export interface FrontendGeneratorInput {
  generationResult: GenerationResult;
  projectPath: string;
  framework: "react";
}

export interface FrontendGeneratorOutput {
  projectPath: string;
  files: string[];
  packages: string[];
  buildSuccess: boolean;
  errors: string[];
  warnings: string[];
}

interface ComponentNode {
  tag: string;
  className?: string;
  id?: string;
  styles: Record<string, string>;
  attributes: Record<string, string>;
  children: (ComponentNode | string)[];
}

interface ExtractedStyle {
  className: string;
  properties: Record<string, string>;
}

interface PageInfo {
  url: string;
  routePath: string;
  componentName: string;
  html: string;
}

/**
 * Convert CSS property name from kebab-case to camelCase
 */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to kebab-case for CSS output
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Parse inline style string into an object
 */
function parseInlineStyle(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!style) return result;

  const declarations = style.split(";").filter((d) => d.trim());
  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) continue;

    const property = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();

    if (property && value) {
      result[kebabToCamel(property)] = value;
    }
  }

  return result;
}

/**
 * Generate a unique class name for extracted styles
 */
function generateClassName(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

/**
 * Convert a URL path to a valid component name
 */
function urlToComponentName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Handle root path
    if (pathname === "/" || pathname === "") {
      return "Home";
    }

    // Convert path segments to PascalCase
    const segments = pathname
      .split("/")
      .filter((s) => s && !s.startsWith(":") && !s.match(/^\d+$/));

    if (segments.length === 0) {
      return "Home";
    }

    return segments
      .map((segment) => {
        // Remove file extensions
        const name = segment.replace(/\.[^/.]+$/, "");
        // Convert to PascalCase
        return name
          .split(/[-_]/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join("");
      })
      .join("");
  } catch {
    return "Page";
  }
}

/**
 * Convert a URL to a route path
 */
function urlToRoutePath(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname === "" ? "/" : pathname;
  } catch {
    return "/";
  }
}

/**
 * Parse HTML string into a simplified DOM structure
 */
function parseHtml(html: string): ComponentNode | null {
  // Simple regex-based HTML parser for basic structure extraction
  // This handles most common HTML patterns

  const trimmed = html.trim();
  if (!trimmed) return null;

  // Find the body content or use full HTML
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : trimmed;

  return parseElement(content);
}

/**
 * Parse a single HTML element
 */
function parseElement(html: string): ComponentNode | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  // Skip script and style tags
  if (trimmed.match(/^<(script|style|noscript|link|meta)/i)) {
    return null;
  }

  // Check if it's a tag
  const tagMatch = trimmed.match(/^<(\w+)([^>]*)>/);
  if (!tagMatch) {
    // It's text content
    return null;
  }

  const tag = tagMatch[1].toLowerCase();
  const attributeStr = tagMatch[2];

  // Skip non-visual elements
  if (["head", "script", "style", "noscript", "link", "meta", "title"].includes(tag)) {
    return null;
  }

  // Parse attributes
  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+(?:-\w+)*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(attributeStr)) !== null) {
    const attrName = attrMatch[1];
    const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
    attributes[attrName] = attrValue;
  }

  // Handle boolean attributes
  const boolAttrRegex = /\s(\w+)(?=\s|>|$)/g;
  let boolMatch;
  while ((boolMatch = boolAttrRegex.exec(attributeStr)) !== null) {
    if (!attributes[boolMatch[1]]) {
      attributes[boolMatch[1]] = "true";
    }
  }

  // Extract inline styles
  const styles = parseInlineStyle(attributes["style"] ?? "");
  delete attributes["style"];

  // Extract class and id
  const className = attributes["class"];
  const id = attributes["id"];
  delete attributes["class"];
  delete attributes["id"];

  // Handle self-closing tags
  const selfClosing = ["img", "br", "hr", "input", "meta", "link", "area", "base", "col"];
  if (selfClosing.includes(tag) || attributeStr.endsWith("/")) {
    return {
      tag,
      className,
      id,
      styles,
      attributes,
      children: [],
    };
  }

  // Find matching closing tag (accounting for nesting)
  const openingTagRegex = new RegExp(`<${tag}[^>]*>`, "gi");
  const closingTagRegex = new RegExp(`</${tag}>`, "gi");

  let depth = 1;
  let searchIndex = tagMatch[0].length;
  let closeIndex = -1;

  while (depth > 0 && searchIndex < trimmed.length) {
    openingTagRegex.lastIndex = searchIndex;
    closingTagRegex.lastIndex = searchIndex;

    const openMatch = openingTagRegex.exec(trimmed);
    const closeMatch = closingTagRegex.exec(trimmed);

    if (!closeMatch) break;

    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      searchIndex = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      if (depth === 0) {
        closeIndex = closeMatch.index;
      } else {
        searchIndex = closeMatch.index + closeMatch[0].length;
      }
    }
  }

  if (closeIndex === -1) {
    return {
      tag,
      className,
      id,
      styles,
      attributes,
      children: [],
    };
  }

  const innerHtml = trimmed.slice(tagMatch[0].length, closeIndex);
  const children = parseChildren(innerHtml);

  return {
    tag,
    className,
    id,
    styles,
    attributes,
    children,
  };
}

/**
 * Parse children from HTML content
 */
function parseChildren(html: string): (ComponentNode | string)[] {
  const children: (ComponentNode | string)[] = [];
  const trimmed = html.trim();
  if (!trimmed) return children;

  // Split by top-level tags
  let currentIndex = 0;
  const tagPattern = /<(\w+)([^>]*)>/g;
  let match;

  while ((match = tagPattern.exec(trimmed)) !== null) {
    // Add text before this tag
    const textBefore = trimmed.slice(currentIndex, match.index).trim();
    if (textBefore) {
      children.push(textBefore);
    }

    const tag = match[1].toLowerCase();
    const selfClosing = ["img", "br", "hr", "input", "meta", "link", "area", "base", "col"];

    if (selfClosing.includes(tag) || match[2].endsWith("/")) {
      // Self-closing tag
      const node = parseElement(match[0]);
      if (node) {
        children.push(node);
      }
      currentIndex = match.index + match[0].length;
    } else {
      // Find matching closing tag (accounting for nesting)
      const closingTagRegex = new RegExp(`</${tag}>`, "gi");
      const openingTagRegex = new RegExp(`<${tag}[^>]*>`, "gi");

      let depth = 1;
      let searchIndex = match.index + match[0].length;
      let closeIndex = -1;

      while (depth > 0 && searchIndex < trimmed.length) {
        closingTagRegex.lastIndex = searchIndex;
        openingTagRegex.lastIndex = searchIndex;

        const closeMatch = closingTagRegex.exec(trimmed);
        const openMatch = openingTagRegex.exec(trimmed);

        if (!closeMatch) break;

        if (openMatch && openMatch.index < closeMatch.index) {
          depth++;
          searchIndex = openMatch.index + openMatch[0].length;
        } else {
          depth--;
          if (depth === 0) {
            closeIndex = closeMatch.index + closeMatch[0].length;
          } else {
            searchIndex = closeMatch.index + closeMatch[0].length;
          }
        }
      }

      if (closeIndex !== -1) {
        const fullElement = trimmed.slice(match.index, closeIndex);
        const node = parseElement(fullElement);
        if (node) {
          children.push(node);
        }
        currentIndex = closeIndex;
        tagPattern.lastIndex = closeIndex;
      } else {
        currentIndex = match.index + match[0].length;
      }
    }
  }

  // Add any remaining text
  const remainingText = trimmed.slice(currentIndex).trim();
  if (remainingText && !remainingText.startsWith("</")) {
    children.push(remainingText);
  }

  return children;
}

/**
 * Convert HTML attribute name to React prop name
 */
function toReactProp(attr: string): string {
  const mapping: Record<string, string> = {
    class: "className",
    for: "htmlFor",
    readonly: "readOnly",
    maxlength: "maxLength",
    minlength: "minLength",
    tabindex: "tabIndex",
    colspan: "colSpan",
    rowspan: "rowSpan",
    cellpadding: "cellPadding",
    cellspacing: "cellSpacing",
    usemap: "useMap",
    frameborder: "frameBorder",
    contenteditable: "contentEditable",
    autocomplete: "autoComplete",
    autofocus: "autoFocus",
    autoplay: "autoPlay",
  };

  return mapping[attr.toLowerCase()] ?? attr;
}

/**
 * Generate React component from ComponentNode
 */
function generateReactComponent(
  node: ComponentNode,
  extractedStyles: ExtractedStyle[],
  indent: number = 2
): string {
  const indentStr = " ".repeat(indent);
  const tag = node.tag;

  // Build props
  const props: string[] = [];

  // Add className (combining original class with extracted style class)
  const classNames: string[] = [];
  if (node.className) {
    classNames.push(node.className);
  }

  // Extract inline styles to CSS and add class reference
  if (Object.keys(node.styles).length > 0) {
    const styleClassName = generateClassName("style", extractedStyles.length);
    extractedStyles.push({
      className: styleClassName,
      properties: node.styles,
    });
    classNames.push(styleClassName);
  }

  if (classNames.length > 0) {
    props.push(`className="${classNames.join(" ")}"`);
  }

  if (node.id) {
    props.push(`id="${node.id}"`);
  }

  // Add other attributes
  for (const [attr, value] of Object.entries(node.attributes)) {
    // Skip React-specific or event attributes for now
    if (attr.startsWith("data-react") || attr.startsWith("data-v-") || attr.startsWith("_ng")) {
      continue;
    }

    const reactProp = toReactProp(attr);

    // Handle boolean attributes
    if (value === "true" || value === attr) {
      props.push(reactProp);
    } else {
      // Escape quotes in value
      const escapedValue = value.replace(/"/g, '\\"');
      props.push(`${reactProp}="${escapedValue}"`);
    }
  }

  const propsStr = props.length > 0 ? " " + props.join(" ") : "";

  // Handle self-closing tags
  if (node.children.length === 0) {
    return `${indentStr}<${tag}${propsStr} />`;
  }

  // Generate children
  const childrenStrs: string[] = [];
  for (const child of node.children) {
    if (typeof child === "string") {
      const trimmed = child.trim();
      if (trimmed) {
        // Escape JSX special characters
        const escaped = trimmed
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/{/g, "&#123;")
          .replace(/}/g, "&#125;");
        childrenStrs.push(`${indentStr}  ${escaped}`);
      }
    } else {
      childrenStrs.push(generateReactComponent(child, extractedStyles, indent + 2));
    }
  }

  if (childrenStrs.length === 0) {
    return `${indentStr}<${tag}${propsStr} />`;
  }

  if (childrenStrs.length === 1 && !childrenStrs[0].includes("\n")) {
    const childContent = childrenStrs[0].trim();
    return `${indentStr}<${tag}${propsStr}>${childContent}</${tag}>`;
  }

  return `${indentStr}<${tag}${propsStr}>\n${childrenStrs.join("\n")}\n${indentStr}</${tag}>`;
}

/**
 * Generate CSS from extracted styles
 */
function generateCss(styles: ExtractedStyle[]): string {
  if (styles.length === 0) return "";

  const rules = styles.map((style) => {
    const properties = Object.entries(style.properties)
      .map(([prop, value]) => `  ${camelToKebab(prop)}: ${value};`)
      .join("\n");
    return `.${style.className} {\n${properties}\n}`;
  });

  return rules.join("\n\n");
}

/**
 * Generate a React page component
 */
function generatePageComponent(componentName: string, node: ComponentNode | null): {
  tsx: string;
  extractedStyles: ExtractedStyle[];
} {
  const extractedStyles: ExtractedStyle[] = [];

  let jsxContent: string;
  if (node) {
    jsxContent = generateReactComponent(node, extractedStyles, 4);
  } else {
    jsxContent = `    <div>\n      <h1>${componentName}</h1>\n    </div>`;
  }

  const tsx = `import "./styles/${componentName}.css";

export function ${componentName}() {
  return (
${jsxContent}
  );
}
`;

  return { tsx, extractedStyles };
}

/**
 * Generate package.json for Vite + React project
 */
function generatePackageJson(): string {
  return JSON.stringify(
    {
      name: "generated-frontend",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router-dom": "^6.20.0",
      },
      devDependencies: {
        "@types/react": "^18.2.37",
        "@types/react-dom": "^18.2.15",
        "@vitejs/plugin-react": "^4.2.0",
        typescript: "^5.2.2",
        vite: "^5.0.0",
      },
    },
    null,
    2
  );
}

/**
 * Generate vite.config.ts
 */
function generateViteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;
}

/**
 * Generate tsconfig.json
 */
function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: false,
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }],
    },
    null,
    2
  );
}

/**
 * Generate tsconfig.node.json
 */
function generateTsConfigNode(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: "ESNext",
        moduleResolution: "bundler",
        allowSyntheticDefaultImports: true,
      },
      include: ["vite.config.ts"],
    },
    null,
    2
  );
}

/**
 * Generate index.html
 */
function generateIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

/**
 * Generate main.tsx
 */
function generateMainTsx(): string {
  return `import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`;
}

/**
 * Generate App.tsx with routes
 */
function generateAppTsx(routes: GeneratedRoute[]): string {
  // Generate imports
  const imports = routes
    .map((route) => `import { ${route.component} } from "./pages/${route.component}";`)
    .join("\n");

  // Generate routes
  const routeElements = routes
    .map((route) => `        <Route path="${route.path}" element={<${route.component} />} />`)
    .join("\n");

  return `import { Routes, Route } from "react-router-dom";
${imports}

export function App() {
  return (
    <Routes>
${routeElements}
    </Routes>
  );
}
`;
}

/**
 * Generate base index.css
 */
function generateIndexCss(): string {
  return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
}

/**
 * Extract unique pages from DOM snapshots
 */
function extractPages(snapshots: DOMSnapshot[]): PageInfo[] {
  const pagesMap = new Map<string, PageInfo>();

  for (const snapshot of snapshots) {
    if (snapshot.type !== "full" || !snapshot.html) continue;

    const routePath = urlToRoutePath(snapshot.url);

    // Only keep the first snapshot for each route
    if (pagesMap.has(routePath)) continue;

    const componentName = urlToComponentName(snapshot.url);

    pagesMap.set(routePath, {
      url: snapshot.url,
      routePath,
      componentName,
      html: snapshot.html,
    });
  }

  // Ensure we have at least a home page
  if (pagesMap.size === 0) {
    pagesMap.set("/", {
      url: "/",
      routePath: "/",
      componentName: "Home",
      html: "<div><h1>Welcome</h1></div>",
    });
  }

  return Array.from(pagesMap.values());
}

/**
 * Ensure unique component names
 */
function ensureUniqueComponentNames(pages: PageInfo[]): PageInfo[] {
  const nameCount = new Map<string, number>();
  const result: PageInfo[] = [];

  for (const page of pages) {
    const count = nameCount.get(page.componentName) ?? 0;
    nameCount.set(page.componentName, count + 1);

    if (count > 0) {
      result.push({
        ...page,
        componentName: `${page.componentName}${count + 1}`,
      });
    } else {
      result.push(page);
    }
  }

  return result;
}

/**
 * Generate frontend from recording analysis
 *
 * @param snapshots - DOM snapshots from recording
 * @param framework - Detected framework info
 * @returns Generated frontend project files and routes
 */
export async function generate(
  snapshots: DOMSnapshot[],
  framework: FrameworkInfo
): Promise<GeneratedFrontend> {
  const files: GeneratedFile[] = [];
  const routes: GeneratedRoute[] = [];

  // Extract unique pages from snapshots
  let pages = extractPages(snapshots);
  pages = ensureUniqueComponentNames(pages);

  // Generate page components
  const allExtractedStyles: ExtractedStyle[] = [];

  for (const page of pages) {
    const node = parseHtml(page.html);
    const { tsx, extractedStyles } = generatePageComponent(page.componentName, node);

    files.push({
      path: `src/pages/${page.componentName}.tsx`,
      content: tsx,
    });

    // Generate CSS for this page
    const css = generateCss(extractedStyles);
    files.push({
      path: `src/styles/${page.componentName}.css`,
      content: css,
    });

    allExtractedStyles.push(...extractedStyles);

    routes.push({
      path: page.routePath,
      component: page.componentName,
    });
  }

  // Generate project configuration files
  files.push({
    path: "package.json",
    content: generatePackageJson(),
  });

  files.push({
    path: "vite.config.ts",
    content: generateViteConfig(),
  });

  files.push({
    path: "tsconfig.json",
    content: generateTsConfig(),
  });

  files.push({
    path: "tsconfig.node.json",
    content: generateTsConfigNode(),
  });

  files.push({
    path: "index.html",
    content: generateIndexHtml(),
  });

  // Generate main entry point
  files.push({
    path: "src/main.tsx",
    content: generateMainTsx(),
  });

  // Generate App component with routes
  files.push({
    path: "src/App.tsx",
    content: generateAppTsx(routes),
  });

  // Generate base CSS
  files.push({
    path: "src/index.css",
    content: generateIndexCss(),
  });

  // Determine output framework (always React for now)
  const outputFramework: "react" | "vanilla" =
    framework.framework === "vanilla" ? "vanilla" : "react";

  return {
    framework: outputFramework,
    files,
    routes,
  };
}

// ==================== NEW VALIDATION WRAPPER (SPEC 12) ====================

/**
 * List of common Tailwind CSS classes for validation
 * This is a subset - in production, you'd use the full Tailwind class list
 */
const COMMON_TAILWIND_CLASSES = new Set([
  // Layout
  "container", "block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "hidden",
  // Flexbox
  "flex-row", "flex-col", "flex-wrap", "flex-nowrap", "items-start", "items-center", "items-end",
  "justify-start", "justify-center", "justify-end", "justify-between", "justify-around", "gap-1", "gap-2", "gap-4",
  // Spacing
  "m-0", "m-1", "m-2", "m-4", "m-8", "p-0", "p-1", "p-2", "p-4", "p-8", "px-2", "px-4", "py-2", "py-4",
  "mt-2", "mt-4", "mb-2", "mb-4", "ml-2", "ml-4", "mr-2", "mr-4",
  // Sizing
  "w-full", "w-1/2", "w-auto", "h-full", "h-screen", "h-auto", "max-w-sm", "max-w-md", "max-w-lg", "max-w-xl",
  // Colors
  "text-white", "text-black", "text-gray-500", "text-blue-500", "bg-white", "bg-black", "bg-gray-100", "bg-blue-500",
  // Typography
  "text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "font-normal", "font-bold", "font-semibold",
  // Borders
  "border", "border-2", "rounded", "rounded-lg", "rounded-full", "border-gray-300",
]);

/**
 * Validate TypeScript/JSX files using TypeScript compiler API
 */
function validateTypeScript(files: { path: string; content: string }[]): string[] {
  const errors: string[] = [];

  // Create in-memory compiler host
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.React,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
  };

  // Create virtual file system
  const fileMap = new Map(files.map(f => [f.path, f.content]));

  const host: ts.CompilerHost = {
    getSourceFile: (fileName) => {
      const content = fileMap.get(fileName);
      if (content !== undefined) {
        return ts.createSourceFile(fileName, content, ts.ScriptTarget.ES2020, true);
      }
      return undefined;
    },
    writeFile: () => {},
    getCurrentDirectory: () => "",
    getDirectories: () => [],
    fileExists: (fileName) => fileMap.has(fileName),
    readFile: (fileName) => fileMap.get(fileName),
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  };

  // Create program and get diagnostics
  const program = ts.createProgram(Array.from(fileMap.keys()), compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  for (const diagnostic of diagnostics) {
    if (diagnostic.file) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      errors.push(`${diagnostic.file.fileName}:${line + 1}:${character + 1} - ${message}`);
    } else {
      errors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
  }

  return errors;
}

/**
 * Validate Tailwind CSS classes in HTML/JSX content
 */
function validateTailwindClasses(content: string): string[] {
  const warnings: string[] = [];

  // Extract className attributes from JSX
  const classNameRegex = /className=["']([^"']+)["']/g;
  let match;

  while ((match = classNameRegex.exec(content)) !== null) {
    const classes = match[1].split(/\s+/).filter(c => c);

    for (const className of classes) {
      // Skip dynamic classes and variables
      if (className.includes("{") || className.includes("$")) continue;

      // Check if it's a known Tailwind class (or follows Tailwind patterns)
      const isTailwindPattern = /^(m|p|w|h|text|bg|border|rounded|flex|grid|gap|items|justify)-/.test(className);
      const isKnownClass = COMMON_TAILWIND_CLASSES.has(className);

      if (!isKnownClass && !isTailwindPattern) {
        warnings.push(`Unknown Tailwind class: ${className}`);
      }
    }
  }

  return warnings;
}

/**
 * Validate that all imports can be resolved
 */
function validateImports(
  files: { path: string; content: string }[],
  packages: string[]
): string[] {
  const errors: string[] = [];
  const packageSet = new Set(packages.map(p => p.split("@")[0]));

  // Standard libraries that should always be available
  const standardLibs = new Set(["react", "react-dom", "react-router-dom"]);

  for (const file of files) {
    // Extract imports
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+["']([^"']+)["']/g;
    let match;

    while ((match = importRegex.exec(file.content)) !== null) {
      const importPath = match[1];

      // Skip relative imports - we'll assume they're valid for now
      if (importPath.startsWith(".") || importPath.startsWith("/")) continue;

      // Check if it's a known package
      const packageName = importPath.split("/")[0];
      if (!packageSet.has(packageName) && !standardLibs.has(packageName)) {
        errors.push(`${file.path}: Missing dependency '${packageName}'`);
      }
    }
  }

  return errors;
}

/**
 * Execute a shell command and return the result
 */
async function execCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, shell: true });
    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        success: code === 0,
        output,
      });
    });

    proc.on("error", (error) => {
      resolve({
        success: false,
        output: error.message,
      });
    });
  });
}

/**
 * Generate package.json with all detected dependencies
 */
function generateValidatedPackageJson(packages: string[]): string {
  const dependencies: Record<string, string> = {
    react: "^19.0.0",
    "react-dom": "^19.0.0",
  };

  const devDependencies: Record<string, string> = {
    "@vitejs/plugin-react": "^4.3.4",
    typescript: "^5.6.0",
    vite: "^7.0.0",
    tailwindcss: "^3.4.0",
    postcss: "^8.4.0",
    autoprefixer: "^10.4.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
  };

  // Add detected packages
  for (const pkg of packages) {
    // Skip if already in dependencies or devDependencies
    if (pkg in dependencies || pkg in devDependencies) continue;

    // Add to dependencies with a default version
    dependencies[pkg] = "latest";
  }

  return JSON.stringify(
    {
      name: "crayon-sandbox",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
      },
      dependencies,
      devDependencies,
    },
    null,
    2
  );
}

/**
 * Generate Tailwind config
 */
function generateTailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
}

/**
 * Generate PostCSS config
 */
function generatePostcssConfig(): string {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
}

/**
 * Main validation and generation function
 * Validates AI-generated code and creates a production-ready Vite project
 */
export async function generateValidated(
  input: FrontendGeneratorInput
): Promise<FrontendGeneratorOutput> {
  const { generationResult, projectPath } = input;
  const errors: string[] = [];
  const warnings: string[] = [...generationResult.warnings];
  const allFiles: string[] = [];

  // Step 1: Validate TypeScript/JSX
  const tsFiles = generationResult.files.filter(
    f => f.path.endsWith(".ts") || f.path.endsWith(".tsx") || f.path.endsWith(".jsx")
  );

  const tsErrors = validateTypeScript(tsFiles);
  if (tsErrors.length > 0) {
    errors.push(...tsErrors);
  }

  // Step 2: Validate Tailwind classes
  for (const file of generationResult.files) {
    if (file.path.endsWith(".tsx") || file.path.endsWith(".jsx")) {
      const tailwindWarnings = validateTailwindClasses(file.content);
      warnings.push(...tailwindWarnings);
    }
  }

  // Step 3: Validate imports
  const importErrors = validateImports(generationResult.files, generationResult.packages);
  if (importErrors.length > 0) {
    errors.push(...importErrors);
  }

  // Step 4: Create project structure
  try {
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, "src"), { recursive: true });
    await fs.mkdir(path.join(projectPath, "public"), { recursive: true });

    // Write all AI-generated files
    for (const file of generationResult.files) {
      const filePath = path.join(projectPath, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, "utf-8");
      allFiles.push(file.path);
    }

    // Generate config files
    const packageJson = generateValidatedPackageJson(generationResult.packages);
    await fs.writeFile(path.join(projectPath, "package.json"), packageJson, "utf-8");
    allFiles.push("package.json");

    await fs.writeFile(path.join(projectPath, "vite.config.ts"), generateViteConfig(), "utf-8");
    allFiles.push("vite.config.ts");

    await fs.writeFile(path.join(projectPath, "tsconfig.json"), generateTsConfig(), "utf-8");
    allFiles.push("tsconfig.json");

    await fs.writeFile(path.join(projectPath, "tsconfig.node.json"), generateTsConfigNode(), "utf-8");
    allFiles.push("tsconfig.node.json");

    await fs.writeFile(path.join(projectPath, "tailwind.config.ts"), generateTailwindConfig(), "utf-8");
    allFiles.push("tailwind.config.ts");

    await fs.writeFile(path.join(projectPath, "postcss.config.js"), generatePostcssConfig(), "utf-8");
    allFiles.push("postcss.config.js");

    // Generate index.html if not provided
    if (!generationResult.files.some(f => f.path === "index.html")) {
      await fs.writeFile(path.join(projectPath, "index.html"), generateIndexHtml(), "utf-8");
      allFiles.push("index.html");
    }

  } catch (error) {
    errors.push(`Failed to create project structure: ${error instanceof Error ? error.message : String(error)}`);
    return {
      projectPath,
      files: allFiles,
      packages: [],
      buildSuccess: false,
      errors,
      warnings,
    };
  }

  // Step 5: Install packages
  const installResult = await execCommand("npm", ["install"], projectPath);
  if (!installResult.success) {
    errors.push(`npm install failed: ${installResult.output}`);
    return {
      projectPath,
      files: allFiles,
      packages: [],
      buildSuccess: false,
      errors,
      warnings,
    };
  }

  // Step 6: Run build to verify
  const buildResult = await execCommand("npm", ["run", "build"], projectPath);
  const buildSuccess = buildResult.success;

  if (!buildSuccess) {
    errors.push(`Build failed: ${buildResult.output}`);
  }

  return {
    projectPath,
    files: allFiles,
    packages: [...generationResult.packages],
    buildSuccess,
    errors,
    warnings,
  };
}
