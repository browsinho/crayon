import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RecordPage from "./page";
import * as projectActions from "@/lib/actions/projects";
import * as recordingActions from "@/lib/actions/recording";

// Mock server actions
vi.mock("@/lib/actions/projects", () => ({
  createProject: vi.fn().mockResolvedValue({ id: "test-project-id" }),
}));

vi.mock("@/lib/actions/recording", () => ({
  startRecording: vi.fn().mockResolvedValue({
    sessionId: "test-session-id",
    liveViewUrl: "https://live.anchorbrowser.io/session/test",
  }),
  stopRecording: vi.fn().mockResolvedValue({ projectId: "test-project-id" }),
}));

// Mock useSSE hook
vi.mock("@/hooks/use-sse", () => ({
  useSSE: vi.fn().mockReturnValue({
    data: [],
    error: null,
    isConnected: false,
    close: vi.fn(),
  }),
}));

// Mock useRouter
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

describe("RecordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render initial state with URL input", () => {
    render(<RecordPage />);

    expect(screen.getByText("New Recording")).toBeInTheDocument();
    expect(screen.getByLabelText("Target URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument();
  });

  it("should show recording tips initially", () => {
    render(<RecordPage />);

    expect(screen.getByText("Recording Tips")).toBeInTheDocument();
    expect(screen.getByText(/navigate through the pages/i)).toBeInTheDocument();
  });

  it("should not show recording indicator initially", () => {
    render(<RecordPage />);

    expect(screen.queryByText("REC")).not.toBeInTheDocument();
  });

  it("should start recording when valid URL is submitted", async () => {
    render(<RecordPage />);

    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(projectActions.createProject).toHaveBeenCalledWith({
        name: "example.com",
        sourceUrl: "https://example.com",
      });
    });

    await waitFor(() => {
      expect(recordingActions.startRecording).toHaveBeenCalledWith(
        "test-project-id",
        "https://example.com"
      );
    });
  });

  it("should show recording indicator after starting", async () => {
    render(<RecordPage />);

    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("REC")).toBeInTheDocument();
    });
  });

  it("should show browser embed after starting recording", async () => {
    render(<RecordPage />);

    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByTitle("AnchorBrowser Live View")).toBeInTheDocument();
    });
  });

  it("should navigate to project page after stopping recording", async () => {
    render(<RecordPage />);

    // Start recording
    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.submit(input.closest("form")!);

    // Wait for recording to start
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop & save/i })).toBeInTheDocument();
    });

    // Stop recording
    const stopButton = screen.getByRole("button", { name: /stop & save/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/project/test-project-id");
    });
  });

  it("should display cancel button during recording", async () => {
    render(<RecordPage />);

    // Start recording
    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.submit(input.closest("form")!);

    // Wait for recording to start and buttons to be enabled
    await waitFor(() => {
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    // Wait for transition to complete (button should become enabled)
    await waitFor(() => {
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      expect(cancelButton).not.toBeDisabled();
    });
  });
});
