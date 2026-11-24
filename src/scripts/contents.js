// Contents. Inlined by Layout.astro on pages with a contents list.
// Marks the section being read (CSS opens its sub-sections in the rail). On
// narrow screens the same pass feeds the section bar (phone.css): its label,
// the progress rule (--p) and .on, set while the reader is past the title block
// and scrolling up; 8px of slack keeps a thumb's wobble from flicking the bar
// in and out. A move of more than a screen in one frame is a jump (a contents
// entry, a note's back-link, an in-page link), not a thumb, and leaves the bar
// away, so the heading arrived at is not repeated just above itself.
// Choosing a section closes the list.
(function () {
	var links = [].slice.call(document.querySelectorAll('.toc-rail a'));
	var heads = links.map(function (a) { return document.getElementById(decodeURIComponent(a.hash.slice(1))); });
	var rail = links[0].closest('nav'), side = rail.parentNode;
	var current, ticking = false, last = 0;
	function update() {
		ticking = false;
		var i = 0, y = scrollY, end = document.documentElement.scrollHeight - innerHeight;
		for (var k = 0; k < heads.length; k++) if (heads[k] && heads[k].getBoundingClientRect().top < innerHeight * 0.3) i = k;
		if (y >= end - 4) i = heads.length - 1;
		side.style.setProperty('--p', y / end);
		if (Math.abs(y - last) > 8) { side.classList.toggle('on', y < last && last - y < innerHeight && side.parentNode.getBoundingClientRect().top < 0); last = y; }
		if (links[i] === current) return;
		if (current) current.removeAttribute('aria-current');
		current = links[i];
		current.setAttribute('aria-current', 'true');
		side.firstElementChild.lastChild.textContent = current.textContent;
	}
	addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
	rail.onclick = function (e) { if (e.target.hash && rail.hidePopover) rail.hidePopover(); };
	update();
})();
