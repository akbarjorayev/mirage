const test = require('node:test');
const assert = require('node:assert');
const { PixelMatcher, haveSameColors } = require('../src/core/pixel-matcher.js');

// In the browser these are globals from earlier <script> tags.
globalThis.PixelMatcher = PixelMatcher;
globalThis.haveSameColors = haveSameColors;
const { MorphSession } = require('../src/core/morph-session.js');

const square = (values) => ({ rgb: Float32Array.from(values), width: 2, height: 2 });
const PHOTO = square([10, 10, 10, 200, 200, 200, 90, 90, 90, 30, 30, 30]);
const OTHER_PHOTO = square([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const TARGET = square([200, 200, 200, 30, 30, 30, 10, 10, 10, 90, 90, 90]);
const OTHER_TARGET = square([90, 90, 90, 10, 10, 10, 200, 200, 200, 30, 30, 30]);
// A wide photo: cropping its left half gives PHOTO, its right half OTHER_PHOTO.
const WIDE_PHOTO = { width: 4, height: 2, left: PHOTO, right: OTHER_PHOTO };
// What any rotated image crops to, so tests can tell a rotation happened.
const ROTATED_PHOTO = square([5, 5, 5, 50, 50, 50, 150, 150, 150, 250, 250, 250]);

function fakeRotate(image, quarterTurns) {
  if (quarterTurns % 4 === 0) return image;
  const swap = quarterTurns % 2 === 1;
  return { rotatedFrom: image, width: swap ? image.height : image.width, height: swap ? image.width : image.height };
}

function fakeCropSquare(image, anchor) {
  if (image.rotatedFrom) return ROTATED_PHOTO;
  if (image.left) return anchor < 0.5 ? image.left : image.right;
  return image;
}

class FakeCamera {
  constructor({ failWith } = {}) {
    this.isRunning = false;
    this.failWith = failWith;
  }
  async start() {
    if (this.failWith) throw new Error(this.failWith);
    this.isRunning = true;
  }
  stop() { this.isRunning = false; }
  capture() { return PHOTO; }
}

// Draws the loaded source pixels in their assigned spots, like the real animator's final frame.
class FakeAnimator {
  constructor() {
    this.paused = false;
    this.rendered = [];
    this.background = null;
  }
  load(sourceRgb, assignment) {
    this.sourceRgb = sourceRgb;
    this.assignment = Int32Array.from(assignment);
  }
  play() {
    this.onPlay?.();
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => { this.release = resolve; });
  }
  stop() {
    this.release?.();
    this.release = null;
  }
  renderAt(progress) { this.rendered.push(progress); }
  setBackground(rgb) { this.background = rgb; }
  drawnColors() {
    const drawn = new Float32Array(this.sourceRgb.length);
    this.assignment.forEach((source, target) => drawn.set(this.sourceRgb.subarray(source * 3, source * 3 + 3), target * 3));
    return drawn;
  }
}

class FakeRecorder {
  constructor() {
    this.isSupported = true;
    this.fileExtension = 'mp4';
    this.recording = false;
    this.takes = 0;
    this.cancelled = 0;
  }
  start() { this.recording = true; this.takes++; }
  async stop() { this.recording = false; return `video-${this.takes}`; }
  cancel() {
    if (!this.recording) return;
    this.recording = false;
    this.cancelled++;
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

async function waitFor(condition) {
  for (let i = 0; i < 1000 && !condition(); i++) await settle();
}

async function waitUntilIdle(session) {
  await settle();
  await waitFor(() => !session.snapshot().morphing);
}

function createSession(cameraOptions) {
  let clock = 0;
  const sampled = [];
  const session = new MorphSession({
    camera: new FakeCamera(cameraOptions),
    sampler: { sample: (image) => { sampled.push(image); return image.rgb; } },
    animator: new FakeAnimator(),
    recorder: new FakeRecorder(),
    images: {
      fromFile: async (file) => file.image,
      fromUrl: async () => TARGET,
      rotate: fakeRotate,
      cropSquare: fakeCropSquare,
      defaultAnchor: () => 0,
    },
    backgroundRgb: () => [1, 2, 3],
    nextFrame: async () => { clock += 16; },
    now: () => clock,
  });
  session.sampled = sampled;
  return session;
}

async function startAndSnap(session) {
  await session.start('default.jpg');
  await session.tapPhoto();
}

test('taking a photo stops the camera and morphs straight away, without recording', async () => {
  const session = createSession();
  await session.start('default.jpg');
  assert.strictEqual(session.snapshot().display, 'camera');
  let playedAt = null;
  session.animator.onPlay = () => { playedAt = session.now(); };

  const startedAt = session.now();
  await session.tapPhoto();

  const state = session.snapshot();
  assert.ok(playedAt - startedAt < 1000, 'no waiting before the pixels move');
  assert.strictEqual(state.cameraRunning, false);
  assert.strictEqual(state.display, 'result');
  assert.strictEqual(state.hasResult, true);
  assert.strictEqual(state.morphing, false);
  assert.strictEqual(state.note, '');
  assert.strictEqual(state.hasVideo, false);
  assert.strictEqual(session.recorder.takes, 0);
});

test('after capture the square shows the photo as taken until the pixels start moving', async () => {
  const session = createSession();
  await session.start('default.jpg');
  const seen = [];
  session.subscribe((state) => seen.push(state.display));
  let displayWhenPixelsMove = null;
  session.animator.onPlay = () => { displayWhenPixelsMove = session.snapshot().display; };

  await session.tapPhoto();

  const changes = seen.filter((display, i) => display !== seen[i - 1]);
  assert.deepStrictEqual(changes.slice(-3), ['camera', 'still', 'result'], 'camera → captured photo → pixels');
  assert.strictEqual(session.snapshot().still, PHOTO, 'the still is the exact captured frame');
  assert.strictEqual(displayWhenPixelsMove, 'result');
});

test('recording holds the photo 3s, morphs, holds the result 3s, then offers the video', async () => {
  const session = createSession();
  await startAndSnap(session);
  session.animator.rendered = [];
  let playedAt = null;
  session.animator.onPlay = () => { playedAt = session.now(); };

  const startedAt = session.now();
  await session.record();

  assert.ok(playedAt - startedAt >= 3000, 'photo shown for at least 3s before the morph');
  assert.ok(session.now() - playedAt >= 3000, 'result shown for at least 3s after the morph');
  assert.strictEqual(session.animator.rendered[0], 0);
  assert.strictEqual(session.animator.rendered.at(-1), 1);
  assert.deepStrictEqual(session.video, { blob: 'video-1', extension: 'mp4' });
  assert.strictEqual(session.snapshot().recording, false);
  assert.strictEqual(session.animator.background, null, 'transparent again after recording');
});

test('recording needs a finished result', async () => {
  const session = createSession();
  await session.start('default.jpg');
  await session.record();
  assert.strictEqual(session.recorder.takes, 0);
});

test('a new photo throws away the previous video', async () => {
  const session = createSession();
  await startAndSnap(session);
  await session.record();

  await session.usePhotoFile({ image: OTHER_PHOTO });

  assert.strictEqual(session.snapshot().hasVideo, false);
  assert.strictEqual(session.animator.sourceRgb, OTHER_PHOTO.rgb);
});

test('opening the camera mid-recording cancels the recording', async () => {
  const session = createSession();
  await startAndSnap(session);
  session.animator.paused = true;
  session.record();
  await waitFor(() => session.animator.release);

  await session.tapPhoto();
  await settle();

  assert.strictEqual(session.recorder.cancelled, 1);
  assert.strictEqual(session.snapshot().recording, false);
  assert.strictEqual(session.snapshot().hasVideo, false);
  assert.strictEqual(session.animator.background, null);
});

test('changing the target mid-morph cancels it and morphs into the new target', async () => {
  const session = createSession();
  await session.start('default.jpg');
  session.animator.paused = true;
  session.tapPhoto();
  await waitFor(() => session.animator.release);
  session.animator.paused = false;

  await session.useTargetFile({ image: OTHER_TARGET });
  await waitUntilIdle(session);

  assert.strictEqual(session.sampled.at(-1), OTHER_TARGET, 'last morph used the new target');
  assert.strictEqual(session.snapshot().hasResult, true);
});

test('a photo uploaded mid-morph is used right away', async () => {
  const session = createSession();
  await session.start('default.jpg');
  session.animator.paused = true;
  session.tapPhoto();
  await waitFor(() => session.animator.release);
  session.animator.paused = false;

  await session.usePhotoFile({ image: OTHER_PHOTO });
  await waitUntilIdle(session);

  assert.strictEqual(session.animator.sourceRgb, OTHER_PHOTO.rgb);
  assert.strictEqual(session.snapshot().hasResult, true);
});

test('opening the camera mid-morph cancels the morph', async () => {
  const session = createSession();
  await session.start('default.jpg');
  session.animator.paused = true;
  session.tapPhoto();
  await waitFor(() => session.animator.release);

  await session.tapPhoto();
  await settle();

  const state = session.snapshot();
  assert.strictEqual(state.display, 'camera');
  assert.strictEqual(state.morphing, false);
  assert.strictEqual(state.hasResult, false);
});

test('replay only works once there is a result', async () => {
  const session = createSession();
  await session.start('default.jpg');
  let plays = 0;
  session.animator.onPlay = () => { plays++; };

  await session.replay();
  assert.strictEqual(plays, 0);

  await session.tapPhoto();
  plays = 0;
  await session.replay();
  assert.strictEqual(plays, 1);
});

test('moving the crop on a wide photo re-morphs with that part', async () => {
  const session = createSession();
  await session.start('default.jpg');

  await session.usePhotoFile({ image: WIDE_PHOTO });
  assert.strictEqual(session.snapshot().photoAdjustable, true);
  assert.strictEqual(session.animator.sourceRgb, PHOTO.rgb, 'starts with the default (left) crop');

  await session.setPhotoFraming({ quarterTurns: 0, anchor: 1 });
  await waitUntilIdle(session);
  assert.strictEqual(session.animator.sourceRgb, OTHER_PHOTO.rgb, 'now uses the right part');
});

test('rotating your photo re-morphs with the rotated picture, camera photos included', async () => {
  const session = createSession();
  await startAndSnap(session);
  assert.strictEqual(session.snapshot().photoAdjustable, true, 'a camera photo can be rotated too');

  await session.setPhotoFraming({ quarterTurns: 1, anchor: 0.5 });
  await waitUntilIdle(session);

  assert.strictEqual(session.animator.sourceRgb, ROTATED_PHOTO.rgb);
  assert.strictEqual(session.snapshot().still, ROTATED_PHOTO, 'the still shows the rotated photo');
});

test('rotating the target re-morphs into the rotated target', async () => {
  const session = createSession();
  await startAndSnap(session);
  assert.strictEqual(session.snapshot().targetAdjustable, true);

  await session.setTargetFraming({ quarterTurns: 3, anchor: 0.5 });
  await waitUntilIdle(session);

  assert.strictEqual(session.snapshot().target, ROTATED_PHOTO);
  assert.strictEqual(session.sampled.at(-1), ROTATED_PHOTO, 'the morph used the rotated target');
});

test('a blocked camera explains itself instead of failing silently', async () => {
  const session = createSession({ failWith: 'Camera unavailable (NotAllowedError).' });
  await session.start('default.jpg');

  const state = session.snapshot();
  assert.strictEqual(state.display, 'none');
  assert.match(state.note, /Camera unavailable/);
});

test('subscribers hear every state change', async () => {
  const session = createSession();
  const seen = [];
  session.subscribe((state) => seen.push(state.display));
  await startAndSnap(session);
  assert.ok(seen.includes('camera'));
  assert.strictEqual(seen.at(-1), 'result');
});
