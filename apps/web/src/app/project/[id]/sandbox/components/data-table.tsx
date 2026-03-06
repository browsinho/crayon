"use client";

import { useState, useCallback } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableRow, TableColumn } from "./types";

interface DataTableProps {
  columns: TableColumn[];
  rows: TableRow[];
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DataTable({
  columns,
  rows,
  onUpdate,
  onDelete,
}: DataTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleEdit = useCallback((row: TableRow) => {
    setEditingId(row.id);
    setEditData({ ...row.data });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditData({});
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    setIsUpdating(true);
    try {
      await onUpdate(editingId, editData);
      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error("Failed to update row:", error);
    } finally {
      setIsUpdating(false);
    }
  }, [editingId, editData, onUpdate]);

  const handleDelete = useCallback(
    async (id: string) => {
      setIsDeleting(id);
      try {
        await onDelete(id);
      } catch (error) {
        console.error("Failed to delete row:", error);
      } finally {
        setIsDeleting(null);
      }
    },
    [onDelete]
  );

  const handleInputChange = useCallback((column: string, value: string) => {
    setEditData((prev) => ({
      ...prev,
      [column]: value,
    }));
  }, []);

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">id</th>
            {columns.map((col) => (
              <th key={col.name} className="px-4 py-2 text-left font-medium">
                {col.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({col.type})
                </span>
              </th>
            ))}
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "border-b hover:bg-muted/30",
                editingId === row.id && "bg-muted/20"
              )}
            >
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                {row.id}
              </td>
              {columns.map((col) => (
                <td key={col.name} className="px-4 py-2">
                  {editingId === row.id ? (
                    <input
                      type="text"
                      value={String(editData[col.name] ?? "")}
                      onChange={(e) =>
                        handleInputChange(col.name, e.target.value)
                      }
                      className="w-full rounded border bg-background px-2 py-1 text-sm"
                    />
                  ) : (
                    formatValue(row.data[col.name])
                  )}
                </td>
              ))}
              <td className="px-4 py-2">
                <div className="flex justify-end gap-1">
                  {editingId === row.id ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isUpdating}
                        className="p-1 rounded hover:bg-green-500/10 text-green-500 disabled:opacity-50"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 rounded hover:bg-muted"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(row)}
                        className="p-1 rounded hover:bg-muted"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={isDeleting === row.id}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No rows found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
