/**
 * Git context collection for adversarial review.
 *
 * Ported from the external plugin's git.mjs with simplified dependencies.
 * Collects working-tree or branch diff context for review agents.
 */

import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_UNTRACKED_BYTES = 24 * 1024;
const DEFAULT_INLINE_DIFF_MAX_FILES = 2;
const DEFAULT_INLINE_DIFF_MAX_BYTES = 256 * 1024;

function git(cwd, args, options = {}) {
  try {
    const stdout = execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf8',
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
    });
    return { status: 0, stdout };
  } catch (err) {
    return {
      status: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      error: err,
    };
  }
}

function gitChecked(cwd, args, options = {}) {
  const result = git(cwd, args, options);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr?.trim() || 'exit ' + result.status}`);
  }
  return result;
}

function isProbablyText(buffer) {
  const sample = buffer.slice(0, 8192);
  let nullCount = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) nullCount++;
  }
  return nullCount / sample.length < 0.1;
}

function formatSection(title, body) {
  return [`## ${title}`, '', body.trim() ? body.trim() : '(none)', ''].join('\n');
}

function formatUntrackedFile(cwd, relativePath) {
  const absolutePath = join(cwd, relativePath);
  let stat;
  try {
    stat = statSync(absolutePath);
  } catch {
    return `### ${relativePath}\n(skipped: broken symlink or unreadable file)`;
  }
  if (stat.isDirectory()) {
    return `### ${relativePath}\n(skipped: directory)`;
  }
  if (stat.size > MAX_UNTRACKED_BYTES) {
    return `### ${relativePath}\n(skipped: ${stat.size} bytes exceeds ${MAX_UNTRACKED_BYTES} byte limit)`;
  }

  let buffer;
  try {
    buffer = readFileSync(absolutePath);
  } catch {
    return `### ${relativePath}\n(skipped: broken symlink or unreadable file)`;
  }
  if (!isProbablyText(buffer)) {
    return `### ${relativePath}\n(skipped: binary file)`;
  }

  return [`### ${relativePath}`, '```', buffer.toString('utf8').trimEnd(), '```'].join('\n');
}

export function getRepoRoot(cwd) {
  return gitChecked(cwd, ['rev-parse', '--show-toplevel']).stdout.trim();
}

export function getCurrentBranch(cwd) {
  return gitChecked(cwd, ['branch', '--show-current']).stdout.trim() || 'HEAD';
}

export function detectDefaultBranch(cwd) {
  const symbolic = git(cwd, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
  if (symbolic.status === 0) {
    const remoteHead = symbolic.stdout.trim();
    if (remoteHead.startsWith('refs/remotes/origin/')) {
      return remoteHead.replace('refs/remotes/origin/', '');
    }
  }

  const candidates = ['main', 'master', 'trunk'];
  for (const candidate of candidates) {
    const local = git(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${candidate}`]);
    if (local.status === 0) return candidate;
    const remote = git(cwd, ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${candidate}`]);
    if (remote.status === 0) return `origin/${candidate}`;
  }

  throw new Error('Unable to detect the repository default branch. Pass --base <ref> or use --scope working-tree.');
}

export function getWorkingTreeState(cwd) {
  const staged = gitChecked(cwd, ['diff', '--cached', '--name-only']).stdout.trim().split('\n').filter(Boolean);
  const unstaged = gitChecked(cwd, ['diff', '--name-only']).stdout.trim().split('\n').filter(Boolean);
  const untracked = gitChecked(cwd, ['ls-files', '--others', '--exclude-standard']).stdout.trim().split('\n').filter(Boolean);

  return {
    staged,
    unstaged,
    untracked,
    isDirty: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
  };
}

