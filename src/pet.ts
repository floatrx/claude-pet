import type { AnimationState, Session, SpriteSheet } from './types';
import { SPRITE_SIZE } from './sprites';

const SCALE = 4;
const RENDER_SIZE = SPRITE_SIZE * SCALE;
const WALK_SPEED = 30; // pixels per second

function statusToAnimation(status: Session['status']): AnimationState {
  switch (status) {
    case 'thinking':
    case 'streaming':
    case 'tool_use':
      return 'working';
    case 'done':
      return 'done';
    case 'error':
      return 'error';
    case 'idle':
    default:
      return 'idle';
  }
}

function formatElapsed(since: number): string {
  const seconds = Math.floor(Date.now() / 1000 - since);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export class Pet {
  x: number;
  session: Session;
  private direction: 1 | -1 = 1;
  private animState: AnimationState = 'idle';
  private frameIndex = 0;
  private frameTimer = 0;
  private sprites: SpriteSheet;
  private canvasWidth: number;
  dragging = false;

  constructor(sprites: SpriteSheet, canvasWidth: number, session: Session, startX?: number) {
    this.sprites = sprites;
    this.canvasWidth = canvasWidth;
    this.session = session;
    this.x = startX ?? Math.random() * (canvasWidth - RENDER_SIZE);
    this.animState = statusToAnimation(session.status);
  }

  get renderSize() {
    return RENDER_SIZE;
  }

  setCanvasWidth(width: number) {
    this.canvasWidth = width;
  }

  updateSession(session: Session) {
    this.session = session;
    const newAnim = statusToAnimation(session.status);
    if (this.animState !== newAnim) {
      this.animState = newAnim;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  hitTest(px: number, py: number, drawY: number): boolean {
    return px >= this.x && px <= this.x + RENDER_SIZE && py >= drawY && py <= drawY + RENDER_SIZE;
  }

  update(dt: number) {
    if (this.dragging) return;

    const spriteSet = this.sprites[this.animState];
    const frameDuration = 1 / spriteSet.fps;

    // Advance animation frame
    this.frameTimer += dt;
    if (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      this.frameIndex = (this.frameIndex + 1) % spriteSet.frames.length;
    }

    // Move only when idle (walking)
    if (this.animState === 'idle') {
      this.x += WALK_SPEED * this.direction * dt;

      if (this.x + RENDER_SIZE > this.canvasWidth) {
        this.x = this.canvasWidth - RENDER_SIZE;
        this.direction = -1;
      } else if (this.x < 0) {
        this.x = 0;
        this.direction = 1;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, drawY: number) {
    const spriteSet = this.sprites[this.animState];
    const frame = spriteSet.frames[this.frameIndex];

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (this.direction === -1) {
      ctx.translate(this.x + RENDER_SIZE, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(frame.canvas, 0, 0, RENDER_SIZE, RENDER_SIZE);
    } else {
      ctx.drawImage(frame.canvas, this.x, drawY, RENDER_SIZE, RENDER_SIZE);
    }

    ctx.restore();
  }

  drawTooltip(ctx: CanvasRenderingContext2D, drawY: number) {
    const centerX = this.x + RENDER_SIZE / 2;
    const status = this.session.status;
    const tool = this.session.tool;
    const elapsed = formatElapsed(this.session.since);

    const line1 = this.session.id.slice(0, 12);
    const line2 = tool ? `${status} (${tool})` : status;
    const line3 = elapsed;

    ctx.save();
    ctx.font = '11px monospace';

    const maxWidth = Math.max(
      ctx.measureText(line1).width,
      ctx.measureText(line2).width,
      ctx.measureText(line3).width
    );

    const padding = 6;
    const lineHeight = 14;
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lineHeight * 3 + padding * 2;
    const boxX = Math.max(0, Math.min(centerX - boxWidth / 2, this.canvasWidth - boxWidth));
    const boxY = drawY - boxHeight - 8;

    // Background
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(217, 119, 87, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Arrow
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.beginPath();
    ctx.moveTo(centerX - 4, boxY + boxHeight);
    ctx.lineTo(centerX, boxY + boxHeight + 4);
    ctx.lineTo(centerX + 4, boxY + boxHeight);
    ctx.fill();

    // Text
    ctx.fillStyle = '#D97757';
    ctx.fillText(line1, boxX + padding, boxY + padding + 10);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillText(line2, boxX + padding, boxY + padding + 10 + lineHeight);
    ctx.fillStyle = '#888888';
    ctx.fillText(line3, boxX + padding, boxY + padding + 10 + lineHeight * 2);

    ctx.restore();
  }
}

export { RENDER_SIZE };
