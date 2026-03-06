# Sandbox Code Agent

Core AI agent that processes natural language instructions to edit sandbox code using a tool-based architecture.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "Anthropic Claude tool use function calling 2025"
- Search: "OpenAI function calling streaming 2025"
- Search: "Vercel AI SDK tool calling streaming"

**Reference implementation**: Study OpenCode's tool system at https://github.com/anomalyco/opencode
- Key files: `packages/opencode/src/tool/` (read.ts, write.ts, edit.ts, bash.ts)
- Pattern: `Tool.define()` with Zod schemas for parameters

## Purpose

Provides an AI agent that can read, write, and edit files in the sandbox directory based on natural language instructions. The agent uses a tool-calling approach where the LLM decides which tools to invoke.

## Acceptance Criteria

- [ ] Agent processes user messages and returns structured responses
- [ ] Implements 5 core tools: `read_file`, `write_file`, `edit_file`, `list_files`, `run_build`
- [ ] Streams progress events (thinking, tool_call, tool_result, message)
- [ ] Maintains conversation history for context
- [ ] Handles multi-turn conversations
- [ ] Validates all file paths stay within sandbox directory
- [ ] Returns compilation status after file modifications
- [ ] Supports both Anthropic Claude and OpenAI GPT models

## Interface

```typescript
// packages/core/src/code-agent.ts

import { z } from "zod";

// ==================== CONFIGURATION ====================

export const CodeAgentConfigSchema = z.object({
  sandboxId: z.string().min(1),
  sandboxPath: z.string().min(1), // e.g., "./data/projects/{id}/sandbox"
  containerId: z.string().optional(), // Docker container ID for running commands
  
  // LLM Configuration
  provider: z.enum(["anthropic", "openai"]),
  model: z.string().optional(), // Defaults based on provider
  apiKey: z.string().min(1),
  
  // Limits
  maxTokens: z.number().default(4096),
  maxToolCalls: z.number().default(20), // Prevent infinite loops
  
  // Callbacks
  onProgress: z.function()
    .args(z.custom<AgentEvent>())
    .returns(z.void())
    .optional(),
});

export type CodeAgentConfig = z.infer<typeof CodeAgentConfigSchema>;

// ==================== EVENTS ====================

export type AgentEventType = 
  | "thinking"      // Agent is processing
  | "tool_call"     // Agent invoked a tool
  | "tool_result"   // Tool returned a result
  | "message"       // Final text response
  | "error"         // Error occurred
  | "compile_start" // Starting compilation check
  | "compile_done"; // Compilation finished

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data: {
    // For tool_call
    toolName?: string;
    toolInput?: Record<string, unknown>;
    
    // For tool_result
    toolOutput?: string;
    success?: boolean;
    
    // For message
    content?: string;
    
    // For error
    error?: string;
    
    // For compile events
    compileSuccess?: boolean;
    compileErrors?: CompileError[];
  };
}

export interface CompileError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

// ==================== CONVERSATION ====================

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
}

// ==================== AGENT RESULT ====================

export interface AgentResult {
  success: boolean;
  response: string; // Final assistant message
  filesModified: string[]; // List of files that were changed
  compileResult?: {
    success: boolean;
    errors: CompileError[];
    output: string;
  };
  tokensUsed: {
    input: number;
    output: number;
  };
  toolCallsCount: number;
}

// ==================== MAIN INTERFACE ====================

export interface CodeAgent {
  /**
   * Process a user message and return the agent's response
   */
  chat(
    message: string,
    history?: ChatMessage[]
  ): Promise<AgentResult>;

  /**
   * Stream version - yields events as they occur
   */
  chatStream(
    message: string,
    history?: ChatMessage[]
  ): AsyncGenerator<AgentEvent, AgentResult>;

  /**
   * Get current conversation history
   */
  getHistory(): ChatMessage[];

  /**
   * Clear conversation history
   */
  clearHistory(): void;
}

/**
 * Create a new code agent instance
 */
export function createCodeAgent(config: CodeAgentConfig): CodeAgent;
```

## Tool Definitions

Each tool must be defined with a Zod schema for parameters. The LLM will see these descriptions and decide when to use them.

### Tool 1: read_file

```typescript
export const ReadFileTool = {
  name: "read_file",
  description: `Read the contents of a file from the sandbox. 
