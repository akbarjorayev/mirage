// Random swap attempts per pixel; more means a closer match but a longer wait.
const SWAPS_PER_PIXEL = 250;
// Keeps each chunk short enough that the page stays responsive while matching.
const SWAPS_PER_CHUNK = 120000;
const MORPH_DURATION_MS = 4500;
// A recording shows the photo still this long before the morph, and the result this long after it.
const STILL_MS = 3000;
const DEFAULT_FRAMING = Object.freeze({ quarterTurns: 0, anchor: 0.5 });
const BROKEN_RESULT_NOTE ='Something went wrong: the result does not match your pixels.';

/**
 * The whole Mirage flow, with no knowledge of the page: camera → photo → match → morph (recorded).
 * UI components subscribe to its state and call its methods; devices are injected.
 * Whatever the user picks last always wins: a new photo, target or camera tap cancels the running morph.
 */
class MorphSession {
  constructor({ camera, sampler, animator, recorder, images, backgroundRgb = () => null, prefersReducedMotion = () => false, nextFrame, now }) {
    this.camera = camera;
    this.sampler = sampler;
    this.animator = animator;
    this.recorder = recorder;
    this.images = images;
    this.backgroundRgb = backgroundRgb;
    this.prefersReducedMotion = prefersReducedMotion;
    this.nextFrame = nextFrame ?? (() => new Promise((resolve) => requestAnimationFrame(resolve)));
    this.now = now ?? (() => performance.now());
    this.listeners = new Set();
    this.photoRgb = null;
    this.video = null;
    // The full source images, and how each is framed: quarter turns clockwise, then where the
    // square is cut (anchor 0–1 along the longer side).
    this.photoImage = null;
    this.photoFraming = DEFAULT_FRAMING;
    this.targetImage = null;
    this.targetFraming = DEFAULT_FRAMING;
    // Bumped whenever running work must stop; a morph that sees a newer generation quits.
    this.generation = 0;
    this.morphRequested = false;
    this.draining = false;
    // The square photo exactly as captured or cropped, shown untouched until the pixels start moving.
    this.photoSquare = null;
    // display: what the photo square shows — 'none', 'camera', 'still' (the captured photo) or 'result' (the pixels).
    this.state = { display: 'none', still: null, note: '', morphing: false, recording: false, hasResult: false, target: null };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return {
      ...this.state,
      cameraRunning: this.camera.isRunning,
      hasVideo: this.video !== null,
      canRecord: this.recorder.isSupported,
      photoAdjustable: this.photoImage !== null,
      targetAdjustable: this.targetImage !== null,
    };
  }

  start(defaultTargetUrl) {
    this.useTarget(this.images.fromUrl(defaultTargetUrl, 'the default portrait'));
    return this.openCamera();
  }

  /** Clicking the photo square or camera button: snap while the camera is live, otherwise open it. */
  tapPhoto() {
    return this.camera.isRunning ? this.snap() : this.openCamera();
  }

  async openCamera() {
    this.cancelRunningWork();
    const generation = this.generation;
    this.photoRgb = null;
    this.photoSquare = null;
    this.photoImage = null;
    this.video = null;
    this.update({ display: 'none', still: null, morphing: false, recording: false, hasResult: false, note: 'Starting camera…' });
    try {
      await this.camera.start();
      // A photo was picked while the camera was starting: that photo wins.
      if (generation !== this.generation) return this.camera.stop();
      this.update({ display: 'camera', note: '' });
    } catch (error) {
      this.update({ note: `${error.message} You can also drop a photo here.` });
    }
    return undefined;
  }

  snap() {
    const photo = this.camera.capture();
    this.camera.stop();
    this.photoImage = photo;
    this.photoFraming = DEFAULT_FRAMING;
    return this.requestMorph(photo);
  }

  async usePhotoFile(file) {
    try {
      const image = await this.images.fromFile(file);
      this.camera.stop();
      this.photoImage = image;
      this.photoFraming = { quarterTurns: 0, anchor: this.images.defaultAnchor(image) };
      await this.requestMorph(this.frame(image, this.photoFraming));
    } catch (error) {
      this.update({ note: error.message });
    }
  }

  /** Re-frames your photo (rotation and crop position) and morphs again. */
  setPhotoFraming(framing) {
    if (!this.photoImage) return Promise.resolve();
    this.photoFraming = framing;
    return this.requestMorph(this.frame(this.photoImage, framing));
  }

  useTargetFile(file) {
    return this.useTarget(this.images.fromFile(file));
  }

  async useTarget(imagePromise) {
    try {
      const image = await imagePromise;
      this.targetImage = image;
      this.targetFraming = { quarterTurns: 0, anchor: this.images.defaultAnchor(image) };
      await this.showFramedTarget();
    } catch (error) {
      this.update({ note: error.message });
    }
  }

