import { z } from "zod";

export const FileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(["file", "directory"]),
    children: z.array(FileNodeSchema).optional(),
  })
);

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export const TableRowSchema = z.object({
  id: z.string(),
  data: z.record(z.unknown()),
});
export type TableRow = z.infer<typeof TableRowSchema>;

export const TableColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
});
export type TableColumn = z.infer<typeof TableColumnSchema>;

export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
});
export type McpTool = z.infer<typeof McpToolSchema>;

export const McpConfigSchema = z.object({
  url: z.string(),
  apiKey: z.string(),
  tools: z.array(McpToolSchema),
});
export type McpConfig = z.infer<typeof McpConfigSchema>;

export const LogEntrySchema = z.object({
  timestamp: z.string(),
  message: z.string(),
  level: z.enum(["info", "warn", "error"]).optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

export interface CheckpointData {
  id: string;
  name: string;
  createdAt: Date;
}
