// rehype-math: TeX to SVG when the site is built, with MathJax 4 and the STIX
// Two glyphs. Nothing reaches the reader but the drawing itself: no script, no
// stylesheet from MathJax, no font download, and the same pixels on every
// platform. Runs after remark-math, which marks `$…$` and `$$…$$`.
//
//   inline    $h_{l+1} = h_l + f_l(h_l)$     <span class="math"><svg/><math/></span>
//   display   $$ … $$                          <div class="eq"><div class="eq-body">…</div></div>
//
// Each formula carries two things besides the drawing:
//   - the same formula as MathML, visually hidden, for screen readers;
//   - its TeX source in an <annotation>, which the copy handler in
//     src/scripts/typeset.js puts on the clipboard when a selection that
//     includes the formula is copied.
//
// Numbering (display maths only, one number per display)
//   \label{eq:name}     numbers the equation and gives it the id #eq-name
//   \tag{A}             a hand-picked tag instead of a number: (A)
//   \begin{equation}, {align}, {gather}, {multline} without a star are numbered too
//   $\eqref{eq:name}$   in running text becomes a link, "(3)"; \ref gives "3".
//                       Both also work inside a larger formula. Forward
//                       references are fine: labels are collected first.
//
// Options (second item of the plugin tuple in astro.config.mjs)
//   macros   extra TeX macros, MathJax syntax: { R: '\\mathbb{R}', norm: ['\\lVert #1 \\rVert', 1] }

import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { SerializedMmlVisitor } from '@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js';
import { STATE } from '@mathjax/src/js/core/MathItem.js';
import '@mathjax/src/js/util/asyncLoad/esm.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js';
import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js';
import '@mathjax/src/js/input/tex/html/HtmlConfiguration.js';
import { MathJaxStix2Font } from '@mathjax/mathjax-stix2-font/js/svg.js';

// House macros. \hl{…} sets part of a formula in the accent colour.
const MACROS = {
	R: '\\mathbb{R}',
	E: '\\mathbb{E}',
	T: '\\top',
	given: '\\mid',
	softmax: '\\operatorname{softmax}',
	argmax: '\\operatorname*{arg\\,max}',
	argmin: '\\operatorname*{arg\\,min}',
	hl: ['\\class{hl}{#1}', 1],
};

// MathJax sizes its drawings in ex so that they follow the x-height of the
// text around them. That makes the size depend on whichever font happens to be
// loaded (the fallback, then the web font). Source Serif 4's x-height is 0.475em,
// so the ex are converted to em here and the result is fixed and exact.
const EX = 0.475;

// How far an inline formula may reach above and below the baseline before it
// would push the lines of a paragraph apart (em). Taller ones record their
// extent so that math.css can absorb a small excess.
const ROOM_ABOVE = 1.05;
const ROOM_BELOW = 0.4;

