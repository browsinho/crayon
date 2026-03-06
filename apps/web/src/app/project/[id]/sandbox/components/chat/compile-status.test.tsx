import { render, screen } from "@testing-library/react";
import { CompileStatus } from "./compile-status";
import { describe, test, expect } from "vitest";
import type { CompileDoneEventData } from "@/app/api/sandbox/[sandboxId]/chat/types";

describe("CompileStatus", () => {
  test("shows success state", () => {
    const result: CompileDoneEventData = {
      success: true,
      errors: [],
      warnings: [],
      durationMs: 1200,
    };

    render(<CompileStatus result={result} />);
    expect(screen.getByText(/Build successful/i)).toBeInTheDocument();
  });

  test("shows error state with error count", () => {
    const result: CompileDoneEventData = {
      success: false,
      errors: [
        { file: "test.tsx", line: 1, column: 1, message: "Error 1" },
        { file: "test2.tsx", line: 2, column: 2, message: "Error 2" },
      ],
      warnings: [],
      durationMs: 1200,
    };

    render(<CompileStatus result={result} />);
    expect(screen.getByText(/Build failed \(2 errors\)/i)).toBeInTheDocument();
  });

  test("displays error messages", () => {
    const result: CompileDoneEventData = {
      success: false,
      errors: [
        { file: "test.tsx", line: 10, column: 5, message: "Type error" },
      ],
      warnings: [],
      durationMs: 1200,
    };

    render(<CompileStatus result={result} />);
    expect(screen.getByText(/test\.tsx:10:5/)).toBeInTheDocument();
    expect(screen.getByText("Type error")).toBeInTheDocument();
  });

  test("limits error display to 5", () => {
    const result: CompileDoneEventData = {
      success: false,
      errors: Array.from({ length: 8 }, (_, i) => ({
        file: `test${i}.tsx`,
        line: i + 1,
        column: 1,
        message: `Error ${i + 1}`,
      })),
      warnings: [],
      durationMs: 1200,
    };

    render(<CompileStatus result={result} />);
    expect(screen.getByText(/\.\.\.and 3 more errors/)).toBeInTheDocument();
  });

  test("displays warning count", () => {
    const result: CompileDoneEventData = {
      success: true,
      errors: [],
      warnings: [
        { file: "test.tsx", line: 1, message: "Warning 1" },
        { file: "test2.tsx", line: 2, message: "Warning 2" },
      ],
      durationMs: 1200,
    };

    render(<CompileStatus result={result} />);
    expect(screen.getByText(/2 warning\(s\)/)).toBeInTheDocument();
  });
});
