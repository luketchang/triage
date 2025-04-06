// This file ensures TypeScript recognizes the types from the Triage packages
import type { Log } from "@triage/observability/src/types";

// A placeholder for future Electron API integration
declare global {
  interface Window {
    // Will be defined when we add Electron integration
  }
}
