import { GrafanaConfig } from "../../../config";
import { IntegrationType } from "../../../shared";
import { TracesClient } from "../../traces.interface";
import {
  SpanSearchInput,
  SpansWithPagination,
  Trace,
  TraceSearchInput,
  TracesWithPagination,
} from "../../types";

export class GrafanaTracesClient implements TracesClient {
  integrationType: IntegrationType = IntegrationType.GRAFANA;
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(cfg: GrafanaConfig) {
    this.baseUrl = cfg.baseUrl;
    this.username = cfg.username;
    this.password = cfg.password;
  }

  addKeywordsToQuery(query: string, keywords: string[]): string {
    throw new Error("addKeywordsToQuery is not implemented for Grafana traces client");
  }

  getSpanSearchQueryInstructions(): string {
    throw new Error("getSpanSearchQueryInstructions is not implemented for Grafana traces client");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSpansFacetValues(start: string, end: string): Promise<Map<string, string[]>> {
    throw new Error("getSpansFacetValues is not implemented for Grafana traces client");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fetchSpans(params: SpanSearchInput): Promise<SpansWithPagination> {
    throw new Error("fetchSpans is not implemented for Grafana traces client");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fetchTraces(params: TraceSearchInput): Promise<TracesWithPagination> {
    throw new Error("fetchTraces is not implemented for Grafana traces client");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchTraceById(params: {
    traceId: string;
    start?: string;
    end?: string;
  }): Promise<Trace | null> {
    throw new Error("fetchTraceById is not implemented for Grafana traces client");
  }
}
