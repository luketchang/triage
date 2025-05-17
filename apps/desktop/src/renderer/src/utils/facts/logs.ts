import { LogPostprocessingFact, LogSearchInput } from "../../types/index.js"; // adjust path as needed

/**
 * Converts a LogSearchInput or LogPostprocessingFact into a Datadog log viewer URL
 */
export function logSearchInputToDatadogLogsViewUrl(
  input: LogSearchInput | LogPostprocessingFact
): string {
  const core: LogSearchInput = {
    type: "logSearchInput",
    query: input.query,
    start: input.start,
    end: input.end,
    limit: input.limit,
    pageCursor: undefined,
  };

  const fromTs = new Date(core.start).getTime();
  const toTs = new Date(core.end).getTime();

  const baseUrl = "https://app.datadoghq.com/logs";
  const queryParams = new URLSearchParams({
    query: core.query,
    from_ts: fromTs.toString(),
    to_ts: toTs.toString(),
    viz: "stream",
    stream_sort: "desc",
    cols: "host,service",
    live: "false",
    refresh_mode: "paused",
    messageDisplay: "inline",
    storage: "hot",
  });

  return `${baseUrl}?${queryParams.toString()}`;
}
