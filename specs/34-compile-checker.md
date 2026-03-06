# Compile Checker

Validates TypeScript/Vite builds inside Docker containers and parses error output.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "dockerode exec command nodejs 2025"
- Search: "TypeScript compiler API diagnostic messages"
- Search: "Vite build error format parsing"

## Purpose

Executes build commands inside the sandbox Docker container and parses the output to provide structured error information. This enables the code agent to understand and fix compilation errors.

## Acceptance Criteria

- [ ] Can execute `npm run build` inside a running Docker container
- [ ] Parses TypeScript errors into structured format (file, line, column, message)
- [ ] Parses Vite/Rollup errors into structured format
- [ ] Handles build timeouts gracefully (max 60 seconds)
- [ ] Streams build output in real-time for UI feedback
- [ ] Returns structured CompileResult with success/failure status
- [ ] Works with containers created by sandbox-manager (spec 17)

## Interface

```typescript
// packages/core/src/compile-checker.ts

import { z } from "zod";

// ==================== SCHEMAS ====================

export const CompileErrorSchema = z.object({
  file: z.string(), // Relative path: "src/App.tsx"
  line: z.number(), // 1-indexed line number
  column: z.number(), // 1-indexed column number
  message: z.string(), // Error message
  code: z.string().optional(), // Error code: "TS2304", "VITE_ERROR"
  severity: z.enum(["error", "warning"]),
  source: z.enum(["typescript", "vite", "eslint", "unknown"]),
  
  // Context for display
  sourceCode: z.string().optional(), // The line of code with error
  suggestion: z.string().optional(), // Fix suggestion if available
});

export type CompileError = z.infer<typeof CompileErrorSchema>;

export const CompileResultSchema = z.object({
  success: z.boolean(),
  errors: z.array(CompileErrorSchema),
  warnings: z.array(CompileErrorSchema),
  
  // Raw output for debugging
  stdout: z.string(),
  stderr: z.string(),
  
  // Timing
  durationMs: z.number(),
  
  // Summary stats
  stats: z.object({
    errorCount: z.number(),
    warningCount: z.number(),
    filesChecked: z.number().optional(),
  }),
});

export type CompileResult = z.infer<typeof CompileResultSchema>;

// ==================== CONFIGURATION ====================

export interface CompileCheckerConfig {
  containerId: string; // Docker container ID
  timeout?: number; // Max wait time in ms (default: 60000)
  command?: string; // Build command (default: "npm run build")
  onOutput?: (line: string) => void; // Real-time output callback
}

// ==================== MAIN INTERFACE ====================

/**
 * Check if code compiles by running build in container
 */
export async function checkCompilation(
  config: CompileCheckerConfig
): Promise<CompileResult>;

/**
 * Stream version - yields output lines as they come
 */
export async function* checkCompilationStream(
  config: CompileCheckerConfig
): AsyncGenerator<string, CompileResult>;

/**
 * Quick syntax check using TypeScript compiler (no Docker needed)
 * Useful for fast feedback before full build
 */
export async function quickTypeCheck(
  files: Array<{ path: string; content: string }>
): Promise<CompileResult>;
```

## Implementation Details

### Docker Exec Command

Use dockerode to execute commands inside the container:

```typescript
import Docker from "dockerode";

async function execInContainer(
  containerId: string,
  command: string[],
  timeout: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const docker = new Docker();
  const container = docker.getContainer(containerId);

  // Create exec instance
  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
  });

  // Start execution
  const stream = await exec.start({ hijack: true, stdin: false });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    // Set timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(`Build timed out after ${timeout}ms`));
    }, timeout);

    // Demux stdout and stderr
    docker.modem.demuxStream(
      stream,
      {
        write: (chunk: Buffer) => {
          stdout += chunk.toString();
          config.onOutput?.(chunk.toString());
        },
      },
      {
        write: (chunk: Buffer) => {
          stderr += chunk.toString();
          config.onOutput?.(chunk.toString());
        },
      }
    );

    stream.on("end", async () => {
      clearTimeout(timeoutId);
      const inspect = await exec.inspect();
      resolve({
        stdout,
        stderr,
        exitCode: inspect.ExitCode ?? 1,
      });
    });
  });
}
```

### TypeScript Error Parsing

TypeScript errors follow a specific format:

