import { Cell } from "../types";

/**
 * CellUpdateManager
 *
 * Manages updates to a single Cell in a safe, ordered, and race-condition-free manner.
 * Ensures that all updates (from streaming events) are applied in order, atomically,
 * and immutably. Notifies the UI after each update.
 */
export class CellUpdateManager {
  private cell: Cell;
  private updateQueue: Array<(cell: Cell) => Cell> = [];
  private isProcessing = false;
  private onUpdate: (cell: Cell) => void;

  /**
   * Constructor
   *
   * @param initialCell - The initial cell state
   * @param onUpdate - Callback to be called after each update
   */
  constructor(initialCell: Cell, onUpdate: (cell: Cell) => void) {
    this.cell = initialCell;
    this.onUpdate = onUpdate;
  }

  /**
   * Get the current cell state
   *
   * @returns The current cell state
   */
  getCell(): Cell {
    return this.cell;
  }

  /**
   * Queue an update to the cell
   *
   * @param updateFn - Function that describes how to update the cell
   */
  queueUpdate(updateFn: (cell: Cell) => Cell): void {
    this.updateQueue.push(updateFn);
    this.processQueue();
  }

  /**
   * Process the update queue
   *
   * Ensures updates are processed in order and one at a time
   */
  private processQueue(): void {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.updateQueue.length > 0) {
        const updateFn = this.updateQueue.shift()!;
        this.cell = updateFn(this.cell);
      }

      // Notify listeners of the update
      this.onUpdate(this.cell);
    } catch (error) {
      console.error("Error processing cell update:", error);
    } finally {
      this.isProcessing = false;
    }
  }
}
