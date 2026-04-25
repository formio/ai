#!/usr/bin/env node
// Form.io project-URL gate.
//
// Fires on SessionStart, CwdChanged, and PreToolUse (Form.io tools only).
// Policy: if the cwd has no entry in ~/.formio/projects.json, tell
// Claude — the first time — to ask the user which project URL to use, then
// call project_set. After project_set runs, the cwd is mapped and subsequent
// calls are silent.
//
// Kept dependency-free (only node:* builtins) to minimize cold-start latency,
// since PreToolUse fires before every Form.io MCP tool call.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BOOTSTRAP_TOOLS = new Set([
  'project_set',
  'authenticate',
  'complete_authentication',
  'hello',
]);

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function readMappedUrl(mapPath, cwd) {
  let raw;
  try {
    raw = readFileSync(mapPath, 'utf8');
  } catch {
    return '';
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return '';
  }
  return parsed?.[cwd]?.env?.FORMIO_PROJECT_URL ?? '';
}

function isBootstrapTool(toolName) {
  if (!toolName) return false;
  const bare = toolName.includes('__') ? toolName.split('__').pop() : toolName;
  return BOOTSTRAP_TOOLS.has(bare);
}

const payload = parsePayload(readStdin());
const event = payload.hook_event_name ?? '';
const toolName = payload.tool_name ?? '';

if (isBootstrapTool(toolName)) {
  process.exit(0);
}

// Each event has exactly one authoritative cwd source. If it's missing, the
// payload is malformed — refuse to guess. A wrong mapping sticks until the
// user notices; a missing one self-heals on the next event.
function resolveCwd() {
  if (event === 'PreToolUse') return payload.tool_input?.cwd;
  if (event === 'CwdChanged' || event === 'SessionStart') return payload.cwd;
  return undefined;
}

const cwd = resolveCwd();
if (!cwd) {
  process.stderr.write(`[formio verify-project-url] no cwd on ${event || 'unknown'} event\n`);
  if (event === 'PreToolUse') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'Form.io project gate: PreToolUse payload is missing tool_input.cwd, so no project mapping can be resolved. Refusing to proceed. Retry with a cwd, or run project_set first.',
        },
      })
    );
    process.exit(0);
  }
  process.exit(0);
}

const mapPath = join(homedir(), '.formio', 'projects.json');
if (readMappedUrl(mapPath, cwd)) {
  process.exit(0);
}
// this env var is defined by the hooks; it doesn't exist in the MCP server
const defaultUrl = process.env.FORMIO_DEFAULT_PROJECT_URL ?? '';
const rule =
  '~/.formio/projects.json is owned by project_set; never write it by hand (no Write/Edit/heredoc/jq). If project_set fails, surface the error — do not work around it.';
const reason = defaultUrl
  ? `No project mapped for ${cwd}. AskUserQuestion: 'Use default (${defaultUrl})' or 'Other'. Then project_set({ cwd, projectUrl }), then retry. ${rule}`
  : `No project mapped for ${cwd}. AskUserQuestion for URL, then project_set({ cwd, projectUrl }), then retry. ${rule}`;

const output =
  event === 'PreToolUse'
    ? {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
      }
    : {
        hookSpecificOutput: {
          hookEventName: event,
          additionalContext: reason,
        },
      };

process.stdout.write(JSON.stringify(output));
