import { listen } from '@tauri-apps/api/event';
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window';
import { Pet } from './pet';
import { onStateChange, updateState } from './state';
import type { PetState, Session, Subagent } from './types';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const appWindow = getCurrentWindow();

// -- Layout --
const SPRITE_BOTTOM_PAD = -10;
let dockHeight = 70;

function defaultPetY(petSize: number) {
  return window.innerHeight - petSize - dockHeight + SPRITE_BOTTOM_PAD;
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

listen<{ height: number }>('dock-info', (event) => {
  dockHeight = event.payload.height;
});

// -- Pet management --
const pets = new Map<string, Pet>();

function ensureDefaultPet() {
  if (pets.size === 0) {
    const defaultSession: Session = {
      id: 'default',
      status: 'idle',
      since: Math.floor(Date.now() / 1000),
    };
    pets.set('default', new Pet(window.innerWidth, defaultSession));
  }
}

ensureDefaultPet();

// -- State sync --
onStateChange((sessions, subagents) => {
  const activeIds = new Set(sessions.map((s) => s.id));
  const activeSubIds = new Set(subagents.map((s) => s.id));

  // Remove dead pets
  for (const [id, pet] of pets) {
    if (id === 'default') continue;
    if (pet.isSubagent ? !activeSubIds.has(id) : !activeIds.has(id)) {
      pets.delete(id);
    }
  }

  // Update or create session pets
  for (const session of sessions) {
    const existing = pets.get(session.id);
    if (existing) {
      existing.updateSession(session);
    } else {
      if (pets.has('default') && session.id !== 'default') {
        pets.delete('default');
      }
      const spacing = 100;
      const startX = (pets.size * spacing) % (window.innerWidth - 64);
      pets.set(session.id, new Pet(window.innerWidth, session, startX));
    }
  }

  // Spawn subagent mini-pets near their parent
  for (const sub of subagents) {
    if (pets.has(sub.id)) continue;
    const parent = pets.get(sub.parentId);
    const subSession: Session = {
      id: sub.id,
      status: sub.status,
      tool: sub.type,
      model: 'haiku', // subagents get smallest skin
      since: sub.since,
    };
    const startX = parent ? parent.x + parent.renderSize + 10 : Math.random() * window.innerWidth;
    const pet = new Pet(window.innerWidth, subSession, startX);
    pet.isSubagent = true;
    pets.set(sub.id, pet);
  }

  if (sessions.length === 0 && subagents.length === 0) {
    ensureDefaultPet();
  }
});

listen<PetState>('pet-state-changed', (event) => {
  updateState(event.payload);
});

// -- Cursor tracking --
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

    canvas.style.cursor = draggedPet ? 'grabbing' : hoveredPet ? 'grab' : 'default';

    const shouldBeClickThrough = !hoveredPet && !draggedPet;
    if (shouldBeClickThrough !== clickThroughEnabled) {
      clickThroughEnabled = shouldBeClickThrough;
      await appWindow.setIgnoreCursorEvents(shouldBeClickThrough);
    }
  } catch {
    // Ignore
  }
}

// -- Drag and drop --
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
  draggedPet.x = Math.max(0, Math.min(mx - dragOffsetX, window.innerWidth - draggedPet.renderSize));
  draggedPet.y = Math.max(0, Math.min(my - dragOffsetY, window.innerHeight - draggedPet.renderSize));
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
      pet.x = Math.random() * (window.innerWidth - pet.renderSize);
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

  for (const pet of pets.values()) {
    pet.setCanvasWidth(width);
    if (!pet.hasCustomY) {
      pet.y = defaultPetY(pet.renderSize);
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
