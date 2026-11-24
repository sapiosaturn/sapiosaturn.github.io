// Two small conveniences for code and maths. Inlined by src/plugins/rehype-code.mjs
// on pages that have a code block or a formula; everything works without it.
(function () {
	// 1. A copy button on each code block. It copies what a reader would type:
	//    no prompts or output from a terminal session, no removed lines from a diff.
	document.querySelectorAll('.code-block').forEach(function (block) {
		var button = document.createElement('button'), timer;
		button.type = 'button';
		button.className = 'code-copy';
		button.textContent = 'copy';
		button.setAttribute('aria-label', 'Copy code');
		button.addEventListener('click', function () {
			var keep = block.dataset.kind === 'terminal' ? '.line.cmd' : '.line:not(.del)';
			var lines = [].map.call(block.querySelectorAll(keep), function (line) { return line.textContent; });
			navigator.clipboard.writeText(lines.join('\n').replace(/\s+$/, '') + '\n').then(function () {
				button.textContent = 'copied';
				clearTimeout(timer);
				timer = setTimeout(function () { button.textContent = 'copy'; }, 1600);
			});
		});
		block.querySelector('.code-head').appendChild(button);
	});

	// 2. Copying text that includes a formula puts its TeX source on the
	//    clipboard, between dollar signs, instead of nothing.
	document.addEventListener('copy', function (event) {
		var selection = getSelection();
		if (!selection.rangeCount || selection.isCollapsed || !event.clipboardData) return;
		var range = selection.getRangeAt(0), holder = document.createElement('div');
		holder.appendChild(range.cloneContents());
		var formulas = holder.querySelectorAll('.math, .eq-body');
		if (!formulas.length) return;
		formulas.forEach(function (formula) {
			var tex = formula.querySelector('annotation');
			if (!tex) return;
			var block = formula.className === 'eq-body';
			formula.textContent = block ? '$$' + tex.textContent + '$$' : '$' + tex.textContent + '$';
		});
		holder.querySelectorAll('.eq-no, .code-copy').forEach(function (node) { node.remove(); });
		// innerText needs the nodes in the page, among the same styles, to know where lines break.
		var home = range.commonAncestorContainer;
		home = (home.closest ? home : home.parentElement).closest('.prose') || document.body;
		holder.style.cssText = 'position:fixed;left:-99em;width:40em';
		home.appendChild(holder);
		event.clipboardData.setData('text/plain', holder.innerText);
		event.clipboardData.setData('text/html', holder.innerHTML);
		holder.remove();
		event.preventDefault();
	});
})();
