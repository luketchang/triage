import * as Sentry from "@sentry/electron";
import { IpcMain, ipcMain } from "electron";

type RegisterArgs = Parameters<IpcMain["handle"]>;
export function registerHandler(channel: RegisterArgs[0], listener: RegisterArgs[1]): void {
  // Wrap handler to catch errors and send them to Sentry. Otherwise the error is caught by
  // electron and serialized as an IPC error, so Sentry never has a chance to catch it.
  const wrappedHandler = async (...handlerArgs: Parameters<RegisterArgs[1]>) => {
    try {
      return await listener(...handlerArgs);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };
  return ipcMain.handle(channel, wrappedHandler);
}
