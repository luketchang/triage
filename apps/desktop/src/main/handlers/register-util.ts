import { IpcMain, ipcMain } from "electron";

type RegisterArgs = Parameters<IpcMain["handle"]>;
export function registerHandler(channel: RegisterArgs[0], listener: RegisterArgs[1]): void {
  const wrappedHandler = async (...handlerArgs: Parameters<RegisterArgs[1]>) => {
    // try {
    return await listener(...handlerArgs);
    // } catch (error) {
    //   Sentry.captureException(error);
    //   throw error;
    // }
  };
  return ipcMain.handle(channel, wrappedHandler);
}
