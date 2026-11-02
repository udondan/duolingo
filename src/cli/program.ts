/**
 * The `duolingo` command line interface.
 *
 * Prints JSON by default (`--format markdown` for readable text) and shares
 * its queries with the MCP tools. `duolingo mcp` starts the MCP server.
 *
 * Credentials come from DUOLINGO_USERNAME and DUOLINGO_JWT, or from the
 * config file ~/.config/duolingo/config (environment variables win).
 */

import { Command, CommanderError, Option } from 'commander';
import { DuolingoNotFoundError } from '../client/errors.js';
import { startMcpServer } from '../mcp.js';
import { handleError } from '../tools/helpers.js';
import { version } from '../version.js';
import {
  calendarView,
  coursesView,
  currenciesView,
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
} from '../views/account.js';
import {
  audioUrlView,
  goldenTopicsView,
  knownTopicsView,
  knownWordsView,
  languageDetailsView,
  languageProgressView,
  languageVoicesView,
  learnedSkillsView,
  reviewableTopicsView,
  unknownTopicsView,
  type LanguageQuery,
} from '../views/language.js';
import { abbreviationOfView, languageFromAbbrView } from '../views/utils.js';
import { toJson, type ResponseFormat, type View } from '../views/view.js';
import { loadConfigFile } from './config-file.js';

export interface CliOptions {
  /** Config file to load; defaults to ~/.config/duolingo/config. */
  configFile?: string;
}

interface UserOpts {
  username?: string;
}

/**
 * Render a view for the terminal. JSON always prints the data, markdown the
 * rendered text. A view without data means nothing was found: an error.
 */
export function formatView(view: View, format: ResponseFormat): string {
  if (view.data === undefined) {
    throw new DuolingoNotFoundError(String(view.message));
  }
  if (format === 'json') return toJson(view.data);
  return view.message ?? view.markdown();
}

