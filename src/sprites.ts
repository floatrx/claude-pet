import type { SpriteFrame, SpriteSet, SpriteSheet } from './types';

const SPRITE_SIZE = 32;
const BODY_COLOR = '#D97757';
const BODY_LIGHT = '#E8956A';
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

// Draw the base body (rounded blob shape)
function drawBody(ctx: OffscreenCanvasRenderingContext2D, yOffset = 0) {
  const y = 8 + yOffset;
  // Head
  rect(ctx, 12, y, 8, 8, BODY_COLOR);
  rect(ctx, 11, y + 1, 10, 6, BODY_COLOR);
  rect(ctx, 10, y + 2, 12, 4, BODY_COLOR);
  // Highlight on head
  rect(ctx, 12, y + 1, 4, 2, BODY_LIGHT);
  // Body
  rect(ctx, 11, y + 8, 10, 8, BODY_COLOR);
  rect(ctx, 10, y + 9, 12, 6, BODY_COLOR);
  // Highlight on body
  rect(ctx, 11, y + 9, 3, 3, BODY_LIGHT);
}

function drawEyes(ctx: OffscreenCanvasRenderingContext2D, yOffset = 0, blink = false) {
  const y = 8 + yOffset;
  if (blink) {
    // Closed eyes (horizontal lines)
    rect(ctx, 13, y + 4, 2, 1, EYE_COLOR);
    rect(ctx, 17, y + 4, 2, 1, EYE_COLOR);
  } else {
    // Open eyes
    rect(ctx, 13, y + 3, 2, 2, EYE_COLOR);
    rect(ctx, 17, y + 3, 2, 2, EYE_COLOR);
    // Eye highlights
    px(ctx, 13, y + 3, '#FFFFFF');
    px(ctx, 17, y + 3, '#FFFFFF');
  }
}

function drawLegs(ctx: OffscreenCanvasRenderingContext2D, yOffset: number, frame: number) {
  const y = 8 + yOffset;
  const legY = y + 16;
  if (frame % 2 === 0) {
    // Left foot forward
    rect(ctx, 12, legY, 3, 2, BODY_COLOR);
    rect(ctx, 18, legY + 1, 3, 2, BODY_COLOR);
  } else {
    // Right foot forward
    rect(ctx, 12, legY + 1, 3, 2, BODY_COLOR);
    rect(ctx, 18, legY, 3, 2, BODY_COLOR);
  }
}

function drawArms(ctx: OffscreenCanvasRenderingContext2D, yOffset = 0) {
  const y = 8 + yOffset;
  // Left arm
  rect(ctx, 8, y + 10, 2, 4, BODY_COLOR);
  // Right arm
  rect(ctx, 22, y + 10, 2, 4, BODY_COLOR);
}

function generateIdleFrames(): SpriteSet {
  const frames: SpriteFrame[] = [];

  // 4 walk frames + 2 blink frames
  for (let i = 0; i < 6; i++) {
    const blink = i >= 4;
    const bob = i < 4 ? (i % 2 === 0 ? 0 : -1) : 0;

    frames.push(createFrame((ctx) => {
      drawBody(ctx, bob);
      drawEyes(ctx, bob, blink);
      drawArms(ctx, bob);
      if (i < 4) {
        drawLegs(ctx, bob, i);
      } else {
        drawLegs(ctx, bob, 0);
      }
    }));
  }

  return { frames, fps: 8 };
}

function generateThinkingFrames(): SpriteSet {
  const frames: SpriteFrame[] = [];

  for (let i = 0; i < 6; i++) {
    const scratchPhase = i % 3; // 0, 1, 2 cycle

    frames.push(createFrame((ctx) => {
      drawBody(ctx, 0);
      drawLegs(ctx, 0, 0);

      // Left arm resting at side
      rect(ctx, 8, 18, 2, 4, BODY_COLOR);

      // Right arm scratching head — moves up/down
      const armY = [6, 5, 7][scratchPhase];
      rect(ctx, 22, 10, 2, armY, BODY_COLOR); // upper arm
      rect(ctx, 21, 9, 3, 2, BODY_COLOR); // hand on head
      // Scratch lines
      if (scratchPhase === 1) {
        px(ctx, 20, 8, '#FFFFFF');
        px(ctx, 24, 7, '#FFFFFF');
      }

      // Eyes looking up (thinking)
      const blink = i === 4;
      if (blink) {
        rect(ctx, 13, 11, 2, 1, EYE_COLOR);
        rect(ctx, 17, 11, 2, 1, EYE_COLOR);
      } else {
        rect(ctx, 13, 10, 2, 2, EYE_COLOR);
        rect(ctx, 17, 10, 2, 2, EYE_COLOR);
        // Pupils shifted up
        px(ctx, 13, 10, '#FFFFFF');
        px(ctx, 17, 10, '#FFFFFF');
      }

      // Thought dots (... floating above)
      if (i < 4) {
        const dotOffset = i % 2;
        px(ctx, 7, 5 - dotOffset, '#AAAAAA');
        px(ctx, 5, 3 - dotOffset, '#999999');
        px(ctx, 3, 1 + dotOffset, '#777777');
      }
    }));
  }

  return { frames, fps: 4 };
}

