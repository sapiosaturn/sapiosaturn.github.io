// rehype-code: finishes the frame around a highlighted code block and adds the
// page script. Runs after rehype-notebook, which has already wrapped every
// <pre> in <div class="code-block" data-lang="…">.
//
//   <div class="code-block" data-lang="python" data-kind="diff" data-numbers data-wide>
//     <div class="code-head"><span class="code-title">attention.py</span><span class="code-lang">python</span></div>
//     <pre class="astro-code" tabindex="0"><code><span class="line">…</span></code></pre>
//   </div>
//
// The copy button is created by the script (src/scripts/typeset.js), so a
// reader without JavaScript never sees a button that does nothing. The script
// is inlined once, at the end of the text, and only on pages that have a code
// block or a formula.

import fs from 'node:fs';
import { minify } from '../lib/minify.js';

const NAMES = { py: 'python', js: 'javascript', ts: 'typescript', sh: 'shell', bash: 'shell', zsh: 'shell', shellscript: 'shell', console: 'terminal', shellsession: 'terminal', pycon: 'python repl', md: 'markdown', yml: 'yaml', tex: 'latex', rs: 'rust', cpp: 'c++', plaintext: '', text: '', txt: '' };

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });
const classes = (n) => [].concat(n.properties?.className ?? []);

// Minified here; the source stays readable in the repo.
const script = minify(fs.readFileSync(new URL('../scripts/typeset.js', import.meta.url), 'utf8'));

export default function rehypeCode() {
	return (tree) => {
		let wanted = false;
		(function walk(node) {
			if (!node.children) return;
			for (const child of node.children) {
				if (child.type === 'raw') wanted ||= /^<svg[^>]*aria-hidden/.test(child.value);
				if (child.type !== 'element') continue;
				const pre = classes(child).includes('code-block') && child.children.find((n) => n.type === 'element' && n.tagName === 'pre');
				if (!pre) {
					walk(child);
					continue;
				}
				wanted = true;
				const p = pre.properties ?? {};
				const lang = String(child.properties.dataLang ?? p.dataLanguage ?? '');
				const label = NAMES[lang] ?? lang;
				const title = p.dataTitle;
				const head = [];
				if (title) head.push(el('span', { className: ['code-title'] }, [text(String(title))]));
				if (label) head.push(el('span', { className: ['code-lang'] }, [text(label)]));
				delete child.properties.dataLang;
				if (lang) child.properties.dataLang = lang;
				if (p.dataKind) child.properties.dataKind = p.dataKind;
				if (p.dataWide !== undefined) child.properties.dataWide = '';
				if (p.dataNumbers !== undefined) {
					child.properties.dataNumbers = '';
					const start = Number(p.dataNumbers) || 1;
					const last = start + pre.children.flatMap((c) => c.children ?? []).filter((c) => classes(c).includes('line')).length - 1;
					// The counter starts one below the first number; the gutter is as wide as the last one.
					pre.properties.style = `--start:${start - 1};--digits:${String(last).length}`;
				}
				for (const key of ['dataTitle', 'dataKind', 'dataWide', 'dataNumbers', 'dataLanguage']) delete p[key];
				child.children.unshift(el('div', { className: ['code-head'] }, head));
			}
		})(tree);
		if (wanted) tree.children.push(el('script', {}, [text(script)]));
	};
}
