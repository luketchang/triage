# Triage

Triage is AI developer tool for investigating production issues. It searches and reasons through your telemetry data and code, analyzing root cause and surfacing relevant evidence.

## Demo

![Demo](./demo.gif)

## System Architecture

The system consists of two main components:

### Agent (`packages/agent`)

The core AI agent that can iteratively search through logs and code, connecting to data sources such as Sentry, Datadog, and your codebase to analyze production issues.

### Desktop App (`apps/desktop`)

An Electron-based desktop application with a chat interface that lets you paste context from Sentry or Datadog to start an investigation. It invokes the agent and streams back intermediate results.

## Shared Packages

- **`@triage/common`**: Shared utilities, logging, and core functionality
- **`@triage/data-integrations`**: Connectors for observability platforms (Datadog, Grafana, Sentry)
- **`@triage/config`**: Configuration management and validation schemas
- **`@triage/codebase-overviews`**: Tools for generating and managing codebase summaries

## Getting Started

Install dependencies:

```sh
pnpm install
```

Build packages and apps:

```sh
pnpm build
```

Run lint:

```sh
pnpm lint
```

Run the desktop app in development:

```sh
pnpm --filter triage-desktop dev
```