function generateWorkingFrames(): SpriteSet {
  const frames: SpriteFrame[] = [];

  for (let i = 0; i < 4; i++) {
    frames.push(createFrame((ctx) => {
      // Sitting body (lower position)
      drawBody(ctx, 2);
      drawEyes(ctx, 2, false);

      // Laptop
      rect(ctx, 9, 24, 14, 2, LAPTOP_COLOR);
      rect(ctx, 10, 22, 12, 2, '#6AB0FF');
      // Screen glow
      rect(ctx, 11, 22, 10, 1, '#AADDFF');

      // Typing arms - alternate positions
      const armOffset = i % 2 === 0 ? 0 : 1;
      rect(ctx, 10, 20 + armOffset, 3, 3, BODY_COLOR);
      rect(ctx, 19, 21 - armOffset, 3, 3, BODY_COLOR);

      // Seated legs (tucked)
      rect(ctx, 12, 27, 3, 2, BODY_COLOR);
      rect(ctx, 17, 27, 3, 2, BODY_COLOR);
    }));
  }

  return { frames, fps: 6 };
}

function generateDoneFrames(): SpriteSet {
  const frames: SpriteFrame[] = [];

  for (let i = 0; i < 4; i++) {
    const jumpHeight = [0, -4, -6, -3][i];

    frames.push(createFrame((ctx) => {
      drawBody(ctx, jumpHeight);
      drawEyes(ctx, jumpHeight, false);

      // Arms up for celebration
      const y = 8 + jumpHeight;
      rect(ctx, 7, y + 6, 3, 2, BODY_COLOR);
      rect(ctx, 22, y + 6, 3, 2, BODY_COLOR);
      rect(ctx, 6, y + 4, 2, 3, BODY_COLOR);
      rect(ctx, 24, y + 4, 2, 3, BODY_COLOR);

      drawLegs(ctx, jumpHeight, i);

      // Sparkles
      if (i === 1 || i === 2) {
        px(ctx, 6, 6 + jumpHeight, SPARKLE_COLOR);
        px(ctx, 25, 4 + jumpHeight, SPARKLE_COLOR);
        px(ctx, 8, 3 + jumpHeight, SPARKLE_COLOR);
        px(ctx, 23, 7 + jumpHeight, SPARKLE_COLOR);
      }
      if (i === 2) {
        px(ctx, 4, 8, SPARKLE_COLOR);
        px(ctx, 27, 5, SPARKLE_COLOR);
      }
    }));
  }

  return { frames, fps: 8 };
}

function generateErrorFrames(): SpriteSet {
  const frames: SpriteFrame[] = [];

  for (let i = 0; i < 4; i++) {
    const shake = [0, -1, 0, 1][i];

    frames.push(createFrame((ctx) => {
      ctx.translate(shake, 0);
      drawBody(ctx, 0);
      drawArms(ctx, 0);
      drawLegs(ctx, 0, 0);

      // X eyes for error
      const y = 8;
      // Left X
      px(ctx, 13, y + 3, '#FF4444');
      px(ctx, 14, y + 4, '#FF4444');
      px(ctx, 14, y + 3, '#FF4444');
      px(ctx, 13, y + 4, '#FF4444');
      // Right X
      px(ctx, 17, y + 3, '#FF4444');
      px(ctx, 18, y + 4, '#FF4444');
      px(ctx, 18, y + 3, '#FF4444');
      px(ctx, 17, y + 4, '#FF4444');

      // Dizzy stars
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

export function generateSpriteSheet(): SpriteSheet {
  return {
    idle: generateIdleFrames(),
    thinking: generateThinkingFrames(),
    working: generateWorkingFrames(),
    done: generateDoneFrames(),
    error: generateErrorFrames(),
  };
}

export { SPRITE_SIZE };
