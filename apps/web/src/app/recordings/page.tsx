import { listProjects } from "@/lib/actions/projects";
import { RecordingsList } from "./recordings-list";

// Disable static generation - this page uses server actions with native dependencies
export const dynamic = "force-dynamic";

export default async function RecordingsPage() {
  const projects = await listProjects();

  // Filter to only projects that have recordings (status is "recorded" or later)
  const projectsWithRecordings = projects.filter(
    (p) => p.recording !== null || ["recorded", "analyzing", "generating", "ready"].includes(p.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Recordings</h2>
          <p className="text-muted-foreground">
            View all recorded browser sessions and their associated projects.
          </p>
        </div>
      </div>
      <RecordingsList projects={projectsWithRecordings} />
    </div>
  );
}
