import type { PetState, Session, Subagent } from './types';

let currentState: PetState | null = null;
let onChange: ((sessions: Session[], subagents: Subagent[]) => void) | null = null;

export function onStateChange(callback: (sessions: Session[], subagents: Subagent[]) => void) {
  onChange = callback;
}

export function updateState(state: PetState) {
  currentState = state;
  onChange?.(currentState.sessions, currentState.subagents ?? []);
}
