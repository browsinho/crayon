import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogViewer, type LogEntry } from "./log-viewer";

describe("LogViewer", () => {
  beforeEach(() => {
    // Mock scrollTo
    Element.prototype.scrollTo = vi.fn();
  });

  it("should render empty state when no logs", () => {
    render(<LogViewer logs={[]} />);
    expect(screen.getByText("Waiting for logs...")).toBeInTheDocument();
  });

  it("should render log entries", () => {
    const logs: LogEntry[] = [
      { timestamp: "10:00:00", message: "First log" },
      { timestamp: "10:00:01", message: "Second log" },
    ];

    render(<LogViewer logs={logs} />);

    expect(screen.getByText("First log")).toBeInTheDocument();
    expect(screen.getByText("Second log")).toBeInTheDocument();
    expect(screen.getByText("[10:00:00]")).toBeInTheDocument();
    expect(screen.getByText("[10:00:01]")).toBeInTheDocument();
  });

  it("should apply correct styles for different log levels", () => {
    const logs: LogEntry[] = [
      { timestamp: "10:00:00", message: "Info message", level: "info" },
      { timestamp: "10:00:01", message: "Warning message", level: "warn" },
      { timestamp: "10:00:02", message: "Error message", level: "error" },
    ];

    render(<LogViewer logs={logs} />);

    const infoLog = screen.getByText("Info message").closest("div");
    const warnLog = screen.getByText("Warning message").closest("div");
    const errorLog = screen.getByText("Error message").closest("div");

    expect(infoLog).toHaveClass("text-muted-foreground");
    expect(warnLog).toHaveClass("text-yellow-500");
    expect(errorLog).toHaveClass("text-red-500");
  });

  it("should auto-scroll when new logs arrive", () => {
    const logs: LogEntry[] = [{ timestamp: "10:00:00", message: "First log" }];

    const { rerender } = render(<LogViewer logs={logs} />);

    const newLogs = [
      ...logs,
      { timestamp: "10:00:01", message: "Second log" },
    ];

    rerender(<LogViewer logs={newLogs} />);

    expect(Element.prototype.scrollTo).toHaveBeenCalled();
  });

  it("should show scroll-to-bottom button when scrolled up", () => {
    const logs: LogEntry[] = Array.from({ length: 50 }, (_, i) => ({
      timestamp: `10:00:${String(i).padStart(2, "0")}`,
      message: `Log entry ${i}`,
    }));

    render(<LogViewer logs={logs} />);

    // Simulate scrolling away from bottom
    const container = screen.getByText("Log entry 0").closest(".overflow-auto");
    if (container) {
      Object.defineProperty(container, "scrollHeight", { value: 1000 });
      Object.defineProperty(container, "scrollTop", { value: 0 });
      Object.defineProperty(container, "clientHeight", { value: 192 });
      fireEvent.scroll(container);
    }

    // Button should appear
    const scrollButton = screen.queryByText("Auto-scroll");
    expect(scrollButton).toBeInTheDocument();
  });
});
