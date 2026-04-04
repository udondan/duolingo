# duolingo-mcp

A Python-based [MCP](https://modelcontextprotocol.io) server that exposes the unofficial
[Duolingo API](https://github.com/iSteve-O/Duolingo) to LLM agents (e.g. Claude).

## Features

26 tools covering:

- **Account**: user info, settings, streak, daily XP, languages, friends, calendar, leaderboard
- **Language**: details, progress, known/unknown/golden/reviewable topics, known words,
  learned skills, vocabulary, related words, translations, TTS voices, audio URLs
- **Shop / Actions**: buy items, buy streak freeze
- **Utilities**: language name ↔ abbreviation conversion, switch username

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager
- A Duolingo account

## Getting Your JWT Token

Duolingo requires a JWT token for authentication. To extract it:

1. Log in to [duolingo.com](https://www.duolingo.com) in your browser.
2. Open the browser developer console (F12 → Console tab).
3. Paste and run:
   ```js
   document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11);
   ```
4. Copy the output — that is your JWT token.

> **Note**: JWT tokens expire. If you get authentication errors, repeat the steps above.

## Installation

```bash
git clone https://github.com/udondan/duolingo-mcp.git
cd duolingo-mcp
uv sync
```

## Configuration

Set the following environment variables:

```bash
export DUOLINGO_USERNAME="your_duolingo_username"
export DUOLINGO_JWT="your_jwt_token_from_browser"
```

Or create a `.env` file (never commit this):

```env
DUOLINGO_USERNAME=your_duolingo_username
DUOLINGO_JWT=your_jwt_token_from_browser
```

## Running the Server

```bash
# Run directly
uv run python server.py

# Run in development mode with MCP Inspector
uv run mcp dev server.py
```

## Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "duolingo": {
      "command": "uv",
      "args": ["run", "--directory", "/path/to/duolingo-mcp", "python", "server.py"],
      "env": {
        "DUOLINGO_USERNAME": "your_username",
        "DUOLINGO_JWT": "your_jwt_token"
      }
    }
  }
}
```

## Claude Code Integration

```bash
claude mcp add duolingo -- uv run --directory /path/to/duolingo-mcp python server.py
```

Then set the environment variables in your shell before starting Claude Code.

## Available Tools

### Account Tools (read-only)

| Tool | Description |
|------|-------------|
| `duolingo_get_user_info` | Profile: username, name, location, avatar, followers, etc. |
| `duolingo_get_settings` | Notification and follow settings |
| `duolingo_get_streak_info` | Current streak, daily goal, extended today |
| `duolingo_get_daily_xp_progress` | XP goal, XP today, lessons completed today |
| `duolingo_get_languages` | Languages being learned (full names or abbreviations) |
| `duolingo_get_friends` | Friends list with points and languages |
| `duolingo_get_calendar` | Recent activity calendar |
| `duolingo_get_leaderboard` | Weekly/monthly leaderboard among friends |

### Language Tools (read-only)

| Tool | Description |
|------|-------------|
| `duolingo_get_language_details` | Level, points, streak for a language |
| `duolingo_get_language_progress` | Detailed progress metrics |
| `duolingo_get_known_topics` | Learned topic/skill names |
| `duolingo_get_unknown_topics` | Not-yet-learned topics |
| `duolingo_get_golden_topics` | Fully mastered topics |
| `duolingo_get_reviewable_topics` | Learned but not golden topics |
| `duolingo_get_known_words` | Set of known words |
| `duolingo_get_learned_skills` | Full skill objects sorted by learning order |
| `duolingo_get_vocabulary` | Full vocabulary overview |
| `duolingo_get_related_words` | Conjugations/related forms of a word |
| `duolingo_get_translations` | Translate a list of words |
| `duolingo_get_language_voices` | Available TTS voices |
| `duolingo_get_audio_url` | Pronunciation audio URL for a word |

### Utility & Shop Tools

| Tool | Destructive | Description |
|------|-------------|-------------|
| `duolingo_get_language_from_abbr` | No | Abbreviation → full name |
| `duolingo_get_abbreviation_of` | No | Full name → abbreviation |
| `duolingo_set_username` | No | Switch to another user's public data |
| `duolingo_buy_item` | **Yes** | Purchase a shop item (spends Lingots/Gems) |
| `duolingo_buy_streak_freeze` | **Yes** | Buy a streak freeze for current language |

## License

MIT — see [LICENSE](LICENSE)
