# Sandbox Chat UI

Chat interface component for AI-assisted sandbox code editing.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "shadcn/ui chat component React 2025"
- Search: "React streaming text animation typewriter"
- Search: "Monaco editor syntax highlighting readonly"
- Search: "Tailwind CSS chat bubble component"

## Purpose

Provides a user-friendly chat interface where users can give natural language instructions to edit their sandbox code. Shows real-time progress including tool calls, file changes, and compilation status.

## Acceptance Criteria

- [ ] Chat input with send button and keyboard shortcuts (Enter to send, Shift+Enter for newline)
- [ ] Message list showing user and assistant messages
- [ ] Real-time display of tool calls as they happen (reading files, editing, etc.)
- [ ] Syntax-highlighted code diffs for file changes
- [ ] Compilation status indicator (success/error with details)
- [ ] Loading states during processing
- [ ] Error display with retry option
- [ ] Message history persisted in local state
- [ ] Responsive design (works on mobile and desktop)
- [ ] Keyboard accessible (a11y compliant)

## Interface

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat-panel.tsx

interface ChatPanelProps {
  sandboxId: string;
  className?: string;
}

// Internal state types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  
  // Assistant-only fields
  toolCalls?: ToolCallDisplay[];
  compileResult?: CompileResultDisplay;
  isStreaming?: boolean;
}

interface ToolCallDisplay {
  name: string;
  input: Record<string, unknown>;
  output?: string;
  success?: boolean;
  isLoading: boolean;
}

interface CompileResultDisplay {
  success: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
  }>;
  warnings: Array<{
    file: string;
    line: number;
    message: string;
  }>;
}
```

## Component Structure

```
ChatPanel
├── ChatHeader
│   ├── Title ("AI Assistant")
│   ├── Status indicator (connected/processing)
│   └── Clear history button
├── MessageList
│   ├── WelcomeMessage (shown when empty)
│   └── Message[] (scrollable)
│       ├── UserMessage
│       └── AssistantMessage
│           ├── MessageContent (markdown rendered)
│           ├── ToolCallList
│           │   └── ToolCallItem
│           │       ├── ToolIcon
│           │       ├── ToolName + Input preview
│           │       ├── ToolOutput (collapsible)
│           │       └── LoadingSpinner (when active)
│           └── CompileStatus
│               ├── SuccessIndicator / ErrorIndicator
│               └── ErrorList (if errors)
├── ChatInput
│   ├── Textarea (auto-resize)
│   ├── CharacterCount
│   └── SendButton
└── SuggestedPrompts (shown when empty)
```

## Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 AI Assistant                        ● Connected   [Clear]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  👋 Hi! I can help you edit your sandbox code.           │  │
│  │                                                          │  │
│  │  Try asking me to:                                       │  │
│  │  • "Change the page title to 'Welcome'"                  │  │
│  │  • "Add a new button to the header"                      │  │
│  │  • "Fix the TypeScript error in App.tsx"                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ You ────────────────────────────────────────────────────┐  │
│  │  Change the title to "My Dashboard"                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Assistant ──────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  ┌─ 📖 read_file ─────────────────────────────────────┐  │  │
│  │  │  src/App.tsx                                       │  │  │
│  │  │  ✓ Read 45 lines                          [Show ▾] │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌─ ✏️ edit_file ─────────────────────────────────────┐  │  │
│  │  │  src/App.tsx                                       │  │  │
│  │  │  - <h1>Hello World</h1>                            │  │  │
│  │  │  + <h1>My Dashboard</h1>                           │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌─ ✅ Build ─────────────────────────────────────────┐  │  │
│  │  │  Compiled successfully in 1.2s                     │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  I've updated the title in App.tsx from "Hello World"   │  │
│  │  to "My Dashboard". The change has been compiled and    │  │
│  │  should be visible in your sandbox now.                 │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐ [Send] │
│  │ Type a message...                                   │        │
│  └─────────────────────────────────────────────────────┘        │
│  Press Enter to send, Shift+Enter for new line      142/10000  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation

### Main ChatPanel Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat-panel.tsx

"use client";

import { useRef, useEffect } from "react";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";
import { ChatHeader } from "./chat/chat-header";
import { MessageList } from "./chat/message-list";
import { ChatInput } from "./chat/chat-input";
import { SuggestedPrompts } from "./chat/suggested-prompts";
import { cn } from "@/lib/utils";

export function ChatPanel({ sandboxId, className }: ChatPanelProps) {
  const {
    messages,
    isProcessing,
    currentToolCall,
    sendMessage,
    clearHistory,
    error,
  } = useSandboxChat(sandboxId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentToolCall]);

  const handleSend = async (content: string) => {
    if (!content.trim() || isProcessing) return;
    await sendMessage(content.trim());
  };

  const handleSuggestedPrompt = (prompt: string) => {
    handleSend(prompt);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <ChatHeader
        isProcessing={isProcessing}
        onClear={clearHistory}
        hasMessages={messages.length > 0}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <SuggestedPrompts onSelect={handleSuggestedPrompt} />
        ) : (
          <MessageList
            messages={messages}
            currentToolCall={currentToolCall}
            isProcessing={isProcessing}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isDisabled={isProcessing}
        placeholder={isProcessing ? "Processing..." : "Type a message..."}
      />
    </div>
  );
}
```