  /** Re-frames the target picture (rotation and crop position) and morphs again. */
  setTargetFraming(framing) {
    if (!this.targetImage) return Promise.resolve();
    this.targetFraming = framing;
    return this.showFramedTarget();
  }

  async showFramedTarget() {
    this.update({ target: this.frame(this.targetImage, this.targetFraming) });
    if (this.photoRgb) await this.requestMorph();
  }

  frame(image, { quarterTurns, anchor }) {
    return this.images.cropSquare(this.images.rotate(image, quarterTurns), anchor);
  }

  /** Starts a morph with the current photo and target (and a new photo, if given), cancelling any running one. */
  requestMorph(photoCanvas) {
    if (photoCanvas) {
      this.photoSquare = photoCanvas;
      this.photoRgb = this.sampler.sample(photoCanvas);
    }
    this.cancelRunningWork();
    this.morphRequested = true;
    return this.drainMorphRequests();
  }

  cancelRunningWork() {
    this.generation++;
    this.animator.stop();
    this.recorder.cancel();
  }

  async drainMorphRequests() {
    if (this.draining) return;
    this.draining = true;
    while (this.morphRequested) {
      this.morphRequested = false;
      await this.morph(this.generation);
    }
    this.draining = false;
  }

  /** Rearranges the photo's pixels into the target in place, starting straight away. */
  async morph(generation) {
    const { target } = this.state;
    const photoRgb = this.photoRgb;
    if (!target || !photoRgb) return;
    const isStale = () => generation !== this.generation;

    this.video = null;
    const matcher = new PixelMatcher(photoRgb, this.sampler.sample(target));
    // While matching, the square keeps showing the photo exactly as taken, like a paused video.
    this.update({ display: 'still', still: this.photoSquare, morphing: true, recording: false, hasResult: false, note: '' });

    await this.refine(matcher, isStale);
    if (isStale()) return;
    // Swap to the pixel canvas only now, as the pixels start to move.
    this.animator.load(photoRgb, matcher.assignment);
    this.update({ display: 'result' });
    await this.animator.play(this.morphDurationMs());
    if (isStale()) return;

    // Read the finished picture back and prove it holds exactly the photo's pixels.
    const intact = haveSameColors(photoRgb, this.animator.drawnColors());
    this.update({ morphing: false, hasResult: true, note: intact ? '' : BROKEN_RESULT_NOTE });
  }

  /** Plays the finished morph again; clicking again restarts it. */
  replay() {
    if (!this.state.hasResult || this.state.morphing || this.state.recording) return Promise.resolve();
    return this.animator.play(this.morphDurationMs());
  }

  /** Records the photo held still, the morph, then the result held still, as a video. */
  async record() {
    const { hasResult, morphing, recording } = this.state;
    if (!hasResult || morphing || recording || !this.recorder.isSupported) return;
    const generation = this.generation;
    const isStale = () => generation !== this.generation;

    this.update({ recording: true });
    // Video has no transparency, so the gaps between flying pixels get the square's color.
    this.animator.setBackground(this.backgroundRgb());
    try {
      this.recorder.start();
      await this.holdFrame(0, this.now() + STILL_MS, isStale);
      if (isStale()) return;
      await this.animator.play(MORPH_DURATION_MS);
      if (isStale()) return;
      await this.holdFrame(1, this.now() + STILL_MS, isStale);
      if (isStale()) return;
      const blob = await this.recorder.stop();
      if (isStale()) return;
      this.video = { blob, extension: this.recorder.fileExtension };
    } finally {
      // Cancelled or finished, the live square goes back to transparent gaps.
      this.animator.setBackground(null);
      if (!isStale()) {
        this.animator.renderAt(1);
        this.update({ recording: false });
      }
    }
  }

  imageBlob() {
    return this.animator.finalImageBlob();
  }

  async refine(matcher, isStale) {
    const totalSwaps = matcher.pixelCount * SWAPS_PER_PIXEL;
    for (let done = 0; done < totalSwaps && !isStale(); done += SWAPS_PER_CHUNK) {
      matcher.refine(Math.min(SWAPS_PER_CHUNK, totalSwaps - done));
      await this.nextFrame();
    }
  }

  // Keeps redrawing one moment of the morph (0 = photo, 1 = result) so the recorder gets frames the whole time.
  async holdFrame(progress, until, isStale) {
    while (this.now() < until && !isStale()) {
      this.animator.renderAt(progress);
      await this.nextFrame();
    }
  }

  morphDurationMs() {
    return this.prefersReducedMotion() ? 0 : MORPH_DURATION_MS;
  }

  update(changes) {
    Object.assign(this.state, changes);
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

if (typeof module !== 'undefined') module.exports = { MorphSession };
