import { listen } from '@tauri-apps/api/event';
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window';
import { generateSpriteSheet } from './sprites';
import { Pet, RENDER_SIZE } from './pet';
import { onSessionsChange, updateState } from './state';
import type { PetState, Session } from './types';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const appWindow = getCurrentWindow();

// -- Layout --
const SPRITE_BOTTOM_PAD = -10; // fine-tune: push pets higher above dock
let dockHeight = 70; // updated from Rust

// Default pet Y: walk just above the dock
function defaultPetY() {
  return window.innerHeight - RENDER_SIZE - dockHeight + SPRITE_BOTTOM_PAD;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resize();
window.addEventListener('resize', resize);

// Receive dock dimensions from Rust
listen<{ height: number }>('dock-info', (event) => {
  dockHeight = event.payload.height;
});

// -- Sprite & pet management --
const sprites = generateSpriteSheet();
const pets = new Map<string, Pet>();

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
  const activeIds = new Set(sessions.map((s) => s.id));
  for (const [id] of pets) {
    if (id === 'default') continue;
    if (!activeIds.has(id)) {
      pets.delete(id);
    }
  }

  for (const session of sessions) {
    const existing = pets.get(session.id);
    if (existing) {
      existing.updateSession(session);
    } else {
      if (pets.has('default') && session.id !== 'default') {
        pets.delete('default');
      }
      const spacing = RENDER_SIZE * 1.5;
      const startX = (pets.size * spacing) % (window.innerWidth - RENDER_SIZE);
      pets.set(session.id, new Pet(sprites, window.innerWidth, session, startX));
    }
  }

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

let draggedPet: Pet | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let clickThroughEnabled = true;

async function trackCursor() {
  try {
    const pos = await cursorPosition();
    const winPos = await appWindow.outerPosition();
    const scale = window.devicePixelRatio || 1;

    cursorX = (pos.x - winPos.x) / scale;
    cursorY = (pos.y - winPos.y) / scale;

    hoveredPet = null;
    for (const pet of pets.values()) {
      if (pet.hitTest(cursorX, cursorY)) {
        hoveredPet = pet;
        break;
      }
    }

    // Update cursor style
    canvas.style.cursor = draggedPet ? 'grabbing' : hoveredPet ? 'grab' : 'default';

    const shouldBeClickThrough = !hoveredPet && !draggedPet;
    if (shouldBeClickThrough !== clickThroughEnabled) {
      clickThroughEnabled = shouldBeClickThrough;
      await appWindow.setIgnoreCursorEvents(shouldBeClickThrough);
    }
  } catch {
    // Ignore cursor tracking errors
  }
}

// -- Drag and drop (now supports Y axis too) --
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const pet of pets.values()) {
    if (pet.hitTest(mx, my)) {
      draggedPet = pet;
      pet.dragging = true;
      pet.hasCustomY = true;
      dragOffsetX = mx - pet.x;
      dragOffsetY = my - pet.y;
      break;
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!draggedPet) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  draggedPet.x = Math.max(0, Math.min(mx - dragOffsetX, window.innerWidth - RENDER_SIZE));
  draggedPet.y = Math.max(0, Math.min(my - dragOffsetY, window.innerHeight - RENDER_SIZE));
});

canvas.addEventListener('mouseup', () => {
  if (draggedPet) {
    draggedPet.dragging = false;
    draggedPet = null;
  }
});

canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const pet of pets.values()) {
    if (pet.hitTest(mx, my)) {
      pet.hasCustomY = false;
      pet.x = Math.random() * (window.innerWidth - RENDER_SIZE);
      break;
    }
  }
});

// -- Animation loop --
let lastTime = 0;

function loop(time: number) {
  const dt = lastTime ? (time - lastTime) / 1000 : 0;
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = window.innerWidth;
  const petDefaultY = defaultPetY();

  for (const pet of pets.values()) {
    pet.setCanvasWidth(width);
    // Set default Y for new pets that haven't been dragged
    if (!pet.hasCustomY) {
      pet.y = petDefaultY;
    }
    pet.update(dt);
    pet.draw(ctx);
  }

  if (hoveredPet) {
    hoveredPet.drawTooltip(ctx);
  }

  trackCursor();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
