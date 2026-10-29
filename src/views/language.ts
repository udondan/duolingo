/**
 * Language-level views: details, progress, topics, words, skills, TTS voices
 * and audio URLs.
 */

import { getClient, type DuolingoClient } from '../client/duolingo.js';
import type { DuolingoLanguageData, DuolingoSkill } from '../client/types.js';
import { notFound, textView, type View } from './view.js';

export async function languageDetailsView(opts: {
  language_name: string;
  username?: string;
}): Promise<View> {
  const { language_name } = opts;
  const userData = await getClient().getUserData(opts.username);

  // The API omits `languages` while the current course is not a
  // language course (e.g. Math, Music, Chess).
  if (!userData.languages) {
    return notFound(
      'Language details are not available while the current course is not a language course.',
    );
  }

  const lang = userData.languages.find(
    (l) => l.language_string === language_name,
  );
  if (!lang) {
    return notFound(
      `No details found for language '${language_name}'. Check the language name.`,
    );
  }

  const details = {
    language: lang.language,
    language_string: lang.language_string,
    level: lang.level,
    points: lang.points,
    streak: lang.streak,
    current_learning: lang.current_learning,
    learning: lang.learning,
  };

  return {
    data: details,
    markdown: () =>
      [
        `# ${language_name} Details`,
        '',
        `- **Level**: ${details.level}`,
        `- **Points**: ${details.points}`,
        `- **Streak**: ${details.streak} days`,
        `- **Currently Learning**: ${details.current_learning}`,
      ].join('\n'),
  };
}

export async function languageProgressView(opts: {
  language_abbr: string;
}): Promise<View> {
  const { language_abbr } = opts;
  const userData = await getClient().getUserData();
  const langData = userData.language_data?.[language_abbr];
  if (!langData) {
    return notFound(
      `Language '${language_abbr}' not found. Make sure you are learning this language.`,
    );
  }

  const progress = {
    language: langData.language,
    language_string: langData.language_string,
    level: langData.level,
    level_percent: langData.level_percent,
    level_points: langData.level_points,
    level_progress: langData.level_progress,
    level_left: langData.level_left,
    next_level: langData.next_level,
    points: langData.points,
    // points_rank is absent in the current API response
    points_rank: langData.points_rank,
    streak: langData.streak,
    num_skills_learned: langData.num_skills_learned,
    fluency_score: langData.fluency_score,
  };

  return {
    data: progress,
    markdown: () => {
      const lang = progress.language_string || language_abbr;
      const lines = [`# ${lang} Progress`, ''];
      lines.push(`- **Level**: ${progress.level}`);
      lines.push(`- **Level Progress**: ${progress.level_percent}%`);
      lines.push(`- **Points to Next Level**: ${progress.level_left}`);
      lines.push(`- **Total Points**: ${progress.points}`);
      if (typeof progress.points_rank === 'number')
        lines.push(`- **Points Rank**: #${progress.points_rank}`);
      lines.push(`- **Streak**: ${progress.streak} days`);
      lines.push(`- **Skills Learned**: ${progress.num_skills_learned}`);
      if (progress.fluency_score !== null) {
        lines.push(`- **Fluency Score**: ${progress.fluency_score}`);
      }
      return lines.join('\n');
    },
  };
}

// ---------------------------------------------------------------------------
// Topics, words and skills
// ---------------------------------------------------------------------------

export interface LanguageQuery {
  language_abbr: string;
  username?: string;
}

/**
 * Load the language data of a user, or a not-found view when the user does
 * not learn the language.
 */
async function loadLanguage(
  opts: LanguageQuery,
): Promise<DuolingoLanguageData | View> {
  const userData = await getClient().getUserData(opts.username);
  const langData = userData.language_data?.[opts.language_abbr];
  if (!langData) {
    return notFound(
      `Language '${opts.language_abbr}' not found. Make sure the user is learning this language.`,
    );
  }
  return langData;
}

function isView(value: DuolingoLanguageData | View): value is View {
  return 'markdown' in value;
}

function topicListView(title: string, topics: string[]): View {
  const sorted = [...topics].sort();
  return {
    data: sorted,
    markdown: () => {
      if (sorted.length === 0) return `No ${title.toLowerCase()} found.`;
      return [`# ${title}`, '', ...sorted.map((t) => `- ${t}`)].join('\n');
    },
  };
}

async function topicsView(
  opts: LanguageQuery,
  title: string,
  filter: (skill: DuolingoSkill) => boolean,
): Promise<View> {
  const langData = await loadLanguage(opts);
  if (isView(langData)) return langData;
  const topics = langData.skills.filter(filter).map((s) => s.title);
  return topicListView(title, topics);
}

export function knownTopicsView(opts: LanguageQuery): Promise<View> {
  return topicsView(opts, 'Known Topics', (s) => s.learned);
}

export function unknownTopicsView(opts: LanguageQuery): Promise<View> {
  return topicsView(opts, 'Unknown Topics', (s) => !s.learned);
}

export function goldenTopicsView(opts: LanguageQuery): Promise<View> {
  return topicsView(
    opts,
    'Golden (Mastered) Topics',
    (s) => s.learned && s.strength === 1.0,
  );
}

export function reviewableTopicsView(opts: LanguageQuery): Promise<View> {
  return topicsView(
    opts,
    'Reviewable Topics',
    (s) => s.learned && s.strength < 1.0,
  );
}

