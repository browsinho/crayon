import { NextResponse } from "next/server";
import { getStorageUsage, clearCache, clearAllData } from "@/lib/settings";

export async function GET() {
  try {
    const usage = await getStorageUsage();
    return NextResponse.json(usage);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get storage usage" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "cache") {
      await clearCache();
      return NextResponse.json({ success: true, message: "Cache cleared" });
    } else if (type === "all") {
      await clearAllData();
      return NextResponse.json({ success: true, message: "All data cleared" });
    } else {
      return NextResponse.json(
        { error: "Invalid type. Use 'cache' or 'all'" },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear data" },
      { status: 500 }
    );
  }
}
