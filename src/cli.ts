#!/usr/bin/env node
/**
 * Entry point of the `duolingo` binary. The CLI itself lives in
 * cli/program.ts so tests can run it in-process.
 */

import { main } from './cli/program.js';

process.exitCode = await main(process.argv.slice(2));
