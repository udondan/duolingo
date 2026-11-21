# Implementation Plan: duolingo-mcp

## Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | Python 3.11+ | Required by duolingo.py; FastMCP is Python-native |
| MCP Framework | FastMCP (mcp[cli]) | Official Python MCP SDK, decorator-based, Pydantic v2 |
| Transport | stdio | Local tool for Claude Desktop / Claude Code |
| HTTP Client | httpx (async) | Async-native; wraps sync duolingo.py calls in executor |
| Input Validation | Pydantic v2 BaseModel | Required by FastMCP best practices |
| Dependency Mgmt | uv | Fast, modern Python package manager |
| Duolingo Library | iSteve-O/Duolingo (git dep) | Upstream unofficial API wrapper |

## Project Structure

```
duolingo-mcp/
├── pyproject.toml          # uv project config, dependencies
├── README.md               # Setup & usage instructions
├── server.py               # Main MCP server entry point
├── duolingo_client.py      # Async wrapper around duolingo.py
└── tools/
    ├── __init__.py
    ├── account.py          # User info, settings, streak, XP, friends, calendar, leaderboard
    ├── language.py         # Language details, progress, topics, words, vocabulary, translations
    └── shop.py             # Buy item, buy streak freeze
```

## Architecture

```
Claude (MCP Client)
    │  stdio
    ▼
server.py (FastMCP)
    │
    ├── tools/account.py   ──┐
    ├── tools/language.py  ──┤──► duolingo_client.py (async wrapper)
    └── tools/shop.py      ──┘         │
                                       ▼
                               duolingo.Duolingo (sync)
                               run_in_executor(thread pool)
                                       │
                                       ▼
                               Duolingo REST API
```

## Implementation Phases

### Phase 1: Project Scaffold
- Initialize uv project with `pyproject.toml`
- Add dependencies: `mcp[cli]`, `duolingo-api` (git), `httpx`
- Create `server.py` with FastMCP initialization
- Create `duolingo_client.py` with async wrapper

### Phase 2: Account Tools (8 tools)
- `duolingo_get_user_info`
- `duolingo_get_settings`
- `duolingo_get_streak_info`
- `duolingo_get_daily_xp_progress`
- `duolingo_get_languages`
- `duolingo_get_friends`
- `duolingo_get_calendar`
- `duolingo_get_leaderboard`

### Phase 3: Language Tools (13 tools)
- `duolingo_get_language_details`
- `duolingo_get_language_progress`
- `duolingo_get_known_topics`
- `duolingo_get_unknown_topics`
- `duolingo_get_golden_topics`
- `duolingo_get_reviewable_topics`
- `duolingo_get_known_words`
- `duolingo_get_learned_skills`
- `duolingo_get_vocabulary`
- `duolingo_get_related_words`
- `duolingo_get_translations`
- `duolingo_get_language_voices`
- `duolingo_get_audio_url`

### Phase 4: Utility & Shop Tools (5 tools)
- `duolingo_get_language_from_abbr`
- `duolingo_get_abbreviation_of`
- `duolingo_set_username`
- `duolingo_buy_item`
- `duolingo_buy_streak_freeze`

### Phase 5: Documentation
- Write `README.md` with JWT extraction instructions, env var setup, Claude config

## Constitutional Compliance

| Principle | Compliance |
|---|---|
| Read-first design | ✅ 21 read-only tools, 5 write/utility tools |
| JWT-based auth | ✅ Env vars only, no password storage |
| Async-first | ✅ All tools async; sync duolingo.py wrapped in executor |
| FastMCP framework | ✅ Using FastMCP with Pydantic v2 |
| stdio transport | ✅ Default FastMCP transport |
| uv project mgmt | ✅ pyproject.toml with uv |
