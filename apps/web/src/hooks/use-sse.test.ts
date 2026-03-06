import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSSE } from "./use-sse";

// Mock EventSource
class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readyState = 0;

  static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  // Helper methods for testing
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError() {
    this.onerror?.({} as Event);
  }
}

describe("useSSE", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should not connect when url is null", () => {
    const { result } = renderHook(() => useSSE(null));

    expect(result.current.isConnected).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(MockEventSource.instances.length).toBe(0);
  });

  it("should connect to SSE endpoint", async () => {
    const { result } = renderHook(() => useSSE("/api/test"));

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toBe("/api/test");

    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it("should receive and accumulate messages", async () => {
    const { result } = renderHook(() => useSSE<{ type: string }>("/api/test"));

    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      MockEventSource.instances[0].simulateMessage({ type: "first" });
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]).toEqual({ type: "first" });
    });

    act(() => {
      MockEventSource.instances[0].simulateMessage({ type: "second" });
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[1]).toEqual({ type: "second" });
    });
  });

  it("should handle errors", async () => {
    const { result } = renderHook(() => useSSE("/api/test"));

    act(() => {
      MockEventSource.instances[0].simulateError();
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe("SSE connection failed");
      expect(result.current.isConnected).toBe(false);
    });
  });

  it("should call callbacks", async () => {
    const onOpen = vi.fn();
    const onMessage = vi.fn();
    const onError = vi.fn();

    renderHook(() =>
      useSSE("/api/test", { onOpen, onMessage, onError })
    );

    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });

    await waitFor(() => {
      expect(onOpen).toHaveBeenCalled();
    });

    act(() => {
      MockEventSource.instances[0].simulateMessage({ test: true });
    });

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({ test: true });
    });

    act(() => {
      MockEventSource.instances[0].simulateError();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it("should close connection when unmounted", () => {
    const { unmount } = renderHook(() => useSSE("/api/test"));

    const instance = MockEventSource.instances[0];
    expect(instance.readyState).toBe(0);

    unmount();

    expect(instance.readyState).toBe(2);
  });

  it("should close connection manually", async () => {
    const { result } = renderHook(() => useSSE("/api/test"));

    act(() => {
      MockEventSource.instances[0].simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.close();
    });

    expect(MockEventSource.instances[0].readyState).toBe(2);
    expect(result.current.isConnected).toBe(false);
  });
});
