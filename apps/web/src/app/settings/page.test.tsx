import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPage from "./page";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the sections to isolate page testing
vi.mock("./sections", () => ({
  ApiKeysSection: () => <div data-testid="api-keys-section">API Keys Section</div>,
  GenerationSection: () => (
    <div data-testid="generation-section">Generation Section</div>
  ),
  StorageSection: () => <div data-testid="storage-section">Storage Section</div>,
  AppearanceSection: () => (
    <div data-testid="appearance-section">Appearance Section</div>
  ),
  DockerSection: () => <div data-testid="docker-section">Docker Section</div>,
  AdvancedSection: () => <div data-testid="advanced-section">Advanced Section</div>,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should render the settings page title", () => {
    render(<SettingsPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Configure your Crayon application settings.")
    ).toBeInTheDocument();
  });

  it("should render all navigation tabs", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("button", { name: /api keys/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /storage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /docker/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /advanced/i })).toBeInTheDocument();
  });

  it("should show API Keys section by default", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("api-keys-section")).toBeInTheDocument();
  });

  it("should switch to Generation section when clicked", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /generation/i }));

    expect(screen.getByTestId("generation-section")).toBeInTheDocument();
  });

  it("should switch to Storage section when clicked", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /storage/i }));

    expect(screen.getByTestId("storage-section")).toBeInTheDocument();
  });

  it("should switch to Appearance section when clicked", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /appearance/i }));

    expect(screen.getByTestId("appearance-section")).toBeInTheDocument();
  });

  it("should switch to Docker section when clicked", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /docker/i }));

    expect(screen.getByTestId("docker-section")).toBeInTheDocument();
  });

  it("should switch to Advanced section when clicked", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /advanced/i }));

    expect(screen.getByTestId("advanced-section")).toBeInTheDocument();
  });

  it("should highlight the active tab", () => {
    render(<SettingsPage />);

    const apiKeysTab = screen.getByRole("button", { name: /api keys/i });
    expect(apiKeysTab.className).toContain("bg-primary");

    fireEvent.click(screen.getByRole("button", { name: /docker/i }));

    const dockerTab = screen.getByRole("button", { name: /docker/i });
    expect(dockerTab.className).toContain("bg-primary");
    expect(apiKeysTab.className).not.toContain("bg-primary");
  });
});
