# Agent Guidelines — duolingo

TypeScript MCP server that wraps the unofficial Duolingo REST API. Uses the
MCP SDK with stdio transport, Zod for input validation, and Axios for HTTP.

---

## Project Overview

- **Entry points:** `src/server.ts` (MCP binary), `src/index.ts` (library)
- **Auth:** `DUOLINGO_USERNAME` + `DUOLINGO_JWT` environment variables
- **Design:** Read-first; all tools are read-only (no writes to Duolingo)
- **Tool naming:** `duolingo_<action>_<resource>` pattern (snake_case)
- **Server name:** `duolingo_mcp`

---

## Build, Lint & Test Commands

This project uses **mise** (`mise.toml`) to manage tasks and the Node.js
toolchain. Always prefer `mise run <task>` over invoking npm scripts directly.
Mise tasks handle dependencies automatically (e.g. `build` runs `install` first).

```bash
# Install dependencies
mise run install

# Build (compiles src/ → dist/)
mise run build

# Type-check without emitting
mise run typecheck

# Lint
mise run lint
mise run "lint:fix"

# Format
mise run format        # write changes
mise run "format:check"  # check only

# Tests (Vitest)
mise run test                # run all tests once
mise run "test:watch"        # watch mode
mise run "test:coverage"     # with v8 coverage

# Run a single test file (invoke vitest directly)
npx vitest run tests/tools/account.test.ts

# Run tests matching a name pattern
npx vitest run -t "getUserData"

# Run all quality checks at once (typecheck + lint + format:check + test)
mise run check

# Full CI pipeline (install → build → check)
mise run ci

# Start MCP server in dev mode (no build required)
mise run dev

# Inspect MCP tools via CLI or browser UI (reads credentials from .env)
mise run inspect
mise run "inspect:ui"
```

Test files live under `tests/` and mirror `src/` layout. The framework is
**Vitest** (`vitest.config.ts`); globals (`describe`, `it`, `expect`, `vi`)
are enabled automatically — no explicit imports needed.

---

## TypeScript Configuration

- **Target:** ES2022, **module:** ESNext, **moduleResolution:** bundler
- **Strict mode:** fully enabled, including:
  - `noUncheckedIndexedAccess` — array/object accesses may return `undefined`
  - `noImplicitOverride` — `override` keyword required when overriding
- **ESM:** the package uses `"type": "module"`; all internal imports must use
  `.js` extensions (e.g., `import { foo } from './bar.js'`)
- `src/` is compiled; `tests/` is excluded from compilation but included in
  `tsconfig.lint.json` for linting

---

## Code Style

Enforced by Prettier + ESLint. Run `mise run "lint:fix" && mise run format` to
auto-fix most issues.

### Formatting (Prettier)

- Single quotes, semicolons, trailing commas everywhere
- 2-space indent, 80-column print width, LF line endings, no tabs
- `arrowParens: 'always'`, `bracketSpacing: true`

### Imports

- Use `import type { ... }` or inline `type` keyword for type-only imports
  (`consistent-type-imports` rule, `fixStyle: inline-type-imports`)
- Import paths must end with `.js` (ESM resolution)
- Group: external packages first, then internal modules

### Naming

- **MCP tools:** `duolingo_<verb>_<noun>` snake_case (e.g., `duolingo_get_user_info`)
- **Classes:** PascalCase (e.g., `DuolingoClient`, `DuolingoAuthError`)
- **Functions/variables:** camelCase
- **Unused parameters/variables:** prefix with `_` to suppress the lint rule

### Types

- `no-explicit-any` is an error in `src/`; use proper types or generics
- All `no-unsafe-*` rules (`assignment`, `call`, `member-access`, etc.) are
  errors — avoid unsafe casts and untyped boundaries
- Prefer `nullish coalescing` (`??`) and optional chaining (`?.`) over
  explicit null checks (`prefer-nullish-coalescing`, `prefer-optional-chain`)
- `switch` statements on union types must be exhaustive
  (`switch-exhaustiveness-check`)
- Template literals must not embed `any` or nullish values
  (`restrict-template-expressions` — numbers and booleans are allowed)

### Error Handling

Custom error hierarchy (all in `src/client/errors.ts`):

```
DuolingoClientError (base)
  ├── DuolingoAuthError
  ├── DuolingoNotFoundError
  ├── DuolingoCaptchaError
  └── DuolingoLanguageNotFoundError
```

- Each subclass sets `this.name` explicitly for reliable `instanceof` checks
- MCP tool handlers always wrap logic in `try/catch` and return errors as
  `{ content: [{ type: 'text', text: handleError(err) }] }` — never throw
  out of a tool handler
- `handleError(err: unknown)` in `src/tools/helpers.ts` type-narrows to each
  custom error and returns a user-facing `"Error: ..."` string

### Async

- All Duolingo API calls are async; floating promises are an error
  (`no-floating-promises`)
- Functions must not declare `async` unless they actually `await` something
  (`require-await`)

---

## MCP Tool Structure

Each tool is registered via `server.registerTool(name, config, handler)`:

```ts
server.registerTool(
  'duolingo_get_foo',
  {
    title: 'Get Foo',
    description: 'Returns the foo for the given user.',
    inputSchema: {
      username: UsernameFieldSchema,
      response_format: ResponseFormatSchema,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ username, response_format }) => {
    try {
      const client = getClient();
      const data = await client.getFoo(username);
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }
      return { content: [{ type: 'text', text: formatMarkdown(data) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: handleError(err) }] };
    }
  },
);
```

**Required for every tool:**

- JSDoc comment on the tool registration (description field)
- Zod input validation via `inputSchema`
- All four MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`)
- `try/catch` with `handleError` in the handler

**Required for tools that return structured data:**

- Dual `response_format` support: `'markdown'` (default) and `'json'`
- Use `ResponseFormatSchema` in `inputSchema`

Simple scalar tools that return a plain string (e.g. `duolingo_get_language_from_abbr`,
`duolingo_get_abbreviation_of`, `duolingo_get_audio_url`) do not need `response_format`.

Shared schemas (`src/tools/helpers.ts`):

- `ResponseFormatSchema` — `z.enum(['markdown', 'json']).default('markdown')`
- `UsernameFieldSchema` — `z.string().optional()`

---

## Testing Conventions

- **Framework:** Vitest with node environment; globals enabled
- **Mocking:** use `vi.spyOn` to mock `getClient()` in tool tests; inject a
  mock `http` object directly into `DuolingoClient`'s private field for
  client unit tests
- **Tool tests:** call tools via the shared `callTool(server, name, args)`
  helper in `tests/helpers.ts`
- **MCP protocol tests:** `tests/server/mcp.test.ts` spins up a real
  `McpServer` with `InMemoryTransport` — add new tools to the expected list
- **Package surface tests:** `tests/package/exports.test.ts` imports only from
  `src/index.ts`; add new public exports there
- **Integration tests:** `tests/integration/` hit the live Duolingo API and
  require env vars — do not run these in CI without credentials

---

## Quality Gates

Before merging, all of the following must pass (`mise run check` runs them all):

```bash
mise run typecheck
mise run lint
mise run "format:check"
mise run test
```

CI runs these automatically via `.github/workflows/ci.yml`.
