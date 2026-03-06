import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UrlInput } from "./url-input";

describe("UrlInput", () => {
  it("should render input and button", () => {
    const onStart = vi.fn();
    render(<UrlInput onStart={onStart} disabled={false} />);

    expect(screen.getByLabelText("Target URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument();
  });

  it("should disable input and button when disabled prop is true", () => {
    const onStart = vi.fn();
    render(<UrlInput onStart={onStart} disabled={true} />);

    expect(screen.getByLabelText("Target URL")).toBeDisabled();
    expect(screen.getByRole("button", { name: /start recording/i })).toBeDisabled();
  });

  it("should show error for invalid URL", () => {
    const onStart = vi.fn();
    render(<UrlInput onStart={onStart} disabled={false} />);

    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "invalid-url" } });
    fireEvent.submit(input.closest("form")!);

    expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("should call onStart with valid URL", () => {
    const onStart = vi.fn();
    render(<UrlInput onStart={onStart} disabled={false} />);

    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.submit(input.closest("form")!);

    expect(onStart).toHaveBeenCalledWith("https://example.com");
  });

  it("should not call onStart when URL is empty", () => {
    const onStart = vi.fn();
    render(<UrlInput onStart={onStart} disabled={false} />);

    const button = screen.getByRole("button", { name: /start recording/i });
    expect(button).toBeDisabled();
  });

  it("should clear error when input changes", () => {
    const onStart = vi.fn();
    render(<UrlInput onStart={onStart} disabled={false} />);

    const input = screen.getByLabelText("Target URL");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.submit(input.closest("form")!);

    expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "https://example.com" } });
    expect(screen.queryByText(/please enter a valid url/i)).not.toBeInTheDocument();
  });
});