```
src/App.tsx:15:23 - error TS2304: Cannot find name 'Headerr'.

15     return <Headerr />;
                ~~~~~~~~

src/App.tsx:20:5 - error TS2741: Property 'title' is missing in type '{}' but required in type 'CardProps'.

20     <Card />
       ~~~~~~~~
```

Parser implementation:

```typescript
const TS_ERROR_REGEX = /^(.+):(\d+):(\d+) - (error|warning) (TS\d+): (.+)$/;
const TS_CODE_LINE_REGEX = /^\s*(\d+)\s*\|?\s*(.*)$/;

function parseTypeScriptErrors(output: string): CompileError[] {
  const errors: CompileError[] = [];
  const lines = output.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TS_ERROR_REGEX);
    if (match) {
      const [, file, line, column, severity, code, message] = match;

      // Look for source code line (usually 2 lines after)
      let sourceCode: string | undefined;
      if (i + 2 < lines.length) {
        const codeMatch = lines[i + 2]?.match(TS_CODE_LINE_REGEX);
        if (codeMatch) {
          sourceCode = codeMatch[2];
        }
      }

      errors.push({
        file,
        line: parseInt(line, 10),
        column: parseInt(column, 10),
        message,
        code,
        severity: severity as "error" | "warning",
        source: "typescript",
        sourceCode,
      });
    }
  }

  return errors;
}
```

### Vite/Rollup Error Parsing

Vite errors have a different format:

```
[vite]: Rollup failed to resolve import "react-routers" from "src/App.tsx".
This is most likely unintended because it can break your application at runtime.
If you do want to externalize this module explicitly add it to
`build.rollupOptions.external`

error during build:
Error: Cannot find module 'react-routers'
    at /app/src/App.tsx:3:0
```

Parser implementation:

```typescript
const VITE_IMPORT_ERROR_REGEX =
  /\[vite\]: Rollup failed to resolve import "([^"]+)" from "([^"]+)"/;
const VITE_LOCATION_REGEX = /at (?:\/app\/)?(.+):(\d+):(\d+)/;

function parseViteErrors(output: string): CompileError[] {
  const errors: CompileError[] = [];
  const lines = output.split("\n");

  // Check for import resolution errors
  for (let i = 0; i < lines.length; i++) {
    const importMatch = lines[i].match(VITE_IMPORT_ERROR_REGEX);
    if (importMatch) {
      const [, moduleName, fromFile] = importMatch;

      // Look for location in following lines
      let line = 1;
      let column = 0;
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const locMatch = lines[j].match(VITE_LOCATION_REGEX);
        if (locMatch) {
          line = parseInt(locMatch[2], 10);
          column = parseInt(locMatch[3], 10);
          break;
        }
      }

      errors.push({
        file: fromFile,
        line,
        column,
        message: `Cannot resolve import "${moduleName}". Check if the package is installed or if the path is correct.`,
        code: "VITE_RESOLVE_ERROR",
        severity: "error",
        source: "vite",
        suggestion: `Run: npm install ${moduleName}`,
      });
    }
  }

  // Check for generic build errors
  const buildErrorRegex = /^Error: (.+)$/m;
  const buildMatch = output.match(buildErrorRegex);
  if (buildMatch && errors.length === 0) {
    errors.push({
      file: "unknown",
      line: 0,
      column: 0,
      message: buildMatch[1],
      severity: "error",
      source: "vite",
    });
  }

  return errors;
}
```

### ESLint Error Parsing (if ESLint is configured)

```
/app/src/App.tsx
  15:23  error  'Headerr' is not defined  no-undef
  20:5   warning  React Hook useEffect has a missing dependency  react-hooks/exhaustive-deps
```

Parser:

```typescript
const ESLINT_ERROR_REGEX = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(.+)$/;

function parseEslintErrors(output: string): CompileError[] {
  const errors: CompileError[] = [];
  const lines = output.split("\n");
  let currentFile = "";

  for (const line of lines) {
    // Check for file path line
    if (line.startsWith("/app/")) {
      currentFile = line.replace("/app/", "");
      continue;
    }

    const match = line.match(ESLINT_ERROR_REGEX);
    if (match && currentFile) {
      const [, lineNum, column, severity, message, rule] = match;
      errors.push({
        file: currentFile,
        line: parseInt(lineNum, 10),
        column: parseInt(column, 10),
        message,
        code: rule,
        severity: severity as "error" | "warning",
        source: "eslint",
      });
    }
  }

  return errors;
}
```

