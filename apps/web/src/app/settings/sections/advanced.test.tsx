import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdvancedSection } from "./advanced";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AdvancedSection", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          storage: {
            projectsDir: "./data/projects",
            recordingsDir: "./data/recordings",
            sandboxesDir: "./data/sandboxes",
            cacheDir: "./data/cache",
          },
        }),
    });
  });

  it("should render the section title", async () => {
    render(<AdvancedSection />);

    expect(screen.getByText("Advanced Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Configure storage paths and other advanced options.")
    ).toBeInTheDocument();
  });

  it("should render all path inputs", async () => {
    render(<AdvancedSection />);

    expect(screen.getByText("Projects Directory")).toBeInTheDocument();
    expect(screen.getByText("Recordings Directory")).toBeInTheDocument();
    expect(screen.getByText("Sandboxes Directory")).toBeInTheDocument();
    expect(screen.getByText("Cache Directory")).toBeInTheDocument();
  });

  it("should load saved settings on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          storage: {
            projectsDir: "/custom/projects",
            recordingsDir: "/custom/recordings",
            sandboxesDir: "/custom/sandboxes",
            cacheDir: "/custom/cache",
          },
        }),
    });

    render(<AdvancedSection />);

    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs[0]).toHaveValue("/custom/projects");
      expect(inputs[1]).toHaveValue("/custom/recordings");
      expect(inputs[2]).toHaveValue("/custom/sandboxes");
      expect(inputs[3]).toHaveValue("/custom/cache");
    });
  });

  it("should have Save Settings button disabled initially", async () => {
    render(<AdvancedSection />);

    const saveButton = screen.getByRole("button", { name: /save settings/i });
    expect(saveButton).toBeDisabled();
  });

  it("should enable Save button when a path is changed", async () => {
    render(<AdvancedSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "/new/path" } });

    const saveButton = screen.getByRole("button", { name: /save settings/i });
    expect(saveButton).not.toBeDisabled();
  });

  it("should call API when Save is clicked", async () => {
    render(<AdvancedSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings");
    });

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "/new/projects" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const saveButton = screen.getByRole("button", { name: /save settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("storage"),
      });
    });
  });

  it("should disable Save button after saving", async () => {
    render(<AdvancedSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "/new/projects" } });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const saveButton = screen.getByRole("button", { name: /save settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });

  it("should update all path fields independently", async () => {
    render(<AdvancedSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], { target: { value: "/path1" } });
    fireEvent.change(inputs[1], { target: { value: "/path2" } });
    fireEvent.change(inputs[2], { target: { value: "/path3" } });
    fireEvent.change(inputs[3], { target: { value: "/path4" } });

    expect(inputs[0]).toHaveValue("/path1");
    expect(inputs[1]).toHaveValue("/path2");
    expect(inputs[2]).toHaveValue("/path3");
    expect(inputs[3]).toHaveValue("/path4");
  });
});
