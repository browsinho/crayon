"use server";

import { getCrayonService } from "@/lib/crayon";
import { revalidatePath } from "next/cache";

import type { GenerationOptions, AnalysisResults } from "@/lib/generation-types";

export async function getAnalysisResults(
  projectId: string
): Promise<AnalysisResults | null> {
  const service = getCrayonService();

  // Verify project exists
  const project = await service.getProject(projectId);
  if (!project) {
    return null;
  }

  // Check if recording exists
  const recording = await service.getRecording(projectId);
  if (!recording) {
    return null;
  }

  // Return mock analysis results for now
  // In a real implementation, this would analyze the recording
  return {
    framework: "Next.js 14 (App Router)",
    frameworkVersion: "14.0.4",
    auth: "JWT + Cookie session",
    apiRoutes: recording.networkCalls.length,
    widgets: ["DataTable", "Modal", "Form", "Toast"],
    database: "PostgreSQL (inferred)",
    pages: ["/", "/products", "/products/[id]", "/cart", "/checkout"],
    components: ["ProductCard", "CartItem", "Header", "Footer"],
  };
}

export async function startGeneration(
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: GenerationOptions
): Promise<{ generationId: string }> {
  const service = getCrayonService();

  // Verify project exists
  const project = await service.getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Verify recording exists
  const recording = await service.getRecording(projectId);
  if (!recording) {
    throw new Error(`No recording found for project: ${projectId}`);
  }

  // Generate a unique generation ID
  const generationId = `${projectId}-gen-${Date.now()}`;

  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/generate`);

  return { generationId };
}

export async function cancelGeneration(generationId: string): Promise<void> {
  // Extract projectId from generationId (format: {projectId}-gen-{timestamp})
  const projectId = generationId.split("-gen-")[0];

  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/generate`);
}
