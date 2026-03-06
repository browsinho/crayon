import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileTree } from "./file-tree";
import type { FileNode } from "./types";

const mockFiles: FileNode[] = [
  {
    name: "src",
    path: "src",
    type: "directory",
    children: [
      {
        name: "app",
        path: "src/app",
        type: "directory",
        children: [
          { name: "page.tsx", path: "src/app/page.tsx", type: "file" },
          { name: "layout.tsx", path: "src/app/layout.tsx", type: "file" },
        ],
      },
      { name: "index.ts", path: "src/index.ts", type: "file" },
    ],
  },
  { name: "package.json", path: "package.json", type: "file" },
];

describe("FileTree", () => {
  it("should render file tree structure", () => {
    const onSelect = vi.fn();

    render(
      <FileTree files={mockFiles} selectedPath={null} onSelect={onSelect} />
    );

    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("package.json")).toBeInTheDocument();
  });

  it("should expand directories on click", () => {
    const onSelect = vi.fn();

    render(
      <FileTree files={mockFiles} selectedPath={null} onSelect={onSelect} />
    );

    // src should be expanded by default (depth < 2)
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.getByText("index.ts")).toBeInTheDocument();
  });

  it("should call onSelect when file is clicked", () => {
    const onSelect = vi.fn();

    render(
      <FileTree files={mockFiles} selectedPath={null} onSelect={onSelect} />
    );

    fireEvent.click(screen.getByText("package.json"));

    expect(onSelect).toHaveBeenCalledWith("package.json");
  });

  it("should toggle directory expansion on click", () => {
    const onSelect = vi.fn();

    render(
      <FileTree files={mockFiles} selectedPath={null} onSelect={onSelect} />
    );

    // Click to collapse src
    fireEvent.click(screen.getByText("src"));

    // Children should be hidden
    expect(screen.queryByText("app")).not.toBeInTheDocument();
    expect(screen.queryByText("index.ts")).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(screen.getByText("src"));

    expect(screen.getByText("app")).toBeInTheDocument();
  });

  it("should highlight selected file", () => {
    const onSelect = vi.fn();

    render(
      <FileTree
        files={mockFiles}
        selectedPath="package.json"
        onSelect={onSelect}
      />
    );

    const selectedButton = screen.getByText("package.json").closest("button");
    expect(selectedButton).toHaveClass("bg-muted");
  });

  it("should not call onSelect when directory is clicked", () => {
    const onSelect = vi.fn();

    render(
      <FileTree files={mockFiles} selectedPath={null} onSelect={onSelect} />
    );

    fireEvent.click(screen.getByText("src"));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
