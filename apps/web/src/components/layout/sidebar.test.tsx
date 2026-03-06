import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

// The navigation mock is set up in test-setup.ts

describe("Sidebar", () => {
  it("should render the logo", () => {
    render(<Sidebar />);
    expect(screen.getByText("Crayon")).toBeInTheDocument();
  });

  it("should render navigation links", () => {
    render(<Sidebar />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("New Recording")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should have correct href attributes", () => {
    render(<Sidebar />);

    const homeLink = screen.getByText("Home").closest("a");
    const recordLink = screen.getByText("New Recording").closest("a");
    const settingsLink = screen.getByText("Settings").closest("a");

    expect(homeLink).toHaveAttribute("href", "/");
    expect(recordLink).toHaveAttribute("href", "/record");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });
});
