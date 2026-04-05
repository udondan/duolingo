# Implementation Plan: TypeScript Rewrite of duolingo-mcp

## Technology Stack (Final)

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript (strict) | Type safety, better DX, native async |
| MCP Framework | `@modelcontextprotocol/sdk` | Official SDK |
| HTTP Client | `axios` | Battle-tested, great TS support, easy mocking |
| Validation | `zod` | De-facto standard for TS runtime validation |
| Test Framework | `vitest` | Fast, ESM-native, Jest-compatible API |
| Module Format | ESM (`"type": "module"`) | Modern standard, required by MCP SDK |
| Node.js | >= 18 | LTS, native fetch available |
| Package Manager | npm | Standard |
| Build | `tsc` → `dist/` | Simple, no bundler needed for Node |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client (Claude)                   │
└──────────────────────────┬──────────────────────────────┘
                           │ stdio (MCP protocol)
┌──────────────────────────▼──────────────────────────────┐
│                    server.ts (MCP Server)                │
│  - Creates McpServer instance                           │
│  - Registers all tools from tools/ modules              │
│  - Runs on stdio transport                              │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  tools/       │  │  tools/       │  │  tools/       │
│  account.ts   │  │  language.ts  │  │  shop.ts      │
│  (8 tools)    │  │  (13 tools)   │  │  (5 tools)    │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        └──────────────────┼──────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                 client/duolingo.ts                       │
│  - DuolingoClient class (singleton)                     │
│  - All HTTP calls via axios                             │
│  - Caches user data per username                        │
│  - No shared mutable state (thread-safe)                │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────┐
│              Duolingo REST API                           │
│  duolingo.com, d2.duolingo.com                          │
└─────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Project Scaffolding

1. Create `package.json` with all dependencies
2. Create `tsconfig.json` (strict, ESM, target ES2022)
3. Create `vitest.config.ts`
4. Create directory structure: `src/client/`, `src/tools/`, `tests/client/`, `tests/tools/`
5. Create `.gitignore` entries for `dist/`, `node_modules/`
6. Run `npm install`