Returns the file content with line numbers for reference.
Use this before editing to understand the current state of a file.
You can optionally specify a line range to read only part of a large file.`,
  
  parameters: z.object({
    path: z.string().describe(
      "Relative path from sandbox root (e.g., 'src/App.tsx', 'src/components/Header.tsx')"
    ),
    startLine: z.number().optional().describe(
      "Line number to start reading from (1-indexed). Omit to start from beginning."
    ),
    endLine: z.number().optional().describe(
      "Line number to stop reading at (inclusive). Omit to read until end."
    ),
  }),

  execute: async (
    params: { path: string; startLine?: number; endLine?: number },
    context: ToolContext
  ): Promise<ToolOutput> => {
    // Implementation details below
  },
};
```

**Implementation details for read_file:**

1. Validate path doesn't contain `..` or absolute paths
2. Resolve full path: `path.join(sandboxPath, params.path)`
3. Check file exists, return error if not
4. Read file content as UTF-8
5. Split into lines and add line numbers
6. If startLine/endLine specified, slice the array
7. Format output:
   ```
   File: src/App.tsx (45 lines)
   ─────────────────────────────
      1 | import React from 'react';
      2 | import { Header } from './components/Header';
      3 | 
      4 | export function App() {
   ...
   ```
8. Truncate if >500 lines with message "... truncated, use startLine/endLine to read more"

### Tool 2: write_file

```typescript
export const WriteFileTool = {
  name: "write_file",
  description: `Create a new file or completely overwrite an existing file.
