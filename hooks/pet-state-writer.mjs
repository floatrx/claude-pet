#!/usr/bin/env node

/**
 * Claude Code hook — writes session state to ~/.claude/pet-state.json
 * Captures: status, tool, file/command detail, model, project, subagents, notifications
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { tmpdir, homedir } from 'os';

const STATE_PATH = join(homedir(), '.claude', 'pet-state.json');
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { sessions: [], subagents: [] };
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tmp = join(tmpdir(), `pet-state-${process.pid}.json`);
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, STATE_PATH);
}

function cleanStale(items) {
  const now = Date.now();
  return items.filter((s) => now - s.since * 1000 < STALE_THRESHOLD_MS);
}

function parseModel(modelStr) {
  if (!modelStr) return undefined;
  const m = modelStr.toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  return 'unknown';
}

function extractToolDetail(hookData) {
  const input = hookData.tool_input;
  if (!input) return undefined;

  // File operations
  if (input.file_path) return basename(input.file_path);
  // Bash — prefer description, fallback to truncated command
  if (input.description) return input.description;
  if (input.command) {
    const cmd = input.command.length > 40 ? input.command.slice(0, 37) + '...' : input.command;
    return cmd;
  }
  // Search operations
  if (input.pattern) return input.pattern;
  if (input.query) return input.query;
  // Agent
  if (input.description) return input.description;
  return undefined;
}

// Read hook input from stdin
let input = '';
try {
  input = readFileSync(process.stdin.fd, 'utf-8');
} catch {
  process.exit(0);
}

let hookData;
try {
  hookData = JSON.parse(input);
} catch {
  process.exit(0);
}

const sessionId = hookData.session_id;
if (!sessionId) process.exit(0);

const hookEvent = hookData.hook_event_name || '';
const toolName = hookData.tool_name || '';
const cwd = hookData.cwd || '';

const state = readState();
if (!state.subagents) state.subagents = [];
const now = Math.floor(Date.now() / 1000);

// Clean stale
state.sessions = cleanStale(state.sessions);
state.subagents = cleanStale(state.subagents);

// -- Subagent events --
if (hookEvent === 'SubagentStart') {
  const agentId = hookData.agent_id;
  if (agentId) {
    state.subagents.push({
      id: agentId,
      parentId: sessionId,
      type: hookData.agent_type || 'agent',
      status: 'tool_use',
      since: now,
    });
  }
  writeState(state);
  process.exit(0);
}

if (hookEvent === 'SubagentStop') {
  const agentId = hookData.agent_id;
  if (agentId) {
    state.subagents = state.subagents.filter((s) => s.id !== agentId);
  }
  writeState(state);
  process.exit(0);
}

// -- Notification events --
if (hookEvent === 'Notification') {
  const notifType = hookData.notification_type || '';
  if (notifType === 'permission_prompt') {
    const idx = state.sessions.findIndex((s) => s.id === sessionId);
    if (idx !== -1) {
      state.sessions[idx].needsAttention = true;
    }
  }
  writeState(state);
  process.exit(0);
}

// -- Session events --
const idx = state.sessions.findIndex((s) => s.id === sessionId);

if (hookEvent === 'Stop' || hookEvent === 'stop') {
  if (idx !== -1) state.sessions.splice(idx, 1);
  state.subagents = state.subagents.filter((s) => s.parentId !== sessionId);
} else {
  let status = 'idle';
  if (hookEvent === 'PreToolUse') status = 'tool_use';
  else if (hookEvent === 'PostToolUse') status = 'thinking';
  else if (hookEvent === 'UserPromptSubmit') status = 'thinking';
  else if (hookEvent === 'SessionStart') status = 'idle';

  // Preserve model from SessionStart, update on new SessionStart
  const existingModel = idx !== -1 ? state.sessions[idx].model : undefined;
  const model = hookEvent === 'SessionStart' ? parseModel(hookData.model) : existingModel;

  const session = {
    id: sessionId,
    status,
    tool: toolName || undefined,
    toolDetail: extractToolDetail(hookData),
    model: model || undefined,
    project: cwd ? basename(cwd) : undefined,
    needsAttention: false,
    since: now,
  };

  if (idx !== -1) {
    state.sessions[idx] = session;
  } else {
    state.sessions.push(session);
  }
}

writeState(state);
