"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSSEOptions {
  onMessage?: (data: unknown) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseSSEReturn<T> {
  data: T[];
  error: Error | null;
  isConnected: boolean;
  close: () => void;
}

export function useSSE<T>(
  url: string | null,
  options: UseSSEOptions = {}
): UseSSEReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef(options);

  // Keep options ref up to date
  optionsRef.current = options;

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      optionsRef.current.onClose?.();
    }
  }, []);

  useEffect(() => {
    if (!url) {
      return;
    }

    // Close any existing connection
    close();

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      optionsRef.current.onOpen?.();
    };

    eventSource.onerror = () => {
      const err = new Error("SSE connection failed");
      setError(err);
      setIsConnected(false);
      optionsRef.current.onError?.(err);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as T;
        setData((prev) => [...prev, parsed]);
        optionsRef.current.onMessage?.(parsed);
      } catch (parseError) {
        console.error("Failed to parse SSE message:", parseError);
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [url, close]);

  return { data, error, isConnected, close };
}
