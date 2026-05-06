/**
 * Council 6-phase state machine (Ship 3).
 *
 * Replaces the flat Promise.all council with real deliberation.
 * Evolutions in scope: A (structured JSON positions), B (evidence citations best-effort),
 * E (minority position preservation), G (structured JSON synthesis).
 *
 * Crash recovery: writes council.json on every phase transition.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { REGISTRY, runAgent } from './runners.mjs';
import { parseStructuredOutput } from './parsers.mjs';
import { emit } from './observability.mjs';

// ── Schemas ──────────────────────────────────────────────────────────────────

const COUNCIL_POSITION_SCHEMA = JSON.parse(
  readFileSync(new URL('./schemas/council-position.schema.json', import.meta.url), 'utf8')
);

const COUNCIL_SYNTHESIS_SCHEMA = JSON.parse(
  readFileSync(new URL('./schemas/council-synthesis.schema.json', import.meta.url), 'utf8')
);

// ── Utilities ────────────────────────────────────────────────────────────────

function generateSlug(topic) {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const random = Math.random().toString(36).slice(2, 8);
  return `${slug}-${random}`;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeWithFrontmatter(path, member, model, phase, exitCode, content) {
  const frontmatter = [
    '---',
    `member: ${member}`,
    `model: ${model}`,
    `phase: ${phase}`,
    `timestamp: ${new Date().toISOString()}`,
    `exit_code: ${exitCode}`,
    '---',
    '',
  ].join('\n');
  writeFileSync(path, frontmatter + content);
}

function writeCheckpoint(slug, phase, round, members, generation = 1) {
  const checkpoint = {
    slug,
    phase,
    round: round ?? null,
    members,
    generation,
    timestamp: Date.now(),
  };
  writeFileSync(join(process.cwd(), 'debates', 'council', slug, 'council.json'), JSON.stringify(checkpoint, null, 2));
}

function readCheckpoint(slug) {
  const path = join(process.cwd(), 'debates', 'council', slug, 'council.json');
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  return null;
}

// ── Member Invocation ────────────────────────────────────────────────────────

function buildMemberPrompt(member, phase, topic, clarifications, otherPositions = {}) {
  const base = [
    `You are an expert taking a position in a structured multi-model council debate.`,
    `Topic: ${topic}`,
  ];

  if (clarifications) {
    base.push(`\nUSER CLARIFICATIONS:\n${clarifications}`);
  }

  if (phase === 'opening') {
    return [
      ...base,
      `\nState your opening position:\n`,
      `1. YOUR RECOMMENDED APPROACH (specific and decisive)\n`,
      `2. TOP 3 REASONS WHY\n`,
      `3. KEY RISKS YOU ACCEPT\n`,
      `4. WHAT YOU WOULD EXPLICITLY NOT DO\n`,
      `\nBe direct and opinionated. Don't hedge.`,
    ].join('\n');
  }

  if (phase === 'rebuttal') {
    const others = Object.entries(otherPositions)
      .filter(([name]) => name !== member)
      .map(([name, text]) => `[${name}]:\n${text}`)
      .join('\n\n');

    return [
      ...base,
      `\nOTHER MEMBERS' POSITIONS:\n${others}\n`,
      `Instructions:\n`,
      `1. Where others are RIGHT: concede explicitly\n`,
      `2. Where others are WRONG: counter-argue\n`,
      `3. Where you changed your mind: state your updated position\n`,
      `4. Where you STILL DISAGREE: sharpen your argument\n`,
      `\nEnd with your UPDATED POSITION.`,
    ].join('\n');
  }

  return topic;
}

async function invokeMember(name, binary, prompt, args = []) {
  const timeoutMs = process.env.CHOREO_TEST_MODE ? 5000 : 30000;
  return new Promise((resolve) => {
    const allArgs = [...args, prompt];
    const proc = spawn(binary, allArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    const err = [];

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ name, output: Buffer.concat(out).toString().trim(), error: 'timeout', exitCode: 1 });
    }, timeoutMs);

    proc.stdout.on('data', (d) => out.push(d));
    proc.stderr.on('data', (d) => err.push(d));
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        name,
        output: Buffer.concat(out).toString().trim(),
        error: Buffer.concat(err).toString().trim(),
        exitCode: code ?? 1,
      });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      resolve({ name, output: '', error: e.message, exitCode: 1 });
    });
  });
}

function getMemberInvocation(name, prompt, model) {
  const entry = REGISTRY[name];
  if (!entry) {
    console.error(`[council] Unknown member "${name}" — skipping`);
    return null;
  }

  const modelArgs = (model && model !== 'default') ? ['--model', model] : [];

  switch (name) {
    case 'claude':
      return {
        binary: entry.binary,
        args: [...modelArgs, '--print', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'],
        parse: (s) => s,
      };
    case 'codex':
      return {
        binary: entry.binary,
        args: ['exec', ...modelArgs, '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check'],
        parse: (s) => s,
      };
    case 'opencode':
      return {
        binary: entry.binary,
        args: ['run', ...modelArgs, '--dangerously-skip-permissions'],
        parse: (s) => s,
      };
    default:
      return null;
  }
}

// ── Phase Machine ────────────────────────────────────────────────────────────

export async function runCouncil({ task, members = ['claude', 'codex'], models = {}, claudeRole = 'debater', rounds = 3, skipPreflight = false, nonInteractive = false, jsonMode = false }) {
  // CHOREO_TEST_MODELS override: "claude:haiku-4.5,codex:gpt-5.4-nano"
  if (process.env.CHOREO_TEST_MODELS) {
    for (const pair of process.env.CHOREO_TEST_MODELS.split(',')) {
      const [agent, model] = pair.split(':');
      if (agent && model && !models[agent]) models[agent] = model;
    }
  }

  const slug = generateSlug(task);
  const baseDir = join('debates', 'council', slug);
  const rawDir = join(baseDir, 'raw');

  // Check for interrupted council
  const checkpoint = readCheckpoint(slug);
  if (checkpoint && !nonInteractive) {
    console.log(`[council] Found interrupted council: ${slug} (phase ${checkpoint.phase})`);
    console.log(`Resume? (y/n) `);
    // In non-interactive mode, always restart
    // In interactive mode, we'd prompt — for now, restart
  }

  // Create directory structure
  ensureDir(join(rawDir, 'phase-0-preflight'));
  ensureDir(join(rawDir, 'phase-1-opening'));
  ensureDir(join(rawDir, 'phase-3-validation'));

  // Validate members
  const validMembers = members.filter((m) => REGISTRY[m]);
  if (validMembers.length === 0) {
    throw new Error('No valid council members — all specified members are unknown');
  }
  if (validMembers.length < members.length) {
    const skipped = members.filter((m) => !REGISTRY[m]);
    console.error(`[council] Skipping unknown members: ${skipped.join(', ')}`);
  }
  // eslint-disable-next-line no-param-reassign
  members = validMembers;

  // Write topic
  writeFileSync(join(baseDir, 'topic.md'), `# ${task}\n`);

  // Phase 0: Frame
  writeCheckpoint(slug, 'frame', null, members);

  // Phase 0.5: Pre-flight clarifications (skip if requested or non-interactive)
  let clarifications = '';
  if (!skipPreflight && !nonInteractive && members.length > 1) {
    writeCheckpoint(slug, 'preflight', null, members);
    // Collect clarifying questions from non-Claude members
    const questions = [];
    for (const member of members.filter((m) => m !== 'claude')) {
      const invocation = getMemberInvocation(member, '', models[member]);
      if (!invocation) continue;

      const scopingPrompt = `You are about to participate in a structured multi-model debate on: ${task}\n\nList 0 to 3 clarifying questions you would need answered before you can take a strong position. Format as a numbered list. If the topic is complete enough, respond with exactly: NO QUESTIONS.`;

      const result = await invokeMember(member, invocation.binary, scopingPrompt, invocation.args);
      if (result.output && !result.output.includes('NO QUESTIONS')) {
        const qs = result.output.split('\n').filter((l) => l.match(/^\d+\./));
        questions.push(...qs.map((q) => q.replace(/^\d+\.\s*/, '')));
      }
      writeWithFrontmatter(join(rawDir, 'phase-0-preflight', `${member}.md`), member, models[member] || 'default', 'preflight', result.exitCode, result.output);
    }

    if (questions.length > 0) {
      clarifications = `USER CLARIFICATIONS:\n${questions.map((q) => `- Q: ${q}\n  A: user did not specify — use your best judgment`).join('\n')}`;
    }
  }

  // Phase 1: Opening positions (parallel)
  writeCheckpoint(slug, 'opening', null, members);

  const openings = {};
  const openingPromises = members.map(async (member) => {
    const invocation = getMemberInvocation(member, '', models[member]);
    if (!invocation) return;

    const prompt = buildMemberPrompt(member, 'opening', task, clarifications);
    const result = await invokeMember(member, invocation.binary, prompt, invocation.args);
    openings[member] = result.output;

    const model = models[member] || 'default';
    writeWithFrontmatter(join(rawDir, 'phase-1-opening', `${member}.md`), member, model, 'opening', result.exitCode, result.output);

    // Parse structured position (Evolution A)
    const parsed = parseStructuredOutput(result.output, COUNCIL_POSITION_SCHEMA);
    if (parsed) {
      writeFileSync(join(rawDir, 'phase-1-opening', `${member}.json`), JSON.stringify(parsed, null, 2));
    }
  });

  await Promise.all(openingPromises);

  // Phase 2: Rebuttals
  let actualRounds = 0;
  let positions = { ...openings };

  for (let round = 1; round <= rounds; round++) {
    writeCheckpoint(slug, 'rebuttal', round, members);
    actualRounds = round;

    const roundDir = join(rawDir, `phase-2-rebuttal-round-${round}`);
    ensureDir(roundDir);

    const rebuttals = {};
    const rebuttalPromises = members.map(async (member) => {
      const invocation = getMemberInvocation(member, '', models[member]);
      if (!invocation) return;

      const prompt = buildMemberPrompt(member, 'rebuttal', task, clarifications, positions);
      const result = await invokeMember(member, invocation.binary, prompt, invocation.args);
      rebuttals[member] = result.output;

      const model = models[member] || 'default';
      writeWithFrontmatter(join(roundDir, `${member}.md`), member, model, `rebuttal-round-${round}`, result.exitCode, result.output);
    });

    await Promise.all(rebuttalPromises);
    positions = { ...positions, ...rebuttals };

    // Simple convergence check: if all outputs are very similar, stop early
    const outputs = Object.values(rebuttals);
    if (outputs.length >= 2 && outputs.every((o) => o.length > 0 && o.length < 50)) {
      const unique = new Set(outputs.map((o) => o.trim().toLowerCase()));
      if (unique.size === 1) {
        break; // Identical short outputs suggest convergence
      }
    }
  }

  // Phase 3: Synthesis (Evolution G)
  writeCheckpoint(slug, 'synthesis', null, members);

  const synthesisPrompt = [
    `Synthesize the following council debate positions into a single recommendation.\n`,
    `Topic: ${task}\n`,
    ...members.map((m) => `${m.toUpperCase()}'S FINAL POSITION:\n${positions[m]}\n`),
    `\nProduce:\n`,
    `1. Consensus position\n`,
    `2. Key agreements\n`,
    `3. Resolved debates\n`,
    `4. Remaining disagreements (preserve minority views — Evolution E)\n`,
    `5. Confidence: FULL CONSENSUS / PARTIAL CONSENSUS / DEADLOCK`,
  ].join('\n');

  // Claude writes synthesis directly (orchestrator)
  const synthesisInvocation = getMemberInvocation('claude', '', models['claude']);
  let synthesis = '';
  if (synthesisInvocation) {
    const result = await invokeMember('claude', synthesisInvocation.binary, synthesisPrompt, synthesisInvocation.args);
    synthesis = result.output;
  }

  const parsedSynthesis = parseStructuredOutput(synthesis, COUNCIL_SYNTHESIS_SCHEMA);
  const confidence = parsedSynthesis?.confidence || 'PARTIAL CONSENSUS';

  // Validation (parallel for non-Claude members)
  const validations = {};
  const validationPromises = members.filter((m) => m !== 'claude').map(async (member) => {
    const invocation = getMemberInvocation(member, '', models[member]);
    if (!invocation) return;

    const valPrompt = [
      `SYNTHESIS VALIDATION\n\n`,
      `Topic: ${task}\n\n`,
      `SYNTHESIS:\n${synthesis}\n\n`,
      `YOUR LAST POSITION:\n${positions[member]}\n\n`,
      `Rate your agreement: FULL CONSENSUS / PARTIAL CONSENSUS / DEADLOCK`,
    ].join('');

    const result = await invokeMember(member, invocation.binary, valPrompt, invocation.args);
    validations[member] = result.output;

    writeWithFrontmatter(join(rawDir, 'phase-3-validation', `${member}.md`), member, models[member] || 'default', 'validation', result.exitCode, result.output);
  });

  await Promise.all(validationPromises);

  // Phase 4: Write decision
  writeCheckpoint(slug, 'complete', null, members);

  const decision = [
    `# Council Decision: ${task}\n`,
    `### Members`,
    ...members.map((m) => `- ${m}: ${models[m] || 'default'}, role=${m === 'claude' ? claudeRole : 'debater'}`),
    `\n### Consensus Position\n${synthesis || 'No synthesis produced.'}`,
    `\n### Confidence Level\n${confidence}`,
    `\n### Debate Summary`,
    `- Members: ${members.length}`,
    `- Rounds: ${actualRounds}`,
    `- Slug: ${slug}`,
    `\n### Raw Output\nSee debates/council/${slug}/raw/`,
  ].join('\n');

  writeFileSync(join(baseDir, 'decision.md'), decision);
  writeFileSync(join(baseDir, 'decision.json'), JSON.stringify({
    topic: task,
    slug,
    members,
    rounds: actualRounds,
    confidence,
    synthesis: parsedSynthesis || synthesis,
    positions,
    validations,
  }, null, 2));

  // Cleanup tempfiles (Evolution: fix .txt extension bug — clean .txt not .md)
  try {
    const tmp = process.env.TMPDIR || '/tmp';
    const files = readdirSync(tmp).filter((f) => f.startsWith('council-') && f.endsWith('.txt'));
    for (const f of files) {
      const path = join(tmp, f);
      try { require('node:fs').unlinkSync(path); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // Observability
  try {
    emit({
      type: 'council_complete',
      slug,
      members,
      rounds: actualRounds,
      confidence,
    });
  } catch { /* observability must never block */ }

  return { decision, slug, confidence, rounds: actualRounds };
}