export function resolveReviewTarget(cwd, options = {}) {
  getRepoRoot(cwd);

  const requestedScope = options.scope ?? 'auto';
  const baseRef = options.base ?? null;
  const state = getWorkingTreeState(cwd);
  const supportedScopes = new Set(['auto', 'working-tree', 'branch']);

  if (baseRef) {
    return { mode: 'branch', label: `branch diff against ${baseRef}`, baseRef, explicit: true };
  }

  if (requestedScope === 'working-tree') {
    return { mode: 'working-tree', label: 'working tree diff', explicit: true };
  }

  if (!supportedScopes.has(requestedScope)) {
    throw new Error(`Unsupported review scope "${requestedScope}". Use one of: auto, working-tree, branch, or pass --base <ref>.`);
  }

  if (requestedScope === 'branch') {
    const detectedBase = detectDefaultBranch(cwd);
    return { mode: 'branch', label: `branch diff against ${detectedBase}`, baseRef: detectedBase, explicit: true };
  }

  if (state.isDirty) {
    return { mode: 'working-tree', label: 'working tree diff', explicit: false };
  }

  const detectedBase = detectDefaultBranch(cwd);
  return { mode: 'branch', label: `branch diff against ${detectedBase}`, baseRef: detectedBase, explicit: false };
}

function collectWorkingTreeContext(cwd, state, options = {}) {
  const includeDiff = options.includeDiff !== false;
  const status = gitChecked(cwd, ['status', '--short', '--untracked-files=all']).stdout.trim();
  const changedFiles = [...new Set([...state.staged, ...state.unstaged, ...state.untracked].filter(Boolean))].sort();

  let parts;
  if (includeDiff) {
    const stagedDiff = gitChecked(cwd, ['diff', '--cached', '--no-ext-diff', '--submodule=diff']).stdout;
    const unstagedDiff = gitChecked(cwd, ['diff', '--no-ext-diff', '--submodule=diff']).stdout;
    const untrackedBody = state.untracked.map((file) => formatUntrackedFile(cwd, file)).join('\n\n');
    parts = [
      formatSection('Git Status', status),
      formatSection('Staged Diff', stagedDiff),
      formatSection('Unstaged Diff', unstagedDiff),
      formatSection('Untracked Files', untrackedBody),
    ];
  } else {
    const stagedStat = gitChecked(cwd, ['diff', '--shortstat', '--cached']).stdout.trim();
    const unstagedStat = gitChecked(cwd, ['diff', '--shortstat']).stdout.trim();
    const untrackedBody = state.untracked.map((file) => formatUntrackedFile(cwd, file)).join('\n\n');
    parts = [
      formatSection('Git Status', status),
      formatSection('Staged Diff Stat', stagedStat),
      formatSection('Unstaged Diff Stat', unstagedStat),
      formatSection('Changed Files', changedFiles.join('\n')),
      formatSection('Untracked Files', untrackedBody),
    ];
  }

  return {
    mode: 'working-tree',
    summary: `Reviewing ${state.staged.length} staged, ${state.unstaged.length} unstaged, and ${state.untracked.length} untracked file(s).`,
    content: parts.join('\n'),
    changedFiles,
  };
}

function collectBranchContext(cwd, baseRef, options = {}) {
  const includeDiff = options.includeDiff !== false;
  const mergeBase = gitChecked(cwd, ['merge-base', 'HEAD', baseRef]).stdout.trim();
  const commitRange = `${mergeBase}..HEAD`;
  const currentBranch = getCurrentBranch(cwd);
  const changedFiles = gitChecked(cwd, ['diff', '--name-only', commitRange]).stdout.trim().split('\n').filter(Boolean);
  const logOutput = gitChecked(cwd, ['log', '--oneline', '--decorate', commitRange]).stdout.trim();
  const diffStat = gitChecked(cwd, ['diff', '--stat', commitRange]).stdout.trim();

  return {
    mode: 'branch',
    summary: `Reviewing branch ${currentBranch} against ${baseRef} from merge-base ${mergeBase}.`,
    content: includeDiff
      ? [
          formatSection('Commit Log', logOutput),
          formatSection('Diff Stat', diffStat),
          formatSection('Branch Diff', gitChecked(cwd, ['diff', '--no-ext-diff', '--submodule=diff', commitRange]).stdout),
        ].join('\n')
      : [
          formatSection('Commit Log', logOutput),
          formatSection('Diff Stat', diffStat),
          formatSection('Changed Files', changedFiles.join('\n')),
        ].join('\n'),
    changedFiles,
    comparison: { mergeBase, commitRange, reviewRange: `${baseRef}...HEAD` },
  };
}

