"use server";

import { getCrayonService } from "@/lib/crayon";
import type { Recording } from "@crayon/types";
import { revalidatePath } from "next/cache";

export async function getRecording(projectId: string): Promise<Recording | null> {
  const service = getCrayonService();
  return service.getRecording(projectId);
}

export async function startRecording(
  projectId: string,
  url: string
): Promise<{ sessionId: string; liveViewUrl: string }> {
  const service = getCrayonService();
  const result = await service.startRecording(projectId, url);
  revalidatePath(`/project/${projectId}`);
  return result;
}

export async function stopRecording(sessionId: string, projectId: string): Promise<{ projectId: string }> {
  const service = getCrayonService();

  // Try to stop the browser session and get any captured data
  let sessionData: Awaited<ReturnType<typeof service.stopRecording>> = null;
  try {
    sessionData = await service.stopRecording(sessionId);
  } catch (error) {
    console.error("Error stopping recording session:", error);
  }

  // Always save a recording, even if session wasn't found (HMR case)
  // Now includes multi-page data: userEvents, correlatedGroups, pages
  await service.saveRecordingForProject(projectId, {
    startUrl: sessionData?.startUrl,
    startTime: sessionData?.startTime,
    domSnapshots: sessionData?.domSnapshots,
    networkCalls: sessionData?.networkCalls,
    screenshots: sessionData?.screenshots,
    userEvents: sessionData?.userEvents,
    correlatedGroups: sessionData?.correlatedGroups,
    pages: sessionData?.pages,
  });

  revalidatePath(`/project/${projectId}`);
  revalidatePath("/");

  return { projectId };
}

export async function cancelRecording(sessionId: string, projectId: string): Promise<void> {
  const service = getCrayonService();

  // Close the browser session
  try {
    await service.stopRecording(sessionId);
  } catch (error) {
    console.error("Error closing recording session:", error);
  }

  // Delete the project that was created for this recording
  try {
    await service.deleteProject(projectId);
  } catch (error) {
    console.error("Error deleting project:", error);
  }

  revalidatePath("/");
}
