## Build and Test Commands

- Root: `pnpm build`, `pnpm lint:fix`,
- Desktop: `pnpm build`, `pnpm lint:fix`, `pnpm start`
- Single component test: Not configured yet (add when tests are implemented)

## Code Style Guidelines

- **TypeScript**: Strict typing required, use explicit return types
- **Imports**: Group and sort imports (external libs first, then internal)
- **Formatting**: Follows Prettier config (`.prettierrc` in root): double quotes, semicolons, trailing commas (es5), 100 chars line length, 2 spaces indentation
- **Naming**: camelCase for variables/functions, PascalCase for classes/components/types
- **Error Handling**: Use proper try/catch and typed Error objects
- **Architecture**: Follow modular design in monorepo structure
- **Components**: Use functional components with proper prop typing
- **Logging**: For print statements to test code, use console.info (do not use console.log). For actual logging, use logger.info, logger.warn, logger.error (`import { logger } from '@triage/common'`)
- **Scripts**: Parse any command line arguments with commander
- **Making Code Changes**: Do not perform "drive-by" changes of things you notice that are unrelated to the task/question you were asked.
- **Global variables**: Prefer using variableas from closures over defining new singletons

# Cursor Best Practices

This file outlines best practices for using Cursor effectively to ensure smooth and manageable project development.

## Planning Before Coding

- Use Claude to create a detailed plan in Markdown:
  - Ask it to clarify questions and critique its own plan before regenerating.
  - Add the plan to `instructions.md` to refer to frequently.
  - Example:
    - Ask ChatGPT what you want to create → Have it provide instructions for another AI agent → Paste everything into the Cursor Composer Agent.
    - This adds an additional planning layer, reducing issues.
- On one project, starting over and clearly instructing ChatGPT to generate coding steps solved looping issues.

## .cursorrules File

- Always use `.cursorrules` to define broad AI behavior rules.
- Example rule: Write tests first, then code, then run tests, and iterate until tests pass.
- Reference: [cursor.directory](https://cursor.directory/)

## Incremental Coding with Edit-Test Loops

1. Define a small task or feature increment.
2. Write (or instruct the AI to write) a test that initially fails.
3. Use the Agent to write code to pass the test.
4. Run the test.
5. If the test fails, let the AI debug and try again.
6. Once the test passes, review and commit the changes.

## Prompting Tips

- Encourage chain-of-thought in prompts.
- Ask Cursor to write a report listing all files and their purposes when facing issues.
- Consult Claude or ChatGPT for problem solving.

## Tooling Tips

- Use [gitingest.com](https://gitingest.com) to load all config and relevant files as one page (AI-readable).
- Use [context7.com](https://context7.com) for the latest docs.
- Use Git frequently; avoid too many uncommitted changes.
- Keep context sharp by explicitly adding files via `@`.
  - Start a new chat when the context gets too long.

## Indexing & References

- Re-sync/index code regularly:
  - Use `.cursorignore` to filter irrelevant files.
- Use `/Reference` to open editors and add them quickly to context.

## Miscellaneous Tips

- Notepads are useful for short prompts and notes.
- Optional: Enable YOLO mode to let AI auto-generate tests.
  - Supports `vitest`, `npm test`, `npx test`, etc.
  - AI can also execute commands like `build`, `tsc`, `create`, `touch`, `mkdir`, etc.

## System Prompts (`Rules for AI`)

- Keep answers concise and direct.
- Suggest alternative solutions.
- Prioritize technical explanations.
- Avoid unnecessary general advice.