Use this for creating new components, pages, or completely rewriting files.
For small changes to existing files, prefer edit_file instead.
The file will be created with all parent directories if they don't exist.`,
  
  parameters: z.object({
    path: z.string().describe(
      "Relative path from sandbox root where the file should be written"
    ),
    content: z.string().describe(
      "The complete content to write to the file"
    ),
  }),

  execute: async (
    params: { path: string; content: string },
    context: ToolContext
  ): Promise<ToolOutput> => {
    // Implementation details below
  },
};
```

**Implementation details for write_file:**

1. Validate path (no `..`, no absolute paths, no dangerous extensions like `.env`)
2. Resolve full path: `path.join(sandboxPath, params.path)`
3. Create parent directories: `fs.mkdir(dirname(fullPath), { recursive: true })`
4. Check if file exists (for reporting created vs. overwritten)
5. Write content: `fs.writeFile(fullPath, params.content, 'utf-8')`
6. Return success message with file size and whether created/overwritten
7. Add file to `filesModified` list for compile check

### Tool 3: edit_file

```typescript
export const EditFileTool = {
  name: "edit_file",
  description: `Edit an existing file by replacing specific content.
You must provide the EXACT text to find (oldContent) and what to replace it with (newContent).
The oldContent must match exactly including whitespace and indentation.
This is safer than write_file for small changes as it preserves the rest of the file.

IMPORTANT: 
- Include enough context in oldContent to make it unique (3-5 lines before/after the change)
- If the oldContent is not found exactly, the edit will fail
- For multiple changes in one file, make multiple edit_file calls`,
  
  parameters: z.object({
    path: z.string().describe(
      "Relative path to the file to edit"
    ),
    oldContent: z.string().describe(
      "The exact content to find and replace. Must match exactly including whitespace."
    ),
    newContent: z.string().describe(
      "The new content to replace oldContent with"
    ),
  }),

  execute: async (
    params: { path: string; oldContent: string; newContent: string },
    context: ToolContext
  ): Promise<ToolOutput> => {
    // Implementation details below
  },
};
```

**Implementation details for edit_file:**

1. Validate path
2. Read current file content
3. Check if `oldContent` exists in file
4. If not found exactly, try fuzzy matching strategies (like OpenCode):
   - Strategy 1: Exact match (default)
   - Strategy 2: Trim leading/trailing whitespace per line
   - Strategy 3: Normalize all whitespace
5. If still not found, return error with helpful message:
   ```
   Could not find the specified content in the file.
   
   Looking for:
   """
   {oldContent}
   """
   
   The file contains {lineCount} lines. Here are similar sections:
   - Lines 45-50: {snippet with similarity score}
   
   Suggestion: Use read_file to see the current content, then try again with exact text.
   ```
6. If found multiple times, error: "Content found {n} times. Add more context to make it unique."
7. Replace content and write file
8. Generate and return diff:
   ```
   ✓ Edited src/App.tsx
   
   @@ -12,4 +12,6 @@
   -  return <div>Hello</div>;
   +  return (
   +    <div className="container">
   +      <h1>Hello World</h1>
   +    </div>
   +  );
   ```

### Tool 4: list_files

```typescript
export const ListFilesTool = {
  name: "list_files",
  description: `List files and directories in the sandbox.
Returns a tree structure showing all files with their sizes.
Use this to understand the project structure before making changes.`,
  
  parameters: z.object({
    path: z.string().optional().describe(
      "Subdirectory to list (relative to sandbox root). Omit to list entire sandbox."
    ),
    depth: z.number().optional().default(3).describe(
      "Maximum directory depth to traverse. Default is 3."
    ),
  }),

  execute: async (
    params: { path?: string; depth?: number },
    context: ToolContext
  ): Promise<ToolOutput> => {
    // Implementation details below
  },
};
```

**Implementation details for list_files:**

1. Validate path if provided
2. Build recursive directory tree
3. Skip `node_modules`, `.git`, `dist`, `.next`
4. Format as tree:
   ```
   sandbox/
   ├── src/
   │   ├── App.tsx (2.1 KB)
   │   ├── main.tsx (0.4 KB)
   │   └── components/
   │       ├── Header.tsx (1.2 KB)
   │       └── Footer.tsx (0.8 KB)
   ├── public/
   │   └── index.html (0.5 KB)
   ├── package.json (0.6 KB)
   └── vite.config.ts (0.3 KB)
   
   12 files, 4 directories (total: 45.2 KB)
   ```

### Tool 5: run_build

```typescript
export const RunBuildTool = {
  name: "run_build",
  description: `Run the build command to check if the code compiles.
This will run 'npm run build' inside the sandbox container.
Use this after making changes to verify the code is valid.
Returns build output including any errors.`,
  
  parameters: z.object({
    // No parameters needed
  }),

  execute: async (
    params: Record<string, never>,
    context: ToolContext
  ): Promise<ToolOutput> => {
    // Implementation details below
  },
};
```

**Implementation details for run_build:**

1. Check if container is running
2. Execute command in container: `docker exec {containerId} npm run build`
3. Capture stdout and stderr
4. Parse TypeScript/Vite errors into structured format
5. Return formatted output:
   ```
   ✓ Build successful (3.2s)
   
   Output:
   vite v5.0.0 building for production...
   ✓ 24 modules transformed.
   dist/index.html    0.45 kB
   dist/assets/...    142.32 kB
   
   Build completed with 0 errors and 0 warnings.
   ```
   
   Or on failure:
   ```
   ✗ Build failed (1.8s)
   
   Errors:
   src/App.tsx:15:23 - error TS2304: Cannot find name 'Headerr'.
   
   15 |     return <Headerr />;
      |                     ^
   
   src/components/Card.tsx:8:5 - error TS2741: Property 'title' is missing
   
   Fix these errors and run build again.
   ```

## System Prompt

The agent needs a well-crafted system prompt that defines its behavior:

```typescript
const SYSTEM_PROMPT = `You are an expert frontend developer assistant helping users modify their sandbox application.

## Your Capabilities
You can read, write, and edit files in the sandbox using the provided tools.
You have access to:
- read_file: Read file contents with line numbers
- write_file: Create or overwrite files
- edit_file: Make targeted edits to existing files
- list_files: View the project structure
- run_build: Check if the code compiles

## Guidelines

### Before Making Changes
1. ALWAYS use list_files first to understand the project structure
2. ALWAYS use read_file to see the current content before editing
3. Understand the context before suggesting changes

### Making Edits
1. Prefer edit_file for small changes (a few lines)
2. Use write_file for new files or complete rewrites
3. Make minimal changes - don't rewrite entire files unnecessarily
4. Preserve existing code style and patterns
5. Keep imports organized (React first, then external, then local)

### After Making Changes
1. ALWAYS run run_build after editing to verify the code compiles
2. If build fails, analyze the errors and fix them
3. Don't leave the code in a broken state

### Code Quality
1. Use TypeScript with proper types
2. Use Tailwind CSS for styling (no inline styles)
3. Keep components small and focused
4. Use meaningful variable and function names
5. Add comments only when logic is complex

### Communication
1. Explain what you're doing and why
2. If you're unsure, ask clarifying questions
3. Summarize the changes you made at the end
4. If the build fails, explain the errors clearly

## Important Rules
- NEVER modify package.json dependencies without asking
- NEVER delete files without confirmation
- NEVER access files outside the sandbox directory
- ALWAYS check if the build passes before finishing
`;
```

## Agent Loop Implementation

The core agent loop follows this pattern:

```typescript
async function* chatStream(
  message: string,
  history: ChatMessage[]
): AsyncGenerator<AgentEvent, AgentResult> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: message },
  ];

  let toolCallCount = 0;
  const filesModified: string[] = [];

  while (toolCallCount < config.maxToolCalls) {
    // Yield thinking event
    yield { type: "thinking", timestamp: Date.now(), data: {} };

    // Call LLM with tools
    const response = await callLLM(messages, TOOLS);

    // Check if LLM wants to use a tool
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        toolCallCount++;

        // Yield tool call event
        yield {
          type: "tool_call",
          timestamp: Date.now(),
          data: {
            toolName: toolCall.name,
            toolInput: toolCall.input,
          },
        };

        // Execute the tool
        const result = await executeTool(toolCall);

        // Track modified files
        if (toolCall.name === "write_file" || toolCall.name === "edit_file") {
          filesModified.push(toolCall.input.path);
        }

        // Yield tool result event
        yield {
          type: "tool_result",
          timestamp: Date.now(),
          data: {
            toolOutput: result.output,
            success: result.success,
          },
        };

        // Add to conversation
        messages.push({
          role: "assistant",
          toolCalls: [toolCall],
        });
        messages.push({
          role: "tool",
          toolResults: [{ toolCallId: toolCall.id, output: result.output }],
        });
      }
    } else {
      // LLM finished - return final message
      yield {
        type: "message",
        timestamp: Date.now(),
        data: { content: response.content },
      };

      // Run final compile check if files were modified
      let compileResult;
      if (filesModified.length > 0) {
        yield { type: "compile_start", timestamp: Date.now(), data: {} };
        compileResult = await runCompileCheck();
        yield {
          type: "compile_done",
          timestamp: Date.now(),
          data: {
            compileSuccess: compileResult.success,
            compileErrors: compileResult.errors,
          },
        };
      }

      return {
        success: true,
        response: response.content,
        filesModified,
        compileResult,
        tokensUsed: response.usage,
        toolCallsCount: toolCallCount,
      };
    }
  }

  // Max tool calls reached
  throw new Error(`Max tool calls (${config.maxToolCalls}) reached`);
}
```

## LLM Provider Integration

### Anthropic Claude

```typescript
import Anthropic from "@anthropic-ai/sdk";

