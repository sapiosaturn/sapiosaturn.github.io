// rehype-notebook: the only build-time markdown transform this site uses.
// No dependencies beyond what Astro already installs (sharp is optional).
//
//   1. Typography in running text: acronyms (LLM, GPUs) are wrapped for real
//      small caps, names like o1 and 4o keep lining figures, " - " becomes a spaced
//      en dash, a dash never starts a line, and a paragraph that opens with a
//      quotation mark hangs it.
//   2. Links to a few well-known hosts get a tiny mark after them.
//   3. h2-h4 get a self-link that hangs in the gutter.
//   4. A paragraph holding only an image becomes <figure>. The caption is the
//      image *title* (never the alt text); text after " | " in the title is
//      set as the source line. Local images are classified light/dark by
//      their border pixels so white charts can be inverted in the dark theme.
//      Figures drawn by the figure kit (```figure blocks) are numbered here
//      too, in one sequence with the images. A page with a figure gets the
//      click-to-zoom script (src/scripts/zoom.js, added by Layout.astro).
//   5. GFM footnotes ([^1]) are mirrored as margin sidenotes next to their
//      reference. The endnote list stays in the page for narrow screens, where
//      the same mirrored note opens in place when its reference is tapped.
//   6. Tables and code blocks get a wrapper (horizontal scroll, language tag).
//   7. Posts end with a mark after their text: a fragment of the post's own
//      chasm drawing (src/lib/chasm.js), the one its link-preview card shows.
//   8. Links as citations (references.mjs): arXiv PDFs point at the abstract,
//      links carry a citation tooltip, posts end with a References list, and
//      in-page links get an arrow showing which way the target lies.
//
// Opt-outs
//   frontmatter   smallcaps: false   no automatic small caps (or lining names) on this page
//                 dashes: false      leave " - " alone
//                 linkmarks: false   no marks after links
//                 endmark: false     no end-of-essay mark
//                 references: false  no References list
//   inline        <span class="nocaps">NASA</span> keeps full capitals
//   image title   ![alt](x.png "Caption. {keep}")    never invert this image
//                 ![alt](x.png "Caption. {invert}")  always treat as a white chart
//                 ![alt](x.png "{keep}")             flag only, no caption
//                 ![alt](x.png "Caption. | Source: somewhere")  caption plus a source line
//                 ![alt](x.png "Caption. {wide}")    run across the column and the margin on large screens

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addMark, annotateLinks, crossRefs, references } from './references.mjs';
import { seedOf, slugOf, strip } from '../lib/chasm.js';

const isEl = (n, tag) => n?.type === 'element' && (!tag || n.tagName === tag);
const isBlank = (n) => n.type === 'text' && !n.value.trim();
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });
const classes = (n) => [].concat(n.properties?.className ?? []);

// The end mark of a post (step 7): a fragment of its drawing as inline SVG.
// Styled by src/styles/endmark.css; the ink is currentColor. About 1.5 KB (0.7 gzipped).
function endMark(slug) {
	const { box, lines, cross } = strip(seedOf(slug), { rows: 4, span: 240 });
	const paths = lines.map((l) => `<path opacity="${l.tone.toFixed(2).replace(/^0/, '')}" d="${l.d}"/>`).join('');
	return `<div class="chasm-end" aria-hidden="true"><svg viewBox="${box.join(' ')}" width="${box[2]}" height="${box[3]}">${paths}<path class="x" d="${cross}"/></svg></div>`;
}

function collect(tree, test) {
	const found = [];
	(function walk(node, ancestors) {
		if (!node.children) return;
		node.children.forEach((child) => {
			if (test(child)) found.push({ node: child, parent: node, ancestors });
			walk(child, [...ancestors, node]);
		});
	})(tree, []);
	return found;
}

const replace = (parent, node, next) => parent.children.splice(parent.children.indexOf(node), 1, next);

// --- 1. Typography ---------------------------------------------------------

