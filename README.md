# Mirage

**Turn your selfie into any picture — without changing a single pixel.**

Mirage takes the pixels of your photo and only *moves* them. No pixel is recolored, added or removed. Every one of them flies to a new spot until, together, they look like the target picture: the Mona Lisa, your cat, anything you drop in.

![Mirage demo: one photo's pixels rearranging into another photo](docs/demo.gif)

## Features

- **Live camera.** Tap the square to snap; the frame freezes and your pixels start flying.
- **Any photo, any target.** Upload, drag & drop or paste (Ctrl+V asks which square it goes in).
- **Rotate & crop.** Turn images in 90° steps and drag the square to choose which part is used.
- **Record a video.** Your photo, the morph, then the result, each held still for a moment. Saved as MP4 (or WebM).
- **Save the result** as a PNG. On phones, saving opens the share sheet, so it can go straight to Photos.
- **Proof it's only rearranged.** After every morph, Mirage reads the finished picture back and checks it holds exactly your photo's colors.
- **Private.** Everything runs in your browser. Nothing is uploaded anywhere.
- **Light & dark,** following your system theme. Works on phones and desktops.

## How it works

1. Both images are cropped to a square and shrunk to a **192 × 192 grid**: 36,864 pixels.
2. **First guess:** both pixel lists are sorted by brightness and paired up, darkest to darkest.
3. **Refinement:** about 9 million random pairs of pixels are tried. Whenever swapping two pixels' destinations brings *both* closer to the target colors, the swap is kept. Colors are compared with weights for how the eye sees them (green counts most).
4. **Animation:** every pixel flies from where it was in your photo to its new home, along a slight arc, with lower rows leaving a little later so the picture pours into place.

The result is a permutation: the same 36,864 colors you started with, just in a different order.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer (only for the local server and tests; the app itself has no dependencies).

```bash
git clone https://github.com/akbarjorayev/mirage.git
cd mirage
npm start
```

Then open <http://localhost:5173>. Opening `index.html` straight from disk won't work: browsers don't let a page read image pixels from `file://`.

> Browsers only allow the camera on `https://` sites or `localhost`. If you open Mirage from another device over your local network, use **Upload** instead, or serve it over HTTPS.

## Project structure

No build step and no framework: plain JavaScript files loaded in order, styled with [Tailwind CSS](https://tailwindcss.com) and [Lucide](https://lucide.dev) icons from a CDN.

```
src/
├── core/                  Logic only, no DOM, fully unit-tested
│   ├── pixel-matcher.js   Decides where every pixel goes
│   └── morph-session.js   The whole flow: camera → photo → match → morph → record
├── media/                 Browser devices and canvas
│   ├── camera.js          Front camera, snaps a mirrored square
│   ├── image-tools.js     Loading, rotating, cropping and sampling images
│   ├── morph-animator.js  Draws the flying pixels
│   └── canvas-recorder.js Records the canvas to video
├── ui/                    Components: render state, report clicks, drops and pastes
│   ├── photo-panel.js     Your photo and its toolbar
│   ├── target-panel.js    The target picture and its toolbar
│   ├── adjust-dialog.js   Rotate & crop
│   ├── drop-square.js     A square that accepts dropped images
│   ├── paste-chooser.js   "Where should this pasted image go?"
│   └── …                  Buttons and small helpers
└── main.js                Wires everything together
assets/mona-lisa.jpg       The built-in target picture
```

`MorphSession` never touches the page. UI components subscribe to its state and call its methods, and devices (camera, animator, recorder) are passed in, which is what lets the tests run in Node with fakes.

## Tests

```bash
npm test
```

The tests cover the pixel matcher (every pixel used exactly once, matches only improve, a shuffled image is rebuilt exactly) and the session flow (capturing, cancelling a morph when you change your mind, recording, rotating and cropping).

## Credits

- Default target: *Mona Lisa* by Leonardo da Vinci, public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg).
- Icons: [Lucide](https://lucide.dev) (ISC license).
- Styling: [Tailwind CSS](https://tailwindcss.com) (MIT license).

## License

[MIT](LICENSE) © 2026 Akbar Jorayev
