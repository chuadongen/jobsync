"use client";

import { useState } from "react";
import DisplaySettings from "@/components/settings/DisplaySettings";
import McpAccessSettings from "@/components/settings/McpAccessSettings";
import SettingsSidebar, { type SettingsSection } from "@/components/settings/SettingsSidebar";

function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("mcp-access");

  return (
    <div className="flex flex-col col-span-3">
      <h3 className="text-2xl font-semibold leading-none tracking-tight mb-4">
        Settings
      </h3>
      <div className="flex gap-3 sm:gap-6">
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div className="flex-1 min-w-0">
          {activeSection === "mcp-access" && <McpAccessSettings />}
          {activeSection === "appearance" && <DisplaySettings />}
        </div>
      </div>
    </div>
  );
}

export default Settings;
