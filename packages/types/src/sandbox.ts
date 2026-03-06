import { z } from "zod";

export const SandboxStatusSchema = z.enum([
  "stopped",
  "starting",
  "running",
  "error",
]);
export type SandboxStatus = z.infer<typeof SandboxStatusSchema>;

export const SandboxPortsSchema = z.object({
  frontend: z.number().int().positive(),
  backend: z.number().int().positive(),
});
export type SandboxPorts = z.infer<typeof SandboxPortsSchema>;

export const SandboxSchema = z.object({
  id: z.string(),
  status: SandboxStatusSchema,
  ports: SandboxPortsSchema,
  url: z.string().optional(),
});
export type Sandbox = z.infer<typeof SandboxSchema>;

export const SandboxHostSchema = z.object({
  sandboxId: z.string(),
  url: z.string(),
  status: z.enum(["running", "stopped", "error"]),
  container: z.object({
    id: z.string(),
    ports: z.object({
      frontend: z.number().int().positive(),
      backend: z.number().int().positive().optional(),
    }),
  }),
});
export type SandboxHost = z.infer<typeof SandboxHostSchema>;
