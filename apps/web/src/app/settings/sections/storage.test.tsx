import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StorageSection } from "./storage";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("StorageSection", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          total: 10737418240, // 10 GB
          used: 1073741824, // 1 GB
          projects: 536870912, // 512 MB
          recordings: 268435456, // 256 MB
          sandboxes: 134217728, // 128 MB
          cache: 134217728, // 128 MB
        }),
    });
  });

  it("should render the section title", async () => {
    render(<StorageSection />);

    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("Manage local storage and data.")).toBeInTheDocument();
  });

  it("should display storage usage", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(screen.getByText(/1 GB of 10 GB/)).toBeInTheDocument();
    });
  });

  it("should display breakdown by category", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(screen.getByText("Projects")).toBeInTheDocument();
      expect(screen.getByText("Recordings")).toBeInTheDocument();
      expect(screen.getByText("Sandboxes")).toBeInTheDocument();
      expect(screen.getByText("Cache")).toBeInTheDocument();
    });
  });

  it("should show Clear Cache button", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: /clear cache/i })).toBeInTheDocument();
  });

  it("should show Delete All Data button", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(
      screen.getByRole("button", { name: /delete all data/i })
    ).toBeInTheDocument();
  });

  it("should show confirmation when Clear Cache is clicked", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const clearButton = screen.getByRole("button", { name: /clear cache/i });
    fireEvent.click(clearButton);

    expect(screen.getByText("Clear cache?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("should show confirmation when Delete All Data is clicked", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const deleteButton = screen.getByRole("button", { name: /delete all data/i });
    fireEvent.click(deleteButton);

    expect(screen.getByText("Delete ALL data?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should call API when cache clear is confirmed", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/storage");
    });

    const clearButton = screen.getByRole("button", { name: /clear cache/i });
    fireEvent.click(clearButton);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          total: 10737418240,
          used: 939524096, // Less after clearing
          projects: 536870912,
          recordings: 268435456,
          sandboxes: 134217728,
          cache: 0,
        }),
    });

    const confirmButton = screen.getByRole("button", { name: "Yes" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/storage?type=cache", {
        method: "DELETE",
      });
    });
  });

  it("should hide confirmation when No is clicked", async () => {
    render(<StorageSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const clearButton = screen.getByRole("button", { name: /clear cache/i });
    fireEvent.click(clearButton);

    expect(screen.getByText("Clear cache?")).toBeInTheDocument();

    const noButton = screen.getByRole("button", { name: "No" });
    fireEvent.click(noButton);

    expect(screen.queryByText("Clear cache?")).not.toBeInTheDocument();
  });
});