### ChatHeader Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/chat-header.tsx

import { Bot, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  isProcessing: boolean;
  onClear: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ isProcessing, onClear, hasMessages }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">AI Assistant</h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {isProcessing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>Connected</span>
            </>
          )}
        </div>

        {/* Clear button */}
        {hasMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

### MessageList Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/message-list.tsx

import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import type { Message, ToolCallDisplay } from "../chat-panel";

interface MessageListProps {
  messages: Message[];
  currentToolCall: ToolCallDisplay | null;
  isProcessing: boolean;
}

export function MessageList({
  messages,
  currentToolCall,
  isProcessing,
}: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;
        const showCurrentTool = isLast && message.role === "assistant" && currentToolCall;

        if (message.role === "user") {
          return <UserMessage key={message.id} message={message} />;
        }

        return (
          <AssistantMessage
            key={message.id}
            message={message}
            currentToolCall={showCurrentTool ? currentToolCall : null}
            isStreaming={isLast && isProcessing}
          />
        );
      })}
    </div>
  );
}
```

### UserMessage Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/user-message.tsx

import { User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserMessageProps {
  message: Message;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">You</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
```

### AssistantMessage Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/assistant-message.tsx

import { Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ToolCallItem } from "./tool-call-item";
import { CompileStatus } from "./compile-status";
import { MarkdownContent } from "./markdown-content";

interface AssistantMessageProps {
  message: Message;
  currentToolCall: ToolCallDisplay | null;
  isStreaming: boolean;
}

