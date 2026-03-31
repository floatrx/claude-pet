#!/usr/bin/env node

/**
 * Claude Code hook — writes session state to ~/.claude/pet-state.json
 *
 * Registered for: SessionStart, PreToolUse, PostToolUse, Stop
 * Reads hook context from stdin as JSON.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir, homedir } from 'os';

const STATE_PATH = join(homedir(), '.claude', 'pet-state.json');
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { sessions: [] };
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tmp = join(tmpdir(), `pet-state-${process.pid}.json`);
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, STATE_PATH);
}

function cleanStale(sessions) {
  const now = Date.now();
  return sessions.filter((s) => now - s.since * 1000 < STALE_THRESHOLD_MS);
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
const toolName = hookData.tool_name || hookData.tool?.name || '';

const state = readState();
const now = Math.floor(Date.now() / 1000);

// Clean stale sessions
state.sessions = cleanStale(state.sessions);

// Find or create session entry
const idx = state.sessions.findIndex((s) => s.id === sessionId);

if (hookEvent === 'Stop' || hookEvent === 'stop') {
  // Remove session on stop
  if (idx !== -1) {
    state.sessions.splice(idx, 1);
  }
} else {
  let status = 'idle';

  if (hookEvent === 'PreToolUse') {
    status = 'tool_use';
  } else if (hookEvent === 'PostToolUse') {
    // Stay in 'thinking' between tool calls — Claude is still active
    status = 'thinking';
  } else if (hookEvent === 'UserPromptSubmit') {
    status = 'thinking';
  } else if (hookEvent === 'SessionStart') {
    status = 'idle';
  }

  const session = {
    id: sessionId,
    status,
    tool: toolName || undefined,
    since: now,
  };

  if (idx !== -1) {
    state.sessions[idx] = session;
  } else {
    state.sessions.push(session);
  }
}

writeState(state);
