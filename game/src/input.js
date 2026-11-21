// Keyboard + mouse input. Tracks held keys, edge-triggered presses, and the
// mouse orbit for the third-person camera. Also exposes an inject() path the
// headless test harness uses to press keys without a real keyboard.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {};   // edge: true only on the frame the key went down
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.pointerLocked = false;
    this.canvas = canvas;
    this.aimHeld = false;
    this.fireHeld = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    this._onMouseMove = (e) => {
      if (this.pointerLocked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    };
    this._onMouseDown = (e) => {
      this.mouseDown = true;
      if (e.button === 2) this.aimHeld = true;
      if (e.button === 0) this.fireHeld = true;
    };
    this._onMouseUp = (e) => {
      this.mouseDown = false;
      if (e.button === 2) this.aimHeld = false;
      if (e.button === 0) this.fireHeld = false;
    };
    this._onBlur = () => { this.keys = {}; this.fireHeld = false; this.aimHeld = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('click', () => {
      if (!this.pointerLocked && canvas.requestPointerLock) {
        try { canvas.requestPointerLock(); } catch (e) { /* headless */ }
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  }

  // Test harness: pretend a key was pressed / is held / released.
  inject(code, down) {
    if (down) { this.keys[code] = true; this.pressed[code] = true; }
    else this.keys[code] = false;
  }

  held(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.pressed[code]; }

  // Called at the end of each fixed step: edges live exactly one step.
  endStep() {
    this.pressed = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
