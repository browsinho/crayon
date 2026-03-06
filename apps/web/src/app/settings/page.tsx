"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Key, Server, HardDrive, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ApiKeysSection,
  StorageSection,
  DockerSection,
  AdvancedSection,
} from "./sections";

type SettingsTab = "api-keys" | "storage" | "docker" | "advanced";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api-keys");

  const tabs = [
    { id: "api-keys" as const, label: "API Keys", icon: Key },
    { id: "storage" as const, label: "Storage", icon: HardDrive },
    { id: "docker" as const, label: "Docker", icon: Server },
    { id: "advanced" as const, label: "Advanced", icon: Settings2 },
  ];

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your application settings
        </p>
      </div>

      <div className="mt-6 flex gap-6">
        <nav className="w-40 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <Card className="flex-1">
          <CardContent className="p-6">
            {activeTab === "api-keys" && <ApiKeysSection />}
            {activeTab === "storage" && <StorageSection />}
            {activeTab === "docker" && <DockerSection />}
            {activeTab === "advanced" && <AdvancedSection />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