function buildAdversarialCollectionGuidance(options = {}) {
  if (options.includeDiff !== false) {
    return 'Use the repository context below as primary evidence.';
  }
  return 'The repository context below is a lightweight summary. Inspect the target diff yourself with read-only git commands before finalizing findings.';
}

function measureGitOutputBytes(cwd, args, maxBytes) {
  const result = git(cwd, args, { maxBuffer: maxBytes + 1 });
  if (result.error && result.error.code === 'ENOBUFS') return maxBytes + 1;
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr?.trim() || 'exit ' + result.status}`);
  return Buffer.byteLength(result.stdout, 'utf8');
}

export function collectReviewContext(cwd, target, options = {}) {
  const repoRoot = getRepoRoot(cwd);
  const currentBranch = getCurrentBranch(repoRoot);
  const maxInlineFiles = Number.isFinite(options.maxInlineFiles) && options.maxInlineFiles >= 0
    ? Math.floor(options.maxInlineFiles)
    : DEFAULT_INLINE_DIFF_MAX_FILES;
  const maxInlineDiffBytes = Number.isFinite(options.maxInlineDiffBytes) && options.maxInlineDiffBytes >= 0
    ? Math.floor(options.maxInlineDiffBytes)
    : DEFAULT_INLINE_DIFF_MAX_BYTES;

  let details;
  let includeDiff;
  let diffBytes;

  if (target.mode === 'working-tree') {
    const state = getWorkingTreeState(repoRoot);
    const stagedBytes = measureGitOutputBytes(repoRoot, ['diff', '--cached', '--no-ext-diff', '--submodule=diff'], maxInlineDiffBytes);
    const unstagedBytes = measureGitOutputBytes(repoRoot, ['diff', '--no-ext-diff', '--submodule=diff'], Math.max(0, maxInlineDiffBytes - stagedBytes));
    diffBytes = stagedBytes + unstagedBytes;
    includeDiff = options.includeDiff ?? (
      [...state.staged, ...state.unstaged, ...state.untracked].filter(Boolean).length <= maxInlineFiles &&
      diffBytes <= maxInlineDiffBytes
    );
    details = collectWorkingTreeContext(repoRoot, state, { includeDiff });
  } else {
    const mergeBase = gitChecked(repoRoot, ['merge-base', 'HEAD', target.baseRef]).stdout.trim();
    const commitRange = `${mergeBase}..HEAD`;
    const fileCount = gitChecked(repoRoot, ['diff', '--name-only', commitRange]).stdout.trim().split('\n').filter(Boolean).length;
    diffBytes = measureGitOutputBytes(repoRoot, ['diff', '--no-ext-diff', '--submodule=diff', commitRange], maxInlineDiffBytes);
    includeDiff = options.includeDiff ?? (fileCount <= maxInlineFiles && diffBytes <= maxInlineDiffBytes);
    details = collectBranchContext(repoRoot, target.baseRef, { includeDiff, comparison: { mergeBase, commitRange } });
  }

  return {
    cwd: repoRoot,
    repoRoot,
    branch: currentBranch,
    target,
    fileCount: details.changedFiles.length,
    diffBytes,
    inputMode: includeDiff ? 'inline-diff' : 'self-collect',
    collectionGuidance: buildAdversarialCollectionGuidance({ includeDiff }),
    ...details,
  };
}
