import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  readFile as mcpReadFile,
  writeFile as mcpWriteFile,
  editFile as mcpEditFile,
  listFiles as mcpListFiles,
  runBuild as mcpRunBuild,
  validatePath,
  SecurityError,
} from "./mcp-code-tools.js";

// ==================== CONFIGURATION ====================

export const CodeAgentConfigSchema = z.object({
  sandboxId: z.string().min(1),
  sandboxPath: z.string().min(1),
  containerId: z.string().optional(),

  provider: z.enum(["anthropic", "openai"]),
  model: z.string().optional(),
  apiKey: z.string().min(1),

  maxTokens: z.number().default(4096),
  maxToolCalls: z.number().default(20),

  onProgress: z.function()
    .args(z.custom<AgentEvent>())
    .returns(z.void())
    .optional(),
});

export type CodeAgentConfig = z.infer<typeof CodeAgentConfigSchema>;

// ==================== EVENTS ====================

export type AgentEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "message"
  | "error"
  | "compile_start"
  | "compile_done";

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data: {
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: string;
    success?: boolean;
    content?: string;
    error?: string;
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
  response: string;
  filesModified: string[];
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

// ==================== TOOL SYSTEM ====================

interface ToolContext {
  sandboxPath: string;
  filesModified: string[];
  containerId?: string;
}

interface ToolOutput {
  success: boolean;
  output: string;
}

interface Tool {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (params: any, context: ToolContext) => Promise<ToolOutput>;
}

// ==================== SECURITY ====================
// Security utilities are now imported from mcp-code-tools.ts

// ==================== TOOLS ====================

const ReadFileTool: Tool = {
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
    const result = await mcpReadFile(params, {
      sandboxPath: context.sandboxPath,
      containerId: context.containerId,
    });
    return { success: result.success, output: result.output };
  },
};

const WriteFileTool: Tool = {
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
    const result = await mcpWriteFile(params, {
      sandboxPath: context.sandboxPath,
      containerId: context.containerId,
    });
    if (result.success) {
      context.filesModified.push(params.path);
    }
    return { success: result.success, output: result.output };
  },
};

const EditFileTool: Tool = {
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
    const result = await mcpEditFile(params, {
      sandboxPath: context.sandboxPath,
      containerId: context.containerId,
    });
    if (result.success) {
      context.filesModified.push(params.path);
    }
    return { success: result.success, output: result.output };
  },
};

const ListFilesTool: Tool = {
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
    const result = await mcpListFiles(params, {
      sandboxPath: context.sandboxPath,
      containerId: context.containerId,
    });
    return { success: result.success, output: result.output };
  },
};

const RunBuildTool: Tool = {
  name: "run_build",
  description: `Run the build command to check if the code compiles.
This will run 'npm run build' inside the sandbox container.
Use this after making changes to verify the code is valid.
Returns build output including any errors.`,

  parameters: z.object({}),

  execute: async (
    params: Record<string, never>,
    context: ToolContext
  ): Promise<ToolOutput> => {
    const result = await mcpRunBuild(params, {
      sandboxPath: context.sandboxPath,
      containerId: context.containerId,
    });
    return { success: result.success, output: result.output };
  },
};

const TOOLS: Tool[] = [
  ReadFileTool,
  WriteFileTool,
  EditFileTool,
  ListFilesTool,
  RunBuildTool,
];

