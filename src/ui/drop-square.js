const SQUARE_CLASSES = [
  'group/sq relative grid aspect-square cursor-pointer place-items-center overflow-hidden border',
  // dvh = the screen height actually visible, excluding mobile browser bars.
  'w-[min(88vw,calc(50dvh-5.5rem))] md:w-[min(44vw,calc(100dvh-8rem))]',
  'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-400',
].join(' ');

// Frosted cover shown while a file is dragged over the page (body[data-drag]) with an upload icon,
// or while a pasted image waits for a destination (body[data-choosing]) with a paste icon; then it is clickable.
const FROST_CLASSES = [
  'pointer-events-none absolute inset-0 z-10 grid place-items-center opacity-0 backdrop-blur-md transition-opacity duration-200',
  'bg-white/50 text-neutral-500 dark:bg-black/40 dark:text-neutral-400',
  'group-data-[drag=true]:opacity-100',
  'group-data-[choosing=true]:pointer-events-auto group-data-[choosing=true]:opacity-100',
  'group-[.is-over]/sq:bg-neutral-200/60 dark:group-[.is-over]/sq:bg-neutral-700/50',
].join(' ');
const FROST_ICON_CLASSES = 'h-10 w-10';

/** A clickable square that accepts a dropped image file. Content goes in with add(). */
class DropSquare {
  constructor({ label, onClick, onFile }) {
    this.element = createElement(`
      <button type="button" class="${SQUARE_CLASSES}">
        <span class="${FROST_CLASSES}" aria-hidden="true">
          <span class="group-data-[choosing=true]:hidden"><i data-lucide="upload" class="${FROST_ICON_CLASSES}"></i></span>
          <span class="hidden group-data-[choosing=true]:block"><i data-lucide="clipboard-paste" class="${FROST_ICON_CLASSES}"></i></span>
        </span>
      </button>`);
    this.frost = this.element.firstElementChild;
    this.setLabel(label);
    this.element.addEventListener('click', onClick);
    this.acceptDrops(onFile);
  }

  /** Runs handler when the frost is clicked while choosing where a pasted image goes. */
  onChoose(handler) {
    this.frost.addEventListener('click', (event) => {
      // Keeps the square's own click (snap photo / open picker) and the outside-click cancel from firing.
      event.stopPropagation();
      handler();
    });
  }

  /** Puts content under the frost layer. */
  add(...children) {
    children.forEach((child) => this.element.insertBefore(child, this.frost));
  }

  setLabel(label) {
    this.element.setAttribute('aria-label', label);
  }

  get backgroundRgb() {
    return getComputedStyle(this.element).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
  }

  acceptDrops(onFile) {
    const { element } = this;
    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      element.classList.add('is-over');
    });
    element.addEventListener('dragleave', () => element.classList.remove('is-over'));
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      element.classList.remove('is-over');
      const file = event.dataTransfer.files[0];
      if (file) onFile(file);
    });
  }
}
