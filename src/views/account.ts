/**
 * Account views: languages, courses, shop, health and currencies.
 */

import { getClient } from '../client/duolingo.js';
import { resolveUserId, titleCase, type View } from './view.js';

export async function languagesView(opts: {
  username?: string;
  abbreviations?: boolean;
}): Promise<View> {
  const client = getClient();
  const userId = await resolveUserId(client, opts.username);
  const v2 = await client.getUserDataV2(userId);
  // Filter to language courses only (not math/chess/music)
  const languages = v2.courses.flatMap((c) => {
    if (c.subject !== 'language' || c.learningLanguage === undefined) return [];
    return [
      opts.abbreviations ? c.learningLanguage : (c.title ?? c.learningLanguage),
    ];
  });

  return {
    data: languages,
    message:
      languages.length === 0
        ? 'No languages found. The user may not be learning any languages.'
        : undefined,
    markdown: () =>
      ['# Learning Languages', '', ...languages.map((l) => `- ${l}`)].join(
        '\n',
      ),
  };
}

const SUBJECT_LABELS: Record<string, string> = {
  language: '🌐 Language',
  math: '🔢 Math',
  chess: '♟️ Chess',
  music: '🎵 Music',
};

export async function coursesView(opts: { username?: string }): Promise<View> {
  const client = getClient();
  const userId = await resolveUserId(client, opts.username);
  const v2 = await client.getUserDataV2(userId);
  const courses = v2.courses;

  return {
    data: courses,
    message: courses.length === 0 ? 'No courses found.' : undefined,
    markdown: () => {
      const lines = [`# Courses for ${v2.username}`, ''];
      for (const course of courses) {
        const label = SUBJECT_LABELS[course.subject] ?? course.subject;
        const title =
          course.title ??
          course.subject.charAt(0).toUpperCase() + course.subject.slice(1);
        const lang = course.learningLanguage
          ? ` (${course.learningLanguage})`
          : '';
        lines.push(
          `- **${label}: ${title}${lang}** — ${course.xp.toLocaleString()} XP`,
        );
      }
      return lines.join('\n');
    },
  };
}

export async function shopItemsView(): Promise<View> {
  const items = await getClient().getShopItems();

  return {
    data: items,
    message: items.length === 0 ? 'No shop items found.' : undefined,
    markdown: () => {
      const lines = ['# Duolingo Shop', ''];
      // Group by type
      const byType = new Map<string, typeof items>();
      for (const item of items) {
        const group = byType.get(item.type) ?? [];
        group.push(item);
        byType.set(item.type, group);
      }
      for (const [type, typeItems] of byType) {
        lines.push(`## ${titleCase(type)}`);
        for (const item of typeItems) {
          const name = item.name ?? item.id;
          const currency = item.currencyType === 'XGM' ? 'gems' : 'lingots';
          lines.push(`- **${name}** — ${item.price} ${currency}`);
        }
        lines.push('');
      }
      return lines.join('\n');
    },
  };
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export async function healthView(): Promise<View> {
  const health = await getClient().getHealth();

  return {
    data: health,
    markdown: () => {
      const lines = [
        '# Hearts / Health',
        '',
        `- **Hearts**: ${health.hearts} / ${health.maxHearts}`,
        `- **Health Enabled**: ${yesNo(health.healthEnabled)}`,
        `- **Unlimited Hearts**: ${yesNo(health.unlimitedHeartsAvailable)}`,
        `- **Eligible for Free Refill**: ${yesNo(health.eligibleForFreeRefill)}`,
      ];
      if (health.secondsUntilNextHeartSegment !== null) {
        const mins = Math.ceil(health.secondsUntilNextHeartSegment / 60);
        lines.push(`- **Next Heart In**: ${mins} min`);
      }
      return lines.join('\n');
    },
  };
}

export async function currenciesView(): Promise<View> {
  const currencies = await getClient().getCurrencies();

  return {
    data: currencies,
    markdown: () =>
      [
        '# Currency Balances',
        '',
        `- **Gems**: ${currencies.gems.toLocaleString()}`,
        `- **Lingots**: ${currencies.lingots.toLocaleString()}`,
      ].join('\n'),
  };
}
