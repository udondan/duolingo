/**
 * Edge cases of the shared views: missing fields, empty lists and the
 * markdown branches that the tool and CLI tests do not reach.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as duolingoModule from '../../src/client/duolingo.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import { DuolingoNotFoundError } from '../../src/client/errors.js';
import type { DuolingoSkill } from '../../src/client/types.js';
import { handleError } from '../../src/tools/helpers.js';
import {
  calendarView,
  coursesView,
  dailyXpProgressView,
  friendsView,
  healthView,
  languagesView,
  leaderboardView,
  settingsView,
  shopItemsView,
  streakGoalView,
  streakInfoView,
  userInfoView,
} from '../../src/views/account.js';
import {
  audioUrlView,
  computeDependencyOrder,
  knownTopicsView,
  knownWordsView,
  languageDetailsView,
  languageProgressView,
  languageVoicesView,
  learnedSkillsView,
} from '../../src/views/language.js';
import {
  abbreviationOfView,
  languageFromAbbrView,
} from '../../src/views/utils.js';
import { notFound, renderView } from '../../src/views/view.js';

function mockClient(methods: Record<string, unknown>): void {
  const client = Object.fromEntries(
    Object.entries(methods).map(([name, value]) => [
      name,
      typeof value === 'function' ? value : vi.fn().mockResolvedValue(value),
    ]),
  );
  vi.spyOn(duolingoModule, 'getClient').mockReturnValue(
    client as unknown as DuolingoClient,
  );
}

function skill(overrides: Partial<DuolingoSkill>): DuolingoSkill {
  return {
    id: overrides.name ?? 'skill',
    name: 'skill',
    title: 'Skill',
    learned: true,
    strength: 1,
    progress_percent: 100,
    words: [],
    dependencies_name: [],
    ...overrides,
  };
}

const TODAY = new Date().toISOString().slice(0, 10);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('view helpers', () => {
  it('notFound renders its message', () => {
    const view = notFound('gone');
    expect(view.markdown()).toBe('gone');
    expect(renderView(view, 'json')).toBe('gone');
  });

  it('handleError covers every error kind', () => {
    expect(handleError(new DuolingoNotFoundError('nope'))).toBe('Error: nope');
    expect(handleError(new TypeError('bad'))).toBe(
      'Error: Unexpected error — TypeError: bad',
    );
    expect(handleError('weird')).toBe('Error: Unknown error — weird');
  });
});

describe('account views', () => {
  it('userInfoView falls back to legacy fields and skips empty ones', async () => {
    mockClient({
      getUserData: {
        username: 'sparse',
        fullname: '',
        bio: '',
        location: null,
        avatar: '',
        id: 1,
        num_followers: 3,
        num_following: 4,
        learning_language_string: null,
        ui_language: '',
        admin: false,
        cohort: 0,
        created: '2 years ago',
      },
    });
    const view = await userInfoView({});
    expect(view.data).toMatchObject({ num_followers: 3, num_following: 4 });
    expect(view.markdown()).toBe(
      [
        '# Duolingo User: sparse',
        '',
        '- **Learning**: N/A',
        '- **UI Language**: N/A',
        '- **Followers**: 3',
        '- **Following**: 4',
        '- **Member Since**: 2 years ago',
      ].join('\n'),
    );
  });

  it('userInfoView without any creation date or follower counts', async () => {
    mockClient({
      getUserData: {
        username: 'bare',
        fullname: 'Bare',
        bio: 'bio',
        location: '',
        avatar: '',
        id: 1,
        learning_language_string: '',
        ui_language: 'de',
        tracking_properties: {},
      },
    });
    const md = (await userInfoView({})).markdown();
    expect(md).not.toContain('Member Since');
    expect(md).not.toContain('Followers');
    expect(md).not.toContain('Location');
  });

  it('settingsView includes social flags when present', async () => {
    mockClient({
      getUserData: {
        notify_comment: false,
        deactivated: false,
        is_follower_by: true,
        is_following: false,
      },
    });
    const view = await settingsView();
    expect(view.data).toEqual({
      notify_comment: false,
      deactivated: false,
      is_follower_by: true,
      is_following: false,
    });
    expect(view.markdown()).toContain('- **Is Follower By**: true');
  });

  it('streakInfoView for another user without streak details', async () => {
    mockClient({
      getUserIdByUsername: 7,
      getUserData: { id: 7 },
      getUserDataV2: {
        streak: 0,
        streakData: { currentStreak: null, longestStreak: null },
      },
    });
    const view = await streakInfoView({ username: 'other' });
    expect(view.data).toEqual({
      site_streak: 0,
      daily_goal: null,
      streak_extended_today: false,
      streak_start: null,
      longest_streak: null,
    });
    expect(view.markdown()).toBe(
      [
        '# Duolingo Streak',
        '',
        '- **Current Streak**: 0 days',
        '- **Extended Today**: ❌ No',
      ].join('\n'),
    );
  });

  it('streakInfoView reads the daily goal of another user', async () => {
    mockClient({
      getUserIdByUsername: 7,
      getUserData: { id: 7, daily_goal: 30 },
      getUserDataV2: {
        streak: 1,
        streakData: { currentStreak: null, longestStreak: null },
      },
    });
    const view = await streakInfoView({ username: 'other' });
    expect(view.data).toMatchObject({ daily_goal: 30 });
  });

  it('streakInfoView without a daily goal', async () => {
    mockClient({
      getUserData: { id: 1 },
      getUserDataV2: {
        streak: 1,
        streakData: { currentStreak: null, longestStreak: null },
      },
    });
    expect((await streakInfoView({})).data).toMatchObject({ daily_goal: null });
  });

  it('streakInfoView markdown with all details', async () => {
    mockClient({
      getUserData: { id: 1, daily_goal: 20 },
      getUserDataV2: {
        streak: 5,
        streakData: {
          currentStreak: { lastExtendedDate: TODAY, startDate: '2026-01-01' },
          longestStreak: { length: 9 },
        },
      },
    });
    const md = (await streakInfoView({})).markdown();
    expect(md).toContain('✅ Yes');
    expect(md).toContain('- **Daily Goal**: 20 XP');
    expect(md).toContain('- **Streak Started**: 2026-01-01');
    expect(md).toContain('- **Longest Streak**: 9 days');
  });

  it('dailyXpProgressView counts today and handles a zero goal', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockClient({
      getUserData: { id: 1 },
      getUserDataById: {
        xpGoal: 0,
        // A timestamp in the future falls back to the system midnight
        streakData: { updatedTimestamp: now + 3 * 86400 },
        xpGains: [
          { time: now, xp: 15 },
          { time: now - 3 * 86400, xp: 99 },
        ],
      },
    });
    const view = await dailyXpProgressView();
    expect(view.data).toMatchObject({ xp_goal: 0, xp_today: 15 });
    expect(view.markdown()).toContain('- **XP Today**: 15 / 0 (0%)');
    expect(view.markdown()).toContain('- **Lessons Completed**: 1');
  });

  it('dailyXpProgressView markdown with a goal', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockClient({
      getUserData: { id: 1 },
      getUserDataById: {
        xpGoal: 20,
        streakData: { updatedTimestamp: now },
        xpGains: [{ time: now, xp: 10 }],
      },
    });
    expect((await dailyXpProgressView()).markdown()).toContain('(50%)');
  });

  it('languagesView falls back from title to abbreviation', async () => {
    mockClient({
      getUserData: { id: 1 },
      getUserDataV2: {
        courses: [
          { subject: 'language', learningLanguage: 'fr', topic: 'fr' },
          { subject: 'math', topic: 'bt' },
        ],
      },
    });
    const view = await languagesView({});
    expect(view.data).toEqual(['fr']);
    expect(view.markdown()).toBe('# Learning Languages\n\n- fr');
  });

  it('friendsView markdown uses the username without a display name', async () => {
    mockClient({
      getUserData: { id: 1 },
      getFollowing: [{ username: 'anon', userId: 2, totalXp: 5 }],
    });
    expect((await friendsView()).markdown()).toBe(
      '# Duolingo Friends\n\n- **anon** (@anon) — 5 XP',
    );
  });

  it('calendarView without a calendar', async () => {
    mockClient({ getUserData: {} });
    const view = await calendarView({});
    expect(view.data).toEqual([]);
    expect(view.message).toBe('No calendar entries found.');
  });

  it('calendarView markdown sorts newest first with details', async () => {
    mockClient({
      getUserData: {
        calendar: [
          { datetime: Date.UTC(2026, 0, 1, 8), improvement: 10 },
          {
            datetime: Date.UTC(2026, 0, 2, 9, 30),
            improvement: 20,
            skill_id: 's1',
            event_type: 'lesson',
          },
        ],
      },
    });
    expect((await calendarView({})).markdown()).toBe(
      [
        '# Activity Calendar',
        '',
        '- **2026-01-02 09:30** — 20 XP — skill: s1 — type: lesson',
        '- **2026-01-01 08:00** — 10 XP',
      ].join('\n'),
    );
  });

  it('leaderboardView ranks by weekly score or total XP', async () => {
    const following = [
      { userId: 1, username: 'a', totalXp: 100 },
      {
        userId: 2,
        username: 'b',
        displayName: 'Bee',
        totalXp: 50,
        userScore: { score: 30 },
      },
    ];
    mockClient({ getUserData: { id: 9 }, getFollowing: following });

    const week = await leaderboardView({ unit: 'week' });
    expect(week.markdown()).toBe(
      [
        '# Leaderboard (Week)',
        '',
        '1. **Bee** (@b) — 30 pts',
        '2. **a** (@a) — 0 pts',
      ].join('\n'),
    );

    const month = await leaderboardView({ unit: 'month' });
    expect(month.markdown()).toContain('1. **a** (@a) — 100 pts');
  });

  it('leaderboardView with no friends', async () => {
    mockClient({ getUserData: { id: 9 }, getFollowing: [] });
    expect((await leaderboardView({ unit: 'month' })).message).toBe(
      "No leaderboard data found for unit 'month'.",
    );
  });

  it('coursesView markdown labels every subject', async () => {
    mockClient({
      getUserData: { id: 1 },
      getUserDataV2: {
        username: 'u',
        courses: [
          {
            subject: 'language',
            title: 'French',
            learningLanguage: 'fr',
            xp: 1000,
          },
          { subject: 'chess', xp: 5 },
          { subject: 'cooking', xp: 1 },
        ],
      },
    });
    expect((await coursesView({})).markdown()).toBe(
      [
        '# Courses for u',
        '',
        `- **🌐 Language: French (fr)** — ${(1000).toLocaleString()} XP`,
        '- **♟️ Chess: Chess** — 5 XP',
        '- **cooking: Cooking** — 1 XP',
      ].join('\n'),
    );
  });

  it('coursesView with no courses', async () => {
    mockClient({ getUserData: { id: 1 }, getUserDataV2: { courses: [] } });
    expect((await coursesView({})).message).toBe('No courses found.');
  });

  it('shopItemsView groups items by type', async () => {
    mockClient({
      getShopItems: [
        {
          id: 'freeze',
          name: 'Freeze',
          type: 'misc',
          price: 10,
          currencyType: 'XGM',
        },
        { id: 'outfit', type: 'outfit', price: 5, currencyType: 'LGT' },
        {
          id: 'refill',
          name: 'Refill',
          type: 'misc',
          price: 3,
          currencyType: 'XGM',
        },
      ],
    });
    expect((await shopItemsView()).markdown()).toBe(
      [
        '# Duolingo Shop',
        '',
        '## Misc',
        '- **Freeze** — 10 gems',
        '- **Refill** — 3 gems',
        '',
        '## Outfit',
        '- **outfit** — 5 lingots',
        '',
      ].join('\n'),
    );
  });

  it('healthView without a refill timer', async () => {
    mockClient({
      getHealth: {
        hearts: 5,
        maxHearts: 5,
        healthEnabled: false,
        unlimitedHeartsAvailable: true,
        eligibleForFreeRefill: true,
        secondsUntilNextHeartSegment: null,
      },
    });
    const md = (await healthView()).markdown();
    expect(md).toContain('- **Unlimited Hearts**: Yes');
    expect(md).toContain('- **Health Enabled**: No');
    expect(md).not.toContain('Next Heart In');
  });

  it('streakGoalView markdown with an active goal', async () => {
    mockClient({
      getStreakGoalCurrent: {
        hasActiveGoal: true,
        streakGoal: {
          lastCompleteGoal: 7,
          nextSelectedGoal: { length: 14, dayInterval: 7 },
          checkpoints: [{ length: 10 }, { length: 14 }],
        },
      },
    });
    expect((await streakGoalView()).markdown()).toBe(
      [
        '# Streak Goal',
        '',
        '- **Last Completed Goal**: 7 days',
        '- **Next Goal**: 14 days (every 7 days)',
        '',
        '## Upcoming Checkpoints',
        '- 10 days',
        '- 14 days',
      ].join('\n'),
    );
  });

  it('streakGoalView markdown without next goal or checkpoints', async () => {
    mockClient({
      getStreakGoalCurrent: {
        hasActiveGoal: true,
        streakGoal: { lastCompleteGoal: 3, checkpoints: [] },
      },
    });
    expect((await streakGoalView()).markdown()).toBe(
      '# Streak Goal\n\n- **Last Completed Goal**: 3 days',
    );
  });
});

describe('language views', () => {
  it('languageDetailsView without a language course', async () => {
    mockClient({ getUserData: {} });
    expect(
      (await languageDetailsView({ language_name: 'French' })).message,
    ).toContain('not a language course');
  });

  it('languageDetailsView markdown', async () => {
    mockClient({
      getUserData: {
        languages: [
          {
            language: 'fr',
            language_string: 'French',
            level: 3,
            points: 300,
            streak: 2,
            current_learning: true,
            learning: true,
          },
        ],
      },
    });
    expect(
      (await languageDetailsView({ language_name: 'French' })).markdown(),
    ).toBe(
      [
        '# French Details',
        '',
        '- **Level**: 3',
        '- **Points**: 300',
        '- **Streak**: 2 days',
        '- **Currently Learning**: true',
      ].join('\n'),
    );
  });

  it('languageProgressView for an unknown language', async () => {
    mockClient({ getUserData: {} });
    expect((await languageProgressView({ language_abbr: 'xx' })).data).toBe(
      undefined,
    );
  });

  it('languageProgressView markdown with rank and without fluency', async () => {
    mockClient({
      getUserData: {
        language_data: {
          fr: {
            language: 'fr',
            language_string: '',
            level: 2,
            level_percent: 10,
            level_left: 90,
            points: 120,
            points_rank: 4,
            streak: 1,
            num_skills_learned: 2,
            fluency_score: null,
          },
        },
      },
    });
    expect(
      (await languageProgressView({ language_abbr: 'fr' })).markdown(),
    ).toBe(
      [
        '# fr Progress',
        '',
        '- **Level**: 2',
        '- **Level Progress**: 10%',
        '- **Points to Next Level**: 90',
        '- **Total Points**: 120',
        '- **Points Rank**: #4',
        '- **Streak**: 1 days',
        '- **Skills Learned**: 2',
      ].join('\n'),
    );
  });

  it('topic, word and skill views without the language', async () => {
    mockClient({ getUserData: {} });
    for (const view of [knownTopicsView, knownWordsView, learnedSkillsView]) {
      const result = await view({ language_abbr: 'xx' });
      expect(result.data).toBeUndefined();
      expect(result.message).toContain("Language 'xx' not found");
    }
  });

  it('topic, word and skill views with nothing learned', async () => {
    mockClient({
      getUserData: {
        language_data: {
          fr: { skills: [skill({ learned: false, words: ['non'] })] },
        },
      },
    });
    const opts = { language_abbr: 'fr' };
    expect((await knownTopicsView(opts)).markdown()).toBe(
      'No known topics found.',
    );
    expect((await knownWordsView(opts)).markdown()).toBe(
      "No known words found for language 'fr'.",
    );
    expect((await learnedSkillsView(opts)).markdown()).toBe(
      "No learned skills found for language 'fr'.",
    );
  });

  it('learnedSkillsView orders skills by dependencies', async () => {
    mockClient({
      getUserData: {
        language_data: {
          fr: {
            skills: [
              skill({
                name: 'b',
                title: 'B',
                dependencies_name: ['a'],
                strength: 0.5,
                progress_percent: 49.6,
              }),
              skill({ name: 'a', title: 'A' }),
            ],
          },
        },
      },
    });
    const view = await learnedSkillsView({ language_abbr: 'fr' });
    expect(view.markdown()).toBe(
      [
        '# Learned Skills (FR)',
        '',
        '- **A** — Strength: 100% | Progress: 100%',
        '- **B** — Strength: 50% | Progress: 50%',
      ].join('\n'),
    );
  });

  it('computeDependencyOrder handles cycles and unknown dependencies', () => {
    const skills = [
      skill({ name: 'a', dependencies_name: ['b'] }),
      skill({ name: 'b', dependencies_name: ['a'] }),
      skill({ name: 'c', dependencies_name: ['missing'] }),
    ];
    computeDependencyOrder(skills);
    expect(skills.map((s) => s.dependency_order)).toEqual([3, 2, 1]);
  });

  it('languageVoicesView without any language', async () => {
    mockClient({ getUserData: {} });
    const view = await languageVoicesView({});
    expect(view.data).toBeUndefined();
    expect(view.message).toContain('No language found');
  });

  it('languageVoicesView with no voices and with voices', async () => {
    mockClient({ getLanguageVoices: [] });
    expect((await languageVoicesView({ language_abbr: 'fr' })).message).toBe(
      "No voices found for language 'fr'.",
    );

    mockClient({ getLanguageVoices: ['lea', 'mathieu'] });
    expect((await languageVoicesView({ language_abbr: 'fr' })).markdown()).toBe(
      '# TTS Voices (fr)\n\n- lea\n- mathieu',
    );
  });

  it('audioUrlView without any language', async () => {
    mockClient({ getUserData: { language_data: {} } });
    expect((await audioUrlView({ word: 'oui' })).data).toBeUndefined();
  });

  it('audioUrlView falls back to the default voice', async () => {
    const buildAudioUrl = vi.fn().mockResolvedValue('https://tts/default');
    mockClient({ getLanguageVoices: [], buildAudioUrl });
    const view = await audioUrlView({ word: 'oui', language_abbr: 'fr' });
    expect(view.data).toBe('https://tts/default');
    expect(buildAudioUrl).toHaveBeenCalledWith('oui', 'fr');
  });
});

describe('utility views', () => {
  it('languageFromAbbrView falls back to the abbreviation', async () => {
    mockClient({
      getUserData: { id: 1 },
      getUserDataV2: { courses: [{ subject: 'language', topic: 'fr' }] },
    });
    expect((await languageFromAbbrView({ language_abbr: 'fr' })).data).toBe(
      'fr',
    );
  });

  it('abbreviationOfView uses the topic without a learning language', async () => {
    mockClient({
      getUserData: { id: 1 },
      getUserDataV2: {
        courses: [
          { subject: 'language', topic: 'xx' },
          { subject: 'language', title: 'French', topic: 'fr' },
        ],
      },
    });
    expect((await abbreviationOfView({ language_name: 'french' })).data).toBe(
      'fr',
    );
  });
});
