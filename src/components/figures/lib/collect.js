// For the gallery: find every figure a set of Markdown posts contains
// (```figure blocks and captioned or uncaptioned lone images), in reading
// order and numbered the way the post numbers them.

import path from 'node:path';
import { figureKey, renderFigure } from './render.js';
import { parseSpec } from './data.js';

const BLOCK = /^```figure[^\n]*\n([\s\S]*?)\n```\s*$|^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/gm;

/**
 * @param raw     the post's Markdown source
 * @param dir     the folder the post is in (data paths are relative to it)
 * @param images  imported image modules keyed by file name, to show originals
 * @param post    the post's file name or address: with the figure's number it makes the ids inside the
 *                drawings ("fgp-scaling_post-1"), which must differ from post to post on the page that shows them all
 */
export function collectFigures(raw, dir, images = {}, post = 'post') {
	const key = figureKey(post);
	const found = [];
	let no = 0;
	for (const m of raw.matchAll(BLOCK)) {
		if (m[1] !== undefined) {
			const spec = parseSpec(m[1]);
			no += 1;
			const name = spec.original ? path.basename(spec.original) : undefined;
			found.push({ html: renderFigure(spec, { dir: path.resolve(dir), n: no, uid: `fgp-${key}-${no}` }), original: name ? images[name] : undefined, originalName: name });
		} else {
			const [caption, credit] = String(m[4] ?? '').replace(/\s*\{\.?[a-z]+\}\s*$/i, '').split(/\s+\|\s+/, 2);
			if (caption || credit) no += 1;
			found.push({ image: images[path.basename(m[3])], alt: m[2], caption, credit, n: caption || credit ? no : undefined, name: path.basename(m[3]) });
		}
	}
	return found;
}
