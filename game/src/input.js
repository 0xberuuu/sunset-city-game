// Keyboard and mouse state. Actions are edge-triggered (pressed this frame)
// so menus and interactions never double-fire.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_INTERACT = 'interact';
export const ACTION_MUTE = 'mute';
export const ACTION_WEAPON = 'weapon';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'brake',
  KeyE: 'interact',
  KeyF: 'punch',
  KeyQ: 'weapon',
  KeyM: 'mute',
  KeyR: 'restart',
  Enter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, wheel: 0 };
  let enabled = true;

  function onKeyDown(event) {
    if (!enabled) return;
    const action = KEYMAP[event.code];
    if (!action) return;
    if (['up', 'down', 'left', 'right', 'brake'].includes(action)) event.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }

  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) held.delete(action);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  function onWheel(event) {
    mouse.wheel += Math.sign(event.deltaY);
  }

  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    isHeld(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    consume(action) { pressed.delete(action); },
    axis() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      return { x, y };
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
      mouse.wheel = 0;
    },
    setEnabled(value) { enabled = value; },
  };
}
