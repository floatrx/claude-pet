import type { PetState, Session } from './types';

let currentState: PetState | null = null;
let onChange: ((sessions: Session[]) => void) | null = null;

export function onSessionsChange(callback: (sessions: Session[]) => void) {
  onChange = callback;
}

export function updateState(state: PetState) {
  currentState = state;
  onChange?.(currentState.sessions);
}

