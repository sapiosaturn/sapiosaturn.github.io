// One entry point for every figure. A spec (the YAML an author writes, or
// the props of an Astro component) goes in; a framed, captioned, numbered
// <figure> comes out. Both front doors use this file:
//   - src/plugins/remark-figures.mjs  (```figure blocks in Markdown)
//   - the .astro components beside this folder
//
// Each figure is drawn once per layout width and CSS shows the one that fits,
// so type keeps its size on a phone instead of shrinking with the drawing.

import { el, esc } from './svg.js';
import { resolveSpec } from './data.js';
import { lineChart } from './line.js';
import { barChart } from './bar.js';
import { scatterPlot } from './scatter.js';
import { heatmap } from './heatmap.js';
import { tokenStrip } from './tokens.js';
import { diagram } from './diagram.js';

export const TYPES = { line: lineChart, bar: barChart, scatter: scatterPlot, heatmap, tokens: tokenStrip, diagram };

// Layout widths in CSS px: the text column (39rem), the column plus the
// margin (wide), and a 390px phone's column. Keep in step with figures.css.
export const WIDTHS = { col: 624, wide: 920, narrow: 346 };
const HEIGHTS = { col: 330, wide: 400, narrow: 248 };
const PANEL_GAP = { col: 30, wide: 44, narrow: 22 };

// The ids inside a figure (its <title> and <desc>, which aria-labelledby names)
// are built from a name the caller gives: `uid`, the figure's place in its own
// document, such as "fg-scaling_post-2" for the second block of scaling_post.md.
// Each front door numbers its own figures (remark-figures per Markdown file,
// Chart.astro per page, the gallery per post), so an id depends on the page and
// on nothing else. They used to come from one counter for the whole build, and
// then changed with the order in which the bundler happened to compile the posts.
/** "src/pages/posts/Scaling Post.md" or "/posts/scaling_post/" gives "scaling-post" / "scaling_post": the name used in a uid. */
export const figureKey = (where = '') => String(where).replace(/\/+$/, '').split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'page';
// Without a uid (a caller outside this repository's three), the id is a digest of the spec: stable, and unique unless one page draws the same spec twice.
const digest = (spec) => { let h = 2166136261; for (const c of JSON.stringify(spec)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0).toString(36); };

function drawOne(spec, variant, W, H, colW = WIDTHS.col) {
	const fn = TYPES[spec.type];
	if (!fn) throw new Error(`figure: unknown type "${spec.type}" (have: ${Object.keys(TYPES).join(', ')}, or panels)`);
	const out = fn(spec, { W, H, narrow: variant === 'narrow', variant, colW });
	return { body: out.body, H: out.H ?? H, desc: out.desc };
}

function heightFor(spec, variant) {
	if (variant === 'narrow') return spec.heightNarrow ?? (spec.height ? Math.max(190, Math.round(spec.height * 0.76)) : HEIGHTS.narrow);
	if (variant === 'wide') return spec.heightWide ?? (spec.height ? Math.round(spec.height * 1.18) : HEIGHTS.wide);
	return spec.height ?? HEIGHTS.col;
}

function drawVariant(spec, variant) {
	const W = WIDTHS[variant];
	if (!Array.isArray(spec.panels)) return { W, ...drawOne(spec, variant, W, heightFor(spec, variant)) };

	// Panels: several plots under one caption. Keys set on the figure are
	// shared by every panel. Side by side, except on a phone where they stack
	// (unless `stack: false`).
	const { panels, caption, credit, alt, desc, width, stack, ...shared } = spec;
	const stacked = variant === 'narrow' && stack !== false;
	const gap = PANEL_GAP[variant];
	const pw = stacked ? W : (W - gap * (panels.length - 1)) / panels.length;
	const baseH = stacked ? heightFor(spec, 'narrow') : Math.round(heightFor(spec, variant) * (variant === 'narrow' ? 1 : 0.9));
	let x = 0, y = 0, H = 0;
	const parts = [], descs = [];
	panels.forEach((p, i) => {
		const one = drawOne({ ...shared, ...p }, variant, pw, p.height ?? baseH, (WIDTHS.col - PANEL_GAP.col * (panels.length - 1)) / panels.length);
		parts.push(el('g', { transform: `translate(${Math.round(x * 100) / 100} ${y})` }, one.body));
		descs.push(`${p.title ? p.title + ': ' : `Panel ${i + 1}: `}${one.desc}`);
		if (stacked) { y += one.H + 18; H = y - 18; } else { x += pw + gap; H = Math.max(H, one.H); }
	});
	return { W, H, body: parts.join(''), desc: descs.join(' ') };
}

