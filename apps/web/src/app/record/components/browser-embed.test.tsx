import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserEmbed } from "./browser-embed";

describe("BrowserEmbed", () => {
  it("should render iframe with live view URL", () => {
    const liveViewUrl = "https://live.anchorbrowser.io/session/test-123";
    render(<BrowserEmbed liveViewUrl={liveViewUrl} />);

    const iframe = screen.getByTitle("AnchorBrowser Live View");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", liveViewUrl);
  });

  it("should render loading state when liveViewUrl is empty", () => {
    render(<BrowserEmbed liveViewUrl="" />);

    expect(screen.getByText(/loading browser session/i)).toBeInTheDocument();
  });

  it("should have correct iframe sandbox attributes", () => {
    const liveViewUrl = "https://live.anchorbrowser.io/session/test-123";
    render(<BrowserEmbed liveViewUrl={liveViewUrl} />);

    const iframe = screen.getByTitle("AnchorBrowser Live View");
    expect(iframe).toHaveAttribute("sandbox", "allow-same-origin allow-scripts");
    expect(iframe).toHaveAttribute("allow", "clipboard-read; clipboard-write");
  });
});