const NUMBERED_ENV = /\\begin\{(equation|align|gather|multline)\}/;
const LABEL = /\\label\{([^}]*)\}/;
const TAG = /\\tag(\*?)\{([^}]*)\}/;
const REF = /\\(eqref|ref)\{([^}]*)\}/g;
const ONLY_REF = /^\\(eqref|ref)\{([^}]*)\}$/;

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });
const raw = (value) => ({ type: 'raw', value });
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));
const slug = (s) => s.replace(/^eq[:._-]/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const round = (n) => String(Math.round(n * 1000) / 1000);

// Works on MathJax's own lightweight tree: drops explorer attributes, empty
// glyphs (spaces) and groups left without any attribute.
const EXPLORER = /^data-(?:latex|mml-node|c$|mjx-texclass|semantic|speech|braille)/;
function prune(node) {
	if (!node.children) return [node];
	for (const name of Object.keys(node.attributes)) if (EXPLORER.test(name)) delete node.attributes[name];
	if (node.attributes.transform === 'translate(0,0)') delete node.attributes.transform;
	node.children = node.children.flatMap(prune);
	for (const child of node.children) child.parent = node;
	if (node.kind === 'path' && !node.attributes.d) return [];
	if (node.kind === 'g' && !Object.keys(node.attributes).length) return node.children;
	return [node];
}

// A hand-set tag is plain text; the few symbols people use for one are mapped to their characters.
const SYMBOLS = { star: '\u22c6', ast: '\u2217', dagger: '\u2020', ddagger: '\u2021', prime: '\u2032', S: '\u00a7' };
const tagText = (s) => s.replace(/\$/g, '').replace(/\\([A-Za-z]+)\s*/g, (m, name) => SYMBOLS[name] ?? m).trim();

// MathJax's SVG output can only break an inline formula *before* a relation or
// an operator, which is the convention for displays. In running text the sign
// belongs at the end of the line (TeX, and every style manual), so each piece
// that starts with an operator hands it back to the piece before. Pieces are
// <svg><g><g math> children placed by translate(x,0) </g></g></svg>.
function breakAfter(adaptor, parts) {
	const mathOf = (svg) => adaptor.firstChild(adaptor.firstChild(svg));
	const resize = (svg, delta) => {
		const box = adaptor.getAttribute(svg, 'viewBox').split(' ').map(Number);
		adaptor.setAttribute(svg, 'width', parseFloat(adaptor.getAttribute(svg, 'width')) * ((box[2] + delta) / box[2]) + 'ex');
		box[2] = Math.round((box[2] + delta) * 10) / 10;
		adaptor.setAttribute(svg, 'viewBox', box.join(' '));
		return box[2] - delta;
	};
	const SHIFT = /^translate\(([-\d.]+),\s*([-\d.]+)\)/;
	for (let i = 2; i < parts.length; i += 2) {
		const [before, gap, piece] = [parts[i - 2], parts[i - 1], parts[i]];
		if (adaptor.kind(before) !== 'svg' || adaptor.kind(gap) !== 'mjx-break' || adaptor.kind(piece) !== 'svg') return;
		const [sign, ...rest] = adaptor.childNodes(mathOf(piece));
		if (!rest.length || adaptor.getAttribute(sign, 'data-mml-node') !== 'mo' || adaptor.getAttribute(sign, 'transform')) continue;
		const shifts = rest.map((node) => (adaptor.getAttribute(node, 'transform') ?? '').match(SHIFT));
		if (shifts.some((m) => !m)) continue;
		// The sign's own width plus the space after it, which equals the space before it.
		const step = Number(shifts[0][1]);
		const space = ((Number(adaptor.getAttribute(gap, 'size')) + 1) / 18) * 1000;
		const end = resize(before, step);
		adaptor.setAttribute(sign, 'transform', `translate(${Math.round((end + space) * 10) / 10},0)`);
		adaptor.append(mathOf(before), adaptor.remove(sign));
		rest.forEach((node, k) => adaptor.setAttribute(node, 'transform', adaptor.getAttribute(node, 'transform').replace(SHIFT, `translate(${Math.round((Number(shifts[k][1]) - step) * 10) / 10},${shifts[k][2]})`)));
		resize(piece, -step);
	}
}

let engine;
function getEngine(macros) {
	if (engine) return engine;
	const adaptor = liteAdaptor();
	RegisterHTMLHandler(adaptor);
	const tex = new TeX({
		packages: ['base', 'ams', 'newcommand', 'configmacros', 'boldsymbol', 'mathtools', 'textmacros', 'cancel', 'braket', 'html'],
		macros: { ...MACROS, ...macros },
		tags: 'none',
		formatError(_jax, error) {
			throw error;
		},
	});
	const svg = new SVG({ fontData: MathJaxStix2Font, fontCache: 'none' });
	const doc = mathjax.document('', { InputJax: tex, OutputJax: svg });
	const visitor = new SerializedMmlVisitor();
	return (engine = { adaptor, doc, visitor });
}

async function render(source, display, macros) {
	const { adaptor, doc, visitor } = getEngine(macros);
	const options = { display, em: 16, ex: 16 * EX, containerWidth: 16 * 80 };
	const container = await doc.convertPromise(source, options);

	// An inline formula arrives as several drawings with break points between
	// them (after a relation or a binary operator, where TeX would allow one), so
	// a long one can wrap with the paragraph. A display is always one drawing.
	const em = (v) => parseFloat(v) * EX;
	let drawing = '';
	let width = 0;
	if (!display) breakAfter(adaptor, adaptor.childNodes(container));
	for (const part of adaptor.childNodes(container)) {
		const kind = adaptor.kind(part);
		if (kind === 'mjx-break') {
			// The space MathJax would have set there, as a real, breakable space (sized in math.css).
			const size = adaptor.getAttribute(part, 'size');
			drawing += size && size !== '0' ? `<span class="mb mb${size}"> </span>` : '<wbr>';
		}
		if (kind !== 'svg') continue;
		// ex -> em, and note the extent above and below the baseline.
		const w = em(adaptor.getAttribute(part, 'width'));
		const height = em(adaptor.getAttribute(part, 'height'));
		const depth = -em(adaptor.getStyle(part, 'vertical-align') || '0');
		width += w;
		adaptor.setAttribute(part, 'width', round(w) + 'em');
		adaptor.setAttribute(part, 'height', round(height) + 'em');
		let style = depth ? `vertical-align:${round(-depth)}em` : '';
		const above = height - depth;
		if (!display && (above > ROOM_ABOVE || depth > ROOM_BELOW)) style += `;--a:${round(above)};--d:${round(depth)}`;
		if (style) adaptor.setAttribute(part, 'style', style.replace(/^;/, ''));
		else adaptor.removeAttribute(part, 'style');
		adaptor.removeAttribute(part, 'role');
		adaptor.removeAttribute(part, 'focusable');
		adaptor.setAttribute(part, 'aria-hidden', 'true');
		// The data-* attributes MathJax leaves for its own explorer, and the groups
		// that only existed to carry them, are a third of the markup.
		prune(part);
		drawing += adaptor.outerHTML(part).replace(/ xmlns:xlink="[^"]*"/, '');
	}

	// The same formula as MathML, with its source attached.
	const root = await doc.convertPromise(source, { ...options, end: STATE.CONVERT });
	const mml = visitor
		.visitTree(root)
		.replace(/ data-[a-z-]+="[^"]*"/g, '')
		.replace(/\n\s*/g, '')
		.replace(/^<math([^>]*)>([\s\S]*)<\/math>$/, (_m, attrs, inner) => `<math${attrs}><semantics><mrow>${modern(inner)}</mrow><annotation encoding="application/x-tex">${escape(source)}</annotation></semantics></math>`);

	return { html: drawing + mml, width };
}

// MathML that MathJax still writes and browsers are dropping (Firefox warns in
// the console about both). Only the hidden copy for screen readers is touched.
//   mathvariant="double-struck" / "script" on a letter or digit: the Unicode
//     character says the same (R becomes U+211D), and survives the attribute.
//   an accent under a base, implied by the operator alone (\underbrace): said
//     outright with accentunder="true".
const ALPHABETS = {
	'double-struck': { upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8, holes: { C: '\u2102', H: '\u210d', N: '\u2115', P: '\u2119', Q: '\u211a', R: '\u211d', Z: '\u2124' } },
	script: { upper: 0x1d49c, lower: 0x1d4b6, holes: { B: '\u212c', E: '\u2130', F: '\u2131', H: '\u210b', I: '\u2110', L: '\u2112', M: '\u2133', R: '\u211b', e: '\u212f', g: '\u210a', o: '\u2134' } },
};
function modern(mml) {
	mml = mml.replace(/<(mi|mn) mathvariant="(double-struck|script)">([^<]*)<\/\1>/g, (all, tag, variant, body) => {
		const { upper, lower, digit, holes } = ALPHABETS[variant];
		let out = '';
		for (const ch of body) {
			const start = /[A-Z]/.test(ch) ? [upper, 65] : /[a-z]/.test(ch) ? [lower, 97] : digit && /\d/.test(ch) ? [digit, 48] : null;
			if (!start) return all;
			out += holes[ch] ?? String.fromCodePoint(start[0] + ch.charCodeAt(0) - start[1]);
		}
		return `<${tag}>${out}</${tag}>`;
	});
	// Each <munder> whose last child is an under-brace, -bracket or -line
	// (MathJax writes the character as a numeric reference).
	const open = [], accents = [];
	for (const m of mml.matchAll(/<munder>|<\/munder>/g)) {
		if (m[0] === '<munder>') open.push(m.index);
		else {
			const at = open.pop();
			if (at !== undefined && /<mo[^>]*>(?:[\u23df\u23b5\u23dd\u2015_\u00af]|&#x(?:23DF|23B5|23DD|2015|AF);)<\/mo>$/i.test(mml.slice(0, m.index))) accents.push(at);
		}
	}
	for (const at of accents.sort((x, y) => y - x)) mml = mml.slice(0, at) + '<munder accentunder="true">' + mml.slice(at + 8);
	return mml;
}

export default function rehypeMath({ macros = {} } = {}) {
	return async (tree, file) => {
		// Collect the formulas in document order.
		const found = [];
		(function walk(node, parent) {
			if (!node.children) return;
			for (const child of [...node.children]) {
				const cls = child.type === 'element' && child.tagName === 'code' ? [].concat(child.properties?.className ?? []) : [];
				if (cls.includes('language-math')) {
					const display = cls.includes('math-display');
					const block = display && node.tagName === 'pre';
					found.push({ source: textOf(child).trim(), display, node: block ? node : child, parent: block ? parent : node });
				} else walk(child, node);
			}
		})(tree, null);
		if (!found.length) return;

		// First pass: numbers and labels, so that a reference may come before its equation.
		const labels = new Map();
		let serial = 0;
		for (const f of found) {
			if (!f.display) continue;
			const label = f.source.match(LABEL)?.[1];
			const tag = f.source.match(TAG);
			if (!label && !tag && !NUMBERED_ENV.test(f.source)) continue;
			const shown = tag ? tagText(tag[2]) : String(++serial);
			f.number = tag?.[1] ? shown : `(${shown})`;
			f.id = `eq-${slug(label ?? '') || slug(shown) || serial}`;
			if (label) labels.set(label, { id: f.id, shown });
			f.source = f.source.replace(LABEL, '').replace(TAG, '').replace(/\\(?:notag|nonumber)\b/g, '').trim();
		}
		const warn = (message, f) => file.message(`${message} in: ${f.source.slice(0, 80)}`, f.node.position, 'rehype-math');
		const resolve = (f, name) => {
			const hit = labels.get(name);
			if (!hit) warn(`unknown equation label "${name}"`, f);
			return hit ?? { id: '', shown: '??' };
		};

		for (const f of found) {
			let out;
			const only = !f.display && f.source.match(ONLY_REF);
			if (only) {
				// A bare reference in running text is a link in the text face, not a drawing.
				const { id, shown } = resolve(f, only[2]);
				const label = only[1] === 'eqref' ? `(${shown})` : shown;
				out = id ? el('a', { className: ['eq-ref'], href: `#${id}` }, [text(label)]) : el('span', { className: ['eq-ref'] }, [text(label)]);
			} else {
				const source = f.source.replace(REF, (_m, kind, name) => {
					const { shown } = resolve(f, name);
					return kind === 'eqref' ? `\\text{(${shown})}` : `\\text{${shown}}`;
				});
				try {
					const { html, width } = await render(source, f.display, macros);
					if (f.display) {
						// A formula wider than a phone's column can be scrolled, so it must be reachable by keyboard.
						const body = el('div', { className: ['eq-body'], ...(width > 19 ? { tabIndex: 0, role: 'group', ariaLabel: 'Equation, scrollable' } : {}) }, [raw(html)]);
						const no = f.number && el('a', { className: ['eq-no'], href: `#${f.id}`, ariaLabel: `Equation ${f.number}` }, [text(f.number)]);
						out = el('div', { className: ['eq', ...(f.number ? ['eq-numbered'] : [])], ...(f.id ? { id: f.id } : {}) }, no ? [body, no] : [body]);
					} else {
						out = el('span', { className: ['math'] }, [raw(html)]);
					}
				} catch (error) {
					if (error?.retry) throw error;
					warn(`TeX error (${error?.message ?? error})`, f);
					console.warn(`[rehype-math] ${file.path ?? ''}: ${error?.message ?? error}\n    ${f.source.slice(0, 120)}`);
					out = el(f.display ? 'pre' : 'code', { className: ['math-error'], title: String(error?.message ?? error) }, [text(f.source)]);
				}
			}
			const siblings = f.parent.children;
			const at = siblings.indexOf(f.node);
			siblings[at] = out;
			// Punctuation or a suffix written straight after an inline formula
			// ("$d$-dimensional", "$x$,") must not start the next line on its own.
			const next = siblings[at + 1];
			const tail = !f.display && next?.type === 'text' && next.value.match(/^[^\s\u2014\u2013]+/)?.[0];
			if (tail) {
				next.value = next.value.slice(tail.length);
				siblings[at] = el('span', { className: ['nw'] }, [out, text(tail)]);
			}
		}
	};
}
