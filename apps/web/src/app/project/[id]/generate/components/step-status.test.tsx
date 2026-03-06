import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StepStatus, StepList, type Step } from "./step-status";

describe("StepStatus", () => {
  it("should render pending step", () => {
    const step: Step = {
      id: "step-1",
      name: "Test Step",
      status: "pending",
    };

    render(<StepStatus step={step} />);

    expect(screen.getByText("Test Step")).toBeInTheDocument();
    expect(screen.getByText("Test Step")).toHaveClass("text-muted-foreground");
  });

  it("should render in-progress step with spinner", () => {
    const step: Step = {
      id: "step-1",
      name: "Test Step",
      status: "in_progress",
    };

    render(<StepStatus step={step} />);

    expect(screen.getByText("Test Step...")).toBeInTheDocument();
    expect(screen.getByText("Test Step...")).toHaveClass("font-medium");
    // Check for spinner by looking for the animate-spin class
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("should render completed step with checkmark", () => {
    const step: Step = {
      id: "step-1",
      name: "Test Step",
      status: "completed",
      duration: 2500,
    };

    render(<StepStatus step={step} />);

    expect(screen.getByText("Test Step")).toBeInTheDocument();
    expect(screen.getByText("2.5s")).toBeInTheDocument();
  });

  it("should render failed step with error", () => {
    const step: Step = {
      id: "step-1",
      name: "Test Step",
      status: "failed",
      error: "Something went wrong",
    };

    render(<StepStatus step={step} />);

    expect(screen.getByText("Test Step")).toBeInTheDocument();
    expect(screen.getByText("Test Step")).toHaveClass("text-red-500");
  });

  it("should call onRetry when retry button clicked", () => {
    const onRetry = vi.fn();
    const step: Step = {
      id: "step-1",
      name: "Test Step",
      status: "failed",
    };

    render(<StepStatus step={step} onRetry={onRetry} />);

    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledWith("step-1");
  });

  it("should not show retry button when not failed", () => {
    const onRetry = vi.fn();
    const step: Step = {
      id: "step-1",
      name: "Test Step",
      status: "completed",
    };

    render(<StepStatus step={step} onRetry={onRetry} />);

    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });
});

describe("StepList", () => {
  it("should render all steps", () => {
    const steps: Step[] = [
      { id: "step-1", name: "Step 1", status: "completed" },
      { id: "step-2", name: "Step 2", status: "in_progress" },
      { id: "step-3", name: "Step 3", status: "pending" },
    ];

    render(<StepList steps={steps} />);

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2...")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
  });

  it("should show error message for failed steps", () => {
    const steps: Step[] = [
      {
        id: "step-1",
        name: "Step 1",
        status: "failed",
        error: "Connection timeout",
      },
    ];

    render(<StepList steps={steps} />);

    expect(screen.getByText("Connection timeout")).toBeInTheDocument();
  });

  it("should pass onRetry to failed steps", () => {
    const onRetry = vi.fn();
    const steps: Step[] = [
      { id: "step-1", name: "Step 1", status: "failed" },
    ];

    render(<StepList steps={steps} onRetry={onRetry} />);

    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledWith("step-1");
  });
});
