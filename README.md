# duolingo-mcp

A TypeScript [MCP](https://modelcontextprotocol.io) server that exposes the unofficial
Duolingo API to LLM agents (e.g. Claude). Built natively in TypeScript — no third-party
Duolingo library dependency.

## Features

27 tools covering:

- **Account**: user info, settings, streak, daily XP, languages, friends, calendar, leaderboard
- **Language**: details, progress, known/unknown/golden/reviewable topics, known words,
  learned skills, vocabulary, related words, translations, TTS voices, audio URLs
- **Shop / Actions**: buy items, buy streak freeze
- **Utilities**: language name ↔ abbreviation conversion, switch username

## Prerequisites

- Node.js 18+
- npm
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
npm install
npm run build
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
# Build first, then run
npm run build
npm start

# Run directly from TypeScript source (no build step, uses tsx)
npm run dev
```

## Testing

```bash
npm test
```

## Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`).

Replace `$HOME/duolingo-mcp` with the actual path where you cloned the repo:

```json
{
  "mcpServers": {
    "duolingo": {
      "command": "node",
      "args": ["$HOME/duolingo-mcp/dist/server.js"],
      "env": {
        "DUOLINGO_USERNAME": "your_username",
        "DUOLINGO_JWT": "your_jwt_token"
      }
    }
  }
}
```

> **Important**: Use the absolute path to `dist/server.js`. Run `npm run build` first to generate the `dist/` folder.

## Claude Code Integration

```bash
# Replace ~/duolingo-mcp with the actual path to your clone
claude mcp add duolingo -- node ~/duolingo-mcp/dist/server.js
```

Then set the environment variables in your shell before starting Claude Code:

```bash
export DUOLINGO_USERNAME="your_username"
export DUOLINGO_JWT="your_jwt_token"
```

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
| `duolingo_get_golden_topics` | Fully mastered topics (strength = 1.0) |
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

## Architecture

```
src/
├── server.ts          # MCP server entry point (stdio transport)
├── client/
│   ├── duolingo.ts    # Native TypeScript Duolingo API client
│   ├── types.ts       # TypeScript interfaces for API responses
│   └── errors.ts      # Custom error classes
└── tools/
    ├── account.ts     # Account tools (8)
    ├── language.ts    # Language tools (13)
    ├── shop.ts        # Shop/utility tools (5+)
    └── helpers.ts     # Shared utilities (error handling, Zod schemas)
```

## License

MIT — see [LICENSE](LICENSE)
