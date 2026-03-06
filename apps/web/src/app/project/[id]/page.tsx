import { getProject } from "@/lib/actions/projects";
import { getRecording } from "@/lib/actions/recording";
import { getSandbox } from "@/lib/actions/sandbox";
import { notFound } from "next/navigation";
import { ProjectOverview } from "./project-overview";

// Disable static generation - this page uses server actions with native dependencies
export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const [project, recording, sandboxResult] = await Promise.all([
    getProject(id),
    getRecording(id),
    getSandbox(id),
  ]);

  if (!project) {
    notFound();
  }

  // Extract sandbox data from result, treating errors as no sandbox
  const sandbox = sandboxResult.success ? sandboxResult.data : null;

  return <ProjectOverview project={project} recording={recording} sandbox={sandbox} />;
}
