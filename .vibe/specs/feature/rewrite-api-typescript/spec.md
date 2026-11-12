# Feature Specification: TypeScript Rewrite of duolingo-mcp

## Overview

Rewrite the `duolingo-mcp` MCP server from Python to TypeScript. The Python implementation
depends on the unmaintained `iSteve-O/Duolingo` Python library which has multiple bugs.
The TypeScript rewrite will implement the Duolingo REST API client natively, fix all known
bugs, add comprehensive tests, and maintain full backward compatibility for all 26 MCP tools.

---

## Duolingo REST API Endpoints

All endpoints discovered from the Python library source. The TypeScript client will call
these directly.

### Authentication

- **Header**: `Authorization: Bearer <JWT>`
- **User-Agent**: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ...`
- **Env vars**: `DUOLINGO_USERNAME`, `DUOLINGO_JWT`

### Endpoints

| Method | URL | Used for |
|--------|-----|----------|
| GET | `https://www.duolingo.com/users/<username>` | Primary user data (user_data) |
| GET | `https://www.duolingo.com/2017-06-30/users/<user_id>?fields=<fields>` | Daily XP progress |
| POST | `https://www.duolingo.com/2017-06-30/users/<user_id>/shop-items` | Buy item |
| POST | `https://www.duolingo.com/switch_language` | Switch active language |
| GET | `https://www.duolingo.com/vocabulary/overview` | Vocabulary overview |
| GET | `https://www.duolingo.com/friendships/leaderboard_activity?unit=<unit>&_=<timestamp>` | Leaderboard |
| GET | `https://d2.duolingo.com/api/1/dictionary/hints/<source>/<target>?tokens=<words_json>` | Translations |
| POST | `https://www.duolingo.com/2017-06-30/sessions` | Audio URL discovery (sessions) |
| GET | `https://www.duolingo.com` | Homepage (TTS voice discovery) |

### User Data Structure (`/users/<username>`)

The primary data blob returned by `/users/<username>` contains:

```
{
  username, bio, id, num_following, cohort, language_data, num_followers,
  learning_language_string, created, contribution_points, gplus_id, twitter_id,
  admin, invites_left, location, fullname, avatar, ui_language,
  daily_goal, site_streak, streak_extended_today,
  calendar, languages: [{ language, language_string, learning, ... }],
  language_data: {
    "<lang_abbr>": {
      streak, language_string, level_progress, num_skills_learned, level_percent,
      level_points, points_rank, next_level, level_left, language, points,
      fluency_score, level, calendar, points_ranking_data: [...], skills: [...]
    }
  }
}
```

---

## MCP Tools (26 total — all must be preserved)

### Account Tools (8)

#### `duolingo_get_user_info`
- **Input**: `username?`, `response_format`
- **API**: GET `/users/<username>` → extract fields: username, bio, id, num_following, cohort,
  num_followers, learning_language_string, created, contribution_points, admin, invites_left,
  location, fullname, avatar, ui_language
- **Output**: User profile data (markdown or JSON)
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_settings`
- **Input**: `response_format`
- **API**: GET `/users/<username>` → extract: notify_comment, deactivated, is_follower_by, is_following
- **Output**: Settings data (markdown or JSON)
- **Annotations**: readOnly, idempotent, openWorld
- **Note**: Authenticated user only

#### `duolingo_get_streak_info`
- **Input**: `username?`, `response_format`
- **API**: GET `/users/<username>` → extract: daily_goal, site_streak, streak_extended_today
- **Output**: Streak data (markdown or JSON)
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_daily_xp_progress`
- **Input**: `response_format`
- **API**: GET `/2017-06-30/users/<user_id>?fields=xpGoal,xpGains,streakData`
- **Output**: `{ xp_goal, xp_today, lessons_today }`
- **Annotations**: readOnly, NOT idempotent, openWorld
- **Note**: Authenticated user only. Filter lessons by `streakData.updatedTimestamp` to get
  only today's lessons. Handle time discrepancy (future timestamps) by falling back to system midnight.

