// core/companion.mjs
import { spawnSync as spawnSync2 } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// core/parsers.mjs
function parseClaudeStreamJson(raw) {
  const text = raw.split("\n").filter((l) => l.trim()).flatMap((l) => {
    try {
      const d = JSON.parse(l);
      if (d.type !== "assistant") return [];
      return (d.message?.content ?? []).filter((c) => c.type === "text").map((c) => c.text);
    } catch (e) {
      process.stderr.write(`[choreo:parse-warn] ${e.message}
`);
      return [];
    }
  }).join("");
  return text.trim() || raw.trim();
}
var ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, "g");
function parseOpenCodeOutput(raw) {
  return raw.replace(ANSI_RE, "").split("\n").filter((l) => l.trim()).join("\n").trim() || raw.trim();
}

// core/runners.mjs
import { spawn, spawnSync } from "node:child_process";
var REGISTRY = {
  claude: { binary: "claude", setup: "/choreo:claude" },
  codex: { binary: "codex", setup: "/choreo:codex" },
  opencode: { binary: "opencode", setup: "/choreo:opencode" }
};
var CLI_CHECK_TIMEOUT_MS = 5e3;
var AGENT_TIMEOUT_MS = 5 * 6e4;
var ENV_ALLOW_EXACT = /* @__PURE__ */ new Set([
  // Locale + shell basics.
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TERM",
  "TZ",
  "TMPDIR",
  "LANG",
  "PWD",
  "NO_COLOR",
  "FORCE_COLOR",
  // Node runtime knobs that affect tool behavior predictably.
  "NODE_OPTIONS",
  "NODE_ENV",
  // Anthropic / Claude CLI direct-API keys (read by `claude`).
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_VERTEX_PROJECT_ID",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  // OpenAI / Codex CLI direct-API keys.
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  // Choreo configuration so tests + ops signals flow to the child.
  "CHOREO_LOG_DIR",
  "CHOREO_LOG_MAX_BYTES",
  "CHOREO_AGENT_ENV_PASSTHROUGH"
]);
var ENV_ALLOW_PREFIXES = [
  "LC_",
  "XDG_",
  "ANTHROPIC_",
  "CLAUDE_",
  "OPENCODE_",
  "CODEX_"
];
function buildAgentEnv(src = process.env) {
  if (src.CHOREO_AGENT_ENV_PASSTHROUGH === "1") return { ...src };
  const out = /* @__PURE__ */ Object.create(null);
  for (const [key, value] of Object.entries(src)) {
    if (ENV_ALLOW_EXACT.has(key) || ENV_ALLOW_PREFIXES.some((p) => key.startsWith(p))) {
      out[key] = value;
    }
  }
  return out;
}
function checkCli(binary) {
  const r = spawnSync(binary, ["--version"], { encoding: "utf8", timeout: CLI_CHECK_TIMEOUT_MS });
  if (r.error?.code === "ENOENT") return { status: "not-installed", version: "" };
  if (r.error || r.status !== 0) return { status: "unavailable", version: "" };
  return { status: "ok", version: r.stdout.trim() };
}
function filterAvailable(agents) {
  const available = [];
  const missing = [];
  for (const a of agents) {
    const { status } = checkCli(a.binary);
    status === "ok" ? available.push(a) : missing.push({ ...a, reason: status });
  }
  return { available, missing };
}
function printMissingWarning(missing) {
  if (missing.length === 0) return;
  console.error(`
\u26A0 Skipped agents:`);
  for (const a of missing) {
    if (a.reason === "not-installed") {
      console.error(`  \u2717 ${a.name} \u2014 not installed. Run: ${REGISTRY[a.name]?.setup ?? `/${a.name}:setup`}`);
    } else {
      console.error(`  \u2717 ${a.name} \u2014 unavailable (failed --version check). Check your installation.`);
    }
  }
}
function stripFlags(args) {
  const result = [];
  let skipNext = false;
  for (const a of args) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (a === "--background" || a === "--wait" || a === "--json") continue;
    if (a === "--agent") {
      skipNext = true;
      continue;
    }
    if (a.startsWith("--agent=")) continue;
    result.push(a);
  }
  return result;
}
function runAgent(name, binary, args, parse = (s) => s) {
  return new Promise((resolve) => {
    const out = [];
    const err = [];
    const proc = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], env: buildAgentEnv() });
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({ name, output: "", error: `agent timed out after ${AGENT_TIMEOUT_MS / 1e3}s`, code: 1 });
    }, AGENT_TIMEOUT_MS);
    proc.stdout.on("data", (d) => out.push(d));
    proc.stderr.on("data", (d) => err.push(d));
    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        name,
        output: parse(Buffer.concat(out).toString()).trim(),
        error: Buffer.concat(err).toString().trim(),
        code: code ?? (signal ? 1 : 0)
      });
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      resolve({ name, output: "", error: e.message, code: 1 });
    });
  });
}
function printDelimited(results) {
  for (const r of results) {
    console.log(`
${"\u2550".repeat(60)}`);
    console.log(`AGENT: ${r.name.toUpperCase()}`);
    console.log("\u2550".repeat(60));
    if (r.code !== 0 && !r.output) {
      console.log(`[error \u2014 exit ${r.code}]`);
      if (r.error) console.log(r.error);
    } else {
      console.log(r.output || r.error || "[no output]");
    }
  }
  console.log(`
${"\u2550".repeat(60)}`);
}
function printJSON(command, results) {
  console.log(JSON.stringify({
    command,
    results: results.map((r) => ({ name: r.name, output: r.output, error: r.error, exitCode: r.code }))
  }));
}
function requireAvailable(agents, min = 2) {
  const { available, missing } = filterAvailable(agents);
  printMissingWarning(missing);
  if (available.length < min) {
    throw new Error(
      `Not enough agents available (need at least ${min}, got ${available.length}).` + (missing.length ? ` Install the missing agents listed above.` : "")
    );
  }
  return available;
}

