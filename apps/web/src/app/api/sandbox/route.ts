import { getCrayonService } from "@/lib/crayon";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const service = getCrayonService();
  const sandbox = await service.getSandbox(projectId);

  if (!sandbox) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
  }

  return NextResponse.json(sandbox);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, action } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const service = getCrayonService();

  switch (action) {
    case "start": {
      const sandbox = await service.startSandbox(projectId);
      return NextResponse.json(sandbox);
    }
    case "stop": {
      await service.stopSandbox(projectId);
      return NextResponse.json({ success: true });
    }
    case "restart": {
      const sandbox = await service.restartSandbox(projectId);
      return NextResponse.json(sandbox);
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
