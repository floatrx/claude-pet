export type SessionStatus = 'idle' | 'thinking' | 'streaming' | 'tool_use' | 'error' | 'done';

export interface Session {
  id: string;
  status: SessionStatus;
  tool?: string;
  since: number;
}

export interface PetState {
  sessions: Session[];
}

export type AnimationState = 'idle' | 'working' | 'done' | 'error';

export interface SpriteFrame {
  canvas: OffscreenCanvas;
}

export interface SpriteSet {
  frames: SpriteFrame[];
  fps: number;
}

export interface SpriteSheet {
  idle: SpriteSet;
  working: SpriteSet;
  done: SpriteSet;
  error: SpriteSet;
}