"use server";

import { getCrayonService } from "@/lib/crayon";
import type {
  Project,
  ProjectListFilters,
  ProjectSort,
  CreateProjectData,
} from "@crayon/types";
import { revalidatePath } from "next/cache";

export async function listProjects(
  filters?: ProjectListFilters,
  sort?: ProjectSort
): Promise<Project[]> {
  const service = getCrayonService();
  return service.listProjects(filters, sort);
}

export async function getProject(id: string): Promise<Project | null> {
  const service = getCrayonService();
  return service.getProject(id);
}

export async function createProject(data: CreateProjectData): Promise<Project> {
  const service = getCrayonService();
  const project = await service.createProject(data);
  revalidatePath("/");
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const service = getCrayonService();
  await service.deleteProject(id);
  revalidatePath("/");
}
