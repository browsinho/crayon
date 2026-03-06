import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataTable } from "./data-table";
import type { TableColumn, TableRow } from "./types";

const mockColumns: TableColumn[] = [
  { name: "name", type: "string" },
  { name: "price", type: "number" },
  { name: "stock", type: "number" },
];

const mockRows: TableRow[] = [
  { id: "1", data: { name: "Product 1", price: 29.99, stock: 100 } },
  { id: "2", data: { name: "Product 2", price: 49.99, stock: 50 } },
];

describe("DataTable", () => {
  const defaultProps = {
    columns: mockColumns,
    rows: mockRows,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
  };

  it("should render table with columns and rows", () => {
    render(<DataTable {...defaultProps} />);

    // Check headers
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("(string)")).toBeInTheDocument();
    expect(screen.getByText("price")).toBeInTheDocument();
    expect(screen.getByText("stock")).toBeInTheDocument();

    // Check row data
    expect(screen.getByText("Product 1")).toBeInTheDocument();
    expect(screen.getByText("29.99")).toBeInTheDocument();
    expect(screen.getByText("Product 2")).toBeInTheDocument();
  });

  it("should show edit form when edit button is clicked", () => {
    render(<DataTable {...defaultProps} />);

    const editButtons = screen.getAllByTitle("Edit");
    fireEvent.click(editButtons[0]);

    // Should show input fields for editing
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThan(0);

    // Should show save and cancel buttons
    expect(screen.getByTitle("Save")).toBeInTheDocument();
    expect(screen.getByTitle("Cancel")).toBeInTheDocument();
  });

  it("should call onUpdate when save is clicked", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DataTable {...defaultProps} onUpdate={onUpdate} />);

    // Click edit on first row
    const editButtons = screen.getAllByTitle("Edit");
    fireEvent.click(editButtons[0]);

    // Change a value
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Updated Product" } });

    // Save
    fireEvent.click(screen.getByTitle("Save"));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith("1", expect.objectContaining({
        name: "Updated Product",
      }));
    });
  });

  it("should cancel edit when cancel is clicked", () => {
    render(<DataTable {...defaultProps} />);

    // Click edit
    const editButtons = screen.getAllByTitle("Edit");
    fireEvent.click(editButtons[0]);

    // Click cancel
    fireEvent.click(screen.getByTitle("Cancel"));

    // Should no longer show input fields
    expect(screen.queryByTitle("Save")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Cancel")).not.toBeInTheDocument();
  });

  it("should call onDelete when delete button is clicked", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DataTable {...defaultProps} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByTitle("Delete");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("1");
    });
  });

  it("should show empty state when no rows", () => {
    render(<DataTable {...defaultProps} rows={[]} />);

    expect(screen.getByText("No rows found")).toBeInTheDocument();
  });

  it("should format null values as dash", () => {
    const rowsWithNull: TableRow[] = [
      { id: "1", data: { name: "Product", price: null, stock: 0 } },
    ];

    render(<DataTable {...defaultProps} rows={rowsWithNull} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
