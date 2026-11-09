/** An icon button that opens the system file picker for one image. */
class FilePickerButton {
  constructor({ icon, label, onFile }) {
    this.input = createElement('<input type="file" accept="image/*" hidden>');
    this.button = new IconButton({ icon, label, onClick: () => this.open() });
    this.input.addEventListener('change', () => {
      const file = this.input.files[0];
      // Clearing lets the same file be picked again later.
      this.input.value = '';
      if (file) onFile(file);
    });
    this.element = createElement('<span class="contents"></span>');
    this.element.append(this.button.element, this.input);
  }

  open() {
    this.input.click();
  }

  setVisible(visible) {
    this.button.setVisible(visible);
  }
}
