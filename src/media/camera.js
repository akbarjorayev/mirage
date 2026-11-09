/** Front camera shown in a <video>, able to snap a mirrored square photo. */
class Camera {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
  }

  async start() {
    if (this.isRunning) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser cannot open the camera here. Upload a photo instead, or open the page through a local server (see README).');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
    } catch (error) {
      throw new Error(`Camera unavailable (${error.name}). Allow camera access or upload a photo instead.`);
    }
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  get isRunning() {
    return this.stream !== null;
  }

  capture() {
    return squareCanvasFrom(this.video, this.video.videoWidth, this.video.videoHeight, { mirrored: true });
  }

  /** Releases the camera so the device's camera light turns off. */
  stop() {
    if (!this.isRunning) return;
    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