async function callAnthropicLLM(
  messages: ChatMessage[],
  tools: Tool[]
): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model: config.model || "claude-sonnet-4-20250514",
    max_tokens: config.maxTokens,
    system: messages.find((m) => m.role === "system")?.content,
    messages: convertToAnthropicFormat(messages),
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: zodToJsonSchema(t.parameters),
    })),
  });

  return parseAnthropicResponse(response);
}
```

### OpenAI GPT

```typescript
import OpenAI from "openai";

async function callOpenAILLM(
  messages: ChatMessage[],
  tools: Tool[]
): Promise<LLMResponse> {
  const client = new OpenAI({ apiKey: config.apiKey });

  const response = await client.chat.completions.create({
    model: config.model || "gpt-4o",
    max_tokens: config.maxTokens,
    messages: convertToOpenAIFormat(messages),
    tools: tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      },
    })),
  });

  return parseOpenAIResponse(response);
}
```

## Security Considerations

### Path Validation

```typescript
function validatePath(sandboxPath: string, requestedPath: string): string {
  // Normalize the path
  const normalized = path.normalize(requestedPath);

  // Check for path traversal attempts
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new SecurityError(`Invalid path: ${requestedPath}`);
  }

  // Resolve full path
  const fullPath = path.resolve(sandboxPath, normalized);

  // Ensure it's within sandbox
  if (!fullPath.startsWith(path.resolve(sandboxPath))) {
    throw new SecurityError(`Path escapes sandbox: ${requestedPath}`);
  }

  // Block sensitive files
  const blockedPatterns = [
    /\.env/i,
    /\.git\//,
    /node_modules\//,
    /\.ssh/,
    /credentials/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(normalized)) {
      throw new SecurityError(`Access denied: ${requestedPath}`);
    }
  }

  return fullPath;
}
```

### Rate Limiting

Implement per-session limits:
- Max 50 tool calls per chat session
- Max 100KB file writes per session
- Max 10 files modified per session

## Dependencies

Add to `packages/core/package.json`:

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "openai": "^4.77.0",
    "zod": "^3.24.0",
    "zod-to-json-schema": "^3.24.0",
    "diff": "^5.2.0"
  }
}
```

