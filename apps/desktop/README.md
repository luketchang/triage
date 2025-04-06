# Triage Desktop

A desktop application for the Triage system, built with Electron and React.

## Features

- Chat interface for interacting with the Triage agent
- Artifact display for logs and code snippets
- Split-pane UI with resizable panels

## Development

### Prerequisites

- Node.js v20.18.0+
- pnpm v9.0.0+

### Setup

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

### Build

```bash
# Build the application
pnpm build
```

### Linting

```bash
# Run linter
pnpm lint

# Type checking
pnpm check-types
```

## Architecture

The application consists of:

- **Electron Main Process**: Handles application lifecycle and native functionality
- **Preload Script**: Securely exposes APIs to the renderer process
- **Renderer Process**: React application for the UI

### UI Layout

- **Left Sidebar**: Chat interface for interacting with the Triage agent
- **Main Content**: Overview of available artifacts
- **Right Sidebar**: Detailed view of selected artifacts (logs or code)

## License

Internal use only.
