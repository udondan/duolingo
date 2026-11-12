# Development Plan: duolingo-mcp (feature/rewrite-api-typescript branch)

*Generated on 2026-04-04 by Vibe Feature MCP*
*Workflow: [sdd-greenfield](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/sdd-greenfield)*

## Goal

Rewrite the `duolingo-mcp` server from Python to TypeScript. The Python implementation
depends on the unmaintained `iSteve-O/Duolingo` library which has multiple bugs (e.g.
crashes when `points_ranking_data` is absent, broken leaderboard, etc.). The rewrite will:

1. Replace the Python/FastMCP stack with TypeScript + `@modelcontextprotocol/sdk`
2. Implement the Duolingo REST API client natively in TypeScript (no third-party Duolingo lib)
3. Preserve all 26 existing MCP tools with identical names and behavior
4. Fix all known bugs from the Python implementation
5. Add comprehensive unit tests with mocked HTTP responses
6. Maintain backward compatibility for Claude Desktop / Claude Code users

## Key Decisions

- **Language**: TypeScript (strict mode)
- **MCP Framework**: `@modelcontextprotocol/sdk` (official SDK)
- **HTTP Client**: `axios` — battle-tested, great TypeScript support, easy mocking in tests
- **Validation**: Zod schemas (replaces Pydantic)
- **Test Framework**: Vitest — fast, modern, native ESM, Jest-compatible API
- **Module Format**: ESM (ES modules)
- **Package Manager**: npm
- **Build**: `tsc` to `dist/`
- **Migration**: Replace Python entirely once TypeScript is complete and tested

## Notes

- The Python `duolingo.py` library wraps the unofficial Duolingo REST API at
  `https://www.duolingo.com/`. The TypeScript client will call these endpoints directly.
- Known bugs in the Python implementation that must be fixed:
  - `get_leaderboard` crashes when `points_ranking_data` is absent (worked around in client)
  - `get_friends` crashes on same condition (worked around in client)
  - `asyncio.get_event_loop()` is deprecated in Python 3.10+ (not our problem after rewrite)
  - The `_as_user` context manager is not thread-safe (not our problem after rewrite)
- The `duolingo_set_username` tool is mentioned in README but not implemented in the tools
  directory — needs investigation.

## Constitution
### Tasks
- [x] Update constitution.md for TypeScript rewrite
- [x] Document goal and key decisions in plan file

### Completed
- [x] Created development plan file
- [x] Updated constitution.md for TypeScript rewrite
- [x] Documented goal and key decisions

## Specify
### Tasks
- [x] Document all 26 MCP tools with API endpoints and behavior
- [x] Document all Duolingo REST API endpoints
- [x] Document known bugs to fix
- [x] Define project structure
- [x] Define non-functional requirements and success criteria

### Completed
- [x] Created spec.md at `.vibe/specs/feature/rewrite-api-typescript/spec.md`

## Plan
### Tasks
- [x] Define technology stack (TypeScript, axios, Vitest, Zod, ESM)
- [x] Design architecture (DuolingoClient singleton, tool modules, MCP server)
- [x] Define 11 implementation phases
- [x] Create file checklist (15 new files, 2 updates, 12 deletions)
- [x] Verify constitutional compliance

### Completed
- [x] Created plan.md at `.vibe/specs/feature/rewrite-api-typescript/plan.md`

## Tasks
### Tasks
- [ ] *To be added when this phase becomes active*

### Completed
*None yet*

## Implement
### Tasks
- [x] Phase 1: Project scaffolding (package.json, tsconfig.json, vitest.config.ts)
- [x] Phase 2: Type definitions (src/client/types.ts)
- [x] Phase 3: Error classes (src/client/errors.ts)
- [x] Phase 4: API client (src/client/duolingo.ts)
- [x] Phase 5: Tool helpers (src/tools/helpers.ts)
- [x] Phase 6: Account tools (src/tools/account.ts) — 8 tools
- [x] Phase 7: Language tools (src/tools/language.ts) — 13 tools
- [x] Phase 8: Shop/utility tools (src/tools/shop.ts) — 5 tools + duolingo_set_username
- [x] Phase 9: Server entry point (src/server.ts)
- [x] Phase 10: Tests — 87 tests, all passing
- [x] Phase 11: Cleanup — Python files removed, README updated, .gitignore updated

### Completed
- [x] All 25 MCP tools implemented in TypeScript
- [x] All known Python bugs fixed
- [x] Read-only tools only — write/action tools removed (set_username, buy_item, etc.)
- [x] 87 unit tests passing (0 failures)
- [x] TypeScript strict mode, clean build
- [x] Python files completely removed

## Document
### Tasks
- [x] README.md updated for TypeScript setup
- [x] Architecture section added to README
- [x] Integration tests added that fire against live Duolingo API

### Completed
- [x] README fully updated with TypeScript instructions, architecture, and tool table
- [x] 29 integration tests added in `tests/integration/live.test.ts`
- [x] Integration tests document all known API regressions:
  - `num_followers`, `num_following`, `contribution_points`, `is_follower_by`, `is_following`, `invites_left` missing from API
  - `points_ranking_data` missing → `get_friends` and `get_leaderboard` return empty results
  - `points_rank` missing from `language_data`
  - `created` field returns human-readable text instead of ISO date
  - `/vocabulary/overview` returns HTML instead of JSON (broken endpoint)
  - `d2.duolingo.com` is unreachable (DNS failure) → translations broken
  - `duo.tts_multi_voices` no longer in homepage HTML → TTS voice discovery broken

### Key Decisions
- Integration tests use `it.skipIf` pattern to skip gracefully when credentials are absent
- All 120 tests pass (89 unit + 31 integration)

### API Fixes Applied
- `get_user_info`: `num_followers`/`num_following` now read from `tracking_properties`; `created` replaced by `creation_date` (ISO string)
- `get_settings`: `is_follower_by`/`is_following` included only when present in API response
- `get_language_voices`: Replaced `duo.tts_multi_voices` homepage scraping with session API voice discovery (GLOBAL_PRACTICE session → extract voice names from TTS CDN URLs)
- `get_audio_url`: Replaced broken voice URL dictionary with direct `buildAudioUrl` using `tts_base_url` from user data; URL format: `{ttsBaseUrl}tts/{lang}/{voice}/token/{word}`
- `get_language_progress`: `points_rank` shown only when present in API response
- `getTranslations`: Now reads `dict_base_url` from user data (upgrades http→https automatically)
- `getSession`: SKILL_PRACTICE no longer supported; now delegates to GLOBAL_PRACTICE
- Types updated: all formerly-required fields that are now optional marked with `?`



---
*This plan is maintained by the LLM. Tool responses provide guidance on which section to focus on and what tasks to work on.*
