// The house syntax theme and the Shiki transformer behind every code block.
//
// One theme serves both colour schemes: it names CSS custom properties instead
// of colours, and the transformer turns each into a one-letter class, so the
// palette lives in src/styles/code.css next to the rest of the tokens.
//
//   class  what                                   token (code.css)
//   k      keywords, storage, word operators      --code-keyword  (ink-strong, medium weight)
//   d      names where they are defined           --code-def
//   s      strings                                --code-string
//   n      numbers, constants, escapes            --code-number
//   p      punctuation and symbol operators       --code-punct    (ink-2)
//   c      comments and docstrings                --code-comment  (ink-3, italic)
//   (none) everything else                        --code-fg       (ink)
//
// Authoring, after the language on the opening fence:
//   title="attention.py"     a file name or title on the frame
//   {2,4-6}                  highlighted lines
//   ins={3-4} del={2}        lines marked as added / removed
//   numbers  numbers=40      line numbers, optionally starting at 40
//   wide                     let the block run into the right margin on wide screens
//   raw                      leave [!code …] comments and diff columns exactly as typed
// and at the end of a line, inside a comment in the block's own language:
//   # [!code ++]   # [!code --]   # [!code hl]        (// and -- comments work too)
// ```diff blocks are marked from their +/- columns; ```console blocks are
// terminal sessions: lines starting with "$ " (or "% ", ">>> ", "... ") are
// commands, the rest is output.

const v = (name) => `var(--code-${name})`;
const rule = (name, scope, extra = {}) => ({ scope, settings: { foreground: v(name), ...extra } });

/** @type {import('shiki').ThemeRegistration} */
export const houseTheme = {
	name: 'house',
	type: 'dark',
	fg: v('fg'),
	bg: 'transparent',
	settings: [
		{ settings: { foreground: v('fg'), background: 'transparent' } },
		rule('c', ['comment', 'punctuation.definition.comment', 'string.quoted.docstring', 'string.quoted.docstring punctuation.definition.string', 'meta.diff.header', 'meta.diff.index', 'meta.diff.range', 'punctuation.definition.from-file', 'punctuation.definition.to-file', 'punctuation.definition.range.diff']),
		rule('p', ['punctuation', 'keyword.operator', 'meta.brace', 'storage.type.function.arrow', 'meta.embedded.line punctuation.section.embedded', 'punctuation.definition.tag']),
		rule('k', [
			'keyword',
			'storage',
			'keyword.control',
			'keyword.operator.logical.python',
			'keyword.operator.new',
			'keyword.operator.expression',
			'keyword.operator.word',
			'keyword.operator.wordlike',
			'keyword.other',
			'support.function.builtin.shell',
			'entity.name.command.shell',
			'entity.name.tag',
			'markup.heading',
			'markup.bold',
			'support.function.be.latex',
			'support.function.general.tex',
			'keyword.control.equation',
		]),
		rule('p', ['keyword.operator.assignment', 'keyword.operator.arithmetic', 'keyword.operator.comparison', 'keyword.operator.pipe', 'keyword.operator.redirect', 'punctuation.separator', 'punctuation.definition.markdown', 'punctuation.definition.math']),
		rule('d', ['entity.name.function', 'entity.name.type.class', 'entity.name.class', 'entity.name.type', 'entity.name.namespace', 'meta.function.python support.function.magic.python', 'entity.name.section', 'entity.other.attribute-name', 'variable.other.assignment.shell', 'variable.parameter.function.latex']),
		rule('s', ['string', 'string punctuation.definition.string', 'markup.inline.raw', 'markup.fenced_code.block', 'markup.raw']),
		rule('n', ['constant.numeric', 'constant.language', 'constant.character.escape', 'constant.other.placeholder', 'constant.character.format.placeholder', 'keyword.other.unit', 'constant.other.color', 'support.constant']),
		// Not names being defined: calls and decorators stay in the text colour.
		// Mapping keys read as plain text; only their values are coloured.
		{ scope: ['meta.function-call entity.name.function', 'entity.name.function.decorator', 'entity.name.function.call', 'meta.function-call.generic', 'support.function.magic', 'support.type.property-name.json', 'entity.name.tag.yaml', 'support.type.property-name.toml', 'markup.inserted', 'markup.deleted', 'string.unquoted.argument.shell', 'constant.other.option'], settings: { foreground: v('fg') } },
		rule('k', ['punctuation.definition.decorator', 'entity.name.function.decorator.python', 'entity.name.command.shell', 'support.function.builtin.shell']),
		rule('p', ['entity.name.function.decorator punctuation', 'support.type.property-name.json punctuation', 'punctuation.support.type.property-name']),
		rule('s', ['string.quoted.double.json', 'string.quoted.double.json punctuation.definition.string']),
		rule('c', ['string.quoted.docstring', 'string.quoted.docstring punctuation.definition.string']),
	],
};

