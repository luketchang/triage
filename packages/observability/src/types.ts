export enum IntegrationType {
  DATADOG = "datadog",
  GRAFANA = "grafana",
}

export interface Log {
  timestamp: string;
  message: string;
  service: string;
  level: string;
  metadata: Record<string, string>;
}

export interface Span {
  spanId: string;
  traceId: string;
  service: string;
  operation: string;
  startTime: string | number;
  endTime: string | number;
  duration: number;
  status?: string;
  environment?: string;
  metadata: Record<string, string>;
}
