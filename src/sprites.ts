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
  // Head
  rect(ctx, 13, y, 6, 8, body);
  rect(ctx, 12, y + 1, 8, 6, body);
  rect(ctx, 13, y + 1, 3, 2, light);
  // Body
  rect(ctx, 13, y + 8, 6, 8, body);
  rect(ctx, 12, y + 9, 8, 6, body);
  rect(ctx, 13, y + 9, 2, 3, light);
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
    rect(ctx, 13, legY, 2, 2, body);
    rect(ctx, 17, legY + 1, 2, 2, body);
  } else {
    rect(ctx, 13, legY + 1, 2, 2, body);
    rect(ctx, 17, legY, 2, 2, body);
  }
}

function drawArms(ctx: OffscreenCanvasRenderingContext2D, yOffset = 0, body = DEFAULT_BODY) {
  const y = 8 + yOffset;
  rect(ctx, 10, y + 10, 2, 4, body);
  rect(ctx, 20, y + 10, 2, 4, body);
}


function generateIdleFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 6; i++) {
    const blink = i >= 4;
    const bob = i < 4 ? (i % 2 === 0 ? 0 : -1) : 0;
    frames.push(createFrame((ctx) => {
      drawBody(ctx, bob, body, light);
      drawEyes(ctx, bob, blink);
      drawArms(ctx, bob, body);
      drawLegs(ctx, bob, i < 4 ? i : 0, body);
    }));
  }
  return { frames, fps: 8 };
}

function generateThinkingFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 6; i++) {
    const scratchPhase = i % 3;
    frames.push(createFrame((ctx) => {
      drawBody(ctx, 0, body, light);
      drawLegs(ctx, 0, 0, body);
      // Left arm resting
      rect(ctx, 10, 18, 2, 4, body);
      // Right arm reaching up to scratch head
      const handY = [8, 7, 9][scratchPhase];
      rect(ctx, 20, 12, 2, handY - 2, body); // forearm
      rect(ctx, 19, handY, 2, 2, body); // hand on head
      if (scratchPhase === 1) {
        px(ctx, 18, 7, '#FFFFFF');
        px(ctx, 22, 6, '#FFFFFF');
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

function generateWorkingFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 6; i++) {
    const blink = i === 4;
    frames.push(createFrame((ctx) => {
      drawBody(ctx, 2, body, light);
      drawEyes(ctx, 2, blink);
      rect(ctx, 10, 24, 12, 2, LAPTOP_COLOR);
      rect(ctx, 11, 22, 10, 2, '#6AB0FF');
      rect(ctx, 12, 22, 8, 1, '#AADDFF');
      const typing = i % 2 === 0 ? 0 : 1;
      rect(ctx, 12, 20 + typing, 2, 3, body);
      rect(ctx, 18, 21 - typing, 2, 3, body);
      rect(ctx, 13, 27, 2, 2, body);
      rect(ctx, 17, 27, 2, 2, body);
    }));
  }
  return { frames, fps: 6 };
}

function generateDoneFrames(body = DEFAULT_BODY, light = DEFAULT_LIGHT): SpriteSet {
  const frames: SpriteFrame[] = [];
  for (let i = 0; i < 4; i++) {
    const jumpHeight = [0, -4, -6, -3][i];
    frames.push(createFrame((ctx) => {
      drawBody(ctx, jumpHeight, body, light);
      drawEyes(ctx, jumpHeight, false);
      const y = 8 + jumpHeight;
      rect(ctx, 9, y + 6, 3, 2, body);
      rect(ctx, 20, y + 6, 3, 2, body);
      rect(ctx, 8, y + 4, 2, 3, body);
      rect(ctx, 22, y + 4, 2, 3, body);
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
      const y = 8 + bounce;
      // Left arm resting
      rect(ctx, 10, y + 10, 2, 4, body);
      // Right arm waving
      const waveY = [4, 3, 5][wavePhase];
      rect(ctx, 20, y + waveY, 2, 5, body);
      rect(ctx, 21, y + waveY - 1, 2, 2, body);
      // Exclamation mark
      if (i < 4) {
        rect(ctx, 25, 3 + bounce, 1, 4, '#FF6B6B');
        px(ctx, 25, 8 + bounce, '#FF6B6B');
      }
    }));
  }
  return { frames, fps: 8 };
}

export function generateSpriteSheet(model?: ModelFamily): SpriteSheet {
  const theme: ModelTheme = model ? MODEL_THEMES[model] : MODEL_THEMES.sonnet;
  const { body, bodyLight } = theme;

  return {
    idle: generateIdleFrames(body, bodyLight),
    thinking: generateThinkingFrames(body, bodyLight),
    working: generateWorkingFrames(body, bodyLight),
    done: generateDoneFrames(body, bodyLight),
    error: generateErrorFrames(body, bodyLight),
    attention: generateAttentionFrames(body, bodyLight),
  };
}

export { SPRITE_SIZE };