const TERMINAL = new Set(['console', 'shellsession', 'terminal', 'pycon']);
const PROMPT = /^(\$|%|❯|>>>|\.\.\.)(?: |$)/;
const NOTATION = /\s*(?:\/\/|#|--|\/\*|<!--|%)\s*\[!code (\+\+|--|hl|highlight)\]\s*(?:\*\/|-->)?\s*$/;
const FLAG = { '++': 'add', '--': 'del', hl: 'hl', highlight: 'hl' };

const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));

function ranges(spec) {
	const set = new Set();
	for (const part of String(spec).split(',')) {
		const [a, b = a] = part.trim().split('-').map(Number);
		for (let i = a; i <= b && Number.isFinite(i); i++) set.add(i);
	}
	return set;
}

export function parseMeta(rawMeta = '') {
	const meta = { hl: new Set(), ins: new Set(), del: new Set() };
	const rest = rawMeta
		.replace(/([\w-]+)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|(\S+))/g, (_m, key, a, b, c, d) => {
			const value = a ?? b ?? c ?? d;
			if (key === 'ins' || key === 'del' || key === 'hl') meta[key] = ranges(value);
			else meta[key === 'showLineNumbers' ? 'numbers' : key] = value;
			return ' ';
		})
		.replace(/\{([^}]*)\}/g, (_m, spec) => {
			meta.hl = ranges(spec);
			return ' ';
		});
	for (const word of rest.split(/\s+/).filter(Boolean)) meta[word === 'showLineNumbers' ? 'numbers' : word] ??= true;
	return meta;
}

const cache = new WeakMap();
function metaOf(ctx) {
	if (!cache.has(ctx.options)) cache.set(ctx.options, parseMeta(ctx.options.meta?.__raw));
	return cache.get(ctx.options);
}

// Remove `count` characters from the end (or start) of a line's text, however the tokens are nested.
function trim(node, count, fromEnd) {
	const kids = node.children;
	while (count > 0 && kids.length) {
		const at = fromEnd ? kids.length - 1 : 0;
		const kid = kids[at];
		if (kid.type === 'text') {
			const take = Math.min(count, kid.value.length);
			kid.value = fromEnd ? kid.value.slice(0, kid.value.length - take) : kid.value.slice(take);
			count -= take;
			if (!kid.value) kids.splice(at, 1);
		} else {
			count = trim(kid, count, fromEnd);
			if (!kid.children.length) kids.splice(at, 1);
			else if (count > 0) break;
		}
	}
	return count;
}

