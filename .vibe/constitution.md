# Project Constitution: duolingo-mcp

## Project Overview

A TypeScript-based MCP (Model Context Protocol) server that directly calls the unofficial
Duolingo REST API to expose Duolingo learning data and actions to LLM agents via standardized
MCP tools. This is a full rewrite of the original Python implementation, replacing the buggy
and unmaintained `iSteve-O/Duolingo` Python library with a native TypeScript HTTP client.

## Core Principles

1. **Read-first design**: Prioritize read-only data access tools; write/purchase actions are
   secondary and must be clearly marked as destructive.
2. **JWT-based auth**: Authentication uses a JWT token extracted from the browser — no
   password storage. Credentials are passed via environment variables.
3. **Async-first**: All I/O operations use native async/await with `fetch` or `axios`/`got`.
   No synchronous blocking calls.
4. **MCP SDK**: Use the official `@modelcontextprotocol/sdk` with Zod schemas for input
   validation and structured output.
5. **stdio transport**: This is a local tool; use stdio transport for Claude Desktop /
   Claude Code integration.
6. **npm/Node.js project management**: Use `npm` (or `pnpm`) for dependency management.
7. **Test coverage**: All API client methods and tool handlers must have unit tests using
   mocked HTTP responses. Integration tests are optional.
8. **No third-party Duolingo library**: Implement the Duolingo API client from scratch in
   TypeScript, calling the REST endpoints directly with proper typing.

## Quality Gates

- All tools must have comprehensive JSDoc with input/output schemas.
- All tools must use Zod schemas for input validation.
- All tools must have correct `readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint` annotations.
- Error messages must be actionable and guide the user toward resolution.
- The server must run successfully with `npm start` or `node dist/server.js`.
- No secrets (JWT tokens) committed to the repository.
- All tests must pass (`npm test`).
- TypeScript strict mode enabled.

## Governance

- Tool names follow the pattern `duolingo_<action>_<resource>` (camelCase internally,
  snake_case for MCP tool names to maintain backward compatibility).
- Server name: `duolingo_mcp`.
- Environment variables: `DUOLINGO_USERNAME`, `DUOLINGO_JWT`.
- The Duolingo API client is implemented natively — no upstream Python library dependency.
