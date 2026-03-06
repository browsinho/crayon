import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventFeed } from "./event-feed";
import type { RecordingEvent } from "@/app/api/recording/route";

describe("EventFeed", () => {
  const mockStartTime = Date.now() - 30000; // 30 seconds ago

  const createEvent = (
    type: RecordingEvent["type"],
    data?: RecordingEvent["data"],
    offsetMs = 0
  ): RecordingEvent => ({
    type,
    sessionId: "test-session",
    timestamp: mockStartTime + offsetMs,
    data,
  });

  it("should render empty state when no events", () => {
    const onClear = vi.fn();
    render(<EventFeed events={[]} startTime={mockStartTime} onClear={onClear} />);

    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
  });

  it("should render navigate events", () => {
    const onClear = vi.fn();
    const events = [createEvent("navigate", { url: "/dashboard" }, 5000)];

    render(<EventFeed events={events} startTime={mockStartTime} onClear={onClear} />);

    expect(screen.getByText(/navigate \/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText("00:05")).toBeInTheDocument();
  });

  it("should render click events", () => {
    const onClear = vi.fn();
    const events = [createEvent("click", { selector: ".submit-btn" }, 12000)];

    render(<EventFeed events={events} startTime={mockStartTime} onClear={onClear} />);

    expect(screen.getByText(/click \.submit-btn/i)).toBeInTheDocument();
    expect(screen.getByText("00:12")).toBeInTheDocument();
  });

  it("should render input events", () => {
    const onClear = vi.fn();
    const events = [createEvent("input", { selector: "#email" }, 18000)];

    render(<EventFeed events={events} startTime={mockStartTime} onClear={onClear} />);

    expect(screen.getByText(/type #email/i)).toBeInTheDocument();
  });

  it("should filter out non-interaction events", () => {
    const onClear = vi.fn();
    const events = [
      createEvent("connected", undefined, 0),
      createEvent("network", { method: "GET", url: "/api" }, 1000),
      createEvent("navigate", { url: "/" }, 2000),
    ];

    render(<EventFeed events={events} startTime={mockStartTime} onClear={onClear} />);

    expect(screen.getByText(/navigate \//i)).toBeInTheDocument();
    expect(screen.queryByText(/session connected/i)).not.toBeInTheDocument();
  });

  it("should call onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    const events = [createEvent("navigate", { url: "/" }, 2000)];

    render(<EventFeed events={events} startTime={mockStartTime} onClear={onClear} />);

    const clearButton = screen.getByTitle("Clear events");
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalled();
  });

  it("should disable clear button when no events", () => {
    const onClear = vi.fn();
    render(<EventFeed events={[]} startTime={mockStartTime} onClear={onClear} />);

    const clearButton = screen.getByTitle("Clear events");
    expect(clearButton).toBeDisabled();
  });
});
