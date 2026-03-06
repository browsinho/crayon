import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenerationOptionsForm } from "./generation-options-form";
import type { GenerationOptions } from "@/lib/generation-types";

describe("GenerationOptionsForm", () => {
  const defaultOptions: GenerationOptions = {
    frontend: "nextjs",
    styling: "tailwind",
    backend: "express",
    database: "sqlite",
    includeSampleData: true,
    downloadAssets: true,
    generateTests: false,
  };

  it("should render all form fields", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm options={defaultOptions} onChange={onChange} />
    );

    expect(screen.getByLabelText("Frontend Framework")).toBeInTheDocument();
    expect(screen.getByLabelText("Styling")).toBeInTheDocument();
    expect(screen.getByLabelText("Backend")).toBeInTheDocument();
    expect(screen.getByLabelText("Database")).toBeInTheDocument();
    expect(screen.getByText("Include sample data")).toBeInTheDocument();
    expect(
      screen.getByText("Download assets (images, fonts)")
    ).toBeInTheDocument();
    expect(screen.getByText("Generate tests")).toBeInTheDocument();
  });

  it("should display current option values", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm options={defaultOptions} onChange={onChange} />
    );

    expect(screen.getByLabelText("Frontend Framework")).toHaveValue("nextjs");
    expect(screen.getByLabelText("Styling")).toHaveValue("tailwind");
    expect(screen.getByLabelText("Backend")).toHaveValue("express");
    expect(screen.getByLabelText("Database")).toHaveValue("sqlite");
  });

  it("should call onChange when frontend is changed", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm options={defaultOptions} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText("Frontend Framework"), {
      target: { value: "react" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultOptions,
      frontend: "react",
    });
  });

  it("should call onChange when styling is changed", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm options={defaultOptions} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText("Styling"), {
      target: { value: "css-modules" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultOptions,
      styling: "css-modules",
    });
  });

  it("should call onChange when backend is changed", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm options={defaultOptions} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText("Backend"), {
      target: { value: "fastify" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultOptions,
      backend: "fastify",
    });
  });

  it("should call onChange when database is changed", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm options={defaultOptions} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText("Database"), {
      target: { value: "postgres" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultOptions,
      database: "postgres",
    });
  });

  it("should call onChange when checkboxes are toggled", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm options={defaultOptions} onChange={onChange} />
    );

    // Toggle includeSampleData off
    fireEvent.click(screen.getByText("Include sample data"));
    expect(onChange).toHaveBeenCalledWith({
      ...defaultOptions,
      includeSampleData: false,
    });

    // Toggle downloadAssets off
    fireEvent.click(screen.getByText("Download assets (images, fonts)"));
    expect(onChange).toHaveBeenCalledWith({
      ...defaultOptions,
      downloadAssets: false,
    });

    // Toggle generateTests on
    fireEvent.click(screen.getByText("Generate tests"));
    expect(onChange).toHaveBeenCalledWith({
      ...defaultOptions,
      generateTests: true,
    });
  });

  it("should disable all inputs when disabled prop is true", () => {
    const onChange = vi.fn();
    render(
      <GenerationOptionsForm
        options={defaultOptions}
        onChange={onChange}
        disabled
      />
    );

    expect(screen.getByLabelText("Frontend Framework")).toBeDisabled();
    expect(screen.getByLabelText("Styling")).toBeDisabled();
    expect(screen.getByLabelText("Backend")).toBeDisabled();
    expect(screen.getByLabelText("Database")).toBeDisabled();

    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toBeDisabled();
    });
  });
});
