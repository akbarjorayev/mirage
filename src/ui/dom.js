/** Builds an element from trusted markup that has exactly one root element. */
function createElement(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

/** The shared panel layout: a fixed-height toolbar above a square. */
function createPanel(toolbarItems, square) {
  const panel = createElement('<section class="flex flex-col items-center gap-3"></section>');
  // Fixed height keeps the square from jumping when every button is hidden.
  const toolbar = createElement('<div class="flex h-10 gap-2"></div>');
  toolbar.append(...toolbarItems);
  panel.append(toolbar, square);
  return panel;
}

/** Phones get the share sheet (so the file can go to Photos); computers get a normal download. */
async function saveFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return; // the user closed the share sheet
      // Any other refusal (e.g. the tap "expired" while the file was prepared): fall back to downloading.
    }
  }
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Calls onImage with any image pasted with Ctrl+V. */
function listenForPastedImages(onImage) {
  window.addEventListener('paste', (event) => {
    const item = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    event.preventDefault();
    onImage(item.getAsFile());
  });
}
