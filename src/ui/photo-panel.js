/** Left panel: your camera or photo, rearranged in place, with its toolbar. Renders session state. */
class PhotoPanel {
  constructor(actions) {
    this.video = createElement('<video class="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsinline muted hidden></video>');
    this.canvas = createElement('<canvas class="absolute inset-0 h-full w-full [image-rendering:pixelated]" hidden></canvas>');
    // The captured photo, shown untouched (like a paused video) until the pixels start moving.
    this.still = createElement('<span class="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" hidden></span>');
    this.shownStill = null;
    this.note = createElement('<span class="relative px-6 text-center text-xs text-neutral-500 dark:text-neutral-400" hidden></span>');

    this.buttons = {
      camera: new IconButton({ icon: 'camera', label: 'Take photo', onClick: actions.onTap }),
      upload: new FilePickerButton({ icon: 'image-up', label: 'Upload your photo', onFile: actions.onFile }),
      adjust: new IconButton({ icon: 'pencil', label: 'Rotate or crop your photo', onClick: actions.onAdjust }),
      replay: new IconButton({ icon: 'rotate-ccw', label: 'Replay', onClick: actions.onReplay }),
      record: new IconButton({ icon: 'circle-dot', label: 'Record video', onClick: actions.onRecord, tone: 'record' }),
      saveImage: new IconButton({ icon: 'image-down', label: 'Download image', onClick: actions.onSaveImage }),
      saveVideo: new IconButton({ icon: 'file-video', label: 'Download video', onClick: actions.onSaveVideo }),
    };

    this.square = new DropSquare({ label: 'Take photo', onClick: actions.onTap, onFile: actions.onFile });
    this.square.add(this.video, this.still, this.canvas, this.note);
    this.element = createPanel(Object.values(this.buttons).map((button) => button.element), this.square.element);
  }

  render(state) {
    this.video.hidden = state.display !== 'camera';
    this.still.hidden = state.display !== 'still';
    this.canvas.hidden = state.display !== 'result';
    if (state.still && state.still !== this.shownStill) {
      this.still.replaceChildren(state.still);
      this.shownStill = state.still;
    }
    this.note.textContent = state.note;
    this.note.hidden = !state.note;

    const cameraLabel = state.cameraRunning ? 'Take photo' : 'New photo';
    this.buttons.camera.setLabel(cameraLabel);
    this.square.setLabel(cameraLabel);

    // Camera and upload always work (they cancel a running morph); the rest appear once there is something to use.
    this.buttons.adjust.setVisible(state.photoAdjustable);
    // Replay and record would fight over the square while a recording runs.
    this.buttons.replay.setVisible(state.hasResult && !state.recording);
    this.buttons.record.setVisible(state.hasResult && state.canRecord && !state.recording);
    this.buttons.saveImage.setVisible(state.hasResult);
    this.buttons.saveVideo.setVisible(state.hasVideo);
  }
}
