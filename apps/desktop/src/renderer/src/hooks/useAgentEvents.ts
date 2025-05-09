import { useEffect } from "react";
import { useAgentStore } from "../store/index.js";
import { CellUpdateManager } from "../utils/CellUpdateManager.js";

/**
 * Hook to register for agent events.
 *
 * This hook manages the lifecycle of agent updates by registering
 * and unregistering event handlers when the cell manager changes.
 */
export function useAgentEvents(cellManager: CellUpdateManager | null) {
  const { setCellManager, unregisterAgentUpdates } = useAgentStore();

  // Register for agent events when cell manager changes
  useEffect(() => {
    // Set the cell manager in the agent store
    setCellManager(cellManager);

    // Cleanup function to unregister events when component unmounts
    // or when cell manager changes
    return () => {
      unregisterAgentUpdates();
    };
  }, [cellManager, setCellManager, unregisterAgentUpdates]);
}
