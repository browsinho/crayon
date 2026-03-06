import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SandboxPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "project-1" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock the server actions - do not reference external variables
vi.mock("@/lib/actions/sandbox", () => ({
  getSandbox: vi.fn().mockResolvedValue({ success: true, data: null }),
  startSandbox: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: "sandbox-1",
      status: "running",
      ports: { frontend: 3000, backend: 3001 },
      url: "http://localhost:3000",
    },
  }),
  stopSandbox: vi.fn().mockResolvedValue(undefined),
  restartSandbox: vi.fn().mockResolvedValue({
    id: "sandbox-1",
    status: "running",
    ports: { frontend: 3000, backend: 3001 },
    url: "http://localhost:3000",
  }),
  checkSandboxFiles: vi.fn().mockResolvedValue(false),
  getSandboxFiles: vi.fn().mockResolvedValue([]),
  getSandboxFileContent: vi.fn().mockResolvedValue(""),
  getSandboxTables: vi.fn().mockResolvedValue([]),
  getSandboxTableData: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
  createSandboxRow: vi.fn().mockResolvedValue(undefined),
  updateSandboxRow: vi.fn().mockResolvedValue(undefined),
  deleteSandboxRow: vi.fn().mockResolvedValue(undefined),
  getSandboxMcpConfig: vi.fn().mockResolvedValue({
    url: "http://localhost:3002/mcp/sandbox-1",
    apiKey: "sk-test",
    tools: [],
  }),
  getSandboxCheckpoints: vi.fn().mockResolvedValue([]),
  createSandboxCheckpoint: vi.fn().mockResolvedValue({
    id: "checkpoint-1",
    name: "Test",
    createdAt: new Date(),
  }),
  restoreSandboxCheckpoint: vi.fn().mockResolvedValue(undefined),
}));

// Define mockSandbox after mocks for use in tests
const mockSandbox = {
  id: "sandbox-1",
  status: "running" as const,
  ports: { frontend: 3000, backend: 3001 },
  url: "http://localhost:3000",
};

// Mock the SSE hook
vi.mock("@/hooks/use-sse", () => ({
  useSSE: () => ({
    data: [],
    error: null,
    isConnected: false,
    close: vi.fn(),
  }),
}));

describe("SandboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    render(<SandboxPage />);

    // Loading spinner should be present
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should show no sandbox message when sandbox is null", async () => {
    render(<SandboxPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No sandbox available for this project.")
      ).toBeInTheDocument();
    });
  });

  it("should show sandbox controls and tabs when sandbox exists", async () => {
    const { getSandbox } = await import("@/lib/actions/sandbox");
    vi.mocked(getSandbox).mockResolvedValue({ success: true, data: mockSandbox });

    render(<SandboxPage />);

    await waitFor(() => {
      expect(screen.getByText("Sandbox")).toBeInTheDocument();
    });

    // Check for tabs
    expect(screen.getByText("Browser")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });

  it("should switch tabs when tab is clicked", async () => {
    const { getSandbox } = await import("@/lib/actions/sandbox");
    vi.mocked(getSandbox).mockResolvedValue({ success: true, data: mockSandbox });

    render(<SandboxPage />);

    await waitFor(() => {
      expect(screen.getByText("Browser")).toBeInTheDocument();
    });

    // Click on Code tab
    fireEvent.click(screen.getByText("Code"));

    // Code tab should now be active (has border-primary class)
    const codeTab = screen.getByText("Code").closest("button");
    expect(codeTab).toHaveClass("border-primary");
  });

  it("should show placeholder when sandbox is not running", async () => {
    const { getSandbox } = await import("@/lib/actions/sandbox");
    vi.mocked(getSandbox).mockResolvedValue({
      success: true,
      data: { ...mockSandbox, status: "stopped" },
    });

    render(<SandboxPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Start the sandbox to view its contents")
      ).toBeInTheDocument();
    });
  });

  it("should call startSandbox when Start button is clicked", async () => {
    const { getSandbox, startSandbox } = await import("@/lib/actions/sandbox");
    vi.mocked(getSandbox).mockResolvedValue({
      success: true,
      data: { ...mockSandbox, status: "stopped" },
    });

    render(<SandboxPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await waitFor(() => {
      expect(startSandbox).toHaveBeenCalledWith("project-1");
    });
  });

  it("should call stopSandbox when Stop button is clicked", async () => {
    const { getSandbox, stopSandbox } = await import("@/lib/actions/sandbox");
    vi.mocked(getSandbox).mockResolvedValue({ success: true, data: mockSandbox });

    render(<SandboxPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /stop/i }));

    await waitFor(() => {
      expect(stopSandbox).toHaveBeenCalledWith("project-1");
    });
  });

  it("should show checkpoint bar when sandbox is running", async () => {
    const { getSandbox } = await import("@/lib/actions/sandbox");
    vi.mocked(getSandbox).mockResolvedValue({ success: true, data: mockSandbox });

    render(<SandboxPage />);

    await waitFor(() => {
      expect(screen.getByText("Checkpoints:")).toBeInTheDocument();
    });
  });
});
