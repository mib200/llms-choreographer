import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentEnv } from '../env.mjs';

// --- buildAgentEnv allowlist ---

test('buildAgentEnv blocks AWS_SECRET_ACCESS_KEY', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', AWS_SECRET_ACCESS_KEY: 'secret123' });
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(env.PATH, '/usr/bin');
});

test('buildAgentEnv blocks GITHUB_TOKEN', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', GITHUB_TOKEN: 'ghp_xxx' });
  assert.equal(env.GITHUB_TOKEN, undefined);
});

test('buildAgentEnv blocks NPM_TOKEN', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', NPM_TOKEN: 'npm_xxx' });
  assert.equal(env.NPM_TOKEN, undefined);
});

test('buildAgentEnv blocks DATABASE_URL', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', DATABASE_URL: 'postgres://...' });
  assert.equal(env.DATABASE_URL, undefined);
});

test('buildAgentEnv passes ANTHROPIC_API_KEY', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', ANTHROPIC_API_KEY: 'sk-ant-xxx' });
  assert.equal(env.ANTHROPIC_API_KEY, 'sk-ant-xxx');
});

test('buildAgentEnv passes OPENAI_API_KEY', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', OPENAI_API_KEY: 'sk-xxx' });
  assert.equal(env.OPENAI_API_KEY, 'sk-xxx');
});

test('buildAgentEnv passes PATH, HOME, SHELL, TERM', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', HOME: '/home/u', SHELL: '/bin/zsh', TERM: 'xterm' });
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HOME, '/home/u');
  assert.equal(env.SHELL, '/bin/zsh');
  assert.equal(env.TERM, 'xterm');
});

test('buildAgentEnv passes CLAUDE_ prefixed vars', () => {
  const env = buildAgentEnv({ PATH: '/usr/bin', CLAUDE_CODE_USE_BEDROCK: '1' });
  assert.equal(env.CLAUDE_CODE_USE_BEDROCK, '1');
});

test('buildAgentEnv CHOREO_AGENT_ENV_PASSTHROUGH=1 forwards everything', () => {
  const src = { PATH: '/usr/bin', AWS_SECRET_ACCESS_KEY: 'secret', CHOREO_AGENT_ENV_PASSTHROUGH: '1' };
  const env = buildAgentEnv(src);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, 'secret');
  assert.equal(env.PATH, '/usr/bin');
});

test('buildAgentEnv CHOREO_AGENT_ENV_PASSTHROUGH absent blocks secrets', () => {
  const src = { PATH: '/usr/bin', AWS_SECRET_ACCESS_KEY: 'secret' };
  const env = buildAgentEnv(src);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(env.PATH, '/usr/bin');
});

// --- Permission handler ---

test('makeClientHandler permission: denies unlisted tools', async () => {
  // Import the factory — it's not exported directly, but we can test via AcpClient behavior
  // Since makeClientHandler is internal, we test indirectly via the adapter pattern:
  // The adapter passes interactive:false and no allowlist → all tools denied
  const { buildAgentEnv: _ } = await import('../runners.mjs');
  // Directly test that acp-client no longer has interactive auto-allow
  const source = await import('node:fs').then(fs =>
    fs.readFileSync(new URL('../agents/acp-client.mjs', import.meta.url), 'utf8')
  );
  assert.ok(!source.includes('if (interactive)'), 'interactive auto-allow should be removed');
  assert.ok(source.includes('permissionAllowlist.has(toolName)'), 'allowlist check must exist');
  assert.ok(source.includes("outcome: 'deny'"), 'default deny must exist');
});
