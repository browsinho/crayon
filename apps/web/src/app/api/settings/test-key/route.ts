import { NextResponse } from "next/server";
import { z } from "zod";
import { testApiKey, type ApiKeys } from "@/lib/settings";

const TestKeyRequestSchema = z.object({
  service: z.enum(["anchorBrowser", "openai", "anthropic"]),
  key: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { service, key } = TestKeyRequestSchema.parse(data);
    const result = await testApiKey(service as keyof ApiKeys, key);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
