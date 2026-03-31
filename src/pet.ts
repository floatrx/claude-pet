import type { AnimationState, ModelFamily, Session, SpriteSheet } from './types';
import { MODEL_THEMES } from './types';
import { generateSpriteSheet, SPRITE_SIZE } from './sprites';
import { petName } from './names';

const WALK_SPEED = 30;

function scaleForModel(model?: ModelFamily): number {
  return model ? MODEL_THEMES[model].scale : MODEL_THEMES.sonnet.scale;
}

function statusToAnimation(session: Session): AnimationState {
  if (session.needsAttention) return 'attention';
  switch (session.status) {
    case 'thinking':
      return 'thinking';
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

// Cache sprite sheets per model to avoid regenerating
const spriteCache = new Map<string, SpriteSheet>();

function getSprites(model?: ModelFamily): SpriteSheet {
  const key = model || 'sonnet';
  let sprites = spriteCache.get(key);
  if (!sprites) {
    sprites = generateSpriteSheet(model);
    spriteCache.set(key, sprites);
  }
  return sprites;
}

export class Pet {
  x: number;
  y: number;
  hasCustomY = false;
  session: Session;
  isSubagent = false;
  private direction: 1 | -1 = 1;
  private animState: AnimationState = 'idle';
  private frameIndex = 0;
  private frameTimer = 0;
  private sprites: SpriteSheet;
  private canvasWidth: number;
  private scale: number;
  dragging = false;

  constructor(canvasWidth: number, session: Session, startX?: number) {
    this.scale = scaleForModel(session.model);
    this.sprites = getSprites(session.model);
    this.canvasWidth = canvasWidth;
    this.session = session;
    this.x = startX ?? Math.random() * (canvasWidth - this.renderSize);
    this.y = 0;
    this.animState = statusToAnimation(session);
  }

  get renderSize() {
    return SPRITE_SIZE * this.scale;
  }

  setCanvasWidth(width: number) {
    this.canvasWidth = width;
  }

  updateSession(session: Session) {
    // Update sprites if model changed
    if (session.model !== this.session.model) {
      this.scale = scaleForModel(session.model);
      this.sprites = getSprites(session.model);
    }
    this.session = session;
    const newAnim = statusToAnimation(session);
    if (this.animState !== newAnim) {
      this.animState = newAnim;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  hitTest(px: number, py: number): boolean {
    const size = this.renderSize;
    return px >= this.x && px <= this.x + size && py >= this.y && py <= this.y + size;
  }

  update(dt: number) {
    if (this.dragging) return;

    const spriteSet = this.sprites[this.animState];
    const frameDuration = 1 / spriteSet.fps;

    this.frameTimer += dt;
    if (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      this.frameIndex = (this.frameIndex + 1) % spriteSet.frames.length;
    }

    if (this.animState === 'idle') {
      this.x += WALK_SPEED * this.direction * dt;
      const size = this.renderSize;
      if (this.x + size > this.canvasWidth) {
        this.x = this.canvasWidth - size;
        this.direction = -1;
      } else if (this.x < 0) {
        this.x = 0;
        this.direction = 1;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const spriteSet = this.sprites[this.animState];
    const frame = spriteSet.frames[this.frameIndex];
    const size = this.renderSize;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (this.direction === -1) {
      ctx.translate(this.x + size, this.y);
      ctx.scale(-1, 1);
      ctx.drawImage(frame.canvas, 0, 0, size, size);
    } else {
      ctx.drawImage(frame.canvas, this.x, this.y, size, size);
    }

    ctx.restore();

    // Project name label above pet
    if (this.session.project) {
      this.drawLabel(ctx, this.session.project);
    }
  }

  private drawLabel(ctx: CanvasRenderingContext2D, text: string) {
    const size = this.renderSize;
    const centerX = this.x + size / 2;

    ctx.save();
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(text, centerX, this.y - 4);
    ctx.restore();
  }

  drawTooltip(ctx: CanvasRenderingContext2D) {
    const size = this.renderSize;
    const centerX = this.x + size / 2;
    const elapsed = formatElapsed(this.session.since);

    const name = petName(this.session.id);
    const modelTag = this.session.model ? ` [${this.session.model}]` : '';
    const line1 = `${name}${modelTag}`;

    // Rich tool detail
    let line2: string;
    const { tool, toolDetail } = this.session;
    if (tool && toolDetail) {
      line2 = `${tool}: ${toolDetail}`;
    } else if (tool) {
      line2 = `${this.session.status} (${tool})`;
    } else {
      line2 = this.session.status;
    }

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
    const boxY = this.y - boxHeight + 8;

    // Background
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
    ctx.fill();

    // Border — accent color based on model
    const accent = this.session.model
      ? MODEL_THEMES[this.session.model].accent
      : 'rgba(217, 119, 87, 0.6)';
    ctx.strokeStyle = accent;
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
    ctx.fillStyle = accent;
    ctx.fillText(line1, boxX + padding, boxY + padding + 10);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillText(line2, boxX + padding, boxY + padding + 10 + lineHeight);
    ctx.fillStyle = '#888888';
    ctx.fillText(line3, boxX + padding, boxY + padding + 10 + lineHeight * 2);

    ctx.restore();
  }
}
