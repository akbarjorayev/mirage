// How much of the screen the whole image may take up in the dialog.
const ADJUST_VIEW_MAX_WIDTH = 0.9;
const ADJUST_VIEW_MAX_HEIGHT = 0.75;
const ANCHOR_NUDGE = 0.05;

/**
 * Full-screen view of a whole image with a square on it: rotate it in 90° steps, and tap or drag
 * to choose which square part is used. open() resolves with { quarterTurns, anchor }, or null when cancelled.
 */
class AdjustDialog {
  constructor({ rotate }) {
    this.rotate = rotate;
    this.preview = createElement('<canvas class="block h-full w-full"></canvas>');
    // The huge shadow darkens everything outside the square.
    this.frame = createElement('<div class="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"></div>');
    this.stage = createElement('<div class="relative touch-none select-none overflow-hidden"></div>');
    this.stage.append(this.preview, this.frame);

    const cancel = new IconButton({ icon: 'x', label: 'Cancel', onClick: () => this.close(null) });
    const rotate90 = new IconButton({ icon: 'rotate-cw', label: 'Rotate 90°', onClick: () => this.rotateQuarter() });
    this.confirm = new IconButton({ icon: 'check', label: 'Apply', onClick: () => this.close(this.framing()) });
    const toolbar = createElement('<div class="flex gap-2"></div>');
    toolbar.append(cancel.element, rotate90.element, this.confirm.element);

    this.element = createElement('<div class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-label="Rotate and crop" hidden></div>');
    this.element.append(this.stage, toolbar);
    this.resolve = null;
    this.enablePointer();
    this.enableKeys();
    window.addEventListener('resize', () => {
      if (this.isOpen) this.layout();
    });
  }

  get isOpen() {
    return !this.element.hidden;
  }

  open(image, { quarterTurns, anchor }) {
    this.image = image;
    this.quarterTurns = quarterTurns;
    this.anchor = anchor;
    this.element.hidden = false;
    this.drawPreview();
    this.confirm.element.focus();
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  close(result) {
    if (!this.isOpen) return;
    this.element.hidden = true;
    this.resolve?.(result);
    this.resolve = null;
  }

  framing() {
    return { quarterTurns: this.quarterTurns, anchor: this.anchor };
  }

  rotateQuarter() {
    this.quarterTurns = (this.quarterTurns + 1) % 4;
    // The long side may have changed direction, so start the square from the middle again.
    this.anchor = 0.5;
    this.drawPreview();
  }

  drawPreview() {
    const rotated = this.rotate(this.image, this.quarterTurns);
    this.preview.width = rotated.width;
    this.preview.height = rotated.height;
    this.preview.getContext('2d').drawImage(rotated, 0, 0);
    this.layout();
  }

  layout() {
    const { width, height } = this.preview;
    const scale = Math.min((window.innerWidth * ADJUST_VIEW_MAX_WIDTH) / width, (window.innerHeight * ADJUST_VIEW_MAX_HEIGHT) / height);
    this.displayWidth = width * scale;
    this.displayHeight = height * scale;
    this.side = Math.min(this.displayWidth, this.displayHeight);
    this.isLandscape = this.displayWidth > this.displayHeight;
    // Only a non-square image has anywhere for the square to move.
    this.stage.style.cursor = this.travel() > 0 ? 'grab' : 'default';
    Object.assign(this.stage.style, { width: `${this.displayWidth}px`, height: `${this.displayHeight}px` });
    Object.assign(this.frame.style, { width: `${this.side}px`, height: `${this.side}px` });
    this.placeFrame();
  }

  placeFrame() {
    const offset = this.travel() * this.anchor;
    this.frame.style.left = `${this.isLandscape ? offset : 0}px`;
    this.frame.style.top = `${this.isLandscape ? 0 : offset}px`;
  }

  // How far the square can slide along the longer side.
  travel() {
    return Math.max(this.displayWidth, this.displayHeight) - this.side;
  }

  setAnchor(anchor) {
    if (this.travel() <= 0) return;
    this.anchor = Math.min(1, Math.max(0, anchor));
    this.placeFrame();
  }

  // Tapping centres the square on that spot; dragging keeps it under the finger or mouse.
  enablePointer() {
    let dragging = false;
    const centreOn = (event) => {
      const rect = this.stage.getBoundingClientRect();
      const along = this.isLandscape ? event.clientX - rect.left : event.clientY - rect.top;
      this.setAnchor((along - this.side / 2) / this.travel());
    };
    this.stage.addEventListener('pointerdown', (event) => {
      dragging = true;
      this.stage.setPointerCapture(event.pointerId);
      centreOn(event);
    });
    this.stage.addEventListener('pointermove', (event) => {
      if (dragging) centreOn(event);
    });
    const stop = () => { dragging = false; };
    this.stage.addEventListener('pointerup', stop);
    this.stage.addEventListener('pointercancel', stop);
  }

  // Esc cancels, Enter applies, R rotates, arrow keys nudge the square.
  enableKeys() {
    window.addEventListener('keydown', (event) => {
      if (!this.isOpen) return;
      if (event.key === 'Escape') this.close(null);
      else if (event.key === 'Enter') this.close(this.framing());
      else if (event.key === 'r' || event.key === 'R') this.rotateQuarter();
      else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) this.setAnchor(this.anchor - ANCHOR_NUDGE);
      else if (['ArrowRight', 'ArrowDown'].includes(event.key)) this.setAnchor(this.anchor + ANCHOR_NUDGE);
      else return;
      event.preventDefault();
    });
  }
}
