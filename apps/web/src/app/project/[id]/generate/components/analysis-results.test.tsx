import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AnalysisResults } from "./analysis-results";
import * as generationActions from "@/lib/actions/generation";

vi.mock("@/lib/actions/generation", () => ({
  getAnalysisResults: vi.fn(),
}));

describe("AnalysisResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    vi.mocked(generationActions.getAnalysisResults).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AnalysisResults projectId="test-project" />);

    expect(screen.getByText("Loading analysis...")).toBeInTheDocument();
  });

  it("should display analysis results when loaded", async () => {
    vi.mocked(generationActions.getAnalysisResults).mockResolvedValue({
      framework: "Next.js 14 (App Router)",
      frameworkVersion: "14.0.4",
      auth: "JWT + Cookie session",
      apiRoutes: 12,
      widgets: ["DataTable", "Modal"],
      database: "PostgreSQL (inferred)",
      pages: ["/", "/products"],
      components: ["Header", "Footer"],
    });

    render(<AnalysisResults projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Analysis Results")).toBeInTheDocument();
    });

    expect(screen.getByText("Next.js 14 (App Router)")).toBeInTheDocument();
    expect(screen.getByText("JWT + Cookie session")).toBeInTheDocument();
    expect(screen.getByText("12 endpoints")).toBeInTheDocument();
    expect(screen.getByText("DataTable, Modal")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL (inferred)")).toBeInTheDocument();
    expect(screen.getByText("2 pages")).toBeInTheDocument();
  });

  it("should show error message when no analysis available", async () => {
    vi.mocked(generationActions.getAnalysisResults).mockResolvedValue(null);

    render(<AnalysisResults projectId="test-project" />);

    await waitFor(() => {
      expect(
        screen.getByText("No analysis available. Please complete a recording first.")
      ).toBeInTheDocument();
    });
  });

  it("should show error message on failure", async () => {
    vi.mocked(generationActions.getAnalysisResults).mockRejectedValue(
      new Error("Failed to fetch")
    );

    render(<AnalysisResults projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
    });
  });

  it("should display 'None detected' for null auth", async () => {
    vi.mocked(generationActions.getAnalysisResults).mockResolvedValue({
      framework: "React",
      auth: null,
      apiRoutes: 5,
      widgets: ["Modal"],
      database: "SQLite",
      pages: ["/"],
      components: [],
    });

    render(<AnalysisResults projectId="test-project" />);

    await waitFor(() => {
      // Auth should be "None detected"
      const authSection = screen.getByText("Authentication").closest("div");
      expect(authSection?.querySelector("dd")).toHaveTextContent("None detected");
    });
  });

  it("should display 'Not detected' for null database", async () => {
    vi.mocked(generationActions.getAnalysisResults).mockResolvedValue({
      framework: "React",
      auth: "Basic",
      apiRoutes: 5,
      widgets: [],
      database: null,
      pages: ["/"],
      components: [],
    });

    render(<AnalysisResults projectId="test-project" />);

    await waitFor(() => {
      expect(screen.getByText("Not detected")).toBeInTheDocument();
    });
  });

  it("should display 'None detected' for empty widgets", async () => {
    vi.mocked(generationActions.getAnalysisResults).mockResolvedValue({
      framework: "React",
      auth: "Basic",
      apiRoutes: 5,
      widgets: [],
      database: "SQLite",
      pages: ["/"],
      components: [],
    });

    render(<AnalysisResults projectId="test-project" />);

    await waitFor(() => {
      const noneDetectedElements = screen.getAllByText("None detected");
      expect(noneDetectedElements.length).toBeGreaterThan(0);
    });
  });
});
