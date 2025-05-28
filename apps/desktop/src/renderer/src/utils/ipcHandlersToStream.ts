/**
 * Base interface for stream packets
 */
export interface BaseStreamPacket {
  id: string;
  chunk?: any;
  done?: boolean;
  error?: any;
  result?: any;
}

/**
 * Interface for IPC functions needed to create a ResponseStream
 * @template TInvokeArgs Type of the arguments passed to invoke
 * @template TPacket Type of the packet received in onChunk callback
 */
export interface IpcFunctions<
  TInvokeArgs extends any[] = any[],
  TPacket extends BaseStreamPacket = BaseStreamPacket,
> {
  invoke: (...args: TInvokeArgs) => Promise<any>;
  onChunk: (callback: (packet: TPacket) => void) => () => void;
  cancel: (streamId: string) => void;
}

/**
 * Interface for consuming streaming responses. This matches the interface
 * returned by calling `fetch` on an HTTP streaming API endpoint, allowing
 * clients to use the same interface for both HTTP and IPC streaming.
 */
export interface ResponseStream extends AsyncIterable<any> {
  /**
   * Cancels the current stream
   */
  cancel(): void;
}

/**
 * Converts a set of IPC functions into a stream that's compatible with the
 * ResponseStream interface.
 *
 * @param ipcFunctions Object containing invoke, onChunk, and cancel functions
 * @param args Arguments to pass to the invoke function
 * @returns A ResponseStream for consuming the response
 */
export async function ipcHandlersToStream<
  TInvokeArgs extends any[] = any[],
  TPacket extends BaseStreamPacket = BaseStreamPacket,
>(ipcFunctions: IpcFunctions<TInvokeArgs, TPacket>, ...args: TInvokeArgs): Promise<ResponseStream> {
  const streamId = await ipcFunctions.invoke(...args);

  let done = false;
  const queue: any[] = [];

  // attach once; dispose closes the listener
  const dispose = ipcFunctions.onChunk((packet) => {
    if (packet.id !== streamId) return;

    if (packet.chunk) queue.push(packet.chunk);
    if (packet.done || packet.error) {
      if (packet.result) queue.push(packet.result);
      done = true;
      dispose();
    }
  });

  return {
    async *[Symbol.asyncIterator]() {
      try {
        while (!done || queue.length) {
          if (queue.length) yield queue.shift()!;
          else await new Promise((r) => setTimeout(r, 30));
        }
      } finally {
        dispose(); // safeguard in case consumer breaks early
      }
    },

    cancel() {
      dispose();
      ipcFunctions.cancel(streamId);
      done = true;
    },
  };
}