#### `duolingo_get_languages`
- **Input**: `username?`, `abbreviations`, `response_format`
- **API**: GET `/users/<username>` → filter `languages` array where `learning === true`
- **Output**: List of language names or abbreviations
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_friends`
- **Input**: `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[first_lang].points_ranking_data`
- **Output**: `[{ username, id, points, languages }]`
- **Annotations**: readOnly, idempotent, openWorld
- **Bug fix**: Handle missing `points_ranking_data` gracefully (return empty list, don't crash)

#### `duolingo_get_calendar`
- **Input**: `username?`, `language_abbr?`, `response_format`
- **API**: GET `/users/<username>` → `user_data.calendar` or `language_data[lang].calendar`
- **Output**: List of calendar entries
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_leaderboard`
- **Input**: `username?`, `unit`, `response_format`
- **API**: GET `/friendships/leaderboard_activity?unit=<unit>&_=<timestamp>`
  + GET `/users/<username>` for friends data
- **Output**: `[{ unit, id, points, username }]` sorted by points desc
- **Annotations**: readOnly, NOT idempotent, openWorld
- **Bug fix**: Handle missing `points_ranking_data` gracefully (return empty list, don't crash)

---

### Language Tools (13)

#### `duolingo_get_language_details`
- **Input**: `language_name`, `username?`, `response_format`
- **API**: GET `/users/<username>` → find in `languages` array by `language_string`
- **Output**: `{ language, language_string, level, points, streak, current_learning, learning }`
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_language_progress`
- **Input**: `language_abbr`, `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[lang_abbr]`
  (may need POST `/switch_language` first if not current language)
- **Output**: `{ language, language_string, level, level_percent, level_points, level_progress,
  level_left, next_level, points, points_rank, streak, num_skills_learned, fluency_score }`
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_known_topics`
- **Input**: `language_abbr`, `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[lang].skills` where `learned === true` → `title`
- **Output**: List of topic names
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_unknown_topics`
- **Input**: `language_abbr`, `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[lang].skills` where `learned === false` → `title`
- **Output**: List of topic names
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_golden_topics`
- **Input**: `language_abbr`, `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[lang].skills` where `learned && strength === 1.0` → `title`
- **Output**: List of topic names
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_reviewable_topics`
- **Input**: `language_abbr`, `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[lang].skills` where `learned && strength < 1.0` → `title`
- **Output**: List of topic names
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_known_words`
- **Input**: `language_abbr`, `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[lang].skills` where `learned` → flatten `words` arrays → deduplicate
- **Output**: Sorted list of known words
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_learned_skills`
- **Input**: `language_abbr`, `username?`, `response_format`
- **API**: GET `/users/<username>` → `language_data[lang].skills` where `learned` → sort by dependency order
- **Output**: Ordered list of skill objects
- **Annotations**: readOnly, idempotent, openWorld
- **Note**: Dependency order computed via topological sort on `dependencies_name` field

#### `duolingo_get_vocabulary`
- **Input**: `language_abbr?`, `response_format`
- **API**: GET `/vocabulary/overview` (may need POST `/switch_language` first)
- **Output**: `{ language_string, learning_language, from_language, vocab_overview: [...] }`
- **Annotations**: readOnly, idempotent, openWorld
- **Note**: Authenticated user only

#### `duolingo_get_related_words`
- **Input**: `word`, `language_abbr?`, `response_format`
- **API**: GET `/vocabulary/overview` → find word by `normalized_string` → return words with matching `lexeme_id`
- **Output**: List of related vocab word objects
- **Annotations**: readOnly, idempotent, openWorld
- **Note**: Authenticated user only

#### `duolingo_get_translations`
- **Input**: `words[]`, `source?`, `target?`, `response_format`
- **API**: GET `https://d2.duolingo.com/api/1/dictionary/hints/<source>/<target>?tokens=<json>`
  (segments large word lists to stay under 2000 words / 12800 chars JSON limit)
- **Output**: `{ word: [translation, ...] }`
- **Annotations**: readOnly, idempotent, openWorld

#### `duolingo_get_language_voices`
- **Input**: `language_abbr?`, `response_format`
- **API**: GET `https://www.duolingo.com` (homepage) → parse `duo.tts_multi_voices = {...}` JS variable
- **Output**: List of voice names (e.g. `["default", "mathieu"]`)
- **Annotations**: readOnly, idempotent, openWorld
- **Note**: This scrapes the homepage JS. Consider caching the result.

#### `duolingo_get_audio_url`
- **Input**: `word`, `language_abbr?`, `voice?`, `random`
- **API**: POST `/2017-06-30/sessions` for each skill → extract TTS URLs from challenges
- **Output**: CloudFront CDN URL string or null
- **Annotations**: readOnly, NOT idempotent, openWorld
- **Note**: Builds a voice URL dictionary per language. Cache per session.

---

### Utility & Shop Tools (5)

#### `duolingo_get_language_from_abbr`
- **Input**: `language_abbr`, `username?`
- **API**: GET `/users/<username>` → find in `languages` array by `language` field
- **Output**: Full language name string
- **Annotations**: readOnly, idempotent, NOT openWorld

#### `duolingo_get_abbreviation_of`
- **Input**: `language_name`, `username?`
- **API**: GET `/users/<username>` → find in `languages` array by `language_string` (case-insensitive)
- **Output**: Language abbreviation string
- **Annotations**: readOnly, idempotent, NOT openWorld

#### `duolingo_set_username` *(mentioned in README, not in tools — needs implementation)*
- **Input**: `username`
- **Behavior**: Switch the active username for subsequent queries
- **Output**: Confirmation string
- **Annotations**: NOT readOnly, NOT destructive, NOT idempotent, NOT openWorld
- **Note**: In the Python implementation this was a client-level operation. In TypeScript,
  this can be implemented by updating the active username in the client singleton.

#### `duolingo_buy_item`
- **Input**: `item_name`, `language_abbr`
- **API**: POST `/2017-06-30/users/<user_id>/shop-items` with `{ itemName, learningLanguage }`
- **Output**: Success confirmation or error
- **Annotations**: NOT readOnly, destructive, NOT idempotent, openWorld
- **Error handling**: 400 + `ALREADY_HAVE_STORE_ITEM` → specific message; 400 + `INSUFFICIENT_FUNDS` → specific message

#### `duolingo_buy_streak_freeze`
- **Input**: none
- **API**: GET `/users/<username>` for current language → POST `/2017-06-30/users/<user_id>/shop-items`
- **Output**: Success or "already equipped" message
- **Annotations**: NOT readOnly, destructive, NOT idempotent, openWorld

---

## Known Bugs to Fix

1. **`get_friends` crash**: Python library crashes with `KeyError` when `points_ranking_data`
   is absent from `language_data`. Fix: check for existence before accessing.

2. **`get_leaderboard` crash**: Same root cause — calls `get_friends()` which crashes.
   Fix: handle missing `points_ranking_data` gracefully.

3. **`asyncio.get_event_loop()` deprecation**: Python 3.10+ deprecates this. Not applicable
   after TypeScript rewrite.

4. **Thread-safety of `_as_user` context manager**: The Python client mutates shared state
   (`client.username`) in a context manager, which is not thread-safe. In TypeScript, each
   request should pass the username as a parameter rather than mutating shared state.

5. **`duolingo_set_username` missing**: Mentioned in README but not implemented in tools.
   Must be added.

---

## Project Structure

```
duolingo-mcp/
├── src/
│   ├── server.ts              # MCP server entry point
│   ├── client/
│   │   ├── duolingo.ts        # DuolingoClient class (HTTP calls)
│   │   ├── types.ts           # TypeScript interfaces for API responses
│   │   └── errors.ts          # Custom error classes
│   └── tools/
│       ├── account.ts         # Account tools (8)
│       ├── language.ts        # Language tools (13)
│       └── shop.ts            # Shop/utility tools (5)
├── tests/
│   ├── client/
│   │   └── duolingo.test.ts   # Unit tests for API client
│   └── tools/
│       ├── account.test.ts
│       ├── language.test.ts
│       └── shop.test.ts
├── dist/                      # Compiled output (gitignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Non-Functional Requirements

- **TypeScript strict mode**: `"strict": true` in tsconfig
- **ESM modules**: `"type": "module"` in package.json, `"module": "ESNext"` in tsconfig
- **Node.js**: >= 18 (for native fetch availability, though we use axios)
- **Test coverage**: All client methods and tool handlers must have unit tests
- **No Python files**: Python source files removed after TypeScript is complete
- **Backward compatibility**: All 26 tool names unchanged, same input/output schemas
- **Error messages**: Actionable, guide user toward resolution
- **No secrets in repo**: JWT tokens only via environment variables

---

## Success Criteria

1. All 26 MCP tools work correctly with real Duolingo credentials
2. All unit tests pass (`npm test`)
3. TypeScript compiles without errors (`npm run build`)
4. Server starts and responds to MCP protocol (`npm start`)
5. All known Python bugs are fixed
6. `duolingo_set_username` tool is implemented
7. No Python files remain in the repository