/** @returns {import('shiki').ShikiTransformer} */
export function houseTransformer() {
	return {
		name: 'house',
		line(node, number) {
			const meta = metaOf(this);
			const lang = this.options.lang;
			const flags = new Set();
			let content = textOf(node);

			if (TERMINAL.has(lang)) {
				// Typed or printed: that is the only distinction a session needs.
				const state = (meta.session ??= { continued: false });
				const prompt = content.match(PROMPT);
				let kind = 'out';
				let mark = null;
				if (prompt) {
					kind = 'cmd';
					// Drawn by CSS from the attribute, so the prompt is never selected or copied.
					mark = { type: 'element', tagName: 'span', properties: { class: 'pr', 'data-p': prompt[1] }, children: [] };
					content = content.slice(prompt[0].length);
				} else if (state.continued) kind = 'cmd';
				else if (/^#( |$)/.test(content)) kind = 'note';
				state.continued = kind === 'cmd' && /\\$/.test(content);
				node.children = [...(mark ? [mark] : []), ...(content ? [{ type: 'text', value: content }] : [])];
				flags.add(kind);
			} else {
				// Colours become classes; text in the default colour needs no element at all.
				node.children = node.children.map((child) => {
					if (child.type !== 'element') return child;
					const style = String(child.properties?.style ?? '');
					const name = style.match(/color:var\(--code-([a-z]+)\)/)?.[1];
					if (!name || name === 'fg') return child.children.length === 1 && child.children[0].type === 'text' ? child.children[0] : { ...child, properties: {} };
					return { ...child, properties: { class: name } };
				});

				if (lang === 'diff' && !meta.raw) {
					// Astro has already split the +/- off into its own element; the column is redrawn in CSS.
					const mark = content[0];
					if (/^(\+\+\+|---|diff |index )/.test(content)) flags.add('meta');
					else if (content.startsWith('@@')) flags.add('hunk');
					else if (mark === '+' || mark === '-' || mark === ' ') {
						if (mark !== ' ') flags.add(mark === '+' ? 'add' : 'del');
						trim(node, 1, false);
					}
				}
				const note = !meta.raw && content.match(NOTATION);
				if (note) {
					trim(node, note[0].length, true);
					flags.add(FLAG[note[1]]);
				}
			}
			// Whatever lost its attributes in the steps above is plain text again.
			node.children = node.children.flatMap((child) => (child.type === 'element' && !Object.keys(child.properties ?? {}).length ? child.children : [child]));
			if (meta.hl.has(number)) flags.add('hl');
			if (meta.ins.has(number)) flags.add('add');
			if (meta.del.has(number)) flags.add('del');
			if (flags.has('add') || flags.has('del')) meta.marked = true;
			node.properties.class = ['line', ...flags].join(' ');
		},
		code(node) {
			// Markdown hands over the code with a final newline; the empty line it makes is not part of the listing.
			const last = node.children.at(-1);
			if (node.children.length > 1 && last?.type === 'element' && !textOf(last)) node.children.splice(-2, 2);
			// A block with added or removed lines gets a +/- column on every line, so the text stays aligned.
			const meta = metaOf(this);
			if (meta.raw || (!meta.marked && this.options.lang !== 'diff')) return;
			for (const line of node.children) {
				if (line.type !== 'element') continue;
				const cls = String(line.properties.class);
				if (/\b(meta|hunk)\b/.test(cls)) continue;
				const sign = /\badd\b/.test(cls) ? '+' : /\bdel\b/.test(cls) ? '\u2212' : '';
				line.children.unshift({ type: 'element', tagName: 'span', properties: { class: 'mk', ...(sign ? { 'data-m': sign } : {}) }, children: [] });
			}
		},
		pre(node) {
			const meta = metaOf(this);
			const lang = this.options.lang;
			// Colours and scrolling come from code.css, not from inline styles.
			delete node.properties.style;
			if (typeof meta.title === 'string') node.properties['data-title'] = meta.title;
			if (meta.numbers) node.properties['data-numbers'] = meta.numbers === true ? '1' : String(meta.numbers);
			if (meta.wide) node.properties['data-wide'] = '';
			const kind = TERMINAL.has(lang) ? 'terminal' : lang === 'diff' || meta.marked ? 'diff' : null;
			if (kind) node.properties['data-kind'] = kind;
		},
	};
}

/** @type {Partial<import('astro').ShikiConfig>} */
export const shikiConfig = {
	theme: houseTheme,
	wrap: null,
	langAlias: { terminal: 'console', pycon: 'console' },
	transformers: [houseTransformer()],
};
