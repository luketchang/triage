## Build and Test Commands

- Root: `pnpm build`, `pnpm lint`, `pnpm dev`, `pnpm format`
- API: `cd apps/api && pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm check-types`
- Web: `cd apps/web && pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm check-types`
- Single component test: Not configured yet (add when tests are implemented)

## Code Style Guidelines

- **TypeScript**: Strict typing required, use explicit return types
- **Imports**: Group and sort imports (external libs first, then internal)
- **Formatting**: Follows Prettier config (`.prettierrc` in root): double quotes, semicolons, trailing commas (es5), 100 chars line length, 2 spaces indentation
- **Naming**: camelCase for variables/functions, PascalCase for classes/components/types
- **Error Handling**: Use proper try/catch and typed Error objects
- **Architecture**: Follow modular design in monorepo structure
- **Linting**: Zero warnings policy (`--max-warnings 0`)
- **Components**: Use functional components with proper prop typing
- **Logging**: For print statements to test code, use console.info. For actual logging, use logger.info, logger.warn, logger.error (`import logger from 'utils/logger.ts'`)
- **Scripts**: Parse any command line arguments with commander
- **Making Code Changes**: Do not perform "drive-by" changes of things you notice that are unrelated to the task/question you were asked.
