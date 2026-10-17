# Feature Specification: duolingo-mcp

## Overview

A Python-based MCP server that exposes Duolingo learning data and actions to LLM agents
(e.g., Claude) via standardized MCP tools. Users authenticate with their Duolingo JWT token
and can query their learning progress, vocabulary, streaks, friends, and more.

## Actors

- **LLM Agent** (Claude): The primary consumer of the MCP tools.
- **Duolingo User**: The human who configures credentials and benefits from the integration.

## Functional Requirements

### Authentication
- The server authenticates to Duolingo using a username and JWT token provided via
  environment variables (`DUOLINGO_USERNAME`, `DUOLINGO_JWT`).
- If credentials are missing or invalid, tools return a clear error message.

### Account Information Tools (read-only)
1. **Get User Info** — Returns profile data: username, full name, bio, location, avatar,
   follower/following counts, UI language, learning language, cohort, admin status.
2. **Get Settings** — Returns notification and follow settings.
3. **Get Streak Info** — Returns current streak, daily goal, and whether streak was
   extended today.
4. **Get Daily XP Progress** — Returns XP goal, XP earned today, and lessons completed today.
5. **Get Languages** — Returns list of languages the user is learning (full names or
   abbreviations).
6. **Get Friends** — Returns friends list with their points and languages.
7. **Get Calendar** — Returns the user's recent activity calendar, optionally filtered by
   language.
8. **Get Leaderboard** — Returns the weekly or monthly leaderboard ranking among friends.

### Language Information Tools (read-only)
9. **Get Language Details** — Returns level, points, streak, and learning status for a
   specific language.
10. **Get Language Progress** — Returns detailed progress metrics for a language (level,
    percent, points rank, fluency score, etc.).
11. **Get Known Topics** — Returns list of learned topic/skill names for a language.
12. **Get Unknown Topics** — Returns list of not-yet-learned topics for a language.
13. **Get Golden Topics** — Returns topics that are fully mastered ("golden") for a language.
14. **Get Reviewable Topics** — Returns topics learned but not yet golden for a language.
15. **Get Known Words** — Returns the set of known words for a language.
16. **Get Learned Skills** — Returns full skill objects sorted by learning order.
17. **Get Vocabulary** — Returns the full vocabulary overview for a language.
18. **Get Related Words** — Returns conjugations/related forms of a given word.
19. **Get Translations** — Returns translations of a list of words between two languages.
20. **Get Language Voices** — Returns available TTS voices for a language.
21. **Get Audio URL** — Returns the URL of a pronunciation audio file for a word.

### Shop / Action Tools (write/destructive)
22. **Buy Item** — Purchases a shop item (e.g., streak_freeze) for a given language.
23. **Buy Streak Freeze** — Convenience tool to buy a streak freeze for the current language.

### Utility Tools
24. **Get Language from Abbreviation** — Converts a language abbreviation to its full name.
25. **Get Abbreviation Of** — Converts a language full name to its abbreviation.
26. **Set Username** — Switches the active user to read another user's public data.

## Non-Functional Requirements

- **Transport**: stdio (for local Claude Desktop / Claude Code integration).
- **Credentials**: Passed via environment variables; never hardcoded or logged.
- **Error handling**: All tools return descriptive error strings on failure; no unhandled
  exceptions propagate to the MCP client.
- **Response formats**: Tools support both `markdown` (human-readable) and `json`
  (machine-readable) output formats where applicable.
- **Packaging**: Managed with `uv`; installable as a local MCP server.

## Success Criteria

- All 26 tools are implemented and callable from Claude.
- Read-only tools are correctly annotated with `readOnlyHint: true`.
- Shop/action tools are annotated with `destructiveHint: true`.
- The server starts successfully with valid credentials.
- The server returns a clear error when credentials are missing.
- A `README.md` documents how to extract the JWT and configure the server.
