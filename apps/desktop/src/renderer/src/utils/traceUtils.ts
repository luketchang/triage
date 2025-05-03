import { Span, SpanError, UISpan } from "../types";

/**
 * Convert a standard Span to a UISpan for display in components
 */
export function spanToUISpan(span: Span): UISpan {
  return {
    id: span.spanId,
    service: span.service,
    operation: span.operation,
    resource: span.metadata?.resource || "",
    start:
      typeof span.startTime === "string" ? span.startTime : new Date(span.startTime).toISOString(),
    end: typeof span.endTime === "string" ? span.endTime : new Date(span.endTime).toISOString(),
    duration: span.duration,
    tags: span.metadata || {},
    // If there are any error details in the metadata, convert them to a SpanError
    error: span.metadata?.error
      ? {
          message: span.metadata.error,
          type: span.metadata.error_type || "Unknown Error",
          stack: span.metadata.stack_trace,
        }
      : undefined,
  };
}

/**
 * Convert a standard Span to a UISpan for use in TracesView
 * and recursively convert any children spans
 */
export function convertSpanHierarchy(span: any): UISpan {
  // Convert the current span
  const uiSpan: UISpan = {
    id: span.id || span.spanId,
    service: span.service,
    operation: span.operation,
    resource: span.resource || span.metadata?.resource || "",
    start: span.start || span.startTime,
    end: span.end || span.endTime,
    duration: span.duration,
    tags: span.tags || span.metadata || {},
    error: span.error as SpanError | undefined,
  };

  // Recursively convert children if they exist
  if (Array.isArray(span.children) && span.children.length > 0) {
    uiSpan.children = span.children.map((child: any) => convertSpanHierarchy(child));
  }

  return uiSpan;
}
