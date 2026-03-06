import { NextResponse } from "next/server";
import { z } from "zod";
import { getDockerStatus, stopAllContainers, pruneDocker } from "@/lib/settings";

export async function GET() {
  try {
    const status = await getDockerStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get Docker status" },
      { status: 500 }
    );
  }
}

const DockerActionSchema = z.object({
  action: z.enum(["stop-all", "prune"]),
});

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { action } = DockerActionSchema.parse(data);

    if (action === "stop-all") {
      await stopAllContainers();
      return NextResponse.json({ success: true, message: "All containers stopped" });
    } else if (action === "prune") {
      await pruneDocker();
      return NextResponse.json({ success: true, message: "Docker resources pruned" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 }
    );
  }
}
