// Green dominates perceived brightness, so it weighs most when comparing colors.
const CHANNEL_WEIGHTS = [2, 4, 3];

/**
 * Decides where every source pixel should go so that, together, they look like the target.
 * assignment[targetIndex] = sourceIndex, and it is always a permutation:
 * each source pixel is used exactly once, nothing is added or recolored.
 */
class PixelMatcher {
  constructor(sourceRgb, targetRgb, random = Math.random) {
    if (sourceRgb.length !== targetRgb.length || sourceRgb.length % 3 !== 0) {
      throw new Error('Source and target must contain the same number of RGB pixels.');
    }
    this.source = sourceRgb;
    this.target = targetRgb;
    this.random = random;
    this.pixelCount = sourceRgb.length / 3;
    this.assignment = this.matchByBrightness();
  }

  /** Tries random pairs of pixels and swaps them when that brings both closer to the target. */
  refine(swapCount) {
    const { assignment, pixelCount, random } = this;
    let improvements = 0;
    for (let k = 0; k < swapCount; k++) {
      const first = (random() * pixelCount) | 0;
      const second = (random() * pixelCount) | 0;
      const a = assignment[first];
      const b = assignment[second];
      const current = this.distance(a, first) + this.distance(b, second);
      const swapped = this.distance(a, second) + this.distance(b, first);
      if (swapped < current) {
        assignment[first] = b;
        assignment[second] = a;
        improvements++;
      }
    }
    return improvements;
  }

  totalCost() {
    let cost = 0;
    for (let t = 0; t < this.pixelCount; t++) cost += this.distance(this.assignment[t], t);
    return cost;
  }

  distance(sourceIndex, targetIndex) {
    const s = sourceIndex * 3;
    const t = targetIndex * 3;
    const dr = this.source[s] - this.target[t];
    const dg = this.source[s + 1] - this.target[t + 1];
    const db = this.source[s + 2] - this.target[t + 2];
    return CHANNEL_WEIGHTS[0] * dr * dr + CHANNEL_WEIGHTS[1] * dg * dg + CHANNEL_WEIGHTS[2] * db * db;
  }

  // A cheap, decent starting point: darkest source pixel goes to the darkest target spot, and so on.
  matchByBrightness() {
    const sourceOrder = PixelMatcher.brightnessOrder(this.source, this.pixelCount);
    const targetOrder = PixelMatcher.brightnessOrder(this.target, this.pixelCount);
    const assignment = new Int32Array(this.pixelCount);
    for (let k = 0; k < this.pixelCount; k++) assignment[targetOrder[k]] = sourceOrder[k];
    return assignment;
  }

  static brightnessOrder(rgb, pixelCount) {
    const brightness = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      brightness[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
    }
    const order = Array.from({ length: pixelCount }, (_, i) => i);
    return order.sort((a, b) => brightness[a] - brightness[b]);
  }
}

/** True when both RGB lists hold exactly the same colors, in any order. */
function haveSameColors(firstRgb, secondRgb) {
  if (firstRgb.length !== secondRgb.length) return false;
  const sortedColors = (rgb) => {
    const packed = new Uint32Array(rgb.length / 3);
    for (let i = 0; i < packed.length; i++) packed[i] = (rgb[i * 3] << 16) | (rgb[i * 3 + 1] << 8) | rgb[i * 3 + 2];
    return packed.sort();
  };
  const first = sortedColors(firstRgb);
  const second = sortedColors(secondRgb);
  return first.every((color, i) => color === second[i]);
}

if (typeof module !== 'undefined') module.exports = { PixelMatcher, haveSameColors };
