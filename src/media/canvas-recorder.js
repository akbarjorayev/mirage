const VIDEO_FRAME_RATE = 60;
const VIDEO_BITS_PER_SECOND = 8_000_000;
// Preferred first: MP4 plays everywhere; WebM is the fallback older Chrome and Firefox record.
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

/** Records whatever is drawn on a canvas into a video file. */
class CanvasRecorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.mimeType = typeof MediaRecorder === 'undefined'
      ? null
      : VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
    this.recorder = null;
    this.chunks = [];
  }

  get isSupported() {
    return this.mimeType !== null && typeof this.canvas.captureStream === 'function';
  }

  get fileExtension() {
    return this.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  }

  start() {
    const stream = this.canvas.captureStream(VIDEO_FRAME_RATE);
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType: this.mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  get isRecording() {
    return this.recorder?.state === 'recording';
  }

  /** Stops recording and throws the footage away. */
  cancel() {
    if (!this.isRecording) return;
    const recorder = this.recorder;
    this.recorder = null;
    recorder.ondataavailable = null;
    recorder.onstop = () => recorder.stream.getTracks().forEach((track) => track.stop());
    recorder.stop();
  }

  /** Stops recording and resolves with the finished video. */
  stop() {
    return new Promise((resolve) => {
      this.recorder.onstop = () => {
        this.recorder.stream.getTracks().forEach((track) => track.stop());
        resolve(new Blob(this.chunks, { type: this.mimeType.split(';')[0] }));
      };
      this.recorder.stop();
    });
  }
}
