# Triage Desktop Application

A desktop application built with Electron and React that provides a GUI for invoking the Triage Agent.

## Features

- Simple, intuitive interface for specifying repository path and issue description
- Invokes the Triage Agent to analyze and diagnose issues
- Displays agent chat history and root cause analysis
- Real-time status updates during processing

## Development

### Prerequisites

- Node.js (v20.18.0 or higher)
- PNPM package manager

### First-time Setup

The desktop app is part of the Triage monorepo. Follow these steps to set it up:

```bash
# From the root of the monorepo
pnpm install

# Install dependencies specifically for the desktop app
cd apps/desktop
pnpm install
```

### Running in Development Mode

From the root directory:

```bash
# Start the desktop app in development mode
pnpm desktop:dev
```

Or from the desktop app directory:

```bash
cd apps/desktop
pnpm dev
```

This will:

1. Compile TypeScript files
2. Start Vite dev server for React
3. Launch Electron pointing to the dev server

### Building for Production

From the root directory:

```bash
pnpm desktop:build
```

Or from the desktop app directory:

```bash
cd apps/desktop
pnpm build
```

## Troubleshooting

### TypeScript/React Errors

If you encounter TypeScript errors related to React:

1. Make sure all dependencies are installed:

   ```bash
   cd apps/desktop
   pnpm install
   ```

2. If the error persists, you may need to restart the TypeScript server in your IDE.

3. For "Cannot find module 'react'" errors, try running:
   ```bash
   pnpm add -D @types/react @types/react-dom
   ```

### Electron Connection Issues

If Electron can't connect to the Vite dev server:

1. Make sure Vite is running on port 3000
2. Check if there are any firewall or security settings blocking the connection
3. Try running the dev script again with explicit NODE_ENV setting:
   ```bash
   cross-env NODE_ENV=development pnpm dev
   ```

## Architecture

- **Main Process**: Handles Electron initialization and IPC communication with the agent
- **Renderer Process**: React application for the user interface
- **Preload Script**: Securely exposes IPC methods to the renderer

## Dependencies

- Electron: Desktop application framework
- React: UI library
- Vite: Build tool and development server
- TypeScript: Type safety
