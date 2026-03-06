"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Loader2, Plus, RefreshCw } from "lucide-react";
import { DataTable } from "./data-table";
import type { TableRow, TableColumn } from "./types";
import {
  getSandboxTables,
  getSandboxTableData,
  createSandboxRow,
  updateSandboxRow,
  deleteSandboxRow,
} from "@/lib/actions/sandbox";

interface DataTabProps {
  sandboxId: string;
}

export function DataTab({ sandboxId }: DataTabProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadTables = async () => {
      setIsLoadingTables(true);
      try {
        const tableList = await getSandboxTables(sandboxId);
        setTables(tableList);
        if (tableList.length > 0) {
          setSelectedTable(tableList[0]);
        }
      } catch (error) {
        console.error("Failed to load tables:", error);
      } finally {
        setIsLoadingTables(false);
      }
    };
    loadTables();
  }, [sandboxId]);

  const loadTableData = useCallback(async () => {
    if (!selectedTable) return;
    setIsLoadingData(true);
    try {
      const data = await getSandboxTableData(sandboxId, selectedTable);
      setColumns(data.columns);
      setRows(data.rows);
    } catch (error) {
      console.error("Failed to load table data:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [sandboxId, selectedTable]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData();
    }
  }, [selectedTable, loadTableData]);

  const handleUpdate = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      if (!selectedTable) return;
      await updateSandboxRow(sandboxId, selectedTable, id, data);
      await loadTableData();
    },
    [sandboxId, selectedTable, loadTableData]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!selectedTable) return;
      await deleteSandboxRow(sandboxId, selectedTable, id);
      await loadTableData();
    },
    [sandboxId, selectedTable, loadTableData]
  );

  const handleCreate = useCallback(async () => {
    if (!selectedTable) return;
    setIsCreating(true);
    try {
      await createSandboxRow(sandboxId, selectedTable, newRowData);
      setShowAddDialog(false);
      setNewRowData({});
      await loadTableData();
    } catch (error) {
      console.error("Failed to create row:", error);
    } finally {
      setIsCreating(false);
    }
  }, [sandboxId, selectedTable, newRowData, loadTableData]);

  if (isLoadingTables) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No database tables found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <select
            value={selectedTable ?? ""}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="appearance-none rounded-md border bg-background px-3 py-1.5 pr-8 text-sm"
          >
            {tables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
        </div>
        <button
          onClick={() => {
            setNewRowData(
              columns.reduce(
                (acc, col) => ({ ...acc, [col.name]: "" }),
                {}
              )
            );
            setShowAddDialog(true);
          }}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Row
        </button>
        <button
          onClick={loadTableData}
          disabled={isLoadingData}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoadingData ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {showAddDialog && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Add New Row</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((col) => (
              <div key={col.name}>
                <label className="block text-xs text-muted-foreground mb-1">
                  {col.name}
                </label>
                <input
                  type="text"
                  value={newRowData[col.name] ?? ""}
                  onChange={(e) =>
                    setNewRowData((prev) => ({
                      ...prev,
                      [col.name]: e.target.value,
                    }))
                  }
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                  placeholder={col.type}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddDialog(false)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 rounded-lg border overflow-hidden">
        {isLoadingData ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
