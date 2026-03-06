import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SandboxControls } from "./sandbox-controls";
import type { Sandbox } from "@crayon/types";

const createMockSandbox = (status: Sandbox["status"]): Sandbox => ({
  id: "sandbox-1",
  status,
  ports: { frontend: 3000, backend: 3001 },
});

describe("SandboxControls", () => {
  const defaultProps = {
    projectId: "project-1",
    isPending: false,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onRestart: vi.fn(),
  };

  it("should render sandbox controls with status", () => {
    const sandbox = createMockSandbox("running");

    render(<SandboxControls {...defaultProps} sandbox={sandbox} />);

    expect(screen.getByText("Sandbox")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("should show Start button when stopped", () => {
    const sandbox = createMockSandbox("stopped");
    const onStart = vi.fn();

    render(
      <SandboxControls {...defaultProps} sandbox={sandbox} onStart={onStart} />
    );

    const startButton = screen.getByRole("button", { name: /start/i });
    expect(startButton).toBeInTheDocument();

    fireEvent.click(startButton);
    expect(onStart).toHaveBeenCalled();
  });

  it("should show Stop and Restart buttons when running", () => {
    const sandbox = createMockSandbox("running");
    const onStop = vi.fn();
    const onRestart = vi.fn();

    render(
      <SandboxControls
        {...defaultProps}
        sandbox={sandbox}
        onStop={onStop}
        onRestart={onRestart}
      />
    );

    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /restart/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /restart/i }));
    expect(onRestart).toHaveBeenCalled();
  });

  it("should disable buttons when pending", () => {
    const sandbox = createMockSandbox("running");

    render(
      <SandboxControls {...defaultProps} sandbox={sandbox} isPending={true} />
    );

    expect(screen.getByRole("button", { name: /stop/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /restart/i })).toBeDisabled();
  });

  it("should show starting status with appropriate indicator", () => {
    const sandbox = createMockSandbox("starting");

    render(<SandboxControls {...defaultProps} sandbox={sandbox} />);

    expect(screen.getByText("starting")).toBeInTheDocument();
  });

  it("should show error status with red indicator", () => {
    const sandbox = createMockSandbox("error");

    render(<SandboxControls {...defaultProps} sandbox={sandbox} />);

    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("should render back to project link", () => {
    const sandbox = createMockSandbox("running");

    render(<SandboxControls {...defaultProps} sandbox={sandbox} />);

    expect(screen.getByText(/back to project/i)).toBeInTheDocument();
  });
});
