const test = require('node:test');
const assert = require('node:assert');
const { PixelMatcher, haveSameColors } = require('../src/core/pixel-matcher.js');

// Seeded generator so every run is identical.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomImage(pixelCount, random) {
  return Float32Array.from({ length: pixelCount * 3 }, () => Math.floor(random() * 256));
}

function shuffledCopy(rgb, random) {
  const pixels = [];
  for (let i = 0; i < rgb.length; i += 3) pixels.push([rgb[i], rgb[i + 1], rgb[i + 2]]);
  for (let i = pixels.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pixels[i], pixels[j]] = [pixels[j], pixels[i]];
  }
  return Float32Array.from(pixels.flat());
}

test('haveSameColors accepts a shuffle and rejects any changed pixel', () => {
  const random = seededRandom(4);
  const image = randomImage(50, random);
  assert.ok(haveSameColors(image, shuffledCopy(image, random)));
  const altered = Float32Array.from(image);
  altered[7] = (altered[7] + 1) % 256;
  assert.ok(!haveSameColors(image, altered));
});

test('rejects images of different sizes', () => {
  assert.throws(() => new PixelMatcher(new Float32Array(6), new Float32Array(9)), /same number/);
});

test('assignment uses every source pixel exactly once', () => {
  const random = seededRandom(1);
  const matcher = new PixelMatcher(randomImage(400, random), randomImage(400, random), random);
  matcher.refine(20000);
  const sorted = Array.from(matcher.assignment).sort((a, b) => a - b);
  assert.deepStrictEqual(sorted, Array.from({ length: 400 }, (_, i) => i));
});

test('refining never makes the match worse and usually improves it', () => {
  const random = seededRandom(2);
  const matcher = new PixelMatcher(randomImage(400, random), randomImage(400, random), random);
  const before = matcher.totalCost();
  matcher.refine(50000);
  assert.ok(matcher.totalCost() < before);
});

test('rebuilds the target exactly when the source holds the same pixels shuffled', () => {
  const random = seededRandom(3);
  const target = randomImage(100, random);
  const matcher = new PixelMatcher(shuffledCopy(target, random), target, random);
  matcher.refine(200000);
  assert.strictEqual(matcher.totalCost(), 0);
});
