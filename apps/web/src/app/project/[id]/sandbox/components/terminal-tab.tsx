"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalTabProps {
  sandboxId: string;
}

interface TerminalLine {
  type: "input" | "output" | "error";
  content: string;
}

export function TerminalTab({ sandboxId }: TerminalTabProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    setIsConnecting(true);

    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/sandbox/${sandboxId}/terminal`
    );

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setLines((prev) => [
        ...prev,
        { type: "output", content: "Connected to sandbox terminal." },
      ]);
    };

    ws.onmessage = (event) => {
      const message = event.data;
      setLines((prev) => [...prev, { type: "output", content: message }]);
    };

    ws.onerror = () => {
      setLines((prev) => [
        ...prev,
        { type: "error", content: "Terminal connection error." },
      ]);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      setLines((prev) => [
        ...prev,
        { type: "output", content: "Disconnected from terminal." },
      ]);
    };

    wsRef.current = ws;
  }, [sandboxId]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || !wsRef.current || !isConnected) return;

      setLines((prev) => [...prev, { type: "input", content: `$ ${input}` }]);
      wsRef.current.send(input);
      setInput("");
    },
    [input, isConnected]
  );

  const handleReconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setLines([]);
    connect();
  }, [connect]);

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected
                ? "bg-green-500"
                : isConnecting
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-gray-400"
            )}
          />
          <span className="text-sm text-muted-foreground">
            {isConnected
              ? "Connected"
              : isConnecting
                ? "Connecting..."
                : "Disconnected"}
          </span>
        </div>
        <button
          onClick={handleReconnect}
          disabled={isConnecting}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted disabled:opacity-50"
        >
          {isConnecting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Reconnect
        </button>
      </div>

      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="flex-1 overflow-auto bg-black text-sm font-mono p-4 rounded-lg cursor-text"
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              line.type === "input" && "text-blue-400",
              line.type === "output" && "text-green-400",
              line.type === "error" && "text-red-400",
              "whitespace-pre-wrap"
            )}
          >
            {line.content}
          </div>
        ))}
        {isConnected && (
          <form onSubmit={handleSubmit} className="flex items-center">
            <span className="text-blue-400">$ </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-transparent outline-none text-green-400"
              autoFocus
            />
          </form>
        )}
        {isConnecting && (
          <div className="text-gray-500 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting to terminal...
          </div>
        )}
      </div>
    </div>
  );
}
