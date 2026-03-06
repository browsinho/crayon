"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ToolCallEventData,
  CompileDoneEventData,
} from "@/app/api/sandbox/[sandboxId]/chat/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallEventData[];
  compileResult?: CompileDoneEventData;
}

export interface UseSandboxChatReturn {
  messages: ChatMessage[];
  isProcessing: boolean;
  currentToolCall: ToolCallEventData | null;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  error: string | null;
}

export function useSandboxChat(sandboxId: string): UseSandboxChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentToolCall, setCurrentToolCall] =
    useState<ToolCallEventData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      setError(null);
      setIsProcessing(true);

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Prepare assistant message placeholder
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        toolCalls: [],
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Create abort controller
        abortControllerRef.current = new AbortController();

        // Build history for API
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Make streaming request
        const response = await fetch(`/api/sandbox/${sandboxId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, history }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Request failed");
        }

        // Read SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete event in buffer

          for (const eventStr of lines) {
            if (!eventStr.trim()) continue;

            const eventMatch = eventStr.match(/event: (\w+)\ndata: (.+)/s);
            if (!eventMatch) continue;

            const [, eventType, dataStr] = eventMatch;
            const data = JSON.parse(dataStr);

            // Handle different event types
            switch (eventType) {
              case "tool_call":
                setCurrentToolCall(data as ToolCallEventData);
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.toolCalls = [...(last.toolCalls || []), data];
                  }
                  return updated;
                });
                break;

              case "tool_result":
                setCurrentToolCall(null);
                break;

              case "message":
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.content = data.content;
                  }
                  return updated;
                });
                break;

              case "compile_done":
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.compileResult = data as CompileDoneEventData;
                  }
                  return updated;
                });
                break;

              case "error":
                setError(data.message);
                break;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsProcessing(false);
        setCurrentToolCall(null);
        abortControllerRef.current = null;
      }
    },
    [sandboxId, messages]
  );

  const clearHistory = useCallback(() => {
    // Cancel any in-progress request
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isProcessing,
    currentToolCall,
    sendMessage,
    clearHistory,
    error,
  };
}
