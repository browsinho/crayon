import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RecordingControls } from "./recording-controls";

describe("RecordingControls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    isRecording: true,
    onStop: vi.fn(),
    onCancel: vi.fn(),
    eventCount: 5,
    networkCount: 10,
    screenshotCount: 3,
    startTime: Date.now(),
    isPending: false,
  };

  it("should render recording timer", () => {
    render(<RecordingControls {...defaultProps} />);

    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("should update timer every second while recording", () => {
    render(<RecordingControls {...defaultProps} />);

    expect(screen.getByText("00:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("00:01")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(59000);
    });
    expect(screen.getByText("01:00")).toBeInTheDocument();
  });

  it("should display event stats", () => {
    render(<RecordingControls {...defaultProps} />);

    expect(screen.getByText("5")).toBeInTheDocument(); // eventCount
    expect(screen.getByText("10")).toBeInTheDocument(); // networkCount
    expect(screen.getByText("3")).toBeInTheDocument(); // screenshotCount
  });

  it("should call onStop when Stop & Save is clicked", () => {
    const onStop = vi.fn();
    render(<RecordingControls {...defaultProps} onStop={onStop} />);

    const stopButton = screen.getByRole("button", { name: /stop & save/i });
    fireEvent.click(stopButton);

    expect(onStop).toHaveBeenCalled();
  });

  it("should call onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<RecordingControls {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it("should disable Stop & Save when not recording", () => {
    render(<RecordingControls {...defaultProps} isRecording={false} />);

    const stopButton = screen.getByRole("button", { name: /stop & save/i });
    expect(stopButton).toBeDisabled();
  });

  it("should disable buttons when isPending is true", () => {
    render(<RecordingControls {...defaultProps} isPending={true} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    const stopButton = screen.getByRole("button", { name: /saving/i });

    expect(cancelButton).toBeDisabled();
    expect(stopButton).toBeDisabled();
  });

  it("should show Saving... text when isPending", () => {
    render(<RecordingControls {...defaultProps} isPending={true} />);

    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it("should reset timer when not recording", () => {
    render(<RecordingControls {...defaultProps} isRecording={false} startTime={0} />);

    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("should display recording indicator animation when recording", () => {
    const { container } = render(<RecordingControls {...defaultProps} />);

    const indicator = container.querySelector(".animate-pulse");
    expect(indicator).toBeInTheDocument();
  });
});
