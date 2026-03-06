import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiKeysSection } from "./api-keys";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ApiKeysSection", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          apiKeys: {
            anchorBrowser: undefined,
            openai: undefined,
            anthropic: undefined,
          },
        }),
    });
  });

  it("should render the section title", async () => {
    render(<ApiKeysSection />);

    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(
      screen.getByText("Configure API keys for external services.")
    ).toBeInTheDocument();
  });

  it("should render all API key inputs", async () => {
    render(<ApiKeysSection />);

    expect(screen.getByText("AnchorBrowser API Key")).toBeInTheDocument();
    expect(screen.getByText("OpenAI API Key")).toBeInTheDocument();
    expect(screen.getByText("Anthropic API Key")).toBeInTheDocument();
  });

  it("should have password type by default", async () => {
    render(<ApiKeysSection />);

    const inputs = screen.getAllByPlaceholderText(/enter api key/i);
    inputs.forEach((input) => {
      expect(input).toHaveAttribute("type", "password");
    });
  });

  it("should toggle visibility when show/hide button is clicked", async () => {
    render(<ApiKeysSection />);

    // Find the first input and its toggle button
    const inputs = screen.getAllByPlaceholderText(/enter api key/i);
    const toggleButtons = screen.getAllByRole("button").filter((btn) => {
      // Filter to only eye buttons (not Test/Save buttons)
      return btn.className.includes("absolute");
    });

    expect(inputs[0]).toHaveAttribute("type", "password");

    fireEvent.click(toggleButtons[0]);
    expect(inputs[0]).toHaveAttribute("type", "text");

    fireEvent.click(toggleButtons[0]);
    expect(inputs[0]).toHaveAttribute("type", "password");
  });

  it("should disable Test and Save buttons when input is empty", async () => {
    render(<ApiKeysSection />);

    const testButtons = screen.getAllByRole("button", { name: /test/i });
    const saveButtons = screen.getAllByRole("button", { name: /save/i });

    testButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });

    saveButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("should enable Save button when input has value", async () => {
    render(<ApiKeysSection />);

    const inputs = screen.getAllByPlaceholderText(/enter api key/i);
    fireEvent.change(inputs[0], { target: { value: "test-key-123" } });

    const saveButtons = screen.getAllByRole("button", { name: /save/i });
    expect(saveButtons[0]).not.toBeDisabled();
  });

  it("should call API when Save is clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            apiKeys: { anchorBrowser: undefined, openai: undefined, anthropic: undefined },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            apiKeys: { anchorBrowser: "••••••••", openai: undefined, anthropic: undefined },
          }),
      });

    render(<ApiKeysSection />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings");
    });

    const inputs = screen.getAllByPlaceholderText(/enter api key/i);
    fireEvent.change(inputs[0], { target: { value: "test-key-123" } });

    const saveButtons = screen.getAllByRole("button", { name: /save/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKeys: { anchorBrowser: "test-key-123" },
        }),
      });
    });
  });

  it("should call test API when Test is clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            apiKeys: { anchorBrowser: "••••••••", openai: undefined, anthropic: undefined },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    render(
      <ApiKeysSection
        initialHasKeys={{ anchorBrowser: true, openai: false, anthropic: false }}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Enter a key value so the test button is enabled
    const inputs = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(inputs[0], { target: { value: "test-key-123" } });

    const testButtons = screen.getAllByRole("button", { name: /test/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "anchorBrowser",
          key: "test-key-123",
        }),
      });
    });
  });

  it("should show success message after successful test", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            apiKeys: { anchorBrowser: undefined, openai: undefined, anthropic: undefined },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const inputs = screen.getAllByPlaceholderText(/enter api key/i);
    fireEvent.change(inputs[0], { target: { value: "test-key-123" } });

    const testButtons = screen.getAllByRole("button", { name: /test/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Connected successfully")).toBeInTheDocument();
    });
  });

  it("should show error message after failed test", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            apiKeys: { anchorBrowser: undefined, openai: undefined, anthropic: undefined },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: "Invalid API key" }),
      });

    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const inputs = screen.getAllByPlaceholderText(/enter api key/i);
    fireEvent.change(inputs[0], { target: { value: "invalid-key" } });

    const testButtons = screen.getAllByRole("button", { name: /test/i });
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Invalid API key")).toBeInTheDocument();
    });
  });
});
