// Notes. Inlined by Layout.astro on pages with footnotes.
// With a margin (a.to-side is the visible reference), clicking a reference pins
// the highlight on its note; click again to release. Without one (a.to-end),
// the mirrored note opens in place as a popover, styled in phone.css. The
// popover attribute only lives while the note is open, so the margin layout
// never sees it. Focus goes to the reference first and then into the note, so
// Esc and the close button hand it back to the reference. If the sheet would
// cover the reference, the page moves up just enough to clear it.
// `was` remembers the note that was open at pointerdown: light dismiss has
// already closed it by the time the click arrives, and a tap on its own
// reference must not reopen it. Where popovers are unsupported the link jumps
// to the endnote, as it does without script.
(function () {
	var was;
	addEventListener('pointerdown', function () { was = document.querySelector('.sidenote[popover]'); });
	document.addEventListener('click', function (e) {
		var a = e.target.closest && e.target.closest('.fn-ref a'), note = a && a.parentNode.nextElementSibling, old = was;
		was = 0;
		if (!note || !note.matches('.sidenote')) return;
		if (a.className == 'to-side') {
			e.preventDefault();
			old = note.classList.contains('lit');
			[].forEach.call(document.querySelectorAll('.sidenote.lit'), function (n) { n.classList.remove('lit'); });
			if (!old) note.classList.add('lit');
		} else if (note.showPopover) {
			e.preventDefault();
			if (note == old) return;
			a.focus({ preventScroll: true });
			note.popover = 'auto';
			note.showPopover();
			note.tabIndex = -1;
			note.focus();
			note.ontoggle = function (t) { if (t.newState == 'closed') note.removeAttribute('popover'); };
			old = a.getBoundingClientRect().bottom + note.offsetHeight + 12 - innerHeight;
			if (old > 0) scrollBy(0, old);
		}
	});
})();