// ==================== SYSTEM PROMPT ====================

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
- ALWAYS check if the build passes before finishing`;

// ==================== LLM INTEGRATION ====================

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    input: number;
    output: number;
  };
}

async function callAnthropicLLM(
  config: CodeAgentConfig,
  messages: ChatMessage[]
): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  // Convert messages to Anthropic format
  const anthropicMessages = conversationMessages.map((msg) => {
    if (msg.role === "assistant" && msg.toolCalls) {
      return {
        role: "assistant" as const,
        content: msg.toolCalls.map((tc) => ({
          type: "tool_use" as const,
          id: tc.id,
          name: tc.name,
          input: tc.input,
        })),
      };
    } else if (msg.toolResults) {
      return {
        role: "user" as const,
        content: msg.toolResults.map((tr) => ({
          type: "tool_result" as const,
          tool_use_id: tr.toolCallId,
          content: tr.output,
          is_error: tr.isError,
        })),
      };
    } else {
      return {
        role: msg.role as "user" | "assistant",
        content: msg.content,
      };
    }
  });

  const response = await client.messages.create({
    model: config.model || "claude-sonnet-4-20250514",
    max_tokens: config.maxTokens,
    system: systemMessage?.content,
    messages: anthropicMessages,
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: zodToJsonSchema(t.parameters) as Anthropic.Tool.InputSchema,
    })),
  });

  const content = response.content
    .filter((c): c is Anthropic.ContentBlock & { type: "text" } => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const toolCalls = response.content
    .filter((c): c is Anthropic.ContentBlock & { type: "tool_use" } => c.type === "tool_use")
    .map((c) => ({
      id: c.id,
      name: c.name,
      input: c.input as Record<string, unknown>,
    }));

  return {
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

async function callOpenAILLM(
  config: CodeAgentConfig,
  messages: ChatMessage[]
): Promise<LLMResponse> {
  const client = new OpenAI({ apiKey: config.apiKey });

  // Convert messages to OpenAI format
  const openaiMessages = messages.map((msg) => {
    if (msg.role === "assistant" && msg.toolCalls) {
      return {
        role: "assistant" as const,
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input),
          },
        })),
      };
    } else if (msg.toolResults) {
      return msg.toolResults.map((tr) => ({
        role: "tool" as const,
        tool_call_id: tr.toolCallId,
        content: tr.output,
      }));
    } else {
      return {
        role: msg.role,
        content: msg.content,
      };
    }
  }).flat();

  const response = await client.chat.completions.create({
    model: config.model || "gpt-4o",
    max_tokens: config.maxTokens,
    messages: openaiMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: TOOLS.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      },
    })),
  });

  const message = response.choices[0].message;

  const toolCalls = message.tool_calls?.map((tc) => {
    if (tc.type === "function") {
      return {
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      };
    }
    return null;
  }).filter((tc): tc is { id: string; name: string; input: Record<string, unknown> } => tc !== null);

  return {
    content: message.content || "",
    toolCalls,
    usage: {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
    },
  };
}

// ==================== AGENT IMPLEMENTATION ====================

class CodeAgentImpl implements CodeAgent {
  private config: CodeAgentConfig;
  private history: ChatMessage[] = [];

  constructor(config: CodeAgentConfig) {
    this.config = CodeAgentConfigSchema.parse(config);
  }

  async chat(message: string, history: ChatMessage[] = []): Promise<AgentResult> {
    let result: AgentResult | undefined;

    for await (const event of this.chatStream(message, history)) {
      if (event.type === "message") {
        // This is actually the final result
        result = event as unknown as AgentResult;
      }
    }

    if (!result) {
      throw new Error("No result returned from chat stream");
    }

    return result;
  }

  async *chatStream(
    message: string,
    history: ChatMessage[] = []
  ): AsyncGenerator<AgentEvent, AgentResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: message },
    ];

    let toolCallCount = 0;
    const filesModified: string[] = [];
    const context: ToolContext = {
      sandboxPath: this.config.sandboxPath,
      filesModified,
      containerId: this.config.containerId,
    };

    const totalUsage = { input: 0, output: 0 };

    while (toolCallCount < this.config.maxToolCalls) {
      // Yield thinking event
      const thinkingEvent: AgentEvent = {
        type: "thinking",
        timestamp: Date.now(),
        data: {},
      };
      yield thinkingEvent;
      if (this.config.onProgress) {
        this.config.onProgress(thinkingEvent);
      }

      // Call LLM
      const response = this.config.provider === "anthropic"
        ? await callAnthropicLLM(this.config, messages)
        : await callOpenAILLM(this.config, messages);

      totalUsage.input += response.usage.input;
      totalUsage.output += response.usage.output;

      // Check if LLM wants to use tools
      if (response.toolCalls && response.toolCalls.length > 0) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.content,
          toolCalls: response.toolCalls,
        };
        messages.push(assistantMessage);
        this.history.push(assistantMessage);

        const toolResults: ToolResult[] = [];

        for (const toolCall of response.toolCalls) {
          toolCallCount++;

          // Yield tool call event
          const toolCallEvent: AgentEvent = {
            type: "tool_call",
            timestamp: Date.now(),
            data: {
              toolName: toolCall.name,
              toolInput: toolCall.input,
            },
          };
          yield toolCallEvent;
          if (this.config.onProgress) {
            this.config.onProgress(toolCallEvent);
          }

          // Execute tool
          const tool = TOOLS.find((t) => t.name === toolCall.name);
          if (!tool) {
            const errorResult: ToolResult = {
              toolCallId: toolCall.id,
              output: `Error: Unknown tool: ${toolCall.name}`,
              isError: true,
            };
            toolResults.push(errorResult);
            continue;
          }

          const result = await tool.execute(toolCall.input, context);

          // Yield tool result event
          const toolResultEvent: AgentEvent = {
            type: "tool_result",
            timestamp: Date.now(),
            data: {
              toolOutput: result.output,
              success: result.success,
            },
          };
          yield toolResultEvent;
          if (this.config.onProgress) {
            this.config.onProgress(toolResultEvent);
          }

          toolResults.push({
            toolCallId: toolCall.id,
            output: result.output,
            isError: !result.success,
          });
        }

        // Add tool results to conversation
        const toolResultMessage: ChatMessage = {
          role: "user",
          content: "",
          toolResults,
        };
        messages.push(toolResultMessage);
        this.history.push(toolResultMessage);
      } else {
        // LLM finished - return final message
        const messageEvent: AgentEvent = {
          type: "message",
          timestamp: Date.now(),
          data: { content: response.content },
        };
        yield messageEvent;
        if (this.config.onProgress) {
          this.config.onProgress(messageEvent);
        }

        const finalMessage: ChatMessage = {
          role: "assistant",
          content: response.content,
        };
        messages.push(finalMessage);
        this.history.push(finalMessage);

        // Run compile check if files were modified
        let compileResult;
        if (filesModified.length > 0) {
          const compileStartEvent: AgentEvent = {
            type: "compile_start",
            timestamp: Date.now(),
            data: {},
          };
          yield compileStartEvent;
          if (this.config.onProgress) {
            this.config.onProgress(compileStartEvent);
          }

          const buildResult = await RunBuildTool.execute({}, context);
          compileResult = {
            success: buildResult.success,
            errors: [] as CompileError[],
            output: buildResult.output,
          };

          const compileDoneEvent: AgentEvent = {
            type: "compile_done",
            timestamp: Date.now(),
            data: {
              compileSuccess: compileResult.success,
              compileErrors: compileResult.errors,
            },
          };
          yield compileDoneEvent;
          if (this.config.onProgress) {
            this.config.onProgress(compileDoneEvent);
          }
        }

        return {
          success: true,
          response: response.content,
          filesModified: Array.from(new Set(filesModified)),
          compileResult,
          tokensUsed: totalUsage,
          toolCallsCount: toolCallCount,
        };
      }
    }

    // Max tool calls reached
    throw new Error(`Max tool calls (${this.config.maxToolCalls}) reached`);
  }

  getHistory(): ChatMessage[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }
}

// ==================== MAIN INTERFACE ====================

export interface CodeAgent {
  chat(message: string, history?: ChatMessage[]): Promise<AgentResult>;
  chatStream(
    message: string,
    history?: ChatMessage[]
  ): AsyncGenerator<AgentEvent, AgentResult>;
  getHistory(): ChatMessage[];
  clearHistory(): void;
}

export function createCodeAgent(config: CodeAgentConfig): CodeAgent {
  return new CodeAgentImpl(config);
}

// ==================== EXPORTS ====================

export { validatePath, SecurityError };
