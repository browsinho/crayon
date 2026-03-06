import { formatDistanceToNow } from "date-fns";
import { ToolCallItem } from "./tool-call-item";
import { CompileStatus } from "./compile-status";
import { MarkdownContent } from "./markdown-content";
import type { ChatMessage } from "@/hooks/use-sandbox-chat";
import type { ToolCallEventData } from "@/app/api/sandbox/[sandboxId]/chat/types";

interface AssistantMessageProps {
  message: ChatMessage;
  currentToolCall: ToolCallEventData | null;
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
      <div className="flex-shrink-0 w-6 h-6 rounded-full gradient-bg-sharp" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Crayon Agent</span>
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
