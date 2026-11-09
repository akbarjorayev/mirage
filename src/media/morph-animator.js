// Fraction of the timeline used to stagger start times; the rest is travel time.
const MAX_START_DELAY = 0.4;
const TRAVEL_SPAN = 1 - MAX_START_DELAY;
// How far pixels bow sideways while flying, relative to their travel distance.
const ARC_STRENGTH = 0.5;
// Fully transparent, so gaps between flying pixels show the square's own (theme-aware) color.
const TRANSPARENT = 0;

function packColor(r, g, b) {
  // ImageData is RGBA in memory; read as little-endian 32-bit words that is ABGR.
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Flies every pixel of the source photo from where it started to where the matcher put it. */
class MorphAnimator {
  constructor(canvas, gridSize, cellSize) {
    this.canvas = canvas;
    this.gridSize = gridSize;
    this.cellSize = cellSize;
    this.side = gridSize * cellSize;
    canvas.width = canvas.height = this.side;
    this.context = canvas.getContext('2d');
    this.imageData = this.context.createImageData(this.side, this.side);
    this.pixels = new Uint32Array(this.imageData.data.buffer);
    this.background = TRANSPARENT;
    this.frameRequest = 0;
  }

  load(sourceRgb, assignment, random = Math.random) {
    const count = assignment.length;
    const grid = this.gridSize;
    this.count = count;
    this.startX = new Float32Array(count);
    this.startY = new Float32Array(count);
    this.endX = new Float32Array(count);
    this.endY = new Float32Array(count);
    this.colors = new Uint32Array(count);
    this.delays = new Float32Array(count);
    this.arcs = new Float32Array(count);

    for (let target = 0; target < count; target++) {
      const source = assignment[target];
      this.startX[target] = source % grid;
      this.startY[target] = (source / grid) | 0;
      this.endX[target] = target % grid;
      this.endY[target] = (target / grid) | 0;
      this.colors[target] = packColor(sourceRgb[source * 3], sourceRgb[source * 3 + 1], sourceRgb[source * 3 + 2]);
      // Rows lower in the final image leave a bit later, so the picture "pours" into place.
      this.delays[target] = (this.endY[target] / grid) * MAX_START_DELAY * 0.6 + random() * MAX_START_DELAY * 0.4;
      this.arcs[target] = (random() - 0.5) * ARC_STRENGTH;
    }
    this.renderAt(0);
  }

  /** Animates from photo to result. Calling it again, or stop(), ends the previous run early. */
  play(durationMs) {
    this.stop();
    if (durationMs <= 0) {
      this.renderAt(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.finishPlay = resolve;
      const startTime = performance.now();
      const tick = (now) => {
        const progress = clamp01((now - startTime) / durationMs);
        this.renderAt(progress);
        if (progress < 1) this.frameRequest = requestAnimationFrame(tick);
        else this.stop();
      };
      this.frameRequest = requestAnimationFrame(tick);
    });
  }

  stop() {
    cancelAnimationFrame(this.frameRequest);
    const finish = this.finishPlay;
    this.finishPlay = null;
    finish?.();
  }

  renderAt(progress) {
    this.pixels.fill(this.background);
    const cell = this.cellSize;
    for (let k = 0; k < this.count; k++) {
      const eased = easeInOutCubic(clamp01((progress - this.delays[k]) / TRAVEL_SPAN));
      const dx = this.endX[k] - this.startX[k];
      const dy = this.endY[k] - this.startY[k];
      const bow = Math.sin(Math.PI * eased) * this.arcs[k];
      const x = this.startX[k] + dx * eased - dy * bow;
      const y = this.startY[k] + dy * eased + dx * bow;
      this.fillCell(Math.round(x * cell), Math.round(y * cell), this.colors[k]);
    }
    this.context.putImageData(this.imageData, 0, 0);
  }

  /** The finished picture as a PNG, whatever moment is on screen right now (e.g. mid-replay). */
  finalImageBlob() {
    const grid = this.gridSize;
    const small = document.createElement('canvas');
    small.width = small.height = grid;
    const smallContext = small.getContext('2d');
    const image = smallContext.createImageData(grid, grid);
    // colors[] is indexed by final position, so it already is the finished picture.
    new Uint32Array(image.data.buffer).set(this.colors);
    smallContext.putImageData(image, 0, 0);

    const output = document.createElement('canvas');
    output.width = output.height = this.side;
    const outputContext = output.getContext('2d');
    outputContext.imageSmoothingEnabled = false;
    outputContext.drawImage(small, 0, 0, this.side, this.side);
    return new Promise((resolve) => output.toBlob(resolve, 'image/png'));
  }

  /** Fills the gaps between pixels with a solid color, or makes them transparent again with null. */
  setBackground(rgb) {
    this.background = rgb ? packColor(...rgb) : TRANSPARENT;
  }

  /** Reads back the color drawn in each grid cell, so the result can be checked against the photo. */
  drawnColors() {
    const grid = this.gridSize;
    const data = this.imageData.data;
    const rgb = new Float32Array(grid * grid * 3);
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const from = (row * this.cellSize * this.side + col * this.cellSize) * 4;
        const to = (row * grid + col) * 3;
        rgb[to] = data[from];
        rgb[to + 1] = data[from + 1];
        rgb[to + 2] = data[from + 2];
      }
    }
    return rgb;
  }

  fillCell(left, top, color) {
    const cell = this.cellSize;
    const maxStart = this.side - cell;
    const x = left < 0 ? 0 : left > maxStart ? maxStart : left;
    const y = top < 0 ? 0 : top > maxStart ? maxStart : top;
    for (let row = 0; row < cell; row++) {
      const offset = (y + row) * this.side + x;
      this.pixels.fill(color, offset, offset + cell);
    }
  }
}
