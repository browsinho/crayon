import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkPanel } from "./network-panel";
import type { RecordingEvent } from "@/app/api/recording/route";

describe("NetworkPanel", () => {
  const createNetworkEvent = (
    method: string,
    url: string,
    status: number,
    timestamp = Date.now()
  ): RecordingEvent => ({
    type: "network",
    sessionId: "test-session",
    timestamp,
    data: { method, url, status },
  });

  it("should render empty state when no network events", () => {
    const onClear = vi.fn();
    render(<NetworkPanel events={[]} onClear={onClear} />);

    expect(screen.getByText(/no network requests yet/i)).toBeInTheDocument();
  });

  it("should render network events with method, url path, and status", () => {
    const onClear = vi.fn();
    const events = [createNetworkEvent("GET", "https://api.example.com/users?page=1", 200)];

    render(<NetworkPanel events={events} onClear={onClear} />);

    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("/users?page=1")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("should filter out non-network events", () => {
    const onClear = vi.fn();
    const events: RecordingEvent[] = [
      { type: "navigate", sessionId: "test", timestamp: Date.now(), data: { url: "/" } },
      createNetworkEvent("POST", "https://api.example.com/login", 201),
    ];

    render(<NetworkPanel events={events} onClear={onClear} />);

    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.queryByText("navigate")).not.toBeInTheDocument();
  });

  it("should call onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    const events = [createNetworkEvent("GET", "https://api.example.com/data", 200)];

    render(<NetworkPanel events={events} onClear={onClear} />);

    const clearButton = screen.getByTitle("Clear network");
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalled();
  });

  it("should disable clear button when no network events", () => {
    const onClear = vi.fn();
    render(<NetworkPanel events={[]} onClear={onClear} />);

    const clearButton = screen.getByTitle("Clear network");
    expect(clearButton).toBeDisabled();
  });

  it("should display multiple network events", () => {
    const onClear = vi.fn();
    const events = [
      createNetworkEvent("GET", "https://api.example.com/users", 200),
      createNetworkEvent("POST", "https://api.example.com/login", 201),
      createNetworkEvent("DELETE", "https://api.example.com/users/1", 204),
    ];

    render(<NetworkPanel events={events} onClear={onClear} />);

    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("DELETE")).toBeInTheDocument();
  });
});
