/**
 * Ctrl+V: frosts every square and waits for a click on one of them to decide where the image goes.
 * Esc or a click anywhere else cancels.
 */
class PasteChooser {
  constructor(body, destinations) {
    this.body = body;
    this.destinations = destinations;
    this.pendingFile = null;
  }

  start() {
    listenForPastedImages((file) => this.open(file));
    this.destinations.forEach(({ square, onFile }) => square.onChoose(() => this.place(onFile)));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
    window.addEventListener('click', () => this.close());
  }

  open(file) {
    this.pendingFile = file;
    this.body.dataset.choosing = true;
  }

  place(onFile) {
    const file = this.pendingFile;
    this.close();
    if (file) onFile(file);
  }

  close() {
    this.pendingFile = null;
    this.body.dataset.choosing = false;
  }
}
