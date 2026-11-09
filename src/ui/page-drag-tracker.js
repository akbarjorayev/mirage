/** Sets data-drag="true" on the body while a file is dragged anywhere over the window. */
class PageDragTracker {
  constructor(body) {
    this.body = body;
    // dragenter/dragleave fire for every child element crossed, so count depth instead of toggling.
    this.depth = 0;
  }

  start() {
    window.addEventListener('dragenter', (event) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      this.depth++;
      this.setDragging(true);
    });
    window.addEventListener('dragleave', () => {
      this.depth = Math.max(0, this.depth - 1);
      if (this.depth === 0) this.setDragging(false);
    });
    // Stops the browser from opening a file dropped on the empty background.
    window.addEventListener('dragover', (event) => event.preventDefault());
    window.addEventListener('drop', (event) => {
      event.preventDefault();
      this.depth = 0;
      this.setDragging(false);
    });
  }

  setDragging(dragging) {
    this.body.dataset.drag = dragging;
  }
}
