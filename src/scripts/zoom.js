// Click-to-zoom for figures. Inlined by Layout.astro on pages that have a
// figure; without it figures are simply static. A click (or Enter) on a figure
// opens it alone on the page in a native <dialog>: a kit figure as its widest
// drawing, up to twice its size; an image as the file itself, at its own size.
// A white chart that is inverted in the dark theme stays inverted there (the
// copy keeps data-tone). Any click outside the caption, the close button or
// Esc closes it, and the browser puts the focus back on the figure.
// Opened with Enter, the focus goes to the close button; opened with the
// pointer, to the dialog itself, so no browser draws a focus ring on "close".
// A figure that would not gain a fifth in width is left alone, which rules out
// phones and images already shown at their natural size.
(function () {
	if (!window.HTMLDialogElement) return;
	var plates = document.querySelectorAll('.figure > .plate, .figure > .fig-plate'), dialog;

	// The width the figure would have enlarged, or false when that is no real gain.
	function gain(plate) {
		var art = plate.firstElementChild, caption = plate.nextElementSibling;
		var w = art.getAttribute('width'), h = art.getAttribute('height');
		w = Math.min(innerWidth - 96, ((innerHeight - 80 - (caption ? caption.offsetHeight : 0)) * w) / h, w * (art.tagName == 'IMG' ? 1 : 2));
		return w >= plate.offsetWidth * 1.2 && Math.floor(w);
	}

	// Zoomable figures get the cursor and a place in the tab order (CSS keys on data-zoom).
	function mark() {
		plates.forEach(function (plate) {
			var figure = plate.parentNode, on = !!gain(plate);
			figure.toggleAttribute('data-zoom', on);
			if (on) plate.tabIndex = 0;
			else plate.removeAttribute('tabindex');
		});
	}

	function open(plate, byKey) {
		var width = gain(plate), caption = plate.nextElementSibling, copy;
		// Not after dragging over a figure's labels to select them.
		if (!width || String(getSelection())) return;
		if (!dialog) {
			dialog = document.createElement('dialog');
			dialog.className = 'zoom prose';
			dialog.setAttribute('aria-label', 'Figure, enlarged');
			dialog.tabIndex = -1;
			dialog.addEventListener('click', function (event) {
				if (!event.target.closest('figcaption')) dialog.close();
			});
			document.body.appendChild(dialog);
		}
		dialog.innerHTML = '<button class="zoom-close" type="button">close</button><figure class="figure"><div class="' + plate.className + '"></div></figure>';
		copy = dialog.lastChild;
		if (plate.parentNode.dataset.tone) copy.dataset.tone = plate.parentNode.dataset.tone;
		copy.style.width = width + 'px';
		copy.firstChild.appendChild(plate.firstElementChild.cloneNode(true));
		if (caption) copy.appendChild(caption.cloneNode(true));
		dialog.showModal();
		if (!byKey) dialog.focus();
	}

	plates.forEach(function (plate) {
		plate.addEventListener('click', function () { open(plate); });
		plate.addEventListener('keydown', function (event) {
			if (event.key != 'Enter') return;
			// Or the same keystroke would go on to press the dialog's close button.
			event.preventDefault();
			open(plate, 1);
		});
	});
	addEventListener('resize', mark);
	mark();
	// Once more when the fonts are in: a caption set in the fallback font can be a line
	// taller, which is enough to tip a figure that only just gains from the zoom.
	if (document.fonts) document.fonts.ready.then(mark);
})();
