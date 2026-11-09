// Keeps memory low on phones while leaving plenty of detail for cropping.
const MAX_IMAGE_SIDE = 1600;
const MAX_SQUARE_SIDE = 1024;
// Tall photos are usually portraits with the face in the upper part, so the default crop sits above centre.
const PORTRAIT_CROP_ANCHOR = 0.25;
const CENTER_CROP_ANCHOR = 0.5;

function defaultCropAnchor(image) {
  return image.height > image.width ? PORTRAIT_CROP_ANCHOR : CENTER_CROP_ANCHOR;
}

/**
 * Cuts a square out of any drawable into a new canvas.
 * anchor (0–1) slides the square along the longer side: 0 = left/top edge, 1 = right/bottom edge.
 */
function squareCanvasFrom(drawable, width, height, { mirrored = false, anchor = CENTER_CROP_ANCHOR } = {}) {
  const side = Math.min(width, height);
  const outputSide = Math.min(side, MAX_SQUARE_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = outputSide;
  const context = canvas.getContext('2d');
  if (mirrored) {
    context.translate(outputSide, 0);
    context.scale(-1, 1);
  }
  const left = width > height ? (width - side) * anchor : 0;
  const top = height > width ? (height - side) * anchor : 0;
  context.drawImage(drawable, left, top, side, side, 0, 0, outputSide, outputSide);
  return canvas;
}

/** Rotates an image clockwise by quarter turns (90° each) into a new canvas. */
function rotateImage(image, quarterTurns) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return image;
  const sideways = turns % 2 === 1;
  const canvas = document.createElement('canvas');
  canvas.width = sideways ? image.height : image.width;
  canvas.height = sideways ? image.width : image.height;
  const context = canvas.getContext('2d');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas;
}

function cropSquare(image, anchor) {
  return squareCanvasFrom(image, image.width, image.height, { anchor });
}

/** Loads a whole image (not cropped) into a canvas, scaled down if it is very large. */
function loadImage(src, label) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error(`Could not read ${label}. Try a different image.`));
    image.src = src;
  });
}

async function loadImageFile(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" is not an image. Pick a JPG, PNG or WebP file.`);
  }
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url, `"${file.name}"`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Shrinks a square canvas to a gridSize x gridSize block of RGB values. */
class ImageSampler {
  constructor(gridSize) {
    this.gridSize = gridSize;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = gridSize;
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  sample(squareCanvas) {
    const size = this.gridSize;
    this.context.imageSmoothingQuality = 'high';
    this.context.drawImage(squareCanvas, 0, 0, size, size);
    const rgba = this.context.getImageData(0, 0, size, size).data;
    const rgb = new Float32Array(size * size * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgb[j] = rgba[i];
      rgb[j + 1] = rgba[i + 1];
      rgb[j + 2] = rgba[i + 2];
    }
    return rgb;
  }
}
