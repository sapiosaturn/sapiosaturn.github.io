// remark-figures: a fenced block tagged `figure` becomes a house-style figure,
// drawn as static SVG at build time by src/components/figures.
//
//   ```figure
//   type: line
//   data: ./_figures/loss.csv        # or inline arrays
//   x: step
//   series:
//     - { y: train, label: train }
//     - { y: val, label: validation, color: accent }
//   caption: Loss over training.
//   credit: Data from [the paper](https://arxiv.org/abs/...).
//   ```
//
// The body is YAML, except that caption, credit, alt and desc take the rest of
// their line as written (no quoting needed). File paths are relative to the Markdown file. Adding the
// word `source` after `figure` also prints the block itself under the figure
// (the gallery at /figures/ uses that). Numbering ("Fig. 3") is done later by
// rehype-notebook, in document order together with captioned images.
// A mistake in a block fails the build with the file and line, rather than
// publishing a broken figure.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { figureKey, figureParts, toHast } from '../components/figures/lib/render.js';
import { parseSpec } from '../components/figures/lib/data.js';

const h = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });

export function figureNode(spec, dir, uid) {
	const p = figureParts(spec, { dir, uid });
	const cap = [h('span', { className: ['label'] }, [{ type: 'text', value: 'Fig.' }])];
	if (p.caption.length) cap.push(h('span', { className: ['fig-cap'] }, toHast(p.caption)));
	if (p.credit.length) cap.push(h('span', { className: ['fig-credit'] }, toHast(p.credit)));
	return {
		type: 'figure',
		data: {
			hName: 'figure',
			hProperties: { className: p.classes, dataFigKit: '' },
			hChildren: [h('div', { className: ['fig-plate'] }, [{ type: 'raw', value: p.plate }]), h('figcaption', { className: ['nocaps'] }, cap)],
		},
	};
}

export default function remarkFigures() {
	return (tree, file) => {
		const filePath = file.path?.startsWith('file:') ? fileURLToPath(file.path) : file.path ?? file.history?.[0];
		const dir = filePath ? path.dirname(filePath) : process.cwd();
		// The ids inside a figure's drawings: the file's name and the block's place in it ("fg-scaling_post-1"),
		// counted afresh for every document, so they do not depend on what else is being built.
		const key = figureKey(filePath ?? 'markdown');
		let count = 0;
		(function walk(node) {
			if (!node.children) return;
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				if (child.type !== 'code' || child.lang !== 'figure') { walk(child); continue; }
				let made;
				try {
					const spec = parseSpec(child.value);
					if (!spec || typeof spec !== 'object') throw new Error('the block is empty');
					made = figureNode(spec, dir, `fg-${key}-${++count}`);
				} catch (err) {
					const where = `${filePath ? path.relative(process.cwd(), filePath) : 'markdown'}:${child.position?.start.line ?? '?'}`;
					throw new Error(`[figure] ${where}: ${err.message}`);
				}
				const out = [made];
				if (/\bsource\b/.test(child.meta ?? '')) out.push({ type: 'code', lang: 'yaml', meta: null, value: '```figure\n' + child.value + '\n```' });
				node.children.splice(i, 1, ...out);
				i += out.length - 1;
			}
		})(tree);
	};
}
