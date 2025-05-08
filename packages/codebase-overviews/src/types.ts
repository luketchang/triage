import { z } from "zod";

export interface ServiceSelection {
  reason: string;
  module: string;
}

export interface SelectedModules {
  selections: ServiceSelection[];
}

export const serviceSelectionSchema = z.object({
  reason: z.string().describe("Explanation for including this service"),
  module: z.string().describe("Filepath for the service"),
});

export const selectedModulesSchema = z.object({
  selections: z
    .array(serviceSelectionSchema)
    .describe("List of services/modules selected and their reasons"),
});

export interface CollectedFiles {
  fileTree: string;
  pathToSourceCode: Record<string, string>;
}
