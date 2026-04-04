# Development Plan: duolingo-mcp (feature/python-duolingo-mcp branch)

*Generated on 2026-04-04 by Vibe Feature MCP*
*Workflow: [sdd-greenfield](https://mrsimpson.github.io/responsible-vibe-mcp/workflows/sdd-greenfield)*

## Goal
Build a Python-based MCP server (`duolingo_mcp`) that wraps the unofficial Duolingo API
(iSteve-O/Duolingo) to expose Duolingo learning data and actions to LLM agents via
standardized MCP tools using FastMCP + stdio transport.

## Key Decisions
- Use FastMCP (Python MCP SDK) with stdio transport for local Claude Desktop/Code integration
- Use `uv` for project/dependency management
- Vendor the upstream `duolingo.py` directly (install via git URL as dependency)
- Authentication via environment variables: `DUOLINGO_USERNAME`, `DUOLINGO_JWT`
- Use async httpx internally; wrap synchronous duolingo.py calls in thread executor
- Server name: `duolingo_mcp`

## Notes
- The upstream duolingo.py uses synchronous `requests` library; we wrap calls with
  `asyncio.get_event_loop().run_in_executor(None, ...)` to keep the MCP server async
- JWT token must be extracted manually from browser developer console
- The library supports: user info, settings, languages, friends, calendar, streak,
  leaderboard, daily XP, vocabulary, topics, translations, audio URLs, and shop items

## Constitution
### Tasks
- [x] Research Duolingo API capabilities
- [x] Research Python MCP SDK (FastMCP)
- [x] Write constitution.md
- [x] Update development plan

### Completed
- [x] Created development plan file
- [x] Created constitution.md

## Specify
### Tasks
- [ ] *To be added when this phase becomes active*

### Completed
*None yet*

## Plan
### Tasks
- [ ] *To be added when this phase becomes active*

### Completed
*None yet*

## Tasks
### Tasks
- [T001] [P] Initialize uv project with pyproject.toml
- [T002] [P] Create server.py with FastMCP initialization and env var loading
- [T003] Create duolingo_client.py async wrapper (run_in_executor pattern)
- [T004] Create tools/__init__.py
- [T005] [P] Implement tools/account.py (8 account tools)
- [T006] [P] Implement tools/language.py (13 language tools)
- [T007] [P] Implement tools/shop.py (5 shop/utility tools)
- [T008] Write README.md with setup instructions

### Completed
*None yet*

## Implement
### Tasks
*All tasks complete*

### Completed
- [x] T001: Initialize uv project with pyproject.toml
- [x] T002: Create server.py with FastMCP initialization and env var loading
- [x] T003: Create duolingo_client.py async wrapper (run_in_executor pattern)
- [x] T004: Create tools/__init__.py
- [x] T005: Implement tools/account.py (8 account tools)
- [x] T006: Implement tools/language.py (13 language tools)
- [x] T007: Implement tools/shop.py (5 shop/utility tools)
- [x] T008: Write README.md with setup instructions

## Document
### Tasks
- [ ] *To be added when this phase becomes active*

### Completed
*None yet*



---
*This plan is maintained by the LLM. Tool responses provide guidance on which section to focus on and what tasks to work on.*
