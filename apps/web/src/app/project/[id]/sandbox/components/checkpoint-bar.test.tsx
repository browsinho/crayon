import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CheckpointBar } from "./checkpoint-bar";

// Mock the server actions
vi.mock("@/lib/actions/sandbox", () => ({
  getSandboxCheckpoints: vi.fn().mockResolvedValue([
    { id: "initial", name: "Initial", createdAt: new Date() },
    { id: "checkpoint-1", name: "After login", createdAt: new Date() },
  ]),
  createSandboxCheckpoint: vi.fn().mockResolvedValue({
    id: "checkpoint-new",
    name: "New Checkpoint",
    createdAt: new Date(),
  }),
  restoreSandboxCheckpoint: vi.fn().mockResolvedValue(undefined),
}));

describe("CheckpointBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render checkpoints after loading", async () => {
    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("Initial")).toBeInTheDocument();
      expect(screen.getByText("After login")).toBeInTheDocument();
    });
  });

  it("should show Checkpoints label", async () => {
    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("Checkpoints:")).toBeInTheDocument();
    });
  });

  it("should show Create button", async () => {
    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("Create")).toBeInTheDocument();
    });
  });

  it("should show input field when Create is clicked", async () => {
    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create"));

    expect(
      screen.getByPlaceholderText("Checkpoint name")
    ).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("should hide input field when Cancel is clicked", async () => {
    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(
      screen.queryByPlaceholderText("Checkpoint name")
    ).not.toBeInTheDocument();
  });

  it("should call createSandboxCheckpoint when Save is clicked", async () => {
    const { createSandboxCheckpoint } = await import("@/lib/actions/sandbox");

    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create"));

    const input = screen.getByPlaceholderText("Checkpoint name");
    fireEvent.change(input, { target: { value: "New Checkpoint" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(createSandboxCheckpoint).toHaveBeenCalledWith(
        "sandbox-1",
        "New Checkpoint"
      );
    });
  });

  it("should highlight the current checkpoint", async () => {
    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("Initial")).toBeInTheDocument();
    });

    // First checkpoint should be selected by default
    const initialButton = screen.getByText("Initial").closest("button");
    expect(initialButton).toHaveClass("bg-primary");
  });

  it("should call restoreSandboxCheckpoint when checkpoint is clicked", async () => {
    const { restoreSandboxCheckpoint } = await import("@/lib/actions/sandbox");

    render(<CheckpointBar sandboxId="sandbox-1" />);

    await waitFor(() => {
      expect(screen.getByText("After login")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("After login"));

    await waitFor(() => {
      expect(restoreSandboxCheckpoint).toHaveBeenCalledWith(
        "sandbox-1",
        "checkpoint-1"
      );
    });
  });
});
