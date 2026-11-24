// Small helpers shared by every figure renderer. Everything here returns
// plain strings: the kit draws static SVG at build time and ships no script.

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Round to at most two decimals and drop trailing zeros: keeps the markup small. */
export const r = (n) => {
	const v = Math.round(n * 100) / 100;
	return Object.is(v, -0) ? '0' : String(v);
};

/** attrs({ x: 1, class: 'a', hidden: null }) -> ' x="1" class="a"' */
export const attrs = (o = {}) =>
	Object.entries(o)
		.filter(([, v]) => v !== null && v !== undefined && v !== false && v !== '')
		.map(([k, v]) => ` ${k}="${typeof v === 'number' ? r(v) : esc(v)}"`)
		.join('');

export const el = (tag, a, children) => (children === undefined ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${[].concat(children).join('')}</${tag}>`);

export const line = (x1, y1, x2, y2, cls) => el('line', { x1, y1, x2, y2, class: cls });
export const text = (x, y, s, a = {}) => el('text', { x, y, ...a }, esc(s));

// --- Type -------------------------------------------------------------------
// The labels are set in IBM Plex Mono, whose advance is exactly 0.6 em, so the
// width of any label is known at build time without measuring anything.
export const FS = { tick: 11.5, label: 12, small: 10.5, node: 13, prose: 14.5 };
export const MONO = 0.6;
export const tw = (s, size = FS.label) => String(s).length * size * MONO;
// The serif is proportional; this average is only used to keep prose notes inside the plate.
export const sw = (s, size = FS.prose) => String(s).length * size * 0.47;

// --- Numbers ----------------------------------------------------------------
const MINUS = '\u2212';
/** Fixed decimals with a true minus sign; negative zero keeps its sign, as a rounded small negative would. */
export function fixed(v, d = 0) {
	const s = Math.abs(v).toFixed(d);
	return (v < 0 || Object.is(v, -0) ? MINUS : '') + s;
}
const SI = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
export function si(v) {
	const a = Math.abs(v);
	for (const [n, suffix] of SI) if (a >= n) return (v < 0 ? MINUS : '') + String(+(a / n).toPrecision(3)) + suffix;
	if (a !== 0 && a < 0.01) return v.toExponential(0).replace('e-', 'e' + MINUS).replace('-', MINUS);
	return (v < 0 ? MINUS : '') + String(+a.toPrecision(3));
}
/**
 * A number formatter from a short spec:
 *   '.2f' fixed decimals · '%' percent of 1 · '.1%' · 'si' 1k, 2.5M · '.2' leading zero dropped (.78)
 * With no spec, `decimals` (taken from the tick step) is used.
 */
export function formatter(spec, decimals = 0) {
	if (typeof spec === 'function') return spec;
	if (!spec || spec === 'auto') return (v) => fixed(v, decimals);
	if (spec === 'si') return si;
	let m;
	if ((m = /^\.(\d)f$/.exec(spec))) return (v) => fixed(v, +m[1]);
	if ((m = /^(?:\.(\d))?%$/.exec(spec))) return (v) => fixed(v * 100, +(m[1] ?? 0)) + '%';
	if ((m = /^\.(\d)$/.exec(spec))) return (v) => fixed(v, +m[1]).replace(/^(\u2212?)0\./, '$1.');
	return (v) => fixed(v, decimals);
}

/** Three significant figures, for the written descriptions screen readers get. */
export const say = (v) => String(+Number(v).toPrecision(3)).replace('-', MINUS);

// --- Colour -----------------------------------------------------------------
// Series colours are named, never hex: each name is a CSS custom property set
// per theme in figures.css, so a figure follows the page with no filter.
export const PALETTE = ['ink', 'accent', 'blue', 'teal', 'rose', 'mute'];
export const colourClass = (name, i = 0, order = PALETTE) => 'fg-c-' + (PALETTE.includes(name) ? name : order[i % 5]);
// Filled areas start from the quiet grey: a block of full-strength ink is too loud.
export const FILL_ORDER = ['mute', 'accent', 'blue', 'teal', 'rose'];

/** Position on a colour ramp, as the inline custom property the stylesheet turns into a fill. */
export const ramp = (t) => `--t:${r(Math.max(-1, Math.min(1, t)))}`;

// --- Arrowheads -------------------------------------------------------------
/** A slim filled head at (x, y) pointing along (dx, dy). */
export function arrowHead(x, y, dx, dy, cls, size = 7) {
	const n = Math.hypot(dx, dy) || 1;
	const ux = dx / n, uy = dy / n, w = size * 0.42;
	const bx = x - ux * size, by = y - uy * size;
	return el('path', { d: `M${r(x)} ${r(y)}L${r(bx - uy * w)} ${r(by + ux * w)}L${r(bx + uy * w)} ${r(by - ux * w)}Z`, class: cls });
}