export function AssistantMessage({
  message,
  currentToolCall,
  isStreaming,
}: AssistantMessageProps) {
  const allToolCalls = [
    ...(message.toolCalls || []),
    ...(currentToolCall ? [{ ...currentToolCall, isLoading: true }] : []),
  ];

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Assistant</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>
        </div>

        {/* Tool calls */}
        {allToolCalls.length > 0 && (
          <div className="space-y-2">
            {allToolCalls.map((tool, index) => (
              <ToolCallItem key={index} toolCall={tool} />
            ))}
          </div>
        )}

        {/* Compile status */}
        {message.compileResult && (
          <CompileStatus result={message.compileResult} />
        )}

        {/* Message content */}
        {message.content && (
          <div className="text-sm">
            <MarkdownContent content={message.content} />
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### ToolCallItem Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/tool-call-item.tsx

import { useState } from "react";
import {
  FileText,
  FilePlus,
  FileEdit,
  FolderTree,
  Hammer,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const toolIcons: Record<string, typeof FileText> = {
  read_file: FileText,
  write_file: FilePlus,
  edit_file: FileEdit,
  list_files: FolderTree,
  run_build: Hammer,
};

const toolLabels: Record<string, string> = {
  read_file: "Reading file",
  write_file: "Creating file",
  edit_file: "Editing file",
  list_files: "Listing files",
  run_build: "Building",
};

interface ToolCallItemProps {
  toolCall: ToolCallDisplay;
}

export function ToolCallItem({ toolCall }: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = toolIcons[toolCall.name] || FileText;
  const label = toolLabels[toolCall.name] || toolCall.name;

  // Get file path from input if available
  const filePath = (toolCall.input as { path?: string })?.path;

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        {/* Status icon */}
        {toolCall.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : toolCall.success ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : toolCall.success === false ? (
          <X className="h-4 w-4 text-red-500" />
        ) : null}

        {/* Tool icon */}
        <Icon className="h-4 w-4 text-muted-foreground" />

        {/* Label */}
        <span className="text-sm font-medium">{label}</span>

        {/* File path */}
        {filePath && (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {filePath}
          </code>
        )}

        {/* Expand arrow */}
        <div className="ml-auto">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && toolCall.output && (
        <div className="border-t bg-muted/10">
          <pre className="p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto">
            {toolCall.output}
          </pre>
        </div>
      )}
    </div>
  );
}
```

### CompileStatus Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/compile-status.tsx

import { Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompileStatusProps {
  result: CompileResultDisplay;
}

export function CompileStatus({ result }: CompileStatusProps) {
  return (
    <div
      className={cn(
        "border rounded-lg p-3",
        result.success
          ? "bg-green-500/10 border-green-500/30"
          : "bg-red-500/10 border-red-500/30"
      )}
    >
      <div className="flex items-center gap-2">
        {result.success ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Build successful
            </span>
          </>
        ) : (
          <>
            <X className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              Build failed ({result.errors.length} error
              {result.errors.length !== 1 ? "s" : ""})
            </span>
          </>
        )}
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.errors.slice(0, 5).map((error, index) => (
            <div key={index} className="text-xs font-mono">
              <span className="text-muted-foreground">
                {error.file}:{error.line}:{error.column}
              </span>
              <span className="text-red-600 dark:text-red-400 ml-2">
                {error.message}
              </span>
            </div>
          ))}
          {result.errors.length > 5 && (
            <div className="text-xs text-muted-foreground">
              ...and {result.errors.length - 5} more errors
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          <span>{result.warnings.length} warning(s)</span>
        </div>
      )}
    </div>
  );
}
```

### ChatInput Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/chat-input.tsx

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (content: string) => void;
  isDisabled: boolean;
  placeholder: string;
}

const MAX_LENGTH = 10000;

export function ChatInput({ onSend, isDisabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (value.trim() && !isDisabled) {
      onSend(value);
      setValue("");
    }
  };

  return (
    <div className="border-t p-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            className="min-h-[44px] max-h-[200px] resize-none pr-12"
            rows={1}
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={isDisabled || !value.trim()}
          size="icon"
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>
          {value.length}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
```

### SuggestedPrompts Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/suggested-prompts.tsx

import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUGGESTED_PROMPTS = [
  "Change the page title",
  "Add a new button to the header",
  "Update the color scheme to blue",
  "Add a footer with copyright",
  "Create a new Card component",
  "Fix any TypeScript errors",
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="space-y-4">
      {/* Welcome message */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Welcome to AI Assistant</h3>
            <p className="text-sm text-muted-foreground mt-1">
              I can help you edit your sandbox code using natural language.
              Try one of the suggestions below or type your own request.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested prompts */}
      <div>
        <h4 className="text-sm font-medium mb-2">Try asking:</h4>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onSelect(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### MarkdownContent Component

```typescript
// apps/web/src/app/project/[id]/sandbox/components/chat/markdown-content.tsx

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      className="prose prose-sm dark:prose-invert max-w-none"
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              className="rounded-lg text-xs"
              {...props}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code
              className="bg-muted px-1.5 py-0.5 rounded text-xs"
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

## Integration with Sandbox Page

```typescript
// apps/web/src/app/project/[id]/sandbox/page.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "./components/chat-panel";
// ... other imports

export default function SandboxPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;

  return (
    <div className="flex flex-col h-full">
      {/* ... existing header ... */}

      <Tabs defaultValue="browser" className="flex-1 flex flex-col">
        <TabsList className="mx-4">
          <TabsTrigger value="browser">Browser</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="chat">AI Assistant</TabsTrigger>  {/* NEW */}
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="browser" className="h-full">
            {/* ... existing browser tab ... */}
          </TabsContent>

          <TabsContent value="code" className="h-full">
            {/* ... existing code tab ... */}
          </TabsContent>

          <TabsContent value="chat" className="h-full">
            <ChatPanel sandboxId={projectId} />
          </TabsContent>

          {/* ... other tabs ... */}
        </div>
      </Tabs>
    </div>
  );
}
```

## Dependencies

Add to `apps/web/package.json`:

```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.6.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/react-syntax-highlighter": "^15.5.0"
  }
}
```

## Accessibility Requirements

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Enter to send message
   - Escape to clear input
   - Arrow keys in message list

2. **Screen Reader Support**
   - Announce new messages
   - Label all buttons and inputs
   - Describe tool call status

3. **Focus Management**
   - Return focus to input after sending
   - Focus new error messages

```typescript
// Add to MessageList
useEffect(() => {
  if (messages.length > 0) {
    // Announce new message to screen readers
    const lastMessage = messages[messages.length - 1];
    const announcement = `${lastMessage.role === 'user' ? 'You said' : 'Assistant replied'}: ${lastMessage.content.slice(0, 100)}`;
    
    // Use aria-live region
    const liveRegion = document.getElementById('chat-announcements');
    if (liveRegion) {
      liveRegion.textContent = announcement;
    }
  }
}, [messages]);
```

## Testing Requirements

### Unit Tests (`chat-panel.test.tsx`)

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPanel } from "./chat-panel";

describe("ChatPanel", () => {
  test("renders welcome message when empty", () => {
    render(<ChatPanel sandboxId="test" />);
    expect(screen.getByText(/Welcome to AI Assistant/i)).toBeInTheDocument();
  });

  test("sends message on Enter key", async () => {
    const { container } = render(<ChatPanel sandboxId="test" />);
    const input = container.querySelector("textarea");
    
    fireEvent.change(input!, { target: { value: "Hello" } });
    fireEvent.keyDown(input!, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });

  test("disables input while processing", async () => {
    // Mock useSandboxChat to return isProcessing: true
    render(<ChatPanel sandboxId="test" />);
    
    const input = screen.getByPlaceholderText(/Processing/i);
    expect(input).toBeDisabled();
  });

  test("displays error message", () => {
    // Mock useSandboxChat with error
    render(<ChatPanel sandboxId="test" />);
    expect(screen.getByText(/error message/i)).toBeInTheDocument();
  });
});

describe("ToolCallItem", () => {
  test("shows loading state", () => {
    render(
      <ToolCallItem
        toolCall={{ name: "read_file", input: { path: "test.tsx" }, isLoading: true }}
      />
    );
    expect(screen.getByRole("status")).toHaveClass("animate-spin");
  });

  test("expands to show output", () => {
    render(
      <ToolCallItem
        toolCall={{
          name: "read_file",
          input: { path: "test.tsx" },
          output: "file content",
          success: true,
          isLoading: false,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("file content")).toBeInTheDocument();
  });
});

describe("CompileStatus", () => {
  test("shows success state", () => {
    render(<CompileStatus result={{ success: true, errors: [], warnings: [] }} />);
    expect(screen.getByText(/Build successful/i)).toBeInTheDocument();
  });

  test("shows errors", () => {
    render(
      <CompileStatus
        result={{
          success: false,
          errors: [{ file: "test.tsx", line: 1, column: 1, message: "Error!" }],
          warnings: [],
        }}
      />
    );
    expect(screen.getByText(/Build failed/i)).toBeInTheDocument();
    expect(screen.getByText("Error!")).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
describe("ChatPanel Integration", () => {
  // REQUIRES: Running API server

  test("sends message and receives response", async () => {
    render(<ChatPanel sandboxId="test-sandbox" />);

    const input = screen.getByPlaceholderText(/Type a message/i);
    fireEvent.change(input, { target: { value: "List files" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/files/i)).toBeInTheDocument();
      },
      { timeout: 30000 }
    );
  });
});
```

## Definition of Done

- [ ] ChatPanel component renders correctly
- [ ] Messages display with proper formatting
- [ ] Tool calls show with expand/collapse
- [ ] Compile status shows success/error state
- [ ] Input supports Enter and Shift+Enter
- [ ] Character count displays
- [ ] Suggested prompts work
- [ ] Auto-scroll to new messages
- [ ] Loading states display correctly
- [ ] Error messages display with retry option
- [ ] Keyboard accessible (a11y)
- [ ] Screen reader compatible
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Works on mobile and desktop
