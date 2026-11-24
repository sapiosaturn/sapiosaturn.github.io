// card: the link-preview image of a page (og:image), 1200 x 630, made at build time.
//
// What a post looks like when its address is pasted into X, Slack, iMessage or
// Discord: the site's ground, the post's own chasm drawing (src/lib/chasm.js,
// seeded from the post's file name), the site's name where the home page has
// the seed, and the title under the plate in the face of a post's h1. It is
// the home page's order, plate then words, at the home page's proportions.
//
// Nothing here asks the machine for a font. The text is turned into outlines
// with opentype.js from the two TrueType files in src/assets/card (made by hand
// with R/tools/card-fonts.py; the woff2 subsets in public/fonts cannot be read
// by it), so the picture handed to sharp holds only paths, and the same build
// gives the same PNG anywhere. No network, no clock, no randomness.
//
// Used by src/pages/og/[slug].png.js, which reads the two font files.

import opentype from 'opentype.js';
import sharp from 'sharp';
import { chasm, FRAME, pathData } from './chasm.js';

export const CARD = { width: 1200, height: 630 };

// The dark theme's tokens (src/styles/global.css, section 2). A card is always dark.
const INK = { bg: '#141312', ink: '#d6d2c9', strong: '#f0ece3', quiet: '#837e75', accent: '#d0a465' };

const MARGIN = 80; // left and right; the plate and the words share these edges
const TOP = 60; // top of the plate's frame
const SCALE = (CARD.width - 2 * MARGIN) / FRAME.W; // the plate is the home page's, 624 x 184, enlarged to the measure
const FOOT = TOP + FRAME.H * SCALE;
const NAME = { size: 20, tracking: 0.02, drop: 34 }; // the site's name: the header's wordmark (mono 500), under the plate's foot
const TITLE = {
	tracking: -0.012, // as .page-head h1
	leading: 1.1,
	cap: 0.67, // cap height of the display face, in em: the first line hangs from this
	gap: 38, // from the name's baseline to the top of the title's capitals
	// The largest size whose line count is allowed: one line at 64, two at 56, else 46 (a 90-character title is two lines).
	steps: [[64, 1], [56, 2], [46, 3], [40, 4]],
};
const WORDMARK = { size: 40, tracking: 0.02 }; // the site's own card: the name in the title's place

const parse = (data) => {
	const bytes = new Uint8Array(data);
	return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};

const num = (v) => {
	const s = v.toFixed(2);
	return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

/**
 * The card maker. `fonts` are the bytes of the two files in src/assets/card:
 * { title: Source Serif 4 Display Semibold, label: IBM Plex Mono Medium }.
 */
export function cards(fonts) {
	const title = parse(fonts.title);
	const label = parse(fonts.label);

	const set = (letterSpacing) => ({ kerning: true, features: { liga: true }, letterSpacing });
	const widthOf = (font, text, size, tracking) => font.getAdvanceWidth(text, size, set(tracking));
	// Text as one filled path, its baseline starting at x, y. (Written out here:
	// opentype.js 2.0.0's own toPathData prints "NaN" for some coordinates.)
	const glyphs = (font, text, x, y, size, tracking, fill) => {
		const d = font
			.getPath(text, x, y, size, set(tracking))
			.commands.map((c) => (c.type === 'Z' ? 'Z' : c.type + (c.type === 'C' ? [c.x1, c.y1, c.x2, c.y2, c.x, c.y] : c.type === 'Q' ? [c.x1, c.y1, c.x, c.y] : [c.x, c.y]).map(num).join(' ')))
			.join('');
		return `<path fill="${fill}" d="${d}"/>`;
	};

	// Fewest lines that fit the measure; of those, the most even (the widest line as short as it can be), as text-wrap: balance.
	// Returns null when a single word is wider than the measure.
	function wrap(text, size, measure) {
		const words = text.trim().split(/\s+/);
		const width = (i, j) => widthOf(title, words.slice(i, j).join(' '), size, TITLE.tracking);
		for (let count = 1; count <= words.length; count++) {
			let best = null;
			(function place(i, left, lines, widest) {
				if (left === 1) {
					const w = width(i, words.length);
					if (w <= measure && (!best || Math.max(widest, w) < best.widest)) best = { widest: Math.max(widest, w), lines: [...lines, words.slice(i).join(' ')] };
					return;
				}
				for (let j = i + 1; j <= words.length - (left - 1); j++) {
					const w = width(i, j);
					if (w > measure) break;
					place(j, left - 1, [...lines, words.slice(i, j).join(' ')], Math.max(widest, w));
				}
			})(0, count, [], 0);
			if (best) return best.lines;
		}
		return null;
	}

	// The largest size at which the title takes no more lines than that size allows. A title too
	// long for the last step keeps its size and takes the lines it needs; a word too long for the
	// measure even there shrinks the title until it fits.
	function fit(text, measure) {
		let size, lines;
		for (const [step, most] of TITLE.steps) {
			size = step;
			lines = wrap(text, size, measure);
			if (lines && lines.length <= most) return { size, lines };
		}
		while (!lines && size > 12) lines = wrap(text, (size -= 2), measure);
		return { size, lines: lines ?? [text] };
	}

	// The plate: every stroke of the seed's drawing, weights and tones as on the home page.
	function plate(seed) {
		const { lines, cross } = chasm(seed);
		const strokes = lines.map((l) => `<path stroke-width="${num(l.weight)}" stroke-opacity="${num(l.tone)}" d="${pathData(l.points, 2)}"/>`).join('');
		return `<g transform="translate(${MARGIN} ${TOP}) scale(${SCALE})" fill="none" stroke="${INK.ink}" stroke-linejoin="round">${strokes}<path stroke="${INK.accent}" stroke-width="${cross.weight}" d="${pathData(cross.points, 2)}"/></g>`;
	}

	/** The card as SVG (paths only). With a title, a post's card; without, the site's own. */
	function svg({ seed, title: heading = '', name }) {
		let body = plate(seed);
		let y = FOOT + NAME.drop;
		if (heading) {
			const missing = [...new Set([...heading].filter((ch) => /\S/.test(ch) && title.charToGlyphIndex(ch) === 0))];
			if (missing.length) console.warn(`[card] "${heading}": no glyph for ${missing.join(' ')} in src/assets/card (see R/tools/card-fonts.py)`);
			body += glyphs(label, name, CARD.width - MARGIN - widthOf(label, name, NAME.size, NAME.tracking), y, NAME.size, NAME.tracking, INK.quiet);
			const { size, lines } = fit(heading, CARD.width - 2 * MARGIN);
			y += TITLE.gap + size * TITLE.cap;
			for (const line of lines) {
				body += glyphs(title, line, MARGIN, y, size, TITLE.tracking, INK.strong);
				y += size * TITLE.leading;
			}
		} else {
			body += glyphs(label, name, MARGIN, y + TITLE.gap + 64 * TITLE.cap, WORDMARK.size, WORDMARK.tracking, INK.ink);
		}
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${CARD.width} ${CARD.height}"><rect width="${CARD.width}" height="${CARD.height}" fill="${INK.bg}"/>${body}</svg>`;
	}

	/** The card as PNG bytes. An 8-bit palette: the picture is one ramp of warm greys and one amber (about 50 KB, within 5/255 of the original). */
	const png = (card) => sharp(Buffer.from(svg(card))).removeAlpha().png({ palette: true, colours: 256, dither: 0, effort: 10, compressionLevel: 9 }).toBuffer();

	return { svg, png };
}
