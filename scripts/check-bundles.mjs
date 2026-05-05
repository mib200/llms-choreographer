#!/usr/bin/env node
// Fails if tracked plugin bundles drift from what `npm run bundle` would produce.
// Intended for CI or pre-commit hook.

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const targets = [
  { in: 'plugin-claude/src/entry.mjs',    out: 'plugin-claude/scripts/companion.mjs'  },
  { in: 'plugin-codex/src/entry.mjs',     out: 'plugin-codex/scripts/companion.mjs'   },
  { in: 'plugin-opencode/src/entry.mjs',  out: 'plugin-opencode/dist/companion.mjs'   },
];

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

let drift = false;
for (const t of targets) {
  const result = await build({
    entryPoints: [t.in],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external: ['node:*'],
    write: false,
  });
  const built = result.outputFiles[0].contents;
  const tracked = readFileSync(t.out);
  if (sha(built) !== sha(tracked)) {
    console.error(`✗ drift: ${t.out} is stale — run 'npm run bundle' and commit.`);
    drift = true;
  } else {
    console.log(`✓ fresh: ${t.out}`);
  }
}

if (drift) process.exit(1);
console.log('All bundles match tracked artifacts.');
