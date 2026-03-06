import { NextResponse } from "next/server";
import { getSettings, updateSettings, SettingsSchema } from "@/lib/settings";

export async function GET() {
  try {
    const settings = await getSettings();
    // Mask API keys in response
    const maskedSettings = {
      ...settings,
      apiKeys: {
        anchorBrowser: settings.apiKeys.anchorBrowser ? "••••••••" : undefined,
        openai: settings.apiKeys.openai ? "••••••••" : undefined,
        anthropic: settings.apiKeys.anthropic ? "••••••••" : undefined,
      },
    };
    return NextResponse.json(maskedSettings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const validated = SettingsSchema.partial().parse(data);
    const settings = await updateSettings(validated);
    // Mask API keys in response
    const maskedSettings = {
      ...settings,
      apiKeys: {
        anchorBrowser: settings.apiKeys.anchorBrowser ? "••••••••" : undefined,
        openai: settings.apiKeys.openai ? "••••••••" : undefined,
        anthropic: settings.apiKeys.anthropic ? "••••••••" : undefined,
      },
    };
    return NextResponse.json(maskedSettings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
