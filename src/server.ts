#!/usr/bin/env node
/**
 * Duolingo MCP Server
 *
 * A TypeScript MCP server that exposes Duolingo learning data and actions to
 * LLM agents via the unofficial Duolingo REST API.
 *
 * Authentication:
 *   Set the following environment variables before starting the server:
 *   - DUOLINGO_USERNAME: Your Duolingo username
 *   - DUOLINGO_JWT: Your Duolingo JWT token (extracted from browser)
 *
 * Usage:
 *   npm run build && npm start
 *   # or in development:
 *   npx tsx src/server.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAccountTools } from './tools/account.js';
import { registerLanguageTools } from './tools/language.js';
import { registerShopTools } from './tools/shop.js';

const server = new McpServer(
  {
    name: 'duolingo_mcp',
    version: '1.0.0',
  },
  {
    instructions:
      'This server provides access to Duolingo learning data via the unofficial ' +
      'Duolingo API. You can query user profiles, streak information, language ' +
      'progress, topics, words, TTS audio, and more. ' +
      'Authentication requires DUOLINGO_USERNAME and DUOLINGO_JWT environment variables. ' +
      'To get your JWT token: log in to Duolingo in a browser, open the developer ' +
      'console, and run: ' +
      "document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)",
  },
);

registerAccountTools(server);
registerLanguageTools(server);
registerShopTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
