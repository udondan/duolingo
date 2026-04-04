# Project Constitution: duolingo-mcp

## Project Overview

A Python-based MCP (Model Context Protocol) server that wraps the unofficial Duolingo API
(iSteve-O/Duolingo fork of KartikTalwar/Duolingo) to expose Duolingo learning data and
actions to LLM agents via standardized MCP tools.

## Core Principles

1. **Read-first design**: Prioritize read-only data access tools; write/purchase actions are
   secondary and must be clearly marked as destructive.
2. **JWT-based auth**: Authentication uses a JWT token extracted from the browser — no
   password storage. Credentials are passed via environment variables.
3. **Async-first**: All I/O operations use async/await with httpx (not the synchronous
   `requests` library used by the upstream duolingo.py).
4. **FastMCP framework**: Use `mcp.server.fastmcp.FastMCP` with Pydantic v2 models for
   input validation and structured output.
5. **stdio transport**: This is a local tool; use stdio transport (default) for Claude
   Desktop / Claude Code integration.
6. **uv project management**: Use `uv` for dependency management and packaging.

## Quality Gates

- All tools must have comprehensive docstrings with input/output schemas.
- All tools must use Pydantic `BaseModel` for input validation.
- All tools must have correct `readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint` annotations.
- Error messages must be actionable and guide the user toward resolution.
- The server must run successfully with `uv run python server.py`.
- No secrets (JWT tokens) committed to the repository.

## Governance

- Tool names follow the pattern `duolingo_<action>_<resource>` (snake_case).
- Server name: `duolingo_mcp`.
- Environment variables: `DUOLINGO_USERNAME`, `DUOLINGO_JWT`.
- The upstream `duolingo.py` library is vendored or installed as a git dependency.
