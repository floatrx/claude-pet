import type { ModelFamily, ModelTheme, SpriteFrame, SpriteSet, SpriteSheet } from './types';
import { MODEL_THEMES } from './types';

const SPRITE_SIZE = 32;
const DEFAULT_BODY = '#D97757';
const DEFAULT_LIGHT = '#E8956A';
const EYE_COLOR = '#2D2D2D';
const LAPTOP_COLOR = '#4A90D9';
const SPARKLE_COLOR = '#FFD700';

function createFrame(draw: (ctx: OffscreenCanvasRenderingContext2D) => void): SpriteFrame {
  const canvas = new OffscreenCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  draw(ctx);
  return { canvas };
}

function px(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawBody(ctx: OffscreenCanvasRenderingContext2D, yOffset = 0, body = DEFAULT_BODY, light = DEFAULT_LIGHT) {
  const y = 8 + yOffset;
  rect(ctx, 12, y, 8, 8, body);
  rect(ctx, 11, y + 1, 10, 6, body);
  rect(ctx, 10, y + 2, 12, 4, body);
  rect(ctx, 12, y + 1, 4, 2, light);
  rect(ctx, 11, y + 8, 10, 8, body);
  rect(ctx, 10, y + 9, 12, 6, body);
  rect(ctx, 11, y + 9, 3, 3, light);
}

function drawEyes(ctx: OffscreenCanvasRenderingContext2D, yOffset = 0, blink = false) {
  const y = 8 + yOffset;
  if (blink) {
    rect(ctx, 13, y + 4, 2, 1, EYE_COLOR);
    rect(ctx, 17, y + 4, 2, 1, EYE_COLOR);
  } else {
    rect(ctx, 13, y + 3, 2, 2, EYE_COLOR);
    rect(ctx, 17, y + 3, 2, 2, EYE_COLOR);
    px(ctx, 13, y + 3, '#FFFFFF');
    px(ctx, 17, y + 3, '#FFFFFF');
  }
}

function drawLegs(ctx: OffscreenCanvasRenderingContext2D, yOffset: number, frame: number, body = DEFAULT_BODY) {
  const y = 8 + yOffset;
  const legY = y + 16;
  if (frame % 2 === 0) {
    rect(ctx, 12, legY, 3, 2, body);
    rect(ctx, 18, legY + 1, 3, 2, body);
  } else {
    rect(ctx, 12, legY + 1, 3, 2, body);
    rect(ctx, 18, legY, 3, 2, body);
  }
}

function drawArms(ctx: OffscreenCanvasRenderingContext2D, yOffset = 0, body = DEFAULT_BODY) {
  const y = 8 + yOffset;
  rect(ctx, 8, y + 10, 2, 4, body);
  rect(ctx, 22, y + 10, 2, 4, body);
}

// Model badge — small colored dot on the body
function drawModelBadge(ctx: OffscreenCanvasRenderingContext2D, accent: string, yOffset = 0) {
  const y = 8 + yOffset;
  rect(ctx, 19, y + 9, 2, 2, accent);
}

function generateIdleFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT, accent?: string): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 6; i++) {
    const blink = i >= 4;
    const bob = i < 4 ? (i % 2 === 0 ? 0 : -1) : 0;
    frames.push(createFrame((ctx) => {
      drawBody(ctx, bob, body, light);
      drawEyes(ctx, bob, blink);
      drawArms(ctx, bob, body);
      drawLegs(ctx, bob, i < 4 ? i : 0, body);
      if (accent) drawModelBadge(ctx, accent, bob);
    }));
  }
  return { frames, fps: 8 };
}

function generateThinkingFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT, accent?: string): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 6; i++) {
    const scratchPhase = i % 3;
    frames.push(createFrame((ctx) => {
      drawBody(ctx, 0, body, light);
      drawLegs(ctx, 0, 0, body);
      if (accent) drawModelBadge(ctx, accent);
      rect(ctx, 8, 18, 2, 4, body);
      const armY = [6, 5, 7][scratchPhase];
      rect(ctx, 22, 10, 2, armY, body);
      rect(ctx, 21, 9, 3, 2, body);
      if (scratchPhase === 1) {
        px(ctx, 20, 8, '#FFFFFF');
        px(ctx, 24, 7, '#FFFFFF');
      }
      const blink = i === 4;
      if (blink) {
        rect(ctx, 13, 11, 2, 1, EYE_COLOR);
        rect(ctx, 17, 11, 2, 1, EYE_COLOR);
      } else {
        rect(ctx, 13, 10, 2, 2, EYE_COLOR);
        rect(ctx, 17, 10, 2, 2, EYE_COLOR);
        px(ctx, 13, 10, '#FFFFFF');
        px(ctx, 17, 10, '#FFFFFF');
      }
      if (i < 4) {
        const d = i % 2;
        px(ctx, 7, 5 - d, '#AAAAAA');
        px(ctx, 5, 3 - d, '#999999');
        px(ctx, 3, 1 + d, '#777777');
      }
    }));
  }
  return { frames, fps: 4 };
}

function generateWorkingFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT, accent?: string): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 4; i++) {
    frames.push(createFrame((ctx) => {
      drawBody(ctx, 2, body, light);
      drawEyes(ctx, 2, false);
      if (accent) drawModelBadge(ctx, accent, 2);
      rect(ctx, 9, 24, 14, 2, LAPTOP_COLOR);
      rect(ctx, 10, 22, 12, 2, '#6AB0FF');
      rect(ctx, 11, 22, 10, 1, '#AADDFF');
      const armOffset = i % 2 === 0 ? 0 : 1;
      rect(ctx, 10, 20 + armOffset, 3, 3, body);
      rect(ctx, 19, 21 - armOffset, 3, 3, body);
      rect(ctx, 12, 27, 3, 2, body);
      rect(ctx, 17, 27, 3, 2, body);
    }));
  }
  return { frames, fps: 6 };
}

function generateDoneFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT, accent?: string): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 4; i++) {
    const jumpHeight = [0, -4, -6, -3][i];
    frames.push(createFrame((ctx) => {
      drawBody(ctx, jumpHeight, body, light);
      drawEyes(ctx, jumpHeight, false);
      if (accent) drawModelBadge(ctx, accent, jumpHeight);
      const y = 8 + jumpHeight;
      rect(ctx, 7, y + 6, 3, 2, body);
      rect(ctx, 22, y + 6, 3, 2, body);
      rect(ctx, 6, y + 4, 2, 3, body);
      rect(ctx, 24, y + 4, 2, 3, body);
      drawLegs(ctx, jumpHeight, i, body);
      if (i === 1 || i === 2) {
        px(ctx, 6, 6 + jumpHeight, SPARKLE_COLOR);
        px(ctx, 25, 4 + jumpHeight, SPARKLE_COLOR);
        px(ctx, 8, 3 + jumpHeight, SPARKLE_COLOR);
        px(ctx, 23, 7 + jumpHeight, SPARKLE_COLOR);
      }
    }));
  }
  return { frames, fps: 8 };
}

function generateErrorFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 4; i++) {
    const shake = [0, -1, 0, 1][i];
    frames.push(createFrame((ctx) => {
      ctx.translate(shake, 0);
      drawBody(ctx, 0, body, light);
      drawArms(ctx, 0, body);
      drawLegs(ctx, 0, 0, body);
      const y = 8;
      px(ctx, 13, y + 3, '#FF4444');
      px(ctx, 14, y + 4, '#FF4444');
      px(ctx, 14, y + 3, '#FF4444');
      px(ctx, 13, y + 4, '#FF4444');
      px(ctx, 17, y + 3, '#FF4444');
      px(ctx, 18, y + 4, '#FF4444');
      px(ctx, 18, y + 3, '#FF4444');
      px(ctx, 17, y + 4, '#FF4444');
      if (i % 2 === 0) {
        px(ctx, 8 + shake, 6, SPARKLE_COLOR);
        px(ctx, 24 + shake, 8, SPARKLE_COLOR);
      } else {
        px(ctx, 9 + shake, 8, SPARKLE_COLOR);
        px(ctx, 23 + shake, 6, SPARKLE_COLOR);
      }
    }));
  }
  return { frames, fps: 10 };
}

function generateAttentionFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 6; i++) {
    const bounce = [0, -2, -4, -2, 0, 0][i];
    const wavePhase = i % 3;
    frames.push(createFrame((ctx) => {
      drawBody(ctx, bounce, body, light);
      drawEyes(ctx, bounce, false);
      drawLegs(ctx, bounce, 0, body);
      // Left arm waving
      const y = 8 + bounce;
      rect(ctx, 8, y + 10, 2, 4, body); // right arm normal
      // Left arm up + wave
      const waveY = [4, 3, 5][wavePhase];
      rect(ctx, 22, y + waveY, 2, 5, body);
      rect(ctx, 24, y + waveY - 1, 2, 2, body); // hand
      // Exclamation mark
      if (i < 4) {
        rect(ctx, 27, 3 + bounce, 1, 4, '#FF6B6B');
        px(ctx, 27, 8 + bounce, '#FF6B6B');
      }
    }));
  }
  return { frames, fps: 8 };
}

export function generateSpriteSheet(model?: ModelFamily): SpriteSheet {
  const theme: ModelTheme = model ? MODEL_THEMES[model] : MODEL_THEMES.sonnet;
  const { body, bodyLight, accent } = theme;

  return {
    idle: generateIdleFrames(body, bodyLight, accent),
    thinking: generateThinkingFrames(body, bodyLight, accent),
    working: generateWorkingFrames(body, bodyLight, accent),
    done: generateDoneFrames(body, bodyLight, accent),
    error: generateErrorFrames(body, bodyLight),
    attention: generateAttentionFrames(body, bodyLight),
  };
}

export { SPRITE_SIZE };
