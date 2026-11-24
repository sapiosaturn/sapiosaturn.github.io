// Links as citations. Used by rehype-notebook at build time and by
// scripts/fetch-links.mjs, which fills src/data/links.json by hand-run.
// Nothing here touches the network: the build reads the committed JSON.
//
//   annotateLinks  arxiv.org/pdf/ID -> /abs/ID (a PDF is hostile on a phone);
//                  title="‘Title’, Surname et al. 2024" on links with metadata.
//   references     a numbered "References" section: each external link once,
//                  in order of first use (who, year, title, host).
//   crossRefs      a small arrow after a link to an earlier or later part of
//                  the same page.
//
// Opt-outs
//   frontmatter    references: false   no References section on this page
//                  linkmarks: false    no in-page arrows (and no host marks)
//   links.json     "omit": true        keep the link, leave it out of the list

import fs from 'node:fs';

const isEl = (n, tag) => n?.type === 'element' && (!tag || n.tagName === tag);
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });
const classes = (n) => [].concat(n.properties?.className ?? []);
const WJ = '\u2060';

// A small mark after a link (which host it leads to, or which way in the page).
// The mark is an inline-block, so the link's underline stops short of it, and
// no browser lets a word joiner alone hold an inline-block on the line of the
// word before it, or keep a comma that follows on the line of the mark (Safari
// would start a line with it). So the mark sits between two joiners in a
// no-wrap span: the joiners forbid a break after the word and before whatever
// follows, the span forbids one on either side of the mark, and the word
// itself may still wrap or break as it always could.
export function addMark(a, kind) {
	a.children.push(el('span', { className: ['nw'] }, [text(WJ), el('span', { className: ['lm', `lm-${kind}`], ariaHidden: 'true' }), text(WJ)]));
}

// Links to the site itself are never references.
const OWN_HOSTS = new Set(['stochasm.blog', 'localhost', '127.0.0.1']);

// --- URLs ----------------------------------------------------------------------

function parse(href) {
	try {
		const url = new URL(href);
		return /^https?:$/.test(url.protocol) ? url : null;
	} catch {
		return null;
	}
}

export const hostOf = (href) => parse(href)?.hostname.replace(/^www\./, '') ?? '';

export function isExternal(href) {
	const url = typeof href === 'string' && parse(href);
	return Boolean(url) && !OWN_HOSTS.has(url.hostname.replace(/^www\./, ''));
}