**Dependencies:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.7.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0",
    "axios-mock-adapter": "^2.0.0"
  }
}
```

### Phase 2: Type Definitions (`src/client/types.ts`)

Define TypeScript interfaces for all Duolingo API response shapes:
- `DuolingoUserData` — full `/users/<username>` response
- `DuolingoLanguage` — entry in `languages[]`
- `DuolingoLanguageData` — entry in `language_data[lang]`
- `DuolingoSkill` — entry in `language_data[lang].skills[]`
- `DuolingoFriend` — entry in `points_ranking_data[]`
- `DuolingoVocabOverview` — `/vocabulary/overview` response
- `DuolingoVocabWord` — entry in `vocab_overview[]`
- `DuolingoDailyProgress` — `/2017-06-30/users/<id>?fields=xpGoal,xpGains,streakData`
- `DuolingoLeaderboardData` — `/friendships/leaderboard_activity` response
- `DuolingoShopItemRequest` — POST body for shop items

### Phase 3: Error Classes (`src/client/errors.ts`)

```typescript
export class DuolingoClientError extends Error {}
export class DuolingoAuthError extends DuolingoClientError {}
export class DuolingoNotFoundError extends DuolingoClientError {}
export class DuolingoAlreadyHaveItemError extends DuolingoClientError {}
export class DuolingoInsufficientFundsError extends DuolingoClientError {}
export class DuolingoCaptchaError extends DuolingoClientError {}
```

### Phase 4: API Client (`src/client/duolingo.ts`)

`DuolingoClient` class with:
- Constructor takes `username: string`, `jwt: string`
- `axios` instance with base URL, auth header, user-agent
- Per-username user data cache (Map)
- Methods:
  - `getUserData(username?: string): Promise<DuolingoUserData>`
  - `getUserDataById(userId: number, fields: string[]): Promise<any>`
  - `switchLanguage(lang: string): Promise<void>`
  - `getVocabularyOverview(languageAbbr?: string): Promise<DuolingoVocabOverview>`
  - `getLeaderboard(unit: string, before: string): Promise<DuolingoLeaderboardData>`
  - `getTranslations(words: string[], source: string, target: string): Promise<Record<string, string[]>>`
  - `buyItem(userId: number, itemName: string, languageAbbr: string): Promise<void>`
  - `getHomepage(): Promise<string>`
  - `getSessions(skillId: string, langAbbr: string): Promise<any>`

**Key design decisions:**
- No shared mutable username state — pass username as parameter to each method
- Cache user data by username to avoid redundant API calls within a single tool invocation
- Cache homepage text for TTS voice discovery
- Cache voice URL dictionary per language

**Singleton factory:**
```typescript
let _client: DuolingoClient | null = null;
export function getClient(): DuolingoClient { ... }
export function resetClient(): void { _client = null; }
```

### Phase 5: Tool Helpers (`src/tools/helpers.ts`)

Shared utilities:
- `handleError(err: unknown): string` — converts errors to user-friendly strings
- `ResponseFormat` enum (markdown | json)
- `USERNAME_FIELD` Zod schema
- `computeDependencyOrder(skills: DuolingoSkill[]): DuolingoSkill[]` — topological sort

### Phase 6: Account Tools (`src/tools/account.ts`)

Implement all 8 account tools using `server.tool()` with Zod input schemas.

### Phase 7: Language Tools (`src/tools/language.ts`)

Implement all 13 language tools.

### Phase 8: Shop/Utility Tools (`src/tools/shop.ts`)

Implement all 5 shop/utility tools, including the missing `duolingo_set_username`.

### Phase 9: Server Entry Point (`src/server.ts`)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAccountTools } from './tools/account.js';
import { registerLanguageTools } from './tools/language.js';
import { registerShopTools } from './tools/shop.js';

const server = new McpServer({ name: 'duolingo_mcp', version: '1.0.0' });
registerAccountTools(server);
registerLanguageTools(server);
registerShopTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Phase 10: Tests

**Client tests** (`tests/client/duolingo.test.ts`):
- Mock axios with `axios-mock-adapter`
- Test each client method with fixture data
- Test error handling (404, 400, 403 captcha)
- Test cache behavior

**Tool tests** (`tests/tools/*.test.ts`):
- Mock the `DuolingoClient` methods
- Test markdown and JSON output formats
- Test error propagation
- Test edge cases (empty data, missing fields)

### Phase 11: Cleanup

1. Remove all Python files: `server.py`, `duolingo_client.py`, `tools/`, `pyproject.toml`,
   `uv.lock`, `.python-version`, `.venv/`
2. Update `README.md` for TypeScript setup
3. Update `package.json` scripts: `build`, `start`, `test`, `dev`

---

## File Checklist

### New files to create:
- [ ] `package.json`
- [ ] `tsconfig.json`
- [ ] `vitest.config.ts`
- [ ] `src/server.ts`
- [ ] `src/client/types.ts`
- [ ] `src/client/errors.ts`
- [ ] `src/client/duolingo.ts`
- [ ] `src/tools/helpers.ts`
- [ ] `src/tools/account.ts`
- [ ] `src/tools/language.ts`
- [ ] `src/tools/shop.ts`
- [ ] `tests/client/duolingo.test.ts`
- [ ] `tests/tools/account.test.ts`
- [ ] `tests/tools/language.test.ts`
- [ ] `tests/tools/shop.test.ts`

### Files to update:
- [ ] `README.md` — TypeScript instructions
- [ ] `.gitignore` — add `dist/`, `node_modules/`

### Files to delete:
- [ ] `server.py`
- [ ] `duolingo_client.py`
- [ ] `tools/__init__.py`
- [ ] `tools/account.py`
- [ ] `tools/language.py`
- [ ] `tools/shop.py`
- [ ] `pyproject.toml`
- [ ] `uv.lock`
- [ ] `.python-version`
- [ ] `.venv/` (directory)
- [ ] `__pycache__/` (directory)
- [ ] `.ruff_cache/` (directory)

---

## Constitutional Compliance

| Principle | Compliance |
|-----------|------------|
| Read-first design | ✅ All read tools marked readOnly, shop tools marked destructive |
| JWT-based auth | ✅ JWT via env var, no password storage |
| Async-first | ✅ All methods async/await with axios |
| MCP SDK | ✅ Using `@modelcontextprotocol/sdk` |
| stdio transport | ✅ `StdioServerTransport` |
| npm project management | ✅ `package.json` |
| Test coverage | ✅ Vitest tests for all client methods and tools |
| No third-party Duolingo library | ✅ Native TypeScript HTTP client |
| TypeScript strict mode | ✅ `"strict": true` in tsconfig |
| No secrets in repo | ✅ Env vars only |
