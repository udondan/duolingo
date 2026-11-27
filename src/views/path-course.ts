/**
 * Support for courses on the learning path. Their legacy skill tree in
 * `language_data` is empty, so the authenticated user's current course is
 * read from the current API instead.
 */

import type { DuolingoClient } from '../client/duolingo.js';
import type {
  DuolingoCurrentCourseSkill,
  DuolingoLanguageData,
  DuolingoSkill,
  DuolingoUserData,
} from '../client/types.js';

/** Language codes that the legacy API uses in place of the current ones. */
const LEGACY_LANGUAGE_CODES: Record<string, string> = { zh: 'zs', zs: 'zh' };

/**
 * The legacy language data of a language, by its current or legacy code
 * (Chinese is 'zh' in the current API but 'zs' in `language_data`).
 */
export function languageData(
  userData: DuolingoUserData,
  abbr: string,
): DuolingoLanguageData | undefined {
  const data = userData.language_data ?? {};
  const legacy = LEGACY_LANGUAGE_CODES[abbr];
  return data[abbr] ?? (legacy === undefined ? undefined : data[legacy]);
}

/**
 * A skill of the current course in the shape of a legacy skill. Path courses
 * have no skill strength, so `strength` is the share of the skill's levels
 * (crowns) the user has finished, and `progress_percent` the same share in
 * percent. Words are not available per skill.
 */
function pathSkill(skill: DuolingoCurrentCourseSkill): DuolingoSkill {
  const finishedLevels = skill.finishedLevels ?? 0;
  const levels = skill.levels ?? 0;
  const name = skill.name ?? skill.id;
  const strength = levels > 0 ? Math.min(finishedLevels / levels, 1) : 0;
  return {
    id: skill.id,
    name,
    title: name,
    learned: finishedLevels > 0,
    strength,
    progress_percent: strength * 100,
    words: [],
    dependencies_name: [],
    finished_levels: finishedLevels,
    levels,
  };
}

/**
 * The language data with the skills of the current course when its legacy
 * skill tree is empty. Unchanged for other users and when the language is not
 * the current course.
 */
export async function withPathSkills(
  client: DuolingoClient,
  langData: DuolingoLanguageData,
  opts: { language_abbr: string; username?: string },
): Promise<DuolingoLanguageData> {
  if (langData.skills.length > 0) return langData;
  if (!client.isAuthenticatedUser(opts.username)) return langData;
  const course = await client.getCurrentCourse(opts.language_abbr);
  if (!course) return langData;
  return { ...langData, skills: course.skills.map(pathSkill) };
}

/** The number of skills learned in the current course (0 for other courses). */
export async function pathSkillsLearned(
  client: DuolingoClient,
  abbr: string,
): Promise<number> {
  const course = await client.getCurrentCourse(abbr);
  return course?.skills.filter((s) => (s.finishedLevels ?? 0) > 0).length ?? 0;
}

/**
 * The words the authenticated user learned in the current course, or
 * `undefined` for other users and other courses.
 */
export async function pathCourseWords(
  client: DuolingoClient,
  abbr: string,
  username: string | undefined,
): Promise<string[] | undefined> {
  if (!client.isAuthenticatedUser(username)) return undefined;
  const lexemes = await client.getLearnedLexemes(abbr);
  return lexemes?.map((lexeme) => lexeme.text);
}

/** The level of a path skill, as "x/y", or `undefined` for legacy skills. */
export function pathSkillLevel(skill: DuolingoSkill): string | undefined {
  const { finished_levels, levels } = skill;
  if (typeof finished_levels !== 'number' || typeof levels !== 'number') {
    return undefined;
  }
  return `${finished_levels}/${levels}`;
}