/** Build the CLI. It throws instead of exiting, see `main`. */
export function buildProgram(options: CliOptions = {}): Command {
  const program = new Command();

  program
    .name('duolingo')
    .description(
      'Read your Duolingo data: profile, streak, XP, courses, topics, words and more.\n' +
        'Credentials: DUOLINGO_USERNAME and DUOLINGO_JWT, from the environment or\n' +
        '~/.config/duolingo/config (KEY=VALUE, mode 0600).',
    )
    .version(version)
    .addOption(
      new Option('-f, --format <format>', 'output format')
        .choices(['json', 'markdown'])
        .default('json'),
    )
    .exitOverride()
    .hook('preAction', () => {
      loadConfigFile(options.configFile);
    });

  async function show(load: () => Promise<View>): Promise<void> {
    const { format } = program.opts<{ format: ResponseFormat }>();
    const text = formatView(await load(), format);
    process.stdout.write(`${text}\n`);
  }

  const usernameOption = (): Option =>
    new Option(
      '-u, --username <name>',
      'Duolingo user to query (default: the authenticated user)',
    );

  // ── MCP ───────────────────────────────────────────────────────────────────

  program
    .command('mcp')
    .description('Start the MCP server (stdio)')
    .action(startMcpServer);

  // ── Account ───────────────────────────────────────────────────────────────

  program
    .command('user')
    .description('Profile: name, bio, location, followers, languages')
    .addOption(usernameOption())
    .action((opts: UserOpts) => show(() => userInfoView(opts)));

  program
    .command('settings')
    .description('Account settings of the authenticated user')
    .action(() => show(settingsView));

  program
    .command('streak')
    .description('Current streak, daily goal and longest streak')
    .addOption(usernameOption())
    .action((opts: UserOpts) => show(() => streakInfoView(opts)));

  program
    .command('xp')
    .description('XP earned and lessons completed today')
    .action(() => show(dailyXpProgressView));

  program
    .command('languages')
    .description('Languages the user is learning')
    .addOption(usernameOption())
    .option('-a, --abbreviations', "print abbreviations (e.g. 'fr')")
    .action((opts: UserOpts & { abbreviations?: boolean }) =>
      show(() => languagesView(opts)),
    );

  program
    .command('courses')
    .description('All courses, including Math, Chess and Music')
    .addOption(usernameOption())
    .action((opts: UserOpts) => show(() => coursesView(opts)));

  program
    .command('friends')
    .description('Users the authenticated user follows')
    .action(() => show(friendsView));

  program
    .command('calendar')
    .description('Recent activity of the current course, newest first')
    .addOption(usernameOption())
    .action((opts: UserOpts) => show(() => calendarView(opts)));

  program
    .command('leaderboard')
    .description('Friends ranked by XP')
    .addOption(
      new Option('--unit <unit>', 'time unit')
        .choices(['week', 'month'])
        .default('week'),
    )
    .action((opts: { unit: 'week' | 'month' }) =>
      show(() => leaderboardView(opts)),
    );

  program
    .command('shop')
    .description('Shop items and their prices (read-only)')
    .action(() => show(shopItemsView));

  program
    .command('health')
    .description('Hearts and refill status')
    .action(() => show(healthView));

  program
    .command('currencies')
    .description('Gem and lingot balances')
    .action(() => show(currenciesView));

  program
    .command('streak-goal')
    .description('Current streak goal and upcoming checkpoints')
    .action(() => show(streakGoalView));

  // ── Language ──────────────────────────────────────────────────────────────

  program
    .command('language <name>')
    .description("Level, points and streak of a language (e.g. 'French')")
    .addOption(usernameOption())
    .action((name: string, opts: UserOpts) =>
      show(() => languageDetailsView({ language_name: name, ...opts })),
    );

  program
    .command('progress <abbr>')
    .description("Detailed progress in a language (e.g. 'fr')")
    .action((abbr: string) =>
      show(() => languageProgressView({ language_abbr: abbr })),
    );

  const languageQueries: [
    string,
    string,
    (opts: LanguageQuery) => Promise<View>,
  ][] = [
    ['known-topics', 'Learned topics', knownTopicsView],
    ['unknown-topics', 'Topics not learned yet', unknownTopicsView],
    ['golden-topics', 'Fully mastered topics', goldenTopicsView],
    [
      'reviewable-topics',
      'Learned topics that need review',
      reviewableTopicsView,
    ],
    ['known-words', 'Words learned', knownWordsView],
    ['learned-skills', 'Learned skills in learning order', learnedSkillsView],
  ];
  for (const [name, description, view] of languageQueries) {
    program
      .command(`${name} <abbr>`)
      .description(`${description} in a language (e.g. 'fr')`)
      .addOption(usernameOption())
      .action((abbr: string, opts: UserOpts) =>
        show(() => view({ language_abbr: abbr, ...opts })),
      );
  }

  program
    .command('voices [abbr]')
    .description('Text-to-speech voices (default: current language)')
    .action((abbr?: string) =>
      show(() => languageVoicesView({ language_abbr: abbr })),
    );

  program
    .command('audio-url <word> [abbr]')
    .description('URL of the pronunciation audio of a word')
    .option('--voice <voice>', "voice to use (e.g. 'mathieu')")
    .option('--no-random', 'use the default voice instead of a random one')
    .action(
      (
        word: string,
        abbr: string | undefined,
        opts: { voice?: string; random: boolean },
      ) => show(() => audioUrlView({ word, language_abbr: abbr, ...opts })),
    );

  // ── Utilities ─────────────────────────────────────────────────────────────

  program
    .command('language-name <abbr>')
    .description("Full name of a language you learn (e.g. 'fr' → 'French')")
    .addOption(usernameOption())
    .action((abbr: string, opts: UserOpts) =>
      show(() => languageFromAbbrView({ language_abbr: abbr, ...opts })),
    );

  program
    .command('abbreviation <name>')
    .description("Abbreviation of a language you learn (e.g. 'French' → 'fr')")
    .addOption(usernameOption())
    .action((name: string, opts: UserOpts) =>
      show(() => abbreviationOfView({ language_name: name, ...opts })),
    );

  return program;
}

/** Run the CLI with the given arguments. Returns the exit code. */
export async function main(
  argv: string[],
  options: CliOptions = {},
): Promise<number> {
  try {
    await buildProgram(options).parseAsync(argv, { from: 'user' });
    return 0;
  } catch (err) {
    // Commander already printed help, the version or a usage error.
    if (err instanceof CommanderError) return err.exitCode;
    process.stderr.write(`[duolingo] ${handleError(err)}\n`);
    return 1;
  }
}
