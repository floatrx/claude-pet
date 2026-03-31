import { listen } from '@tauri-apps/api/event';
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window';
import { generateSpriteSheet } from './sprites';
import { Pet, RENDER_SIZE } from './pet';
import { onSessionsChange, updateState } from './state';
import type { PetState, Session } from './types';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const appWindow = getCurrentWindow();

// -- Canvas setup --
const TOOLTIP_SPACE = 72; // space above pet for tooltip
const TOTAL_HEIGHT = RENDER_SIZE + TOOLTIP_SPACE;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = TOTAL_HEIGHT * dpr;
  canvas.style.height = `${TOTAL_HEIGHT}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resize();
window.addEventListener('resize', resize);

// -- Sprite & pet management --
const sprites = generateSpriteSheet();
const pets = new Map<string, Pet>();

// Always have at least one idle pet when no sessions
function ensureDefaultPet() {
  if (pets.size === 0) {
    const defaultSession: Session = {
      id: 'default',
      status: 'idle',
      since: Math.floor(Date.now() / 1000),
    };
    pets.set('default', new Pet(sprites, window.innerWidth, defaultSession));
  }
}

ensureDefaultPet();

// -- Session sync --
onSessionsChange((sessions) => {
  // Remove pets for sessions that no longer exist
  const activeIds = new Set(sessions.map((s) => s.id));
  for (const [id] of pets) {
    if (id === 'default') continue;
    if (!activeIds.has(id)) {
      pets.delete(id);
    }
  }

  // Add or update pets for active sessions
  for (const session of sessions) {
    const existing = pets.get(session.id);
    if (existing) {
      existing.updateSession(session);
    } else {
      // Remove default pet when real sessions appear
      if (pets.has('default') && session.id !== 'default') {
        pets.delete('default');
      }
      const spacing = RENDER_SIZE * 1.5;
      const startX = (pets.size * spacing) % (window.innerWidth - RENDER_SIZE);
      pets.set(session.id, new Pet(sprites, window.innerWidth, session, startX));
    }
  }

  // Re-add default if all sessions gone
  if (sessions.length === 0) {
    ensureDefaultPet();
  }
});

listen<PetState>('pet-state-changed', (event) => {
  updateState(event.payload);
});

// -- Cursor tracking (works even with click-through) --
let cursorX = -1;
let cursorY = -1;
let hoveredPet: Pet | null = null;

// Track drag state
let draggedPet: Pet | null = null;
let dragOffsetX = 0;
let clickThroughEnabled = true;

async function trackCursor() {
  try {
    const pos = await cursorPosition();
    const winPos = await appWindow.outerPosition();
    const scale = window.devicePixelRatio || 1;

    // Convert screen coords to canvas-local coords
    cursorX = (pos.x - winPos.x) / scale;
    cursorY = (pos.y - winPos.y) / scale;

    // Check hover
    hoveredPet = null;
    for (const pet of pets.values()) {
      if (pet.hitTest(cursorX, cursorY, TOOLTIP_SPACE)) {
        hoveredPet = pet;
        break;
      }
    }

    // Enable/disable click-through based on hover
    const shouldBeClickThrough = !hoveredPet && !draggedPet;
    if (shouldBeClickThrough !== clickThroughEnabled) {
      clickThroughEnabled = shouldBeClickThrough;
      await appWindow.setIgnoreCursorEvents(shouldBeClickThrough);
    }
  } catch {
    // Ignore cursor tracking errors
  }
}

// Track cursor in sync with render loop (pauses when hidden)

// -- Drag and drop --
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const pet of pets.values()) {
    if (pet.hitTest(mx, my, TOOLTIP_SPACE)) {
      draggedPet = pet;
      pet.dragging = true;
      dragOffsetX = mx - pet.x;
      break;
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!draggedPet) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  draggedPet.x = Math.max(0, Math.min(mx - dragOffsetX, window.innerWidth - RENDER_SIZE));
});

canvas.addEventListener('mouseup', () => {
  if (draggedPet) {
    draggedPet.dragging = false;
    draggedPet = null;
  }
});

// -- Animation loop --
let lastTime = 0;

function loop(time: number) {
  const dt = lastTime ? (time - lastTime) / 1000 : 0;
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = window.innerWidth;

  // Update and draw all pets
  for (const pet of pets.values()) {
    pet.setCanvasWidth(width);
    pet.update(dt);
    pet.draw(ctx, TOOLTIP_SPACE);
  }

  // Draw tooltip for hovered pet (on top of everything)
  if (hoveredPet) {
    hoveredPet.drawTooltip(ctx, TOOLTIP_SPACE);
  }

  trackCursor();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
