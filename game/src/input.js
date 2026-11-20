// Keyboard + mouse input. Tracks held keys, edge-triggered presses, and camera
// orbit drag. Arrow keys also rotate the camera so the game is fully testable
// without a mouse. All state is plain data — no wall-clock reads.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each sim step
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.enabled = true;
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    this._onMouseDown = (e) => {
      this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
    };
    this._onMouseMove = (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this.lastX;
      this.mouseDY += e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
    };
    this._onMouseUp = () => { this.dragging = false; };
    this._onBlur = () => { this.keys.clear(); this.dragging = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(k) { return this.keys.has(k); }
  hit(k) { return this.pressed.has(k); }
  // Called by the world at the end of each fixed step.
  endStep() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
  // Test hooks: inject synthetic input from Playwright.
  injectKey(k, isDown) {
    if (isDown) { if (!this.keys.has(k)) this.pressed.add(k); this.keys.add(k); }
    else this.keys.delete(k);
  }
  injectMouse(dx, dy) { this.mouseDX += dx; this.mouseDY += dy; }
}
