import { Check, PlusCircle, Save, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/AlertDialog.js";
import { Button } from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Input.jsx";
import { ScrollArea } from "../components/ui/ScrollArea.jsx";
import { useAppConfig } from "../context/useAppConfig.js";

// TODO: temp until we fix imports from @triage/
export const DatadogCfgSchema = z.object({
  apiKey: z.string().optional(),
  appKey: z.string().optional(),
  site: z.string().default("datadoghq.com"),
});
export const GrafanaCfgSchema = z.object({
  baseUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const SectionHeader = ({ children }: { children: React.ReactNode }) => {
  return <h2 className="text-xl font-semibold mb-4 mt-6 text-white">{children}</h2>;
};

const SettingsGroup = ({ children }: { children: React.ReactNode }) => {
  return <div className="mb-6 space-y-3">{children}</div>;
};

const SettingField = ({
  label,
  children,
  description,
}: {
  label: string;
  children: React.ReactNode;
  description?: React.ReactNode;
}) => {
  return (
    <div className="grid grid-cols-12 items-center gap-4">
      <div className="col-span-4">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
      </div>
      <div className="col-span-8">{children}</div>
    </div>
  );
};

const SettingIntegrationCard = <T extends Record<string, any>>({
  title,
  description,
  integrationConfig,
  integrationConfigKey,
  schema,
  fields,
  renderFields,
}: {
  title: string;
  description: string;
  integrationConfig: T | undefined;
  integrationConfigKey: string;
  schema: z.ZodType<any>;
  fields: Array<{
    key: keyof T;
    label: string;
    description?: string;
    type?: "text" | "password";
    placeholder?: string;
  }>;
  renderFields?: (props: {
    localConfig: T;
    handleChange: (key: keyof T, value: any) => void;
  }) => React.ReactNode;
}) => {
  const { updateAppConfig } = useAppConfig();
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Apply schema defaults to configuration
  const getInitialConfig = useCallback(() => {
    try {
      // Parse the config through the schema to apply defaults
      // We use safeParse and provide empty values for missing fields
      const result = schema.safeParse(integrationConfig || {});
      if (result.success) {
        return result.data as T;
      } else {
        console.error("Schema validation error:", result.error);
        return (integrationConfig || {}) as T;
      }
    } catch (error) {
      console.error("Schema processing error:", error);
      return (integrationConfig || {}) as T;
    }
  }, [integrationConfig, schema]);

  const [localConfig, setLocalConfig] = useState<T>(getInitialConfig());
  const [originalConfig, setOriginalConfig] = useState<T>(getInitialConfig());

  const allFieldsComplete = React.useMemo(() => {
    if (!fields || fields.length === 0) {
      return true;
    }
    return fields.every((field) => {
      const value = localConfig[field.key];
      return value !== undefined && value !== null && value !== "";
    });
  }, [fields, localConfig]);

  const fieldsChanged = React.useMemo(() => {
    return JSON.stringify(localConfig) !== JSON.stringify(originalConfig);
  }, [localConfig, originalConfig]);

  // Re-initialize config when integrationConfig changes
  useEffect(() => {
    setIsVisible(!!integrationConfig);
    if (integrationConfig) {
      const newConfig = getInitialConfig();
      setLocalConfig(newConfig);
      setOriginalConfig(newConfig);
    }
  }, [integrationConfig, schema, getInitialConfig]);

  // Handle scrolling only when shouldScroll is true
  useEffect(() => {
    if (shouldScroll && cardRef.current) {
      // Use a small timeout to ensure the UI has updated
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        setShouldScroll(false); // Reset after scrolling
      }, 100);
    }
  }, [shouldScroll]);

  const handleChange = (key: keyof T, value: any) => {
    const updatedConfig = {
      ...localConfig,
      [key]: value,
    };
    setLocalConfig(updatedConfig);
  };

  const saveIntegration = async () => {
    if (!allFieldsComplete || !fieldsChanged) return;

    setIsSaving(true);
    try {
      // Apply schema defaults before saving
      const configToSave = schema.parse(localConfig);

      await updateAppConfig({
        [integrationConfigKey]: configToSave,
      });
      setOriginalConfig({ ...localConfig });
    } catch (error) {
      console.error(`Failed to save ${integrationConfigKey} integration:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const removeIntegration = async () => {
    setIsSaving(true);
    try {
      const newConfig = { [integrationConfigKey]: undefined };
      await updateAppConfig(newConfig);
      setIsVisible(false);
      setShowRemoveDialog(false);
    } catch (error) {
      console.error(`Failed to remove ${integrationConfigKey} integration:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddIntegration = () => {
    setIsVisible(true);
    setShouldScroll(true); // Trigger scroll when button is clicked
  };

  return (
    <div ref={cardRef} className="border border-border rounded-md p-4 mb-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-medium text-white">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
        {isVisible ? (
          <div className="flex justify-end gap-3">
            <Button
              size="sm"
              variant="destructiveOutline"
              onClick={() => setShowRemoveDialog(true)}
              className="mt-2"
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
            <Button
              size="sm"
              onClick={saveIntegration}
              disabled={isSaving || !fieldsChanged || !allFieldsComplete}
              className="mt-2"
            >
              {!fieldsChanged && allFieldsComplete ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={handleAddIntegration}>
            <PlusCircle className="h-4 w-4 mr-2" /> Add Integration
          </Button>
        )}
      </div>

      {isVisible && (
        <div className="mt-4 border-t border-gray-800 pt-4 space-y-4">
          {renderFields
            ? renderFields({ localConfig, handleChange })
            : fields.map((field) => (
                <SettingField
                  key={String(field.key)}
                  label={field.label}
                  description={field.description}
                >
                  <Input
                    type={field.type || "text"}
                    value={localConfig[field.key] ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder || "..."}
                  />
                </SettingField>
              ))}
        </div>
      )}

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {title} Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete your {title} configuration. To add it back, you'll need to enter any
              settings again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeIntegration}
              disabled={isSaving}
              variant="destructiveOutline"
            >
              {isSaving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const DatadogIntegration = () => {
  const { appConfig } = useAppConfig();

  return (
    <SettingIntegrationCard
      title="Datadog"
      description="Connect to let your AI agent search logs on Datadog."
      integrationConfig={appConfig?.datadog}
      integrationConfigKey="datadog"
      schema={DatadogCfgSchema}
      fields={[
        {
          key: "apiKey",
          label: "API Key",
          description: "Datadog read-only API key",
          type: "password",
        },
        {
          key: "appKey",
          label: "App Key",
          description: "Datadog application key",
          type: "password",
        },
        {
          key: "site",
          label: "Site",
          description: "Custom Datadog site (if applicable)",
          placeholder: "datadoghq.com",
        },
      ]}
    />
  );
};

const GrafanaIntegration = () => {
  const { appConfig } = useAppConfig();

  return (
    <SettingIntegrationCard
      title="Grafana"
      description="Connect to let your AI agent search logs on Grafana."
      integrationConfig={appConfig?.grafana}
      integrationConfigKey="grafana"
      schema={GrafanaCfgSchema}
      fields={[
        {
          key: "baseUrl",
          label: "Base URL",
          description: "Grafana base URL",
          placeholder: "https://...",
        },
        {
          key: "username",
          label: "Username",
          description: "Grafana username (read-only)",
        },
        {
          key: "password",
          label: "Password",
          description: "Grafana password",
          type: "password",
        },
      ]}
    />
  );
};

function SettingsView() {
  const { appConfig, updateAppConfig, isLoading } = useAppConfig();
  const [localConfig, setLocalConfig] = useState<any>({});
  const [originalConfig, setOriginalConfig] = useState<any>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    if (appConfig && !isLoading) {
      const configCopy = { ...appConfig };
      setLocalConfig(configCopy);
      setOriginalConfig(configCopy);
      setHasChanges(false);
    }
  }, [appConfig, isLoading]);

  // Update local state only
  const handleChange = (key: string, value: any) => {
    const updatedConfig = {
      ...localConfig,
      [key]: value,
    };
    setLocalConfig(updatedConfig);

    // Check if the updated localConfig differs from original
    const isChanged = JSON.stringify(updatedConfig) !== JSON.stringify(originalConfig);
    setHasChanges(isChanged);
  };

  // Save settings
  const saveSettings = async () => {
    if (!localConfig || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateAppConfig(localConfig);
      setOriginalConfig({ ...localConfig });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = async () => {
    if (hasChanges) {
      await saveSettings();
    }
  };

  if (isLoading || !localConfig) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-white">Loading settings...</h2>
          <p className="text-white">Please wait while we load your configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex justify-between items-center py-3 px-4 border-b border-border bg-background-lighter backdrop-blur-sm shadow-sm z-10">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <div className="flex items-center gap-3">
          <Button onClick={saveSettings} disabled={isSaving || !hasChanges} className="min-w-28">
            {isSaving ? (
              "Saving..."
            ) : hasChanges ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <SectionHeader>Your Code</SectionHeader>
          <SettingsGroup>
            <SettingField label="Repository Path" description="Local path to your code repository">
              <Input
                value={localConfig.repoPath || ""}
                onChange={(e) => handleChange("repoPath", e.target.value)}
                onBlur={handleBlur}
                placeholder="/path/to/repo"
              />
            </SettingField>

            <SettingField
              label="Codebase Overview Path"
              description="Path to codebase overview file"
            >
              <Input
                value={localConfig.codebaseOverviewPath || ""}
                onChange={(e) => handleChange("codebaseOverviewPath", e.target.value)}
                onBlur={handleBlur}
                placeholder="/path/to/overview.md"
              />
            </SettingField>

            <SettingField
              label="GitHub Repo Base URL"
              description="Base URL for your GitHub repository"
            >
              <Input
                value={localConfig.githubRepoBaseUrl || ""}
                onChange={(e) => handleChange("githubRepoBaseUrl", e.target.value)}
                onBlur={handleBlur}
                placeholder="https://github.com/username/repo"
              />
            </SettingField>
          </SettingsGroup>

          <SectionHeader>AI Access</SectionHeader>
          <SettingsGroup>
            <SettingField
              label="Google Gemini API Key"
              description={
                <>
                  Get your API key from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </>
              }
            >
              <Input
                type="password"
                value={localConfig.googleApiKey || ""}
                onChange={(e) => handleChange("googleApiKey", e.target.value)}
                onBlur={handleBlur}
                placeholder="..."
              />
            </SettingField>
          </SettingsGroup>

          <SectionHeader>Telemetry Access</SectionHeader>
          <DatadogIntegration />
          {/* <GrafanaIntegration /> */}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SettingsView;
