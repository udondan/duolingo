/**
 * Tests for createServer() metadata and startMcpServer() wiring.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer, startMcpServer } from '../../src/mcp.js';
import { version } from '../../src/version.js';

describe('createServer', () => {
  it('reports the package version and lists all 25 tools', async () => {
    const server = createServer();
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    try {
      expect(client.getServerVersion()).toEqual({
        name: 'duolingo_mcp',
        version,
      });
      expect(client.getInstructions()).toContain('DUOLINGO_JWT');
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(25);
    } finally {
      await client.close();
      await serverTransport.close();
    }
  });
});

describe('startMcpServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects the server to a stdio transport', async () => {
    const connect = vi
      .spyOn(McpServer.prototype, 'connect')
      .mockResolvedValue(undefined);

    await startMcpServer();

    expect(connect).toHaveBeenCalledOnce();
    expect(connect.mock.calls[0]?.[0]).toBeInstanceOf(StdioServerTransport);
  });
});

describe('version', () => {
  it('matches package.json', async () => {
    const pkg = (await import('../../package.json', {
      with: { type: 'json' },
    })) as { default: { version: string } };
    expect(version).toBe(pkg.default.version);
  });
});
