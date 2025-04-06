# Triage Desktop

A desktop application for the Triage platform, built with Electron, React, and TypeScript.

## Project Structure

The project is organized with a clear separation of concerns:

```
apps/desktop/
├── electron/         # Electron main process code (TypeScript)
│   └── main.ts       # Main process entry point
├── preload/          # Preload scripts for Electron (TypeScript)
│   └── index.ts      # Preload script that exposes a safe API to the renderer
├── src/              # Application source code
│   ├── config.ts     # Centralized configuration with environment loading
│   └── renderer/     # React application for the renderer process
│       ├── App.tsx   # Main React component
│       ├── electron.d.ts  # TypeScript definitions for Electron API
│       ├── main.tsx  # React entry point
│       └── styles.css # Application styles
├── dist/             # Build output for the renderer process
├── dist-electron/    # Build output for the Electron processes
├── index.html        # HTML entry point
├── tsconfig.json     # Base TypeScript configuration
├── tsconfig.electron.json # TypeScript config for Electron main process
├── tsconfig.preload.json  # TypeScript config for preload scripts
└── vite.config.ts    # Vite configuration
```

## Development

### Environment Setup

1. Create a `.env` file in the project root with the necessary environment variables:

```env
# Required API keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional configuration
REPO_PATH=/path/to/your/repo
CODEBASE_OVERVIEW_PATH=/path/to/overview.md
OBSERVABILITY_PLATFORM=datadog
```

### Development Commands

- `pnpm start`: Start the development environment
- `pnpm build`: Build the application for production
- `pnpm lint`: Lint the codebase
- `pnpm check-types`: Check TypeScript types

## Building for Production

Run `pnpm build:prod` to build the application for production. The output will be in the `dist` directory.

## Architecture

The application follows the Electron architecture with three main processes:

1. **Main Process** (Electron): Handles the application lifecycle and creates windows
2. **Renderer Process** (React): Renders the UI and handles user interactions
3. **Preload Scripts**: Provide a secure bridge between the main and renderer processes

All code is written in TypeScript for improved type safety and developer experience.

## License

Internal use only.