// "2411.04282v2" from any arxiv.org abs / pdf / html address (old-style ids too).
export function arxivId(href) {
	const url = parse(href);
	if (!url || !/(^|\.)arxiv\.org$/.test(url.hostname)) return null;
	const m = url.pathname.match(/^\/(?:abs|pdf|html)\/((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?)(?:\.pdf)?\/?$/);
	return m ? m[1] : null;
}

// Where the reader is sent: the abstract page rather than the PDF. (A link to
// arXiv's HTML version already reads well on a phone and is left alone.)
export function readerHref(href) {
	const id = arxivId(href);
	if (!id || !/^\/pdf\//.test(parse(href).pathname)) return href;
	return `https://arxiv.org/abs/${id}`;
}

// The key of a link in links.json: no fragment, and one key per arXiv paper
// whatever its version or format.
export function linkKey(href) {
	const id = arxivId(href);
	if (id) return `https://arxiv.org/abs/${id.replace(/v\d+$/, '')}`;
	const url = parse(href);
	if (!url) return href;
	url.hash = '';
	return url.href;
}

// --- Metadata ------------------------------------------------------------------

let cache;
export function loadLinks(file = new URL('../data/links.json', import.meta.url)) {
	if (cache) return cache;
	try {
		cache = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch {
		cache = {}; // no file yet: every link falls back to its own text
	}
	return cache;
}

const PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'dos', 'du', 'la', 'le', 'ten', 'ter', 'bin', 'ibn', 'al']);

// "Aäron van den Oord" -> "van den Oord"; "Oord, Aäron van den" -> "Oord";
// "{Chameleon Team}" -> "Chameleon Team" (braces keep a collective name whole).
const whole = (name) => String(name).trim().replace(/^\{(.*)\}$/, '$1');
export function surname(name = '') {
	const s = String(name).trim();
	if (/^\{.*\}$/.test(s)) return whole(s);
	if (s.includes(',')) return s.split(',')[0].trim();
	const words = s.split(/\s+/);
	let i = words.length - 1;
	while (i > 0 && PARTICLES.has(words[i - 1])) i--;
	return words.slice(i).join(' ');
}

// "Vaswani et al. 2017", "Yang & Kassner 2024", "Reuters 2024", "2024" or "".
export function citeShort(entry) {
	const authors = [].concat(entry?.authors ?? []).filter(Boolean);
	const who = authors.length > 2 ? `${surname(authors[0])} et al.` : authors.map(surname).join(' & ');
	return [who, entry?.year].filter(Boolean).join(' ');
}

// The tooltip: ‘Title’, Surname et al. 2017 (a bare name when it is not a work)
export function linkTitle(entry) {
	if (!entry?.title) return '';
	if (entry.omit) return entry.title;
	const cite = citeShort(entry);
	return `‘${entry.title}’${cite ? `, ${cite}` : ''}`;
}

// --- Tree passes -----------------------------------------------------------------

function links(tree) {
	const found = [];
	(function walk(node) {
		for (const child of node.children ?? []) {
			if (isEl(child, 'a') && typeof child.properties?.href === 'string') found.push(child);
			walk(child);
		}
	})(tree);
	return found;
}

const plain = (node) => (node.type === 'text' ? node.value : classes(node).includes('lm') ? '' : (node.children ?? []).map(plain).join(''));

export function annotateLinks(tree, meta = loadLinks()) {
	for (const a of links(tree)) {
		if (!isExternal(a.properties.href)) continue;
		const entry = meta[linkKey(a.properties.href)];
		a.properties.href = readerHref(a.properties.href);
		const title = linkTitle(entry);
		if (title && !a.properties.title) a.properties.title = title;
	}
}

// Returns the section to append, or null when the page cites nothing. Call it
// last: by then margin notes sit beside their reference, so document order is
// order of first use. Body links get data-ref="n" (print shows it as [n]).
export function references(tree, meta = loadLinks()) {
	const seen = new Map();
	for (const a of links(tree)) {
		const { href } = a.properties;
		if (!isExternal(href) || classes(a).includes('h-anchor')) continue;
		const key = linkKey(href);
		const entry = meta[key];
		if (entry?.omit) continue;
		if (!seen.has(key)) seen.set(key, { href, entry, label: plain(a).replaceAll(WJ, '').trim() });
		a.properties.dataRef = String([...seen.keys()].indexOf(key) + 1);
	}
	if (!seen.size) return null;

	const items = [...seen.values()].map(({ href, entry, label }) => {
		const host = hostOf(href);
		const cite = citeShort(entry);
		const bare = !entry?.title && (!label || /^https?:/.test(label));
		const title = entry?.title || (bare ? href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : label);
		const kids = [];
		// "Vaswani et al. 2017." leads when the authors are known (all of them
		// in a tooltip); a year with no author trails, after the host.
		const named = entry?.authors?.length > 0;
		if (named) {
			const all = entry.authors.map(whole).join(', ');
			kids.push(el('span', { className: ['ref-by'], ...(entry.authors.length > 2 ? { title: all } : {}) }, [text(cite + '.')]), text(' '));
		}
		kids.push(el('a', { href, className: ['ref-title'] }, [text(title)]));
		const where = [bare ? '' : host, named ? '' : entry?.year].filter(Boolean).join(', ');
		if (where) kids.push(text(' '), el('span', { className: ['ref-host'] }, [text(where)]));
		return el('li', {}, kids);
	});

	return el('section', { className: ['references'], ariaLabelledby: 'references' }, [
		el('h2', { id: 'references' }, [text('References')]),
		el('ol', {}, items),
	]);
}

// In-page links: which way is the target? Footnote and heading self-links are
// left alone (the contents rail is not part of the markdown tree at all).
export function crossRefs(tree) {
	const order = new Map();
	const ids = new Map();
	let n = 0;
	(function walk(node) {
		for (const child of node.children ?? []) {
			if (!isEl(child)) continue;
			order.set(child, n++);
			if (child.properties?.id) ids.set(String(child.properties.id), child);
			walk(child);
		}
	})(tree);
	for (const a of links(tree)) {
		const p = a.properties;
		if (!p.href.startsWith('#') || p.href.length < 2) continue;
		const cls = classes(a);
		// An equation's own number links to its equation: that is not a jump.
		if (p.dataFootnoteRef !== undefined || p.dataFootnoteBackref !== undefined || cls.some((c) => ['h-anchor', 'to-side', 'to-end', 'eq-no'].includes(c))) continue;
		let id = p.href.slice(1);
		try { id = decodeURIComponent(id); } catch {}
		const target = ids.get(id);
		if (!target || target === a) continue;
		const dir = order.get(target) < order.get(a) ? 'up' : 'down';
		a.properties.className = [...cls, `xref-${dir}`];
		addMark(a, dir);
	}
}
