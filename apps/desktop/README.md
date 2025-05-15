# Triage Desktop

An Electron application with React and TypeScript

## Development Commands

- `pnpm install`: Install dependencies
- `pnpm dev`: Run the app in development mode with hot reloading and developer tools. Use while coding and debugging
- `pnpm start`: Run the app using the built files (no hot reload, simulates production). Use for testing the production build before packaging
- `pnpm build:<platform>`: Build the app for production. The binary will be packaged in the `dist/` directory:
  - **macOS:** `dist/mac/Triage Desktop.app` (double-click or run with `open dist/mac/Triage\ Desktop.app`)
  - **Windows:** `dist/win-unpacked/Triage Desktop.exe` (double-click or run from Command Prompt)
  - **Linux:** `dist/linux-unpacked/triage-desktop` (run from Terminal)

## Database Migrations

The application uses SQLite with Drizzle ORM for data persistence. Database schema is defined in `electron/db/schema.ts`.

- **Automatic migrations**: The application will automatically apply any generated migrations when it starts up. This is how users will receive the latest schema when there is an update.

- **Generate migrations**: After changing the schema, generate migration files:

  ```bash
  pnpm db:generate
  ```

  This creates SQL migration files in the `drizzle` directory.

- **Apply manual migrations**: Run migrations to update the database schema:

  ```bash
  pnpm db:migrate
  ```

  This uses `ts-node` to execute the migration script directly from TypeScript.

- **Migration workflow**:
  1. Modify the schema in `electron/db/schema.ts`
  2. Run `pnpm db:generate` to create migration files
  3. Review the generated SQL in `drizzle/` directory
  4. Run `pnpm db:migrate` to apply changes
  5. Restart the application to use the updated schema

The database file is stored in `db/triage-chats.db` relative to the application working directory.

## Using Packaged Binary

To build and run the packaged binary, run the following command in `apps/desktop` (for MacOS):

```bash
pnpm build:mac
```

This will create a macOS app bundle in `dist/mac-arm64/triage.app` directory. It will also create a DMG file at `dist/triage-<version>.dmg`.

You can run the packaged application by running `open dist/mac-arm64/triage.app` or by running `open dist/triage-<version>.dmg` then double-clicking the app icon.
