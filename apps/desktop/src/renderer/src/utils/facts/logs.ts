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

/**
 * Checks if a URL is a valid Datadog logs view URL
 * @param url URL to check
 * @returns true if URL is a valid Datadog logs view URL
 */
export function isValidDatadogLogsViewUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  // Check for basic Datadog logs URL format
  if (!url.includes("datadoghq.com/logs") || !url.includes("query=")) {
    return false;
  }

  try {
    // Validate URL format
    const parsedUrl = new URL(url);

    // Check hostname
    if (!parsedUrl.hostname.includes("datadoghq.com")) {
      return false;
    }

    // Check path
    if (!parsedUrl.pathname.includes("/logs")) {
      return false;
    }

    // Check required parameters
    const params = parsedUrl.searchParams;
    const fromTs = params.get("from_ts");
    const toTs = params.get("to_ts");

    if (!fromTs || !toTs) {
      return false;
    }

    // Validate timestamps are numbers
    if (isNaN(parseInt(fromTs)) || isNaN(parseInt(toTs))) {
      return false;
    }

    return true;
  } catch {
    // If URL parsing fails, it's not a valid URL
    return false;
  }
}

/**
 * Parses a Datadog logs view URL into a LogSearchInput object
 * @param url Datadog logs view URL (e.g., https://app.datadoghq.com/logs?query=service%3Apayments&from_ts=1746738000000&to_ts=1746739800000)
 * @returns LogSearchInput object with parsed parameters
 */
export function datadogLogsViewUrlToLogSearchInput(url: string): LogSearchInput {
  try {
    // Parse the URL
    const parsedUrl = new URL(url);

    // Check if it's a Datadog logs URL
    if (!isValidDatadogLogsViewUrl(url)) {
      throw new Error("Not a valid Datadog logs URL");
    }

    // Extract query parameters
    const params = parsedUrl.searchParams;

    // Get the query string
    const query = params.get("query") || "";

    // Get timestamps and convert to ISO dates
    const fromTs = params.get("from_ts");
    const toTs = params.get("to_ts");

    if (!fromTs || !toTs) {
      throw new Error("Missing timestamp parameters in URL");
    }

    const start = new Date(parseInt(fromTs)).toISOString();
    const end = new Date(parseInt(toTs)).toISOString();

    // Default limit if not specified
    const limit = 500;

    // Return the LogSearchInput object
    return {
      type: "logSearchInput",
      query,
      start,
      end,
      limit,
      pageCursor: undefined,
    };
  } catch (error) {
    throw new Error(`Failed to parse Datadog URL: ${(error as Error).message}`);
  }
}
