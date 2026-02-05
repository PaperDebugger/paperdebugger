import { useState } from "react";

import { useSettingStore } from "../../../stores/setting-store";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SettingsSection } from "@/components/settings/SettingsSection";

export const SettingsFooter = () => {

  
  return (
    <div>
      <SettingsSection title="Version">
        <SettingsCard>
         
        </SettingsCard>
      </SettingsSection>
    </div>
  );
};
