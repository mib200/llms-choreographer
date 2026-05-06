/**
 * Unix socket endpoint for internal choreographer communication.
 *
 * macOS/Linux: Unix domain socket
 * Windows: named-pipe-style fallback
 *
 * Reuse patterns from plugins/codex/scripts/lib/broker-endpoint.mjs.
 */

import { createServer, connect } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chmodSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';

/**
 * Resolve the socket path for the current platform.
 *
 * @param {string} [sessionId]
 * @returns {string}
 */
export function resolveEndpointPath(sessionId = 'default') {
  if (process.platform === 'win32') {
    // Windows: use a named pipe pattern
    return `\\\\.\\pipe\\choreo-broker-${sessionId}`;
  }
  const tmpBase = tmpdir().length > 40 ? '/tmp' : tmpdir();
  const runtimeDir = join(tmpBase, `choreo-${process.getuid?.() ?? 'user'}`);
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  try { chmodSync(runtimeDir, 0o700); } catch { /* best effort */ }
  const safeSessionId = String(sessionId).replace(/[^A-Za-z0-9._-]/g, '-');
  return join(runtimeDir, `broker-${safeSessionId}.sock`);
}

/**
 * Create a Unix socket server that listens for JSON-RPC messages.
 *
 * @param {object} opts
 * @param {string} opts.path — socket path
 * @param {function} opts.onMessage — (message, respond) => void
 * @param {string} [opts.token] — optional bearer token required on every message
 * @returns {Promise<import('node:net').Server>}
 */
export async function createEndpoint({ path, onMessage, token }) {
  // Clean up existing socket file
  if (process.platform !== 'win32' && existsSync(path)) {
    try {
      unlinkSync(path);
    } catch { /* ignore */ }
  }

  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      let buffer = '';

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line);
            const respond = (response) => {
              socket.write(JSON.stringify(response) + '\n');
            };
            if (!message || typeof message !== 'object' || typeof message.method !== 'string') {
              respond({ id: message?.id ?? null, error: 'invalid_request' });
              continue;
            }
            if (token && message.token !== token) {
              respond({ id: message.id ?? null, error: 'unauthorized' });
              continue;
            }
            onMessage(message, respond);
          } catch {
            // Invalid JSON — ignore
          }
        }
      });
    });

    server.listen(path, () => {
      if (process.platform !== 'win32') {
        try { chmodSync(path, 0o600); } catch { /* best effort */ }
      }
      resolve(server);
    });
    server.on('error', reject);
  });
}

/**
 * Connect to a broker endpoint.
 *
 * @param {string} path
 * @returns {Promise<{socket: import('node:net').Socket, send: function, close: function}>}
 */
export async function connectEndpoint(path) {
  return new Promise((resolve, reject) => {
    const socket = connect(path, () => {
      resolve({
        socket,
        send: (message) => {
          socket.write(JSON.stringify(message) + '\n');
        },
        close: () => {
          socket.end();
        },
      });
    });

    socket.on('error', reject);
  });
}
