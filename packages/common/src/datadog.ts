import tracer, { Span } from "dd-trace";
import path from "path";

export function trace<T>(cb: (span?: Span) => Promise<T>): Promise<T> {
  // Logic to compute the span name
  const { stack } = new Error();
  const lines = stack !== undefined ? stack.split("\n") : [];
  const callerLine = lines[2] || ""; // The caller of the caller (the outer function)

  const matchFilePath = callerLine.match(/\(([^:]+):\d+:\d+\)$/);
  const callerFilename = (matchFilePath ? matchFilePath[1] : "") ?? "";
  const matchFunctionName = callerLine.match(/at (\S+)(?: \()/);

  const dirParts = path.dirname(callerFilename).split(path.sep);
  const srcIndex = dirParts.indexOf("build");
  const dirsAfterSrc = srcIndex !== -1 ? dirParts.slice(srcIndex + 1) : dirParts;
  const dirNameStr = `${dirsAfterSrc.join(".")}`;

  let baseName = path.basename(callerFilename, ".ts");
  baseName = baseName.replace(/\.js$/, "");
  const functionName = matchFunctionName ? `${matchFunctionName[1]}` : "";

  const spanName = `${dirNameStr}.${baseName}::${functionName}`;
  const childOf = tracer.scope().active();

  // Tracing logic
  return new Promise((resolve, reject) => {
    void tracer.trace(spanName, { childOf: childOf ?? undefined }, async (span) => {
      try {
        const result = await cb(span);
        resolve(result);
      } catch (error) {
        span?.setTag("error", error);
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      } finally {
        span?.finish();
      }
    });
  });
}

export default tracer;