export async function knownWordsView(opts: LanguageQuery): Promise<View> {
  const langData = await loadLanguage(opts);
  if (isView(langData)) return langData;

  const wordSet = new Set<string>();
  for (const skill of langData.skills) {
    if (skill.learned) {
      for (const word of skill.words) {
        wordSet.add(word);
      }
    }
  }
  const words = [...wordSet].sort();
  const abbr = opts.language_abbr;

  return {
    data: words,
    markdown: () => {
      if (words.length === 0) {
        return `No known words found for language '${abbr}'.`;
      }
      return [
        `# Known Words (${abbr.toUpperCase()}) — ${words.length} words`,
        '',
        words.join(', '),
      ].join('\n');
    },
  };
}

export async function learnedSkillsView(opts: LanguageQuery): Promise<View> {
  const langData = await loadLanguage(opts);
  if (isView(langData)) return langData;

  const allSkills = [...langData.skills];
  computeDependencyOrder(allSkills);

  const learnedSkills = allSkills
    .filter((s) => s.learned)
    .sort((a, b) => (a.dependency_order ?? 0) - (b.dependency_order ?? 0));
  const abbr = opts.language_abbr;

  return {
    data: learnedSkills,
    markdown: () => {
      if (learnedSkills.length === 0) {
        return `No learned skills found for language '${abbr}'.`;
      }
      const lines = [`# Learned Skills (${abbr.toUpperCase()})`, ''];
      for (const skill of learnedSkills) {
        const strengthPct = Math.round(skill.strength * 100);
        lines.push(
          `- **${skill.title}** — Strength: ${strengthPct}% | Progress: ${Math.round(skill.progress_percent)}%`,
        );
      }
      return lines.join('\n');
    },
  };
}

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

const NO_LANGUAGE = 'No language found. Make sure you are learning a language.';

/** The given language, or the first language the user learns. */
async function resolveLanguageAbbr(
  client: DuolingoClient,
  languageAbbr?: string,
): Promise<string | undefined> {
  if (languageAbbr) return languageAbbr;
  const userData = await client.getUserData();
  return Object.keys(userData.language_data ?? {})[0];
}

export async function languageVoicesView(opts: {
  language_abbr?: string;
}): Promise<View> {
  const client = getClient();
  const langAbbr = await resolveLanguageAbbr(client, opts.language_abbr);
  if (!langAbbr) return notFound(NO_LANGUAGE);

  // Discover voices via the session API (duo.tts_multi_voices is no longer
  // embedded in the homepage — voices are now discovered from session TTS URLs)
  const voices = await client.getLanguageVoices(langAbbr);

  return {
    data: voices,
    message:
      voices.length === 0
        ? `No voices found for language '${langAbbr}'.`
        : undefined,
    markdown: () =>
      [`# TTS Voices (${langAbbr})`, '', ...voices.map((v) => `- ${v}`)].join(
        '\n',
      ),
  };
}

export async function audioUrlView(opts: {
  word: string;
  language_abbr?: string;
  voice?: string;
  random?: boolean;
}): Promise<View> {
  const { word, voice, random = true } = opts;
  const client = getClient();
  const langAbbr = await resolveLanguageAbbr(client, opts.language_abbr);
  if (!langAbbr) return notFound(NO_LANGUAGE);

  // If a specific voice is requested, build the URL directly.
  // URL format: {ttsBaseUrl}tts/{lang}/{voice}/token/{word}
  if (voice) {
    return textView(await client.buildAudioUrl(word, langAbbr, voice));
  }

  // If random voice is requested, discover available voices first.
  if (random) {
    const voices = await client.getLanguageVoices(langAbbr);
    if (voices.length > 0) {
      const selectedVoice = voices[Math.floor(Math.random() * voices.length)];
      return textView(
        await client.buildAudioUrl(word, langAbbr, selectedVoice),
      );
    }
  }

  // Fall back to the default (no-voice) URL
  return textView(await client.buildAudioUrl(word, langAbbr));
}

// ---------------------------------------------------------------------------
// Dependency order computation (topological sort for learned skills)
// ---------------------------------------------------------------------------

/**
 * Compute dependency order for all skills using topological sort.
 * Mutates the `dependency_order` field on each skill object.
 */
export function computeDependencyOrder(skills: DuolingoSkill[]): void {
  const skillsDict = new Map<string, DuolingoSkill>();
  for (const skill of skills) {
    skillsDict.set(skill.name, skill);
  }
  for (const skill of skills) {
    getSkillOrdinal(skillsDict, skill, []);
  }
}

function getSkillOrdinal(
  skillsDict: Map<string, DuolingoSkill>,
  skill: DuolingoSkill,
  breadcrumbs: string[],
): number {
  if (breadcrumbs.includes(skill.name)) {
    // Loop detected — assign order 1 to break the cycle
    skill.dependency_order = 1;
    return 1;
  }
  if (skill.dependency_order !== undefined) {
    return skill.dependency_order;
  }
  if (skill.dependencies_name.length === 0) {
    skill.dependency_order = 1;
    return 1;
  }

  const newBreadcrumbs = [...breadcrumbs, skill.name];
  const depOrders = skill.dependencies_name
    .map((name) => skillsDict.get(name))
    .filter((dep): dep is DuolingoSkill => dep !== undefined)
    .map((dep) => getSkillOrdinal(skillsDict, dep, newBreadcrumbs));

  const order = 1 + (depOrders.length > 0 ? Math.max(...depOrders) : 0);
  skill.dependency_order = order;
  return order;
}
