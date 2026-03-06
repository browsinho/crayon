"use client";

import { useRef, useEffect } from "react";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";
import { ChatHeader } from "./chat/chat-header";
import { MessageList } from "./chat/message-list";
import { ChatInput } from "./chat/chat-input";
import { SuggestedPrompts } from "./chat/suggested-prompts";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  sandboxId: string;
  className?: string;
  onClose?: () => void;
}

export function ChatPanel({ sandboxId, className, onClose }: ChatPanelProps) {
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
        onClose={onClose || (() => {})}
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
