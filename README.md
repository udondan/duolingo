# @udondan/duolingo

A TypeScript package that provides both a **Duolingo API client library** and an
**[MCP](https://modelcontextprotocol.io) server** for LLM agents (e.g. Claude).

Built natively in TypeScript against the unofficial Duolingo REST API — no third-party
Duolingo library dependency.

## Table of Contents

- [Getting Your JWT Token](#getting-your-jwt-token)
- [MCP Server](#mcp-server)
  - [Installation](#mcp-installation)
  - [Claude Desktop](#claude-desktop)
  - [Claude Code](#claude-code)
  - [Available Tools](#available-tools)
- [Library](#library)
  - [Installation](#library-installation)
  - [Quick Start](#quick-start)
  - [API Reference](#api-reference)
- [Development](#development)

---

## Getting Your JWT Token

Both the MCP server and the library require a Duolingo JWT token for authentication.

1. Log in to [duolingo.com](https://www.duolingo.com) in your browser.
2. Open the browser developer console (F12 → Console tab).
3. Run:
   ```js
   document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)
   ```
4. Copy the output — that is your JWT token.

> **Note**: JWT tokens expire. If you get authentication errors, repeat the steps above.

---

## MCP Server

### MCP Installation

**Option A — run directly with npx (no install needed):**

```bash
DUOLINGO_USERNAME=your_username DUOLINGO_JWT=your_jwt npx @udondan/duolingo
```

**Option B — install globally:**

```bash
npm install -g @udondan/duolingo
DUOLINGO_USERNAME=your_username DUOLINGO_JWT=your_jwt duolingo-mcp
```

**Option C — clone and build from source:**

```bash
git clone https://github.com/udondan/duolingo.git
cd duolingo
npm install && npm run build
node dist/server.js
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "duolingo": {
      "command": "npx",
      "args": ["-y", "@udondan/duolingo"],
      "env": {
        "DUOLINGO_USERNAME": "your_username",
        "DUOLINGO_JWT": "your_jwt_token"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add duolingo -- npx -y @udondan/duolingo
```

Then set the environment variables before starting Claude Code:

```bash
export DUOLINGO_USERNAME="your_username"
export DUOLINGO_JWT="your_jwt_token"
```

### Available Tools

All tools are **read-only** — the server never modifies your Duolingo account.

#### Account

| Tool | Description |
|------|-------------|
| `duolingo_get_user_info` | Profile: username, name, bio, location, avatar, followers, learning language |
| `duolingo_get_settings` | Notification and account settings |
| `duolingo_get_streak_info` | Current streak, longest streak, daily goal, extended today |
| `duolingo_get_daily_xp_progress` | XP goal, XP earned today, lessons completed today |
| `duolingo_get_languages` | Languages being learned (full names or abbreviations) |
| `duolingo_get_courses` | All courses including Math, Chess, and Music with XP per course |
| `duolingo_get_friends` | Users the authenticated user follows, with total XP |
| `duolingo_get_calendar` | Recent activity calendar for the current course (~last 2 weeks) |
| `duolingo_get_leaderboard` | Authenticated user's friends sorted by XP for week or month |
| `duolingo_get_shop_items` | Full shop catalogue with prices and item types |
| `duolingo_get_health` | Current hearts count, max hearts, refill timing |
| `duolingo_get_currencies` | Gem and lingot balances |
| `duolingo_get_streak_goal` | Current streak goal with upcoming checkpoints |

#### Language

| Tool | Description |
|------|-------------|
| `duolingo_get_language_details` | Level, points, streak for a specific language |
| `duolingo_get_language_progress` | Detailed progress: level %, points to next level, fluency |
| `duolingo_get_known_topics` | Learned topic/skill names |
| `duolingo_get_unknown_topics` | Not-yet-learned topics |
| `duolingo_get_golden_topics` | Fully mastered topics (strength = 1.0) |
| `duolingo_get_reviewable_topics` | Learned but not fully mastered topics |
| `duolingo_get_known_words` | Set of known words for a language |
| `duolingo_get_learned_skills` | Full skill objects sorted by learning order |
| `duolingo_get_language_voices` | Available TTS voice names for a language |
| `duolingo_get_audio_url` | Pronunciation audio URL for a word |

#### Utilities

| Tool | Description |
|------|-------------|
| `duolingo_get_language_from_abbr` | Convert language abbreviation to full name (e.g. `fr` → `French`) |
| `duolingo_get_abbreviation_of` | Convert full language name to abbreviation (e.g. `French` → `fr`) |

---

## Library

### Library Installation

```bash
npm install @udondan/duolingo
```

### Quick Start

```typescript
import { DuolingoClient } from '@udondan/duolingo';

const client = new DuolingoClient('your_username', 'your_jwt_token');

// Get all courses including Math, Chess, and Music
const userData = await client.getUserData();
const userId = userData.id;
const v2 = await client.getUserDataV2(userId);
for (const course of v2.courses) {
  console.log(`${course.subject}: ${course.xp} XP`);
}

// Get streak info
const streak = v2.streak;
const longestStreak = v2.streakData.longestStreak?.length;

// Get friends
const friends = await client.getFollowing(userId);
for (const friend of friends) {
  console.log(`${friend.username}: ${friend.totalXp} XP`);
}

// Get shop items
const items = await client.getShopItems();
const streakFreeze = items.find(i => i.id === 'streak_freeze');

// Get hearts
const health = await client.getHealth();
console.log(`Hearts: ${health.hearts}/${health.maxHearts}`);
```

### API Reference

#### `new DuolingoClient(username, jwt)`

Creates a new client instance. Results are cached per instance.

```typescript
const client = new DuolingoClient('your_username', 'your_jwt_token');
```

#### User Data

```typescript
// Legacy API — returns language_data with skills, calendar, etc.
// Required for: language details, topics, known words, learned skills
const userData = await client.getUserData(username?);

// 2023-05-23 API — returns all courses (language + math/chess/music),
// richer streak data, subscriber level, gems, health
const userId = userData.id;
const v2 = await client.getUserDataV2(userId);

// Resolve a username to a numeric user ID
const id = await client.getUserIdByUsername('someuser');
```

#### Courses (all subjects)

```typescript
const v2 = await client.getUserDataV2(userId);

// All courses
v2.courses;  // DuolingoCourse[]

// Filter by subject
const langCourses  = v2.courses.filter(c => c.subject === 'language');
const mathCourses  = v2.courses.filter(c => c.subject === 'math');
const chessCourses = v2.courses.filter(c => c.subject === 'chess');
const musicCourses = v2.courses.filter(c => c.subject === 'music');
```

Each course has: `id`, `subject`, `topic`, `xp`, `fromLanguage`.
Language courses also have: `learningLanguage`, `title`, `authorId`.

#### Daily XP Progress

```typescript
const progress = await client.getUserDataById(userId, ['xpGoal', 'xpGains', 'streakData']);
// progress.xpGoal    — daily XP goal
// progress.xpGains   — array of { xp, skillId, time } for recent lessons
// progress.streakData.updatedTimestamp — last streak update
```

#### Friends & Social

```typescript
// People this user follows (= friends)
const following = await client.getFollowing(userId);
// following[0].username, .totalXp, .userScore?.score (weekly XP), .isFollowedBy

// People who follow this user
const followers = await client.getFollowers(userId);
```

#### Shop, Health & Currencies

```typescript
// Full shop catalogue (read-only)
const items = await client.getShopItems();
// items[0].id, .name, .type, .price, .currencyType, .lastUsedDate

// Hearts / health (authenticated user only)
const health = await client.getHealth();
// health.hearts, .maxHearts, .eligibleForFreeRefill, .secondsUntilNextHeartSegment

// Gem and lingot balances (authenticated user only)
const { gems, lingots } = await client.getCurrencies();
```

#### Streak Goals

```typescript
// Current streak goal with checkpoints
const goal = await client.getStreakGoalCurrent();
// goal.hasActiveGoal, goal.streakGoal.lastCompleteGoal, .checkpoints, .nextSelectedGoal

// Available next goal options
const options = await client.getStreakGoalNextOptions();
```

#### TTS Audio

```typescript
// Discover available voices for a language
const voices = await client.getLanguageVoices('es');  // ['beaes', 'juniores', ...]

// Build an audio URL
const url = await client.buildAudioUrl('hola', 'es');
const urlWithVoice = await client.buildAudioUrl('hola', 'es', 'beaes');
```

#### Error Handling

```typescript
import {
  DuolingoClient,
  DuolingoAuthError,
  DuolingoNotFoundError,
  DuolingoCaptchaError,
  DuolingoClientError,
} from '@udondan/duolingo';

try {
  const data = await client.getUserData('someuser');
} catch (err) {
  if (err instanceof DuolingoAuthError) {
    // JWT expired — extract a new one from the browser
  } else if (err instanceof DuolingoNotFoundError) {
    // User does not exist
  } else if (err instanceof DuolingoCaptchaError) {
    // Duolingo blocked the request — try again later
  } else if (err instanceof DuolingoClientError) {
    // Other API error
  }
}
```

---

## Development

```bash
git clone https://github.com/udondan/duolingo.git
cd duolingo
npm install

# Build
npm run build

# Run tests (unit + integration)
npm test

# Integration tests require credentials:
export DUOLINGO_USERNAME="your_username"
export DUOLINGO_JWT="your_jwt_token"
npm test

# Type-check without building
npm run typecheck

# Run MCP server in dev mode (no build step)
npm run dev
```

### Project Structure

```
src/
├── index.ts           # Library entry point — exports client, types, errors
├── server.ts          # MCP server entry point (stdio transport)
├── client/
│   ├── duolingo.ts    # DuolingoClient — all API methods
│   ├── types.ts       # TypeScript interfaces for all API responses
│   └── errors.ts      # Custom error classes
└── tools/
    ├── account.ts     # Account tools (13)
    ├── language.ts    # Language tools (11)
    ├── shop.ts        # Utility tools (2)
    └── helpers.ts     # Shared utilities (error handling, Zod schemas)
```

### API Versions Used

| Endpoint | API Version | Used For |
|----------|-------------|----------|
| `/users/<username>` | Legacy | User profile, language data, skills, calendar |
| `/2023-05-23/users/{id}` | Current | Courses (all subjects), streak, health, gems |
| `/2023-05-23/friends/users/{id}/following` | Current | Friends, leaderboard |
| `/2023-05-23/shop-items` | Current | Shop catalogue |
| `/users/{id}/streak-goal-current` | Current | Streak goals |
| `/2017-06-30/sessions` | Current | TTS voice discovery |

---

## License

MIT — see [LICENSE](LICENSE)
