import { render, screen, fireEvent } from "@testing-library/react";
import { ToolCallItem } from "./tool-call-item";
import { describe, test, expect } from "vitest";

describe("ToolCallItem", () => {
  test("shows loading state", () => {
    render(
      <ToolCallItem
        toolCall={{
          toolName: "read_file",
          toolInput: { path: "test.tsx" },
          isLoading: true,
        }}
      />
    );
    const loader = screen.getByRole("button").querySelector(".animate-spin");
    expect(loader).toBeInTheDocument();
  });

  test("shows success state", () => {
    render(
      <ToolCallItem
        toolCall={{
          toolName: "read_file",
          toolInput: { path: "test.tsx" },
          output: "file content",
          success: true,
          isLoading: false,
        }}
      />
    );
    const successIcon = screen.getByRole("button").querySelector(".text-green-500");
    expect(successIcon).toBeInTheDocument();
  });

  test("shows error state", () => {
    render(
      <ToolCallItem
        toolCall={{
          toolName: "read_file",
          toolInput: { path: "test.tsx" },
          output: "error message",
          success: false,
          isLoading: false,
        }}
      />
    );
    const errorIcon = screen.getByRole("button").querySelector(".text-red-500");
    expect(errorIcon).toBeInTheDocument();
  });

  test("expands to show output", () => {
    render(
      <ToolCallItem
        toolCall={{
          toolName: "read_file",
          toolInput: { path: "test.tsx" },
          output: "file content",
          success: true,
          isLoading: false,
        }}
      />
    );

    // Output should not be visible initially
    expect(screen.queryByText("file content")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByRole("button"));

    // Output should now be visible
    expect(screen.getByText("file content")).toBeInTheDocument();
  });

  test("displays file path", () => {
    render(
      <ToolCallItem
        toolCall={{
          toolName: "read_file",
          toolInput: { path: "src/App.tsx" },
          isLoading: false,
        }}
      />
    );
    expect(screen.getByText("src/App.tsx")).toBeInTheDocument();
  });

  test("displays correct label for tool", () => {
    render(
      <ToolCallItem
        toolCall={{
          toolName: "edit_file",
          toolInput: { path: "test.tsx" },
          isLoading: false,
        }}
      />
    );
    expect(screen.getByText("Editing file")).toBeInTheDocument();
  });
});
