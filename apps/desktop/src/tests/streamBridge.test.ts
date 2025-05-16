import { ipcRenderer } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ipcHandlersToStream } from "../preload/ipcStream.js";

// Mock the ipcRenderer
vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  },
}));

describe("streamBridge", () => {
  let listeners: Record<string, (event: any, data: any) => void> = {};

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Reset listeners
    listeners = {};

    // Mock implementations
    (ipcRenderer.invoke as any).mockImplementation((channel: string, ...args: any[]) => {
      if (channel === "test:invoke") {
        return Promise.resolve("test-stream-id");
      }
      return Promise.resolve(null);
    });

    (ipcRenderer.on as any).mockImplementation(
      (channel: string, callback: (event: any, data: any) => void) => {
        listeners[channel] = callback;
      }
    );

    (ipcRenderer.removeListener as any).mockImplementation((channel: string, callback: any) => {
      delete listeners[channel];
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should create a stream and handle chunks", async () => {
    // Setup the test stream
    const stream = await ipcHandlersToStream("test", "some argument");

    // Verify that invoke was called with the correct arguments
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("test:invoke", "some argument");

    // Verify that the listener was registered
    expect(ipcRenderer.on).toHaveBeenCalledWith("test:chunk", expect.any(Function));

    // Simulate receiving chunks
    const chunks = ["chunk1", "chunk2", "chunk3"];
    const receivedChunks: string[] = [];

    // Start consuming the stream
    const consumePromise = (async () => {
      for await (const chunk of stream) {
        receivedChunks.push(chunk);
      }
    })();

    // Send chunks through the mocked event listener
    for (const chunk of chunks) {
      listeners["test:chunk"]({}, { id: "test-stream-id", chunk });
    }

    // Send done signal
    listeners["test:chunk"]({}, { id: "test-stream-id", done: true });

    // Wait for stream consumption to complete
    await consumePromise;

    // Verify received chunks
    expect(receivedChunks).toEqual(chunks);
  });

  it("should ignore chunks with mismatched stream id", async () => {
    // Setup the test stream
    const stream = await ipcHandlersToStream("test", "some argument");

    // Start collecting chunks
    const receivedChunks: string[] = [];
    const consumePromise = (async () => {
      for await (const chunk of stream) {
        receivedChunks.push(chunk);
      }
    })();

    // Send chunks with wrong ID
    listeners["test:chunk"]({}, { id: "wrong-id", chunk: "should be ignored" });

    // Send valid chunk
    listeners["test:chunk"]({}, { id: "test-stream-id", chunk: "valid chunk" });

    // Complete the stream
    listeners["test:chunk"]({}, { id: "test-stream-id", done: true });

    // Wait for stream consumption to complete
    await consumePromise;

    // Verify only valid chunks were received
    expect(receivedChunks).toEqual(["valid chunk"]);
  });

  it("should cancel the stream properly", async () => {
    // Setup the test stream
    const stream = await ipcHandlersToStream("test", "some argument");

    // Cancel the stream
    stream.cancel();

    // Verify that cancel was called with the correct stream ID
    expect(ipcRenderer.send).toHaveBeenCalledWith("test:cancel", "test-stream-id");

    // Verify that the listener was removed
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith("test:chunk", expect.any(Function));
  });
});
