/**
 * Session lifecycle hook handlers.
 *
 * On SessionStart: spawn broker detached, inject CHOREO_BROKER_ENDPOINT +
 * CHOREO_SESSION_ID + CLAUDE_PLUGIN_DATA into $CLAUDE_ENV_FILE.
 * On SessionEnd: broker/shutdown, teardown.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolveEndpointPath } from './endpoint.mjs';
import { createBroker } from './broker.mjs';

/**
 * Generate a short session ID.
 *
 * @returns {string}
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * SessionStart hook handler.
 *
 * Spawns the broker, writes endpoint info to the env file, and returns
 * the broker instance and session ID.
 *
 * @param {object} [opts]
 * @param {string} [opts.envFile] — path to $CLAUDE_ENV_FILE
 * @returns {Promise<{broker: import('./broker.mjs').Broker, sessionId: string, endpoint: string}>}
 */
export async function handleSessionStart({ envFile } = {}) {
  const sessionId = generateSessionId();
  const endpoint = resolveEndpointPath(sessionId);

  const broker = createBroker();
  await broker.sessionStart(sessionId);

  // Write endpoint info to env file if provided
  if (envFile) {
    const existing = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
    const lines = existing.split('\n').filter((l) => l.trim() && !l.startsWith('CHOREO_BROKER_ENDPOINT') && !l.startsWith('CHOREO_SESSION_ID'));
    lines.push(`CHOREO_BROKER_ENDPOINT=${endpoint}`);
    lines.push(`CHOREO_SESSION_ID=${sessionId}`);
    writeFileSync(envFile, lines.join('\n') + '\n');
  }

  return { broker, sessionId, endpoint };
}

/**
 * SessionEnd hook handler.
 *
 * Shuts down the broker and cleans up.
 *
 * @param {object} opts
 * @param {import('./broker.mjs').Broker} opts.broker
 * @param {string} [opts.envFile] — path to $CLAUDE_ENV_FILE
 */
export async function handleSessionEnd({ broker, envFile }) {
  await broker.shutdown();

  // Remove broker env vars from env file if provided
  if (envFile && existsSync(envFile)) {
    const existing = readFileSync(envFile, 'utf8');
    const lines = existing.split('\n').filter((l) => l.trim() && !l.startsWith('CHOREO_BROKER_ENDPOINT') && !l.startsWith('CHOREO_SESSION_ID'));
    writeFileSync(envFile, lines.join('\n') + '\n');
  }
}

/**
 * CLI entrypoint for lifecycle hooks.
 *
 * Usage:
 *   lifecycle.mjs start [--env-file=...]
 *   lifecycle.mjs end [--env-file=...]
 */
import { fileURLToPath } from 'node:url';

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const [,, action, ...rest] = process.argv;
  const envFile = rest.find((a) => a.startsWith('--env-file='))?.split('=')[1];

  if (action === 'start') {
    handleSessionStart({ envFile })
      .then(({ sessionId, endpoint }) => {
        console.log(JSON.stringify({ sessionId, endpoint }));
      })
      .catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
  } else if (action === 'end') {
    // SessionEnd requires a broker instance, which would be passed via
    // the endpoint connection. For CLI usage, this is a no-op.
    console.log('SessionEnd: use broker.shutdown() via endpoint connection');
  } else {
    console.error('Usage: lifecycle.mjs <start|end> [--env-file=...]');
    process.exit(1);
  }
}
