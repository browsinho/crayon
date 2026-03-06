import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenerationProgress } from "./generation-progress";
import type { Step } from "./step-status";
import type { LogEntry } from "./log-viewer";

describe("GenerationProgress", () => {
  const defaultSteps: Step[] = [
    { id: "step-1", name: "Step 1", status: "completed" },
    { id: "step-2", name: "Step 2", status: "in_progress" },
    { id: "step-3", name: "Step 3", status: "pending" },
  ];

  const defaultLogs: LogEntry[] = [
    { timestamp: "10:00:00", message: "Log 1" },
    { timestamp: "10:00:01", message: "Log 2" },
  ];

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
  });

  it("should render running state", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Generating Sandbox...")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("should render completed state", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={100}
        status="completed"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Generation Complete")).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("should render failed state", () => {
    const failedSteps: Step[] = [
      { id: "step-1", name: "Step 1", status: "completed" },
      { id: "step-2", name: "Step 2", status: "failed", error: "Error!" },
    ];

    render(
      <GenerationProgress
        steps={failedSteps}
        logs={defaultLogs}
        progress={50}
        status="failed"
        onCancel={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("Generation Failed")).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("should render cancelled state", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="cancelled"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Generation Cancelled")).toBeInTheDocument();
  });

  it("should call onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();

    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("should render all steps", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2...")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
  });

  it("should render logs", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Log 1")).toBeInTheDocument();
    expect(screen.getByText("Log 2")).toBeInTheDocument();
  });

  it("should render progress bar with correct width", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={75}
        status="running"
        onCancel={vi.fn()}
      />
    );

    const progressBar = document.querySelector(".bg-primary.rounded-full");
    expect(progressBar).toHaveStyle({ width: "75%" });
  });

  it("should not show retry button when not failed", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        onCancel={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("should render token usage stats when provided", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        tokensUsed={12345}
        estimatedCost={0.123}
        componentsGenerated={[]}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Tokens Used")).toBeInTheDocument();
    expect(screen.getByText("12,345")).toBeInTheDocument();
    expect(screen.getByText("Estimated Cost")).toBeInTheDocument();
    expect(screen.getByText("$0.123")).toBeInTheDocument();
  });

  it("should render component preview when components are generated", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        componentsGenerated={["Button", "Header", "Footer"]}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Generated Components")).toBeInTheDocument();
    expect(screen.getByText("Button")).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("should not render stats card when no tokens or components", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText("Tokens Used")).not.toBeInTheDocument();
    expect(screen.queryByText("Generated Components")).not.toBeInTheDocument();
  });

  it("should display component count in stats", () => {
    render(
      <GenerationProgress
        steps={defaultSteps}
        logs={defaultLogs}
        progress={50}
        status="running"
        tokensUsed={1000}
        componentsGenerated={["A", "B", "C"]}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Components")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
