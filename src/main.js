// Composition root: builds the UI components, the devices and the session, and wires them together.
// 192 × 192 = 36,864 pixels: fine-grained but still visibly pixels, and quick to match.
const GRID_SIZE = 192;
// Canvas is GRID_SIZE × CELL_SIZE = 576px wide; CSS scales it to the square.
const CELL_SIZE = 3;
// Mona Lisa by Leonardo da Vinci (public domain), via Wikimedia Commons:
// https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg
const DEFAULT_TARGET_URL = 'assets/mona-lisa.jpg';

let session;
const adjustDialog = new AdjustDialog({ rotate: rotateImage });

const photoPanel = new PhotoPanel({
  onTap: () => session.tapPhoto(),
  onFile: (file) => session.usePhotoFile(file),
  onAdjust: async () => {
    const framing = await adjustDialog.open(session.photoImage, session.photoFraming);
    if (framing) session.setPhotoFraming(framing);
  },
  onReplay: () => session.replay(),
  onRecord: () => session.record(),
  onSaveImage: async () => saveFile(await session.imageBlob(), 'mirage.png'),
  onSaveVideo: () => saveFile(session.video.blob, `mirage.${session.video.extension}`),
});
const targetPanel = new TargetPanel({
  onFile: (file) => session.useTargetFile(file),
  onAdjust: async () => {
    const framing = await adjustDialog.open(session.targetImage, session.targetFraming);
    if (framing) session.setTargetFraming(framing);
  },
});

document.getElementById('app').append(photoPanel.element, targetPanel.element);
document.body.append(adjustDialog.element);
lucide.createIcons();

session = new MorphSession({
  camera: new Camera(photoPanel.video),
  sampler: new ImageSampler(GRID_SIZE),
  animator: new MorphAnimator(photoPanel.canvas, GRID_SIZE, CELL_SIZE),
  recorder: new CanvasRecorder(photoPanel.canvas),
  images: { fromFile: loadImageFile, fromUrl: loadImage, rotate: rotateImage, cropSquare, defaultAnchor: defaultCropAnchor },
  backgroundRgb: () => photoPanel.square.backgroundRgb,
  prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

session.subscribe((state) => {
  photoPanel.render(state);
  targetPanel.render(state);
});

new PageDragTracker(document.body).start();
new PasteChooser(document.body, [
  { square: photoPanel.square, onFile: (file) => session.usePhotoFile(file) },
  { square: targetPanel.square, onFile: (file) => session.useTargetFile(file) },
]).start();

session.start(DEFAULT_TARGET_URL);
