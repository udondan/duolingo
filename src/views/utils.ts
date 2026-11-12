/**
 * Utility views: convert between language names and abbreviations.
 */

import { getClient } from '../client/duolingo.js';
import { notFound, resolveUserId, textView, type View } from './view.js';

async function languageCourses(username?: string) {
  const client = getClient();
  const userId = await resolveUserId(client, username);
  const v2 = await client.getUserDataV2(userId);
  return v2.courses.filter((c) => c.subject === 'language');
}

export async function languageFromAbbrView(opts: {
  language_abbr: string;
  username?: string;
}): Promise<View> {
  const { language_abbr } = opts;
  const course = (await languageCourses(opts.username)).find(
    (c) => c.learningLanguage === language_abbr || c.topic === language_abbr,
  );
  if (!course) {
    return notFound(
      `No language found for abbreviation '${language_abbr}'. ` +
        'Make sure the user is learning this language.',
    );
  }
  return textView(course.title ?? course.learningLanguage ?? language_abbr);
}

export async function abbreviationOfView(opts: {
  language_name: string;
  username?: string;
}): Promise<View> {
  const { language_name } = opts;
  const course = (await languageCourses(opts.username)).find(
    (c) => (c.title ?? '').toLowerCase() === language_name.toLowerCase(),
  );
  if (!course) {
    return notFound(
      `No abbreviation found for language '${language_name}'. ` +
        'Make sure the user is learning this language.',
    );
  }
  return textView(course.learningLanguage ?? course.topic);
}
