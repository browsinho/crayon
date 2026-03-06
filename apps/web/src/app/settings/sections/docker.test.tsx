import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DockerSection } from "./docker";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("DockerSection", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should render the section title", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ running: true, containers: 0, images: 0 }),
    });

    render(<DockerSection />);

    await waitFor(() => {
      expect(screen.getByText("Docker")).toBeInTheDocument();
    });
  });

  it("should show Docker is running status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          running: true,
          version: "24.0.0",
          containers: 3,
          images: 10,
        }),
    });

    render(<DockerSection />);

    await waitFor(() => {
      expect(screen.getByText("Docker is running")).toBeInTheDocument();
      expect(screen.getByText("Version: 24.0.0")).toBeInTheDocument();
    });
  });

  it("should show Docker is not running status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ running: false }),
    });

    render(<DockerSection />);

    await waitFor(() => {
      expect(screen.getByText("Docker is not running")).toBeInTheDocument();
    });
  });

  it("should show container and image counts when running", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          running: true,
          containers: 5,
          images: 12,
        }),
    });

    render(<DockerSection />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("Running containers")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("Docker images")).toBeInTheDocument();
    });
  });

  it("should show action buttons when running", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          running: true,
          containers: 2,
          images: 5,
        }),
    });

    render(<DockerSection />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /stop all containers/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /clean up unused/i })
      ).toBeInTheDocument();
    });
  });

  it("should disable Stop All when no containers are running", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          running: true,
          containers: 0,
          images: 5,
        }),
    });

    render(<DockerSection />);

    await waitFor(() => {
      const stopButton = screen.getByRole("button", {
        name: /stop all containers/i,
      });
      expect(stopButton).toBeDisabled();
    });
  });

  it("should call stop-all API when button is clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            running: true,
            containers: 3,
            images: 5,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            running: true,
            containers: 0,
            images: 5,
          }),
      });

    render(<DockerSection />);

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    const stopButton = screen.getByRole("button", { name: /stop all containers/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop-all" }),
      });
    });
  });

  it("should call prune API when Clean Up button is clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            running: true,
            containers: 1,
            images: 10,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            running: true,
            containers: 1,
            images: 3,
          }),
      });

    render(<DockerSection />);

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    const pruneButton = screen.getByRole("button", { name: /clean up unused/i });
    fireEvent.click(pruneButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prune" }),
      });
    });
  });

  it("should show warning message when Docker is not running", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ running: false }),
    });

    render(<DockerSection />);

    await waitFor(() => {
      expect(screen.getByText("Docker daemon is not running")).toBeInTheDocument();
      expect(
        screen.getByText(/please start docker desktop/i)
      ).toBeInTheDocument();
    });
  });

  it("should show loading state initially", () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    const { container } = render(<DockerSection />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