// Two kinds of token are wrapped:
//   caps  LLM, GPUs (the plural s stays lowercase), "ATTENTION IS ALL YOU NEED"
//   name  o1, 4o, v2, llama3: digits and lowercase letters in one word. These
//         keep lining figures, because beside a letter an old-style 1 reads
//         as an I and an o as a zero ("GPT-4o" must not look like GPT-40).
const TOKEN = /\b(?<caps>[A-Z]{2,}(?:[ :,–-]+[A-Z]{2,})*)(?=s?\b)|\b(?<name>(?=[A-Za-z\d]*[a-z])(?=[A-Za-z]*\d)[A-Za-z\d]+)\b/g;
const VERBATIM = /^(pre|code|kbd|samp|var|script|style|math|svg|abbr)$/;
const HEADING = /^h[1-6]$/;
const RAW_KEEP = /^<(?:(?:code|kbd|samp|var|abbr)\b|[a-z][^>]*\bclass=["'][^"']*\bnocaps\b)/i;

function typography(tree, { caps, dashes }) {
	(function walk(node, state) {
		if (!node.children) return;
		// Inline HTML written in markdown is still unparsed here: an opening tag,
		// its text and its closing tag arrive as three siblings. `raw` counts how
		// deep we are inside a raw element that must keep its capitals.
		let raw = 0;
		for (let i = 0; i < node.children.length; i++) {
			const child = node.children[i];
			if (child.type === 'raw') {
				if (/^<\//.test(child.value)) raw = Math.max(0, raw - 1);
				else if (raw || RAW_KEEP.test(child.value)) raw += /\/>$/.test(child.value) ? 0 : 1;
			} else if (child.type === 'text') {
				if (dashes) {
					child.value = child.value
						.replace(/(?<=\S) - (?=\S)/g, '\u00a0– ')
						.replace(/(?<=\S) (?=[—–] )/g, '\u00a0');
				}
				if (!caps || state.nocaps || raw) continue;
				const parts = [];
				let last = 0;
				for (const m of child.value.matchAll(TOKEN)) {
					parts.push(text(child.value.slice(last, m.index)), el('span', { className: [m.groups.caps ? 'caps' : 'ln'] }, [text(m[0])]));
					last = m.index + m[0].length;
				}
				if (last) {
					parts.push(text(child.value.slice(last)));
					node.children.splice(i, 1, ...parts);
					i += parts.length - 1;
				}
			} else if (isEl(child) && !VERBATIM.test(child.tagName)) {
				const cls = classes(child);
				walk(child, { nocaps: state.nocaps || HEADING.test(child.tagName) || cls.includes('nocaps') || cls.includes('caps') || cls.includes('ln') });
			}
		}
	})(tree, { nocaps: false });

	// Hang an opening quotation mark into the margin (the classes carry a
	// negative indent in global.css; quotation marks only, in every browser).
	for (const { node } of collect(tree, (n) => isEl(n, 'p'))) {
		const first = node.children[0];
		const mark = first?.type === 'text' && first.value[0];
		if (mark === '“' || mark === '‘') node.properties = { ...node.properties, className: [...classes(node), mark === '“' ? 'hang-dq' : 'hang-sq'] };
	}
}

// --- 2. Link marks -----------------------------------------------------------

function linkKind(href) {
	let url;
	try { url = new URL(href); } catch { return null; }
	if (!/^https?:$/.test(url.protocol)) return null;
	const host = url.hostname.replace(/^www\./, '');
	if (host === 'arxiv.org') return 'arxiv';
	if (/(^|\.)wikipedia\.org$/.test(host)) return 'wiki';
	if (host === 'github.com' || host === 'gist.github.com') return 'gh';
	if (host === 'x.com' || host === 'twitter.com') return 'x';
	if (/\.pdf$/i.test(url.pathname)) return 'pdf';
	return null;
}

function linkMarks(tree) {
	for (const { node: a } of collect(tree, (n) => isEl(n, 'a') && typeof n.properties?.href === 'string')) {
		const kind = linkKind(a.properties.href);
		// Skip image links and bare URLs: the mark would tell the reader nothing new.
		if (!kind || a.children.some((c) => isEl(c, 'img')) || (a.children[0]?.type === 'text' && /^https?:/.test(a.children[0].value))) continue;
		addMark(a, kind);
	}
}

// --- 4. Figures --------------------------------------------------------------

// 'light' | 'dark' | null, judged from a ring of border pixels.
async function tone(file) {
	try {
		const { default: sharp } = await import('sharp');
		const size = 24;
		const px = await sharp(file).flatten({ background: '#ffffff' }).resize(size, size, { fit: 'fill' }).greyscale().raw().toBuffer();
		let sum = 0, n = 0;
		for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
			if (x > 1 && x < size - 2 && y > 1 && y < size - 2) continue;
			sum += px[y * size + x]; n++;
		}
		const mean = sum / n;
		return mean > 215 ? 'light' : mean < 70 ? 'dark' : null;
	} catch {
		return null;
	}
}

// "A caption. | Source line {keep}" -> { caption: 'A caption.', credit: 'Source line', flags: Set{'keep'} }
function parseTitle(title = '') {
	const flags = new Set();
	let rest = String(title).trim();
	// Flags sit at the end and may be combined: "Caption. {keep} {wide}"
	for (let m; (m = /\s*\{\.?([a-z]+)\}$/i.exec(rest)); ) { flags.add(m[1].toLowerCase()); rest = rest.slice(0, m.index).trim(); }
	const [caption, credit = ''] = rest.split(/\s+\|\s+/, 2).map((part) => part.trim());
	return { caption, credit, flags };
}

export default function rehypeNotebook() {
	return async (tree, file) => {
		const filePath = file.path?.startsWith('file:') ? fileURLToPath(file.path) : file.path;
		const dir = filePath ? path.dirname(filePath) : null;
		const fm = file.data?.astro?.frontmatter ?? {};

		// 1 + 2. Text
		typography(tree, { caps: fm.smallcaps !== false, dashes: fm.dashes !== false });
		annotateLinks(tree);
		if (fm.linkmarks !== false) linkMarks(tree);

		// 3. Heading self-links. The footnote heading is a label, not a section.
		for (const { node: h } of collect(tree, (n) => isEl(n) && /^h[2-4]$/.test(n.tagName) && n.properties?.id && n.properties.id !== 'footnote-label')) {
			h.children.unshift(el('a', { className: ['h-anchor'], href: `#${h.properties.id}`, ariaLabel: 'Link to this section' }));
		}

		// 4. Figures. Two kinds share one frame, one caption style and one run of
		// numbers: a paragraph holding only an image, and a figure drawn by the
		// figure kit (remark-figures.mjs marks those with data-fig-kit).
		let figureNo = 0, figures = 0;
		const isLoneImage = (n) => isEl(n, 'p') && n.children.filter((c) => !isBlank(c)).length === 1 && isEl(n.children.find((c) => !isBlank(c)), 'img');
		const isKitFigure = (n) => isEl(n, 'figure') && n.properties?.dataFigKit !== undefined;
		for (const { node, parent } of collect(tree, (n) => isLoneImage(n) || isKitFigure(n))) {
			figures += 1;
			if (isKitFigure(node)) {
				delete node.properties.dataFigKit;
				const label = collect(node, (n) => isEl(n, 'span') && classes(n).includes('label'))[0]?.node;
				if (label) {
					figureNo += 1;
					label.children = [text(`Fig.\u00a0${figureNo}`)];
					node.properties.id = `fig-${figureNo}`;
				}
				continue;
			}
			const p = node;
			const img = p.children.find((c) => isEl(c, 'img'));
			const { src = '' } = img.properties;
			const { caption, credit, flags } = parseTitle(img.properties.title);
			delete img.properties.title;
			const props = { className: flags.has('wide') ? ['figure', 'fig-wide'] : ['figure'] };
			let t = null;
			if (flags.has('invert')) t = 'light';
			else if (!flags.has('keep') && dir && !/^([a-z]+:)?\/\//i.test(src) && !src.startsWith('/')) t = await tone(path.resolve(dir, decodeURI(src)));
			if (t) props.dataTone = t;
			// A light chart is inverted in the dark theme (figures.css), on the page and zoomed alike.
			const plate = el('span', { className: ['plate'] }, [img]);
			const children = [plate];
			if (caption || credit) {
				figureNo += 1;
				props.id = `fig-${figureNo}`;
				const cap = [el('span', { className: ['label'] }, [text(`Fig.\u00a0${figureNo}`)])];
				if (caption) cap.push(el('span', { className: ['fig-cap'] }, [text(caption)]));
				if (credit) cap.push(el('span', { className: ['fig-credit'] }, [text(credit)]));
				children.push(el('figcaption', {}, cap));
			}
			replace(parent, p, el('figure', props, children));
		}
		// The layout adds the zoom script to pages with a figure (frontmatter is how a plugin talks to it).
		if (figures && file.data?.astro?.frontmatter) file.data.astro.frontmatter.figureCount = figures;
		// Inline images can carry the flags too; they are never inverted, so just strip them.
		for (const { node: img } of collect(tree, (n) => isEl(n, 'img') && n.properties?.title)) {
			const { caption } = parseTitle(img.properties.title);
			if (caption) img.properties.title = caption; else delete img.properties.title;
		}

		// 5. Sidenotes
		const section = collect(tree, (n) => isEl(n, 'section') && n.properties?.dataFootnotes !== undefined)[0]?.node;
		if (section) {
			const notes = new Map(collect(section, (n) => isEl(n, 'li') && n.properties?.id).map(({ node }) => [node.properties.id, node]));
			const refs = collect(tree, (n) => isEl(n, 'sup') && isEl(n.children[0], 'a') && n.children[0].properties?.dataFootnoteRef !== undefined);
			let mirrored = refs.length > 0;
			let serial = 0;
			for (const { node: sup, parent, ancestors } of refs) {
				const a = sup.children[0];
				sup.properties = { ...sup.properties, className: ['fn-ref'] };
				const li = notes.get(String(a.properties.href).slice(1));
				const blocks = li?.children.filter((c) => !isBlank(c)) ?? [];
				const inTable = [...ancestors, parent].some((n) => isEl(n, 'table'));
				if (!li || inTable || !blocks.every((c) => isEl(c, 'p'))) { mirrored = false; continue; }
				const body = blocks.map((p) => {
					const kids = structuredClone(p.children).filter((c) => !(isEl(c, 'a') && c.properties?.dataFootnoteBackref !== undefined));
					const last = kids.at(-1);
					if (last?.type === 'text') last.value = last.value.trimEnd();
					return el('span', { className: ['sidenote-p'] }, kids);
				});
				const label = a.children[0]?.value ?? '';
				const id = `sn-${++serial}`;
				// Two links, one shown at a time by CSS: to the endnote on narrow
				// screens, to the margin note when there is a margin.
				a.properties.className = ['to-end'];
				sup.children.push(el('a', { className: ['to-side'], href: `#${id}`, ariaLabel: `Note ${label}` }, [text(label)]));
				// On a screen with no margin the note opens in place as a popover (script in
				// Layout.astro, styles in phone.css); this button closes it and is hidden otherwise.
				const close = el('button', { className: ['sidenote-x'], type: 'button', popovertarget: id, popovertargetaction: 'hide', ariaLabel: 'Close note' }, [text('×')]);
				const note = el('span', { className: ['sidenote'], id, role: 'note' }, [close, el('span', { className: ['sidenote-no'] }, [text(label)]), ...body]);
				parent.children.splice(parent.children.indexOf(sup) + 1, 0, note);
			}
			// Only when every note made it to the margin may CSS hide the endnotes on wide screens.
			if (mirrored) section.properties.dataMirrored = '';
		}

		// 6. Wrappers
		for (const { node, parent } of collect(tree, (n) => isEl(n, 'table'))) {
			replace(parent, node, el('div', { className: ['table-wrap'] }, [node]));
		}
		for (const { node, parent } of collect(tree, (n) => isEl(n, 'pre'))) {
			const lang = node.properties?.dataLanguage;
			replace(parent, node, el('div', { className: ['code-block'], ...(lang && lang !== 'plaintext' ? { dataLang: lang } : {}) }, [node]));
		}

		// 7. End mark: where a printed essay has its ornament, the mouth of the post's
		// own chasm (the drawing on its link-preview card, seeded from its file name).
		// It follows the text and comes before the endnotes and the References.
		if (fm.post_date && fm.endmark !== false) {
			const mark = { type: 'raw', value: endMark(slugOf(file.path)) };
			tree.children.splice(section ? tree.children.indexOf(section) : tree.children.length, 0, mark);
		}

		// 8. References (after any endnotes), then in-page arrows.
		const refs = fm.post_date && fm.references !== false ? references(tree) : null;
		if (refs) {
			typography(refs, { caps: fm.smallcaps !== false, dashes: false });
			tree.children.push(refs);
			// The layout lists the section in the contents (frontmatter is how a plugin talks to it).
			if (file.data?.astro?.frontmatter) file.data.astro.frontmatter.referenceCount = refs.children[1].children.length;
		}
		if (fm.linkmarks !== false) crossRefs(tree);
	};
}