### Combined Parser

```typescript
function parseAllErrors(stdout: string, stderr: string): {
  errors: CompileError[];
  warnings: CompileError[];
} {
  const combined = stdout + "\n" + stderr;

  // Try all parsers
  const tsErrors = parseTypeScriptErrors(combined);
  const viteErrors = parseViteErrors(combined);
  const eslintErrors = parseEslintErrors(combined);

  // Combine and deduplicate
  const allErrors = [...tsErrors, ...viteErrors, ...eslintErrors];

  // Remove duplicates (same file, line, message)
  const unique = allErrors.filter(
    (error, index, self) =>
      index ===
      self.findIndex(
        (e) =>
          e.file === error.file &&
          e.line === error.line &&
          e.message === error.message
      )
  );

  return {
    errors: unique.filter((e) => e.severity === "error"),
    warnings: unique.filter((e) => e.severity === "warning"),
  };
}
```

### Quick Type Check (No Docker)

For fast feedback without Docker:

```typescript
import ts from "typescript";

export async function quickTypeCheck(
  files: Array<{ path: string; content: string }>
): Promise<CompileResult> {
  const startTime = Date.now();

  // Create virtual file system
  const fileMap = new Map(files.map((f) => [f.path, f.content]));

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    strict: false, // More lenient for sandbox code
    skipLibCheck: true,
    noEmit: true,
  };

  const host: ts.CompilerHost = {
    getSourceFile: (fileName) => {
      const content = fileMap.get(fileName);
      if (content !== undefined) {
        return ts.createSourceFile(
          fileName,
          content,
          ts.ScriptTarget.ES2020,
          true
        );
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
    getDefaultLibFileName: () => "lib.d.ts",
  };

  const program = ts.createProgram(
    Array.from(fileMap.keys()),
    compilerOptions,
    host
  );

  const diagnostics = ts.getPreEmitDiagnostics(program);

  const errors: CompileError[] = diagnostics
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => {
      const { line, character } = d.file
        ? d.file.getLineAndCharacterOfPosition(d.start!)
        : { line: 0, character: 0 };

      return {
        file: d.file?.fileName || "unknown",
        line: line + 1,
        column: character + 1,
        message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        code: `TS${d.code}`,
        severity: "error" as const,
        source: "typescript" as const,
      };
    });

  const warnings: CompileError[] = diagnostics
    .filter((d) => d.category === ts.DiagnosticCategory.Warning)
    .map((d) => {
      const { line, character } = d.file
        ? d.file.getLineAndCharacterOfPosition(d.start!)
        : { line: 0, character: 0 };

      return {
        file: d.file?.fileName || "unknown",
        line: line + 1,
        column: character + 1,
        message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        code: `TS${d.code}`,
        severity: "warning" as const,
        source: "typescript" as const,
      };
    });

  return {
    success: errors.length === 0,
    errors,
    warnings,
    stdout: "",
    stderr: "",
    durationMs: Date.now() - startTime,
    stats: {
      errorCount: errors.length,
      warningCount: warnings.length,
      filesChecked: files.length,
    },
  };
}
```

### Main Implementation

```typescript
export async function checkCompilation(
  config: CompileCheckerConfig
): Promise<CompileResult> {
  const startTime = Date.now();
  const timeout = config.timeout ?? 60000;
  const command = config.command ?? "npm run build";

  try {
    const { stdout, stderr, exitCode } = await execInContainer(
      config.containerId,
      ["sh", "-c", command],
      timeout
    );

    const { errors, warnings } = parseAllErrors(stdout, stderr);

    return {
      success: exitCode === 0 && errors.length === 0,
      errors,
      warnings,
      stdout,
      stderr,
      durationMs: Date.now() - startTime,
      stats: {
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    };
  } catch (error) {
    // Handle timeout or Docker errors
    return {
      success: false,
      errors: [
        {
          file: "build",
          line: 0,
          column: 0,
          message:
            error instanceof Error ? error.message : "Build execution failed",
          severity: "error",
          source: "unknown",
        },
      ],
      warnings: [],
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      stats: {
        errorCount: 1,
        warningCount: 0,
      },
    };
  }
}
```

## Error Formatting for Display

Provide a utility for formatting errors nicely:

