export type SessionStatus = 'idle' | 'thinking' | 'streaming' | 'tool_use' | 'error' | 'done';

export type ModelFamily = 'opus' | 'sonnet' | 'haiku' | 'unknown';

export interface Session {
  id: string;
  status: SessionStatus;
  tool?: string;
  toolDetail?: string; // file path or command description
  model?: ModelFamily;
  project?: string; // basename of cwd
  needsAttention?: boolean;
  since: number;
}

export interface Subagent {
  id: string;
  parentId: string;
  type: string;
  status: SessionStatus;
  since: number;
}

export interface PetState {
  sessions: Session[];
  subagents?: Subagent[];
}

export type AnimationState = 'idle' | 'thinking' | 'working' | 'done' | 'error' | 'attention';

export interface SpriteFrame {
  canvas: OffscreenCanvas;
}

export interface SpriteSet {
  frames: SpriteFrame[];
  fps: number;
}

export interface SpriteSheet {
  idle: SpriteSet;
  thinking: SpriteSet;
  working: SpriteSet;
  done: SpriteSet;
  error: SpriteSet;
  attention: SpriteSet;
}

// Model color themes
export interface ModelTheme {
  body: string;
  bodyLight: string;
  accent: string;
  scale: number;
}

export const MODEL_THEMES: Record<ModelFamily, ModelTheme> = {
  opus: { body: '#C45A3C', bodyLight: '#D9734F', accent: '#FFD700', scale: 2 },
  sonnet: { body: '#D97757', bodyLight: '#E8956A', accent: '#4A90D9', scale: 2 },
  haiku: { body: '#5BAD7A', bodyLight: '#7DC99A', accent: '#A8E6CF', scale: 2 },
  unknown: { body: '#D97757', bodyLight: '#E8956A', accent: '#4A90D9', scale: 2 },
};