// core/observability.mjs
import { mkdirSync, appendFileSync, renameSync, readdirSync, statSync, unlinkSync, existsSync, readFileSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
var DEFAULT_MAX_BYTES_PER_DAY = 100 * 1024 * 1024;
var RETENTION_DAYS = 7;
var LOG_NAME_RE = /^(\d{4}-\d{2}-\d{2})\.ndjson(?:\.(\d+))?$/;
function logDir() {
  return process.env.CHOREO_LOG_DIR || join(homedir(), ".choreo", "logs");
}
function maxBytesPerDay() {
  const env = process.env.CHOREO_LOG_MAX_BYTES;
  if (env !== void 0) {
    const trimmed = env.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return DEFAULT_MAX_BYTES_PER_DAY;
}
function ensureDir() {
  const dir = logDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function dateKey() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function listLogFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const m = LOG_NAME_RE.exec(name);
    if (!m) continue;
    out.push({ name, date: m[1], seq: m[2] ? parseInt(m[2], 10) : 0 });
  }
  return out;
}
function nextBackupSeq(dir, dateStr) {
  const files = listLogFiles(dir).filter((f) => f.date === dateStr && f.seq > 0);
  return files.reduce((max, f) => Math.max(max, f.seq), 0) + 1;
}
var rotatedThisProcess = false;
process.on("SIGUSR1", () => {
  try {
    rotate();
  } catch {
  }
});
function emit(event) {
  const entry = { timestamp: (/* @__PURE__ */ new Date()).toISOString(), ...event };
  const line = JSON.stringify(entry) + "\n";
  const dir = logDir();
  ensureDir();
  if (!rotatedThisProcess) {
    try {
      rotate();
    } catch {
    }
    rotatedThisProcess = true;
  }
  const today = dateKey();
  const file = join(dir, `${today}.ndjson`);
  const cap = maxBytesPerDay();
  let curSize = 0;
  try {
    curSize = statSync(file).size;
  } catch {
  }
  if (curSize >= cap) {
    let seq = nextBackupSeq(dir, today);
    let rotatedName;
    let reserved = false;
    for (let tries = 0; tries < 20; tries++) {
      rotatedName = join(dir, `${today}.ndjson.${seq}`);
      try {
        const fd = openSync(rotatedName, "wx");
        closeSync(fd);
        reserved = true;
        break;
      } catch {
        seq++;
      }
    }
    if (!reserved) {
      throw new Error(`choreo observability: could not reserve backup name after 20 attempts in ${dir}`);
    }
    try {
      renameSync(file, rotatedName);
    } catch (e) {
      try {
        unlinkSync(rotatedName);
      } catch {
      }
      if (!(e && e.code === "ENOENT")) throw e;
    }
  }
  appendFileSync(file, line, "utf8");
}
function rotate() {
  const dir = logDir();
  if (!existsSync(dir)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1e3;
  for (const f of listLogFiles(dir)) {
    const fullPath = join(dir, f.name);
    let st;
    try {
      st = statSync(fullPath);
    } catch {
      continue;
    }
    if (st.mtimeMs < cutoff) {
      try {
        unlinkSync(fullPath);
      } catch {
      }
    }
  }
}

// core/companion.mjs
function describeTask(task) {
  return {
    task_hash: createHash("sha256").update(task, "utf8").digest("hex").slice(0, 16),
    task_length: task.length
  };
}
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , cmd, ...rest] = process.argv;
  process.on("unhandledRejection", (err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
  if (cmd === "check-all") {
    let ok = true;
    for (const [name, { binary, setup }] of Object.entries(REGISTRY)) {
      const { status, version } = checkCli(binary);
      if (status === "ok") {
        console.log(`\u2713 ${name}: ${version}`);
      } else if (status === "not-installed") {
        console.error(`\u2717 ${name} not installed. Run ${setup}`);
        ok = false;
      } else {
        console.error(`\u2717 ${name} unavailable (failed --version check). Check your installation.`);
        ok = false;
      }
    }
    process.exit(ok ? 0 : 1);
  }
  if (cmd === "agent") {
    let jsonMode = false;
    let nameEquals, modelEquals, effortEquals;
    const taskTokens = [];
    let afterDashDash = false;
    for (const a of rest) {
      if (afterDashDash) {
        taskTokens.push(a);
        continue;
      }
      if (a === "--") {
        afterDashDash = true;
        continue;
      }
      if (a === "--json") {
        jsonMode = true;
        continue;
      }
      if (a.startsWith("--name=")) {
        nameEquals = a.slice("--name=".length);
        continue;
      }
      if (a.startsWith("--model=")) {
        modelEquals = a.slice("--model=".length);
        continue;
      }
      if (a.startsWith("--effort=")) {
        effortEquals = a.slice("--effort=".length);
        continue;
      }
      taskTokens.push(a);
    }
    const task = taskTokens.join(" ").trim();
    if (!nameEquals) {
      console.error("Usage: companion.mjs agent --name=<claude|codex|opencode> [--model=...] [--effort=...] <task>");
      process.exit(1);
    }
    if (!task) {
      console.error("Usage: companion.mjs agent --name=<claude|codex|opencode> [--model=...] [--effort=...] <task>");
      process.exit(1);
    }
    const name = nameEquals;
    const entry = REGISTRY[name];
    if (!entry) {
      console.error(`Unknown agent: "${name}". Choose from: ${Object.keys(REGISTRY).join(", ")}`);
      process.exit(1);
    }
    const { status } = checkCli(entry.binary);
    if (status !== "ok") {
      console.error(`Agent "${name}" is not installed. Run: ${entry.setup}`);
      process.exit(1);
    }
    let args;
    let parse = (s) => s;
    switch (name) {
      case "claude": {
        const claudeArgs = ["--print", "--output-format", "stream-json", "--verbose", task, "--dangerously-skip-permissions"];
        if (modelEquals) claudeArgs.splice(0, 0, "--model", modelEquals);
        args = claudeArgs;
        parse = parseClaudeStreamJson;
        break;
      }
      case "codex": {
        const codexArgs = ["exec", task];
        if (effortEquals) codexArgs.splice(0, 0, "--effort", effortEquals);
        if (modelEquals) codexArgs.splice(0, 0, "--model", modelEquals);
        args = codexArgs;
        break;
      }
      case "opencode": {
        const opencodeArgs = ["run", task, "--dangerously-skip-permissions"];
        if (modelEquals) opencodeArgs.splice(1, 0, "--model", modelEquals);
        args = opencodeArgs;
        parse = parseOpenCodeOutput;
        break;
      }
      default:
        console.error(`Agent "${name}" not supported in Ship 1.`);
        process.exit(1);
    }
    try {
      emit({
        type: "agent_invocation",
        name,
        model: modelEquals,
        effort: effortEquals,
        ...describeTask(task)
      });
    } catch {
    }
    const result = await runAgent(name, entry.binary, args, parse);
    if (jsonMode) {
      printJSON("agent", [result]);
    } else {
      console.log(`
${"\u2550".repeat(60)}`);
      console.log(`AGENT: ${result.name.toUpperCase()}`);
      console.log("\u2550".repeat(60));
      if (result.code !== 0 && !result.output) {
        console.log(`[error \u2014 exit ${result.code}]`);
        if (result.error) console.log(result.error);
      } else {
        console.log(result.output || result.error || "[no output]");
      }
      console.log(`
${"\u2550".repeat(60)}`);
    }
    try {
      emit({
        type: "agent_completion",
        name,
        exitCode: result.code,
        hasError: !!result.error
      });
    } catch {
    }
    const exitCode = typeof result.code === "number" ? result.code : 1;
    await new Promise((resolve) => process.stdout.write("", resolve));
    process.exit(exitCode);
  }
  if (cmd === "council") {
    const jsonMode = rest.includes("--json");
    const task = stripFlags(rest).join(" ").trim();
    if (!task) {
      console.error("Usage: companion.mjs council <task>");
      process.exit(1);
    }
    const agents = [
      {
        name: "claude",
        binary: REGISTRY.claude.binary,
        args: [
          "--print",
          "--output-format",
          "stream-json",
          "--verbose",
          `You are the CORRECTNESS reviewer in an LLM council.
Focus on: logic errors, type safety, off-by-one bugs, unhandled edge cases, security issues.
Be concise \u2014 bullet points preferred.

Task: ${task}`,
          "--dangerously-skip-permissions"
        ],
        parse: parseClaudeStreamJson
      },
      {
        name: "codex",
        binary: REGISTRY.codex.binary,
        args: [
          "exec",
          `You are the SCOPE reviewer in an LLM council.
Focus on: unnecessary complexity, premature abstractions, whether the smallest solution was chosen.
Be concise \u2014 bullet points preferred.

Task: ${task}`
        ]
      },
      {
        name: "opencode",
        binary: REGISTRY.opencode.binary,
        args: [
          "run",
          `You are the INTEGRATION reviewer in an LLM council.
Focus on: how this fits with existing codebase patterns, dependency implications, integration risks.
Be concise \u2014 bullet points preferred.

Task: ${task}`,
          "--dangerously-skip-permissions"
        ],
        parse: parseOpenCodeOutput
      }
    ];
    let available;
    try {
      available = requireAvailable(agents, 2);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const results = await Promise.all(available.map((a) => runAgent(a.name, a.binary, a.args, a.parse)));
    jsonMode ? printJSON("council", results) : printDelimited(results);
  }
  if (cmd === "review") {
    const jsonMode = rest.includes("--json");
    const gitResult = spawnSync2("git", ["diff", "HEAD"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    if (gitResult.error || gitResult.status !== 0) {
      const msg = gitResult.stderr?.trim() || gitResult.error?.message || `exit ${gitResult.status}`;
      console.error(`Failed to get git diff: ${msg}`);
      process.exit(1);
    }
    const diff = gitResult.stdout?.trim() || "No uncommitted changes found.";
    const agents = [
      {
        name: "claude",
        binary: REGISTRY.claude.binary,
        args: [
          "--print",
          "--output-format",
          "stream-json",
          "--verbose",
          `Review the following code changes for CORRECTNESS AND SECURITY.
Focus on: bugs, logic errors, security vulnerabilities, unsafe patterns.
Be concise \u2014 numbered findings.

${diff}`,
          "--dangerously-skip-permissions"
        ],
        parse: parseClaudeStreamJson
      },
      {
        name: "codex",
        binary: REGISTRY.codex.binary,
        args: [
          "exec",
          `Review the following code changes for SCOPE AND SIMPLICITY.
Focus on: unnecessary complexity, changes that exceed the stated goal, simpler alternatives.
Be concise \u2014 numbered findings.

${diff}`
        ]
      },
      {
        name: "opencode",
        binary: REGISTRY.opencode.binary,
        args: [
          "run",
          `Review the following code changes for EDGE CASES AND ROBUSTNESS.
Focus on: unhandled inputs, missing error handling, race conditions, what the author missed.
Be concise \u2014 numbered findings.

${diff}`,
          "--dangerously-skip-permissions"
        ],
        parse: parseOpenCodeOutput
      }
    ];
    let available;
    try {
      available = requireAvailable(agents, 2);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const results = await Promise.all(available.map((a) => runAgent(a.name, a.binary, a.args, a.parse)));
    jsonMode ? printJSON("review", results) : printDelimited(results);
  }
  if (cmd === "debug") {
    const jsonMode = rest.includes("--json");
    const symptom = stripFlags(rest).join(" ").trim();
    if (!symptom) {
      console.error("Usage: companion.mjs debug <symptom>");
      process.exit(1);
    }
    const prompt = (focus) => `A software bug has been reported. Generate a ranked list of hypotheses for the root cause.
Focus area: ${focus}.
Format: numbered list, most likely first, one sentence per hypothesis.

Symptom: ${symptom}`;
    const agents = [
      {
        name: "claude",
        binary: REGISTRY.claude.binary,
        args: ["--print", "--output-format", "stream-json", "--verbose", prompt("application logic, state management, data flow"), "--dangerously-skip-permissions"],
        parse: parseClaudeStreamJson
      },
      {
        name: "codex",
        binary: REGISTRY.codex.binary,
        args: ["exec", prompt("edge cases in input handling, off-by-one errors, type coercion")]
      },
      {
        name: "opencode",
        binary: REGISTRY.opencode.binary,
        args: [
          "run",
          prompt("infrastructure, concurrency, external dependencies, environment"),
          "--dangerously-skip-permissions"
        ],
        parse: parseOpenCodeOutput
      }
    ];
    let available;
    try {
      available = requireAvailable(agents, 2);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const results = await Promise.all(available.map((a) => runAgent(a.name, a.binary, a.args, a.parse)));
    jsonMode ? printJSON("debug", results) : printDelimited(results);
  }
  if (cmd === "second-opinion") {
    const jsonMode = rest.includes("--json");
    const agentEqualsFlag = rest.find((a) => a.startsWith("--agent="))?.split("=")[1];
    const agentIndex = rest.indexOf("--agent");
    const agentNextValue = agentIndex !== -1 && rest[agentIndex + 1] && !rest[agentIndex + 1].startsWith("--") ? rest[agentIndex + 1] : void 0;
    const requestedAgent = agentEqualsFlag || agentNextValue || void 0;
    const task = stripFlags(rest).join(" ").trim();
    if (!task) {
      console.error("Usage: companion.mjs second-opinion [--agent claude|codex|opencode] <decision or approach>");
      process.exit(1);
    }
    const prompt = `Give a concise second opinion on the following decision or approach.
Be direct: state what you agree with, what concerns you, and your overall verdict (approve / approve-with-caveats / reject).

${task}`;
    const agentDefs = {
      claude: { binary: REGISTRY.claude.binary, run: () => runAgent("claude", REGISTRY.claude.binary, ["--print", "--output-format", "stream-json", "--verbose", prompt, "--dangerously-skip-permissions"], parseClaudeStreamJson) },
      codex: { binary: REGISTRY.codex.binary, run: () => runAgent("codex", REGISTRY.codex.binary, ["exec", prompt]) },
      opencode: { binary: REGISTRY.opencode.binary, run: () => runAgent("opencode", REGISTRY.opencode.binary, ["run", prompt, "--dangerously-skip-permissions"], parseOpenCodeOutput) }
    };
    if (requestedAgent && !agentDefs[requestedAgent]) {
      console.error(`Unknown agent: "${requestedAgent}". Choose from: ${Object.keys(agentDefs).join(", ")}`);
      process.exit(1);
    }
    const defaultOrder = ["claude", "codex", "opencode"];
    let chosenAgent = requestedAgent ?? "claude";
    if (checkCli(agentDefs[chosenAgent].binary).status !== "ok") {
      const fallback = (requestedAgent ? Object.keys(agentDefs) : defaultOrder).find((n) => n !== chosenAgent && checkCli(agentDefs[n].binary).status === "ok");
      if (!fallback) {
        console.error(`Agent "${chosenAgent}" not found and no alternatives are available.`);
        console.error(`Install at least one agent: ${Object.keys(agentDefs).map((n) => `${REGISTRY[n].setup}`).join(", ")}`);
        process.exit(1);
      }
      console.error(`\u26A0 Agent "${chosenAgent}" not found \u2014 using "${fallback}" instead.`);
      if (requestedAgent) {
        console.error(`  Install ${chosenAgent}: ${REGISTRY[chosenAgent].setup}`);
      }
      chosenAgent = fallback;
    }
    const result = await agentDefs[chosenAgent].run();
    if (jsonMode) {
      printJSON("second-opinion", [result]);
    } else {
      console.log(`
${"\u2550".repeat(60)}`);
      console.log(`SECOND OPINION: ${result.name.toUpperCase()}`);
      console.log("\u2550".repeat(60));
      console.log(result.output || result.error || "[no output]");
      console.log(`
${"\u2550".repeat(60)}`);
    }
  }
  if (cmd === "vote") {
    let parseVote = function(text) {
      const line = (text || "").split("\n").find((l) => l.trim().length > 0) || "";
      const clean = line.replace(/[*_`]/g, "").trim().toUpperCase();
      if (/^YES\b/.test(clean)) return { vote: "YES", rationale: line.replace(/^yes[^a-z]*/i, "").trim() };
      if (/^NO\b/.test(clean)) return { vote: "NO", rationale: line.replace(/^no[^a-z]*/i, "").trim() };
      if (/^ABSTAIN\b/.test(clean)) return { vote: "ABSTAIN", rationale: line.replace(/^abstain[^a-z]*/i, "").trim() };
      return { vote: "INVALID", rationale: line };
    };
    const jsonMode = rest.includes("--json");
    const task = stripFlags(rest).join(" ").trim();
    if (!task) {
      console.error("Usage: companion.mjs vote <proposition>");
      process.exit(1);
    }
    const prompt = `Vote on the following proposition. Reply with a single line starting with YES, NO, or ABSTAIN (uppercase), followed by one sentence of rationale. No other text.

Proposition: ${task}`;
    const agents = [
      {
        name: "claude",
        binary: REGISTRY.claude.binary,
        args: ["--print", "--output-format", "stream-json", "--verbose", prompt, "--dangerously-skip-permissions"],
        parse: parseClaudeStreamJson
      },
      {
        name: "codex",
        binary: REGISTRY.codex.binary,
        args: ["exec", prompt]
      },
      {
        name: "opencode",
        binary: REGISTRY.opencode.binary,
        args: ["run", prompt, "--dangerously-skip-permissions"],
        parse: parseOpenCodeOutput
      }
    ];
    let available;
    try {
      available = requireAvailable(agents, 2);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
    const results = await Promise.all(available.map((a) => runAgent(a.name, a.binary, a.args, a.parse)));
    const tally = { yes: 0, no: 0, abstain: 0, invalid: 0 };
    const parsed = results.map((r) => {
      const { vote, rationale } = parseVote(r.output);
      tally[vote.toLowerCase()]++;
      return { name: r.name, vote, rationale, output: r.output, error: r.error, exitCode: r.code };
    });
    if (tally.invalid === parsed.length) {
      const msg = "All agent votes were INVALID \u2014 no valid tally produced.";
      if (jsonMode) {
        console.log(JSON.stringify({ command: "vote", error: msg, tally, results: parsed }));
      } else {
        console.error(msg);
      }
      process.exit(1);
    }
    if (jsonMode) {
      console.log(JSON.stringify({ command: "vote", tally, results: parsed }));
    } else {
      const tallyLines = [
        `| Vote    | Count |`,
        `|---------|-------|`,
        `| YES     | ${tally.yes}     |`,
        `| NO      | ${tally.no}     |`,
        `| ABSTAIN | ${tally.abstain}     |`,
        tally.invalid > 0 ? `| INVALID | ${tally.invalid}     |` : null
      ].filter(Boolean).join("\n");
      console.log("\n## Vote Tally\n");
      console.log(tallyLines);
      console.log("\n## Per-Agent Rationale\n");
      for (const r of parsed) {
        console.log(`
${"\u2550".repeat(60)}`);
        console.log(`${r.name.toUpperCase()}: ${r.vote}`);
        console.log("\u2550".repeat(60));
        console.log(r.rationale || r.output || "[no output]");
      }
      console.log(`
${"\u2550".repeat(60)}`);
    }
  }
  const known = ["check-all", "agent", "council", "review", "debug", "second-opinion", "vote"];
  if (!cmd || !known.includes(cmd)) {
    if (cmd) console.error(`Unknown command: "${cmd}"`);
    console.error("Usage: companion.mjs <check-all|agent|council|review|debug|second-opinion|vote> [args...]");
    process.exit(1);
  }
}
export {
  REGISTRY,
  checkCli,
  filterAvailable,
  parseClaudeStreamJson,
  parseOpenCodeOutput,
  printDelimited,
  printJSON,
  printMissingWarning,
  requireAvailable,
  runAgent,
  stripFlags
};
