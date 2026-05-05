import { build } from 'esbuild';

const targets = [
  { in: 'plugin-claude/src/entry.mjs',    out: 'plugin-claude/scripts/companion.mjs'  },
  { in: 'plugin-codex/src/entry.mjs',     out: 'plugin-codex/scripts/companion.mjs'   },
  { in: 'plugin-opencode/src/entry.mjs',  out: 'plugin-opencode/dist/companion.mjs'   },
];

for (const t of targets) {
  await build({
    entryPoints: [t.in],
    outfile:     t.out,
    bundle:      true,
    format:      'esm',
    platform:    'node',
    target:      'node22',
    external:    ['node:*'],
  });
  console.log(`bundled → ${t.out}`);
}
