import { spawn, spawnSync } from 'node:child_process';

const [,, cmd, ...rest] = process.argv;

function checkOpenCode() {
  const result = spawnSync('opencode', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error('Error: OpenCode CLI not found or not working.');
    console.error('Please run setup: /opencode:setup');
    process.exit(1);
  }
  return result.stdout.trim();
}

function stripFlags(args) {
  return args
    .filter(arg => arg !== '--background' && arg !== '--wait')
    .join(' ');
}

/**
 * Parse OpenCode --format json ndJSON stream and extract the final assistant text.
 * Falls back to raw stdout if parsing fails.
 */
function parseOpenCodeOutput(raw) {
  const lines = raw.split('\n').filter(l => l.trim());
  const messages = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      // Collect assistant message parts from the event stream
      if (obj.type === 'assistant' && obj.message?.content) {
        for (const block of obj.message.content) {
          if (block.type === 'text') messages.push(block.text);
        }
      }
    } catch {
      // not JSON — ignore progress/status lines
    }
  }
  return messages.length > 0 ? messages.join('\n').trim() : raw.trim();
}

/**
 * Spawn opencode run and capture output.
 * Respects OPENCODE_SERVER_URL for attach mode (avoids cold-start cost).
 */
function runOpenCode(task, extraArgs = []) {
  const args = ['run', task, '--format', 'json', '--dangerously-skip-permissions'];
  const serverUrl = process.env.OPENCODE_SERVER_URL;
  if (serverUrl) args.push('--attach', serverUrl);
  args.push(...extraArgs);

  return new Promise(resolve => {
    const out = [];
    const err = [];
    const proc = spawn('opencode', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', d => out.push(d));
    proc.stderr.on('data', d => err.push(d));
    proc.on('close', code => {
      const raw = Buffer.concat(out).toString();
      resolve({ output: parseOpenCodeOutput(raw), raw, error: Buffer.concat(err).toString().trim(), code: code ?? 0 });
    });
    proc.on('error', e => resolve({ output: '', raw: '', error: e.message, code: 1 }));
  });
}

if (cmd === 'check') {
  const version = checkOpenCode();
  console.log(`OpenCode version: ${version}`);
  process.exit(0);
}

if (cmd === 'run') {
  checkOpenCode();
  const task = stripFlags(rest);
  if (!task.trim()) {
    console.error('Error: No task provided');
    process.exit(1);
  }
  const { output, error, code } = await runOpenCode(task);
  if (code !== 0 && !output) {
    console.error(error || `opencode exited with code ${code}`);
    process.exit(code);
  }
  console.log(output || error || '[no output]');
  process.exit(code);
}

if (cmd === 'review') {
  checkOpenCode();

  const gitStat = spawnSync('git', ['diff', '--stat', 'HEAD'], { encoding: 'utf8' });
  const gitDiff = spawnSync('git', ['diff', 'HEAD'], { encoding: 'utf8' });

  const reviewPrompt = `Review the current git changes. Focus on correctness, edge cases, and code quality. Output only findings.

Git diff stat:
${gitStat.stdout || 'No stat available'}

Git diff:
${gitDiff.stdout || 'No diff available'}`;

  const { output, error, code } = await runOpenCode(reviewPrompt);
  if (code !== 0 && !output) {
    console.error(error || `opencode exited with code ${code}`);
    process.exit(code);
  }
  console.log(output || error || '[no output]');
  process.exit(code);
}

if (!cmd) {
  console.error('Usage: node companion.mjs <check|run|review> [args...]');
  process.exit(1);
}
