const ICON_BUTTON_CLASSES = [
  'grid h-10 w-10 place-items-center border cursor-pointer',
  'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400',
  '[&>svg]:h-5 [&>svg]:w-5',
].join(' ');

const ICON_TONES = {
  plain: 'text-neutral-600 dark:text-neutral-400',
  record: 'text-red-500',
};

/** A square button showing only an icon; the label is its tooltip and accessible name. */
class IconButton {
  constructor({ icon, label, onClick, tone = 'plain' }) {
    this.element = createElement(
      `<button type="button" class="${ICON_BUTTON_CLASSES} ${ICON_TONES[tone]}"><i data-lucide="${icon}"></i></button>`,
    );
    this.setLabel(label);
    this.element.addEventListener('click', onClick);
  }

  setLabel(label) {
    this.element.title = label;
    this.element.setAttribute('aria-label', label);
  }

  setVisible(visible) {
    this.element.hidden = !visible;
  }
}