```typescript
export function formatCompileErrors(result: CompileResult): string {
  if (result.success) {
    return `✓ Build successful (${(result.durationMs / 1000).toFixed(1)}s)`;
  }

  const lines: string[] = [];
  lines.push(`✗ Build failed (${(result.durationMs / 1000).toFixed(1)}s)`);
  lines.push("");
  lines.push(`${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
  lines.push("");

  for (const error of result.errors) {
    lines.push(`${error.file}:${error.line}:${error.column}`);
    lines.push(`  ${error.severity}: ${error.message}`);
    if (error.code) {
      lines.push(`  Code: ${error.code}`);
    }
    if (error.sourceCode) {
      lines.push(`  ${error.line} | ${error.sourceCode}`);
      lines.push(`  ${" ".repeat(String(error.line).length)} | ${" ".repeat(error.column - 1)}^`);
    }
    if (error.suggestion) {
      lines.push(`  Suggestion: ${error.suggestion}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
```

## Dependencies

Add to `packages/core/package.json`:

```json
{
  "dependencies": {
    "dockerode": "^4.0.0",
    "typescript": "^5.6.0"
  },
  "devDependencies": {
    "@types/dockerode": "^3.3.0"
  }
}
```

## Testing Requirements

### Unit Tests (`compile-checker.test.ts`)

```typescript
describe("CompileChecker", () => {
  describe("parseTypeScriptErrors", () => {
    test("parses standard TS error format", () => {
      const output = `src/App.tsx:15:23 - error TS2304: Cannot find name 'Headerr'.

15     return <Headerr />;
                ~~~~~~~~`;

      const errors = parseTypeScriptErrors(output);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        file: "src/App.tsx",
        line: 15,
        column: 23,
        message: "Cannot find name 'Headerr'.",
        code: "TS2304",
        severity: "error",
        source: "typescript",
        sourceCode: "    return <Headerr />;",
      });
    });

    test("parses multiple errors", () => {
      const output = `src/A.tsx:1:1 - error TS1: msg1
src/B.tsx:2:2 - error TS2: msg2
src/C.tsx:3:3 - warning TS3: msg3`;

      const errors = parseTypeScriptErrors(output);
      expect(errors).toHaveLength(3);
    });
  });

  describe("parseViteErrors", () => {
    test("parses import resolution errors", () => {
      const output = `[vite]: Rollup failed to resolve import "react-routers" from "src/App.tsx".
This is most likely unintended because it can break your application at runtime.

error during build:
Error: Cannot find module 'react-routers'
    at /app/src/App.tsx:3:0`;

      const errors = parseViteErrors(output);
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe("src/App.tsx");
      expect(errors[0].message).toContain("react-routers");
    });
  });

  describe("quickTypeCheck", () => {
    test("detects syntax errors", async () => {
      const result = await quickTypeCheck([
        {
          path: "test.tsx",
          content: "const x: string = 123;", // Type error
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("string");
    });

    test("passes valid code", async () => {
      const result = await quickTypeCheck([
        {
          path: "test.tsx",
          content: "const x: string = 'hello';",
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
```

### Integration Tests (`compile-checker.integration.test.ts`)

```typescript
describe("CompileChecker Integration", () => {
  // REQUIRES: Docker running with a sandbox container

  let containerId: string;

  beforeAll(async () => {
    // Start a test container
    containerId = await startTestContainer();
  });

  afterAll(async () => {
    await stopTestContainer(containerId);
  });

  test("successfully builds valid project", async () => {
    const result = await checkCompilation({ containerId });
    expect(result.success).toBe(true);
  });

  test("detects TypeScript errors", async () => {
    // Inject a broken file
    await injectBrokenFile(containerId);

    const result = await checkCompilation({ containerId });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Restore the file
    await restoreFile(containerId);
  });

  test("handles timeout gracefully", async () => {
    const result = await checkCompilation({
      containerId,
      timeout: 100, // Very short timeout
      command: "sleep 10 && npm run build",
    });

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("timeout");
  });
});
```

## Definition of Done

- [ ] Can execute `npm run build` in Docker container
- [ ] Parses TypeScript errors correctly
- [ ] Parses Vite/Rollup errors correctly
- [ ] Parses ESLint errors correctly (if present)
- [ ] Handles build timeouts gracefully
- [ ] Quick type check works without Docker
- [ ] Error formatting produces readable output
- [ ] Unit tests pass
- [ ] Integration tests pass with real Docker container
- [ ] Errors include file, line, column, and message