## Testing Requirements

### Unit Tests (`code-agent.test.ts`)

```typescript
describe("CodeAgent", () => {
  describe("Path Validation", () => {
    test("allows valid relative paths", () => {
      expect(() => validatePath("/sandbox", "src/App.tsx")).not.toThrow();
    });

    test("blocks path traversal", () => {
      expect(() => validatePath("/sandbox", "../etc/passwd")).toThrow();
    });

    test("blocks absolute paths", () => {
      expect(() => validatePath("/sandbox", "/etc/passwd")).toThrow();
    });

    test("blocks .env files", () => {
      expect(() => validatePath("/sandbox", ".env.local")).toThrow();
    });
  });

  describe("read_file tool", () => {
    test("reads file with line numbers", async () => {
      // Setup mock file system
      const result = await ReadFileTool.execute(
        { path: "src/App.tsx" },
        mockContext
      );
      expect(result.output).toContain("1 |");
    });

    test("respects line range", async () => {
      const result = await ReadFileTool.execute(
        { path: "src/App.tsx", startLine: 5, endLine: 10 },
        mockContext
      );
      expect(result.output).toContain("5 |");
      expect(result.output).not.toContain("1 |");
    });
  });

  describe("edit_file tool", () => {
    test("replaces exact content", async () => {
      const result = await EditFileTool.execute(
        {
          path: "src/App.tsx",
          oldContent: "Hello World",
          newContent: "Hello Universe",
        },
        mockContext
      );
      expect(result.success).toBe(true);
    });

    test("fails when content not found", async () => {
      const result = await EditFileTool.execute(
        {
          path: "src/App.tsx",
          oldContent: "nonexistent content",
          newContent: "new content",
        },
        mockContext
      );
      expect(result.success).toBe(false);
      expect(result.output).toContain("Could not find");
    });
  });

  describe("Agent Loop", () => {
    test("processes message and returns response", async () => {
      const agent = createCodeAgent(mockConfig);
      const result = await agent.chat("List the files in the project");
      expect(result.success).toBe(true);
      expect(result.response).toBeTruthy();
    });

    test("respects max tool calls limit", async () => {
      const agent = createCodeAgent({ ...mockConfig, maxToolCalls: 2 });
      // Mock LLM to always request tools
      await expect(
        agent.chat("Do something that requires many tool calls")
      ).rejects.toThrow("Max tool calls");
    });
  });
});
```

### Integration Tests (`code-agent.integration.test.ts`)

```typescript
describe("CodeAgent Integration", () => {
  // REQUIRES: Real LLM API key
  // REQUIRES: Docker running for build tests

  test("can read and edit a file", async () => {
    const agent = createCodeAgent(realConfig);
    const result = await agent.chat(
      "Change the h1 title in App.tsx from 'Hello' to 'Welcome'"
    );

    expect(result.success).toBe(true);
    expect(result.filesModified).toContain("src/App.tsx");
    expect(result.compileResult?.success).toBe(true);
  });

  test("handles compile errors gracefully", async () => {
    const agent = createCodeAgent(realConfig);
    const result = await agent.chat(
      "Add a component called 'Broken' that has a syntax error"
    );

    // Agent should try to fix the error
    expect(result.compileResult?.success).toBe(true);
  });
});
```

## Definition of Done

- [ ] CodeAgent class implemented with all 5 tools
- [ ] Tool parameter validation with Zod schemas
- [ ] Path security validation prevents sandbox escape
- [ ] Anthropic Claude integration working
- [ ] OpenAI GPT integration working
- [ ] Streaming events yield correctly
- [ ] Unit tests pass (mocked LLM)
- [ ] Integration tests pass (real LLM)
- [ ] Max tool calls limit enforced
- [ ] Compile check runs after file modifications
- [ ] Error messages are helpful and actionable
