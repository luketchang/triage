import { CodebaseOverviewProgressUpdate } from "@triage/codebase-overviews";
import { Check, Loader2, PlusCircle, Save, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/Accordion.js";
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
import { Markdown } from "../components/ui/Markdown.js";
import { Progress } from "../components/ui/Progress.js";
import { ScrollArea } from "../components/ui/ScrollArea.jsx";
import { useAppConfig } from "../context/useAppConfig.js";
import api from "../services/api.js";
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
    <div className="grid grid-cols-12 items-start gap-4">
      <div className="col-span-4">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
      </div>
      <div className="col-span-8">{children}</div>
    </div>
  );
};

const DeleteButton = ({
  title,
  description,
  onDelete,
  buttonText = "Delete",
  size = "sm",
}: {
  title: string;
  description: string;
  onDelete: () => Promise<void>;
  buttonText?: string;
  size?: "sm" | "default";
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Button size={size} variant="destructiveOutline" onClick={() => setShowDeleteDialog(true)}>
        <X className="h-4 w-4 mr-1" /> {buttonText}
      </Button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructiveOutline"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const [serverConfig, setServerConfig] = useState<T>(getInitialConfig());

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
    return JSON.stringify(localConfig) !== JSON.stringify(serverConfig);
  }, [localConfig, serverConfig]);

  // Re-initialize config when integrationConfig changes
  useEffect(() => {
    setIsVisible(!!integrationConfig);
    if (integrationConfig) {
      const newConfig = getInitialConfig();
      setLocalConfig(newConfig);
      setServerConfig(newConfig);
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
      setServerConfig({ ...localConfig });
    } catch (error) {
      console.error(`Failed to save ${integrationConfigKey} integration:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteIntegration = async () => {
    setIsSaving(true);
    try {
      const newConfig = { [integrationConfigKey]: undefined };
      await updateAppConfig(newConfig);
      setIsVisible(false);
    } catch (error) {
      console.error(`Failed to delete ${integrationConfigKey} integration:`, error);
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
          <div className="mt-2 flex justify-end gap-3">
            <DeleteButton
              title={`${title} Integration`}
              description={`This will delete your ${title} configuration. To add it back, you'll need to enter any settings again.`}
              onDelete={deleteIntegration}
            />
            <Button
              size="sm"
              onClick={saveIntegration}
              disabled={isSaving || !fieldsChanged || !allFieldsComplete}
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
  // Config rendered in the UI. This may be different from the config in the server
  // if it hasn't been saved yet.
  const [localConfig, setLocalConfig] = useState<any>({});
  // Config last retrieved from the server.
  const [serverConfig, setServerConfig] = useState<any>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // State for overview
  const [isGeneratingOverview, setIsGeneratingOverview] = useState<boolean>(false);
  const [overviewProgress, setOverviewProgress] = useState<CodebaseOverviewProgressUpdate | null>(
    null
  );
  const [overviewExpanded, setOverviewExpanded] = useState<boolean>(false);

  // Cleanup function reference
  const progressCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (appConfig && !isLoading) {
      const configCopy = { ...appConfig };
      setLocalConfig(configCopy);
      setServerConfig(configCopy);
      setHasChanges(false);
    }
  }, [appConfig, isLoading]);

  // Cleanup progress listener on unmount
  useEffect(() => {
    return () => {
      if (progressCleanupRef.current) {
        progressCleanupRef.current();
        progressCleanupRef.current = null;
      }
    };
  }, []);

  // Update local state only
  const handleChange = (key: string, value: any) => {
    const updatedConfig = {
      ...localConfig,
      [key]: value,
    };
    setLocalConfig(updatedConfig);

    // Check if the updated localConfig differs from original
    const isChanged = JSON.stringify(updatedConfig) !== JSON.stringify(serverConfig);
    setHasChanges(isChanged);
  };

  // Save settings
  const saveSettings = async () => {
    if (!localConfig || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateAppConfig(localConfig);
      setServerConfig({ ...localConfig });
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

  const handleGenerateOverview = async () => {
    if (!localConfig.repoPath || isGeneratingOverview) return;

    setIsGeneratingOverview(true);
    setOverviewProgress({
      status: "processing",
      message: "Generating overview...",
      progress: 0,
    });
    // Show the progress bar
    setOverviewExpanded(true);

    try {
      // Register for progress updates
      if (progressCleanupRef.current) {
        progressCleanupRef.current();
      }
      progressCleanupRef.current = api.onCodebaseOverviewProgress(async (update) => {
        setOverviewProgress(update);
      });
      // Start the generation
      await api.generateCodebaseOverview(localConfig.repoPath);
      const newCfg = await api.getAppConfig();
      setLocalConfig(newCfg);
      setServerConfig(newCfg);
      setIsGeneratingOverview(false);
    } catch (error) {
      console.error("Failed to generate codebase overview:", error);
      setOverviewProgress({
        status: "error",
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        progress: 0,
      });
      setIsGeneratingOverview(false);
    }
  };

  const handleDeleteOverview = async () => {
    setIsGeneratingOverview(true);
    try {
      await updateAppConfig({ codebaseOverview: undefined });
      setLocalConfig((prev) => ({ ...prev, codebaseOverview: undefined }));
      setServerConfig((prev) => ({ ...prev, codebaseOverview: undefined }));
    } catch (error) {
      console.error("Failed to delete codebase overview:", error);
    } finally {
      setIsGeneratingOverview(false);
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
          <SectionHeader>AI Models</SectionHeader>
          <SettingsGroup>
            <SettingField
              label="OpenAI API Key"
              description={
                <>
                  Get your key from{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    OpenAI Dashboard
                  </a>
                </>
              }
            >
              <Input
                type="password"
                value={localConfig.openaiApiKey || ""}
                onChange={(e) => handleChange("openaiApiKey", e.target.value)}
                onBlur={handleBlur}
                placeholder="..."
              />
            </SettingField>

            <SettingField
              label="Google Gemini API Key"
              description={
                <>
                  Get your key from{" "}
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
              label="Codebase Overview"
              description="Helps the AI understand your codebase, making it faster and more reliable at debugging issues"
            >
              <div className="space-y-4">
                {serverConfig.codebaseOverview ? (
                  <>
                    <div className="flex items-center justify-between bg-muted rounded-md">
                      <span className="px-1 text-sm text-muted-foreground truncate max-w-[300px] italic">
                        {isGeneratingOverview ? "Last generated" : "Generated"}
                        {serverConfig.codebaseOverview.createdAt
                          ? ` at ${new Date(serverConfig.codebaseOverview.createdAt).toLocaleString(
                              undefined,
                              {
                                year: "numeric",
                                month: "numeric",
                                day: "numeric",
                                hour: "numeric",
                                minute: "numeric",
                              }
                            )}`
                          : " overview available"}
                      </span>
                      <div className="flex gap-2">
                        {serverConfig.codebaseOverview.repoPath !== serverConfig.repoPath && (
                          <DeleteButton
                            title="Codebase Overview"
                            description="This will delete your codebase overview. You can regenerate it at any time."
                            onDelete={handleDeleteOverview}
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateOverview}
                          disabled={isGeneratingOverview || !serverConfig.repoPath}
                        >
                          Regenerate
                        </Button>
                      </div>
                    </div>
                    {serverConfig.codebaseOverview.repoPath !== serverConfig.repoPath && (
                      <div className="px-1 text-sm text-primary italic">
                        Warning: This overview may be out-of-date as it was generated for a
                        different repository
                        {serverConfig.codebaseOverview.repoPath
                          ? `: ${serverConfig.codebaseOverview.repoPath}`
                          : "."}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-muted p-2 rounded-md">
                    <span className="text-sm text-muted-foreground">
                      Generate an overview of your codebase to help the AI debug issues faster and
                      more reliably.
                    </span>
                    <Button
                      onClick={handleGenerateOverview}
                      disabled={isGeneratingOverview || !serverConfig.repoPath}
                      variant="outline"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                )}
                {(serverConfig.codebaseOverview || isGeneratingOverview) && (
                  <Accordion
                    type="single"
                    collapsible
                    value={overviewExpanded ? "overview" : ""}
                    onValueChange={(value) => setOverviewExpanded(value === "overview")}
                  >
                    <AccordionItem
                      value="overview"
                      className="border border-border rounded-md bg-background-lighter"
                    >
                      <AccordionTrigger
                        className="px-3 py-2 hover:no-underline"
                        chevronPosition="left"
                      >
                        {isGeneratingOverview ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Generating Overview...</span>
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : (
                          <span className="text-sm font-medium">
                            Generated Overview
                            {serverConfig.codebaseOverview.content &&
                              ` (${serverConfig.codebaseOverview.content.split("\n").length} lines)`}
                          </span>
                        )}
                      </AccordionTrigger>
                      <AccordionContent className="py-1 px-4 max-h-[400px] overflow-y-auto">
                        {isGeneratingOverview && overviewProgress ? (
                          <div className="mt-2 space-y-2">
                            <Progress value={overviewProgress.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                              {overviewProgress.message}
                            </p>
                          </div>
                        ) : (
                          <div className="prose-sm p-2">
                            <Markdown>{serverConfig.codebaseOverview.content}</Markdown>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
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
