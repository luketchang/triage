// This file provides type definitions for modules without their own type definitions

// Allow importing components, features, etc. without type errors
declare module "*/components/*";
declare module "*/features/*";
declare module "*/hooks/*";
declare module "*/icons/*";
declare module "*/services/*";
declare module "*/types/*";
declare module "*/utils/*";

/**
 * Global type declarations for custom window properties
 */

declare global {
  interface Window {
    /**
     * Electron API bridge
     */
    electronAPI: ElectronAPI;

    /**
     * Environment variables exposed to renderer
     */
    env: {
      TRACES_ENABLED: boolean;
      USE_MOCK_API: boolean;
    };
  }
}

// This export is needed to make this a module
export {};
