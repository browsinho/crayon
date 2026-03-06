import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import type { ChatMessage } from "@/hooks/use-sandbox-chat";
import type { ToolCallEventData } from "@/app/api/sandbox/[sandboxId]/chat/types";

interface MessageListProps {
  messages: ChatMessage[];
  currentToolCall: ToolCallEventData | null;
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
