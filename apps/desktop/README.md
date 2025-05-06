# Triage Desktop

An Electron application with React and TypeScript

## Project Setup

### Install

```bash
$ pnpm install
```

### Development Mode

Run the app in development mode with hot reloading and developer tools:

```bash
$ pnpm dev
```

- Starts Electron with live reload for rapid development.
- Use this while coding and debugging.

### Preview/Production Mode

Run the app using the built files (no hot reload, simulates production):

```bash
$ pnpm start
```

- Starts Electron in preview mode, serving the built app.
- Useful for testing the production build before packaging.

### Build & Package

Build and package the app for your platform:

```bash
# For Windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

### Running the Packaged App

After building, find the packaged binary in the `dist/` directory:

- **macOS:** `dist/mac/Triage Desktop.app` (double-click or run with `open dist/mac/Triage\ Desktop.app`)
- **Windows:** `dist/win-unpacked/Triage Desktop.exe` (double-click or run from Command Prompt)
- **Linux:** `dist/linux-unpacked/triage-desktop` (run from Terminal)

---

- Use **`pnpm dev`** for development.
- Use **`pnpm start`** to preview the built app.
- Use **`pnpm build:<platform>`** and run the binary from `dist/` for the fully-packaged experience.