// --- Captions ---------------------------------------------------------------

const smart = (s) => s
	.replace(/(^|[\s(\[{])"/g, '$1\u201c').replace(/"/g, '\u201d')
	.replace(/(^|[\s(\[{\u201c])'/g, '$1\u2018').replace(/'/g, '\u2019')
	.replace(/---/g, '\u2014').replace(/--/g, '\u2013').replace(/\.\.\./g, '\u2026');

/** Inline Markdown for captions: [text](url), *emphasis*, `code`. Returns a small tree. */
export function inline(src = '') {
	const out = [];
	const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*|`([^`]+)`/g;
	let last = 0, m;
	const push = (s) => { if (s) out.push(smart(s)); };
	while ((m = re.exec(src))) {
		push(src.slice(last, m.index));
		if (m[1]) out.push({ tag: 'a', attrs: { href: m[2] }, children: inline(m[1]) });
		else if (m[3]) out.push({ tag: 'em', attrs: {}, children: inline(m[3]) });
		else out.push({ tag: 'code', attrs: {}, children: [m[4]] });
		last = m.index + m[0].length;
	}
	push(src.slice(last));
	return out;
}
export const toHTML = (nodes) => nodes.map((n) => (typeof n === 'string' ? esc(n) : `<${n.tag}${Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>${toHTML(n.children)}</${n.tag}>`)).join('');
export const toHast = (nodes) => nodes.map((n) => (typeof n === 'string' ? { type: 'text', value: n } : { type: 'element', tagName: n.tag, properties: { ...n.attrs }, children: toHast(n.children) }));
export const toText = (nodes) => nodes.map((n) => (typeof n === 'string' ? n : toText(n.children))).join('');

// --- Assembly ---------------------------------------------------------------

/**
 * The parts of a figure, for callers that build their own tree.
 * `uid` names the figure within its page (see the note on ids at the top).
 * @returns {{ plate: string, caption: Array, credit: Array, classes: string[] }}
 */
export function figureParts(input, { dir, uid } = {}) {
	const spec = resolveSpec(input, dir);
	if (!spec.type && !spec.panels) throw new Error('figure: the block needs a `type` (line, bar, scatter, heatmap, tokens, diagram) or `panels`');
	const wide = spec.width === 'wide';
	const variants = wide ? ['wide', 'col', 'narrow'] : ['col', 'narrow'];
	const caption = inline(spec.caption ?? ''), credit = inline(spec.credit ?? '');
	const title = spec.alt ?? toText(caption) ?? '';
	const base = uid ?? `fg-x${digest(spec)}`;
	const svgs = variants.map((v) => {
		const d = drawVariant(spec, v);
		// One drawing per layout width, so one id each: the uid plus w, c or n (wide, column, narrow), then t or d below.
		const id = base + v[0];
		const head = (title ? el('title', { id: id + 't' }, esc(title)) : '') + el('desc', { id: id + 'd' }, esc(spec.desc ?? d.desc ?? ''));
		return el('svg', {
			class: `fig-svg fig-v-${v}`, viewBox: `0 0 ${d.W} ${d.H}`, width: d.W, height: d.H, role: 'img',
			'aria-labelledby': `${title ? id + 't ' : ''}${id}d`, xmlns: 'http://www.w3.org/2000/svg',
		}, head + d.body);
	});
	const kind = spec.panels ? 'panels' : spec.type;
	return { plate: svgs.join(''), caption, credit, classes: ['figure', 'fig', `fig-${kind}`, ...(wide ? ['fig-wide'] : [])] };
}

/** Caption markup shared by kit figures and plain images. */
export function captionHTML({ n, caption = [], credit = [] }) {
	if (!n && !caption.length && !credit.length) return '';
	return '<figcaption class="nocaps">' +
		(n ? `<span class="label">Fig.\u00a0${n}</span>` : '') +
		(caption.length ? `<span class="fig-cap">${toHTML(caption)}</span>` : '') +
		(credit.length ? `<span class="fig-credit">${toHTML(credit)}</span>` : '') +
		'</figcaption>';
}

/** A complete <figure> as an HTML string. */
export function renderFigure(input, { dir, n, id, uid } = {}) {
	const p = figureParts(input, { dir, uid });
	return `<figure class="${p.classes.join(' ')}"${id ? ` id="${esc(id)}"` : ''}><div class="fig-plate">${p.plate}</div>${captionHTML({ n, caption: p.caption, credit: p.credit })}</figure>`;
}
