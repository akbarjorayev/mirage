/** Right panel: the picture your pixels rearrange into. */
class TargetPanel {
  constructor({ onFile, onAdjust }) {
    this.picker = new FilePickerButton({ icon: 'image-up', label: 'Upload target picture', onFile });
    this.adjust = new IconButton({ icon: 'pencil', label: 'Rotate or crop the target', onClick: onAdjust });
    this.preview = createElement('<span class="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full"></span>');
    this.square = new DropSquare({ label: 'Choose target picture', onClick: () => this.picker.open(), onFile });
    this.square.add(this.preview);
    this.shownTarget = null;
    this.element = createPanel([this.picker.element, this.adjust.element], this.square.element);
  }

  render({ target, targetAdjustable }) {
    this.adjust.setVisible(targetAdjustable);
    if (!target || target === this.shownTarget) return;
    this.preview.replaceChildren(target);
    this.shownTarget = target;
  }
}
