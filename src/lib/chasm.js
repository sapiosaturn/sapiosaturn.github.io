// chasm: the home page's pen drawing, made at build time.
//
// The plate at the top of the home page is drawn in the reader's browser by
// src/scripts/drift.js. This is the same algorithm with nothing of the browser
// in it: a seed (and a frame) in, the lines out. The build uses it for the two
// things that are a post's own drawing: its link-preview card (src/lib/card.js)
// and the strip at its foot (src/plugins/rehype-notebook.mjs).
//
// For one seed and one frame the two files must draw the same picture, stroke
// for stroke: /#2752e1 on the home page at desktop width is chasm(0x2752e1).
// Whoever changes the walk in one changes it in the other. The order in which
// random numbers are drawn is part of the algorithm; do not "tidy" it.
//
// No imports, no DOM, no clock, no Math.random: pure and deterministic.

/** The home plate's frame on a wide screen: the reading column by 11.5rem. */
export const FRAME = { W: 624, H: 184 };

const STEPS = 156; // per full width, whatever the width

// mulberry32
const rng = (a) => () => {
	a = (a + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A post's seed: 24 bits (the six hex digits the home page shows), FNV-1a of its slug. */
export function seedOf(slug) {
	let h = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(String(slug))) h = Math.imul(h ^ byte, 0x01000193);
	return ((h >>> 0) ^ (h >>> 24)) & 0xffffff;
}

export const hex = (seed) => seed.toString(16).padStart(6, '0');

/** "scaling_post" from a post's address (/posts/scaling_post/) or from its file (…/posts/scaling_post.md). */
export const slugOf = (where) => String(where).replace(/\.md$/, '').split(/[\\/]/).filter(Boolean).at(-1);

/**
 * The drawing for a seed.
 *   lines  one per walker, top stratum first: { points: [x, y, x, y, ...], tone, weight, row }
 *          tone is the line's opacity (0..1), weight its stroke width in px at the frame's size.
 *   cross  the one walk that gets across: { points } in the frame's coordinates,
 *          and as drift.js draws it: { x, y, slope, local } (a sheared frame whose origin is the near lip).
 *   rows   how many strata.
 */
export function chasm(seed, { W = FRAME.W, H = FRAME.H } = {}) {
	const dx = W / STEPS;
	const rand = rng(seed);
	const gauss = (r = rand) => r() + r() + r() - 1.5;
	const { exp, max, min } = Math;
	const lines = [];
	const ends = []; // where the crossing walk reaches each lip: x, y, x, y

	// A smoothed walk of n steps from zero: the swell under the strata.
	const wander = (n, kick) => {
		const out = [];
		for (let pos = 0, vel = 0; n-- >= 0; ) out.push((pos += vel = vel * 0.92 + gauss() * kick));
		return out;
	};

	const rough = 0.3 * min(1, Math.sqrt(dx / 4));

	// The swell every stratum shares, pinned to zero at both edges.
	let swell = wander(STEPS, 0.4);
	swell = swell.map((v, j) => v - (swell[STEPS] * j) / STEPS);
	const scale = (5 + rand() * 7) / (max(...swell) - min(...swell));

	// The rift: where it starts, which way it leans, how wide its mouth is, how
	// far the two sides have slipped, and how far down it closes.
	let centre = W * (0.28 + 0.44 * rand());
	const lean = 4.5 * (rand() - 0.5);
	const mouth = min(W / 14, 18 + rand() * 15);
	const slip = (rand() < 0.5 ? -1 : 1) * (3 + rand() * 6);
	const floor = 0.45 + 0.3 * rand();

	const rows = [];
	for (let y = 8; y < H - 16; y += 10 * (0.5 + rand())) rows.push(y);

	rows.forEach((y0, i) => {
		const depth = i / (rows.length - 1);
		const below = depth / floor - 1; // negative while the rift is open
		centre += lean + gauss() * 4;
		const half = below < 0 ? mouth * (-below) ** 0.75 + 1.5 + Math.abs(gauss()) * 3 : 0;
		const sag = i ? (8 + 16 * (1 - depth)) * exp(-3 * max(0, below)) : 0;
		const reach = 4 + 9 * (1 - depth) + 10 * max(0, below);
		const tone = (0.85 - 0.55 * depth) * (0.7 + 0.3 * rand());
		// Two walkers per stratum, one from each edge; under the floor, one that goes the whole way.
		for (const side of below < 0 ? [-1, 1] : [-1]) {
			const walk = rng(rand() * 4294967296);
			const lip = centre + side * half;
			const points = [];
			let own = 0, x, y;
			for (let j = side < 0 ? 0 : STEPS, far = 1; far > 0 && j >= 0 && j <= STEPS; j -= side) {
				x = j * dx;
				far = side * (x - lip);
				if (far < 0) {
					if (below < 0) { x = lip; far = 0; }
					else far = 1e-9 - far;
				}
				own = own * 0.965 + gauss(walk) * rough * (1 + 3 * exp(-far / 110));
				y = y0 + swell[j] * scale + own
					+ slip / (1 + exp((centre - x) / 5)) // the far side sits higher or lower
					+ sag * exp(below < 0 ? -far / reach : -((far / reach / 1.6) ** 2));
				points.push(x, y);
			}
			lines.push({ points, tone, weight: 0.6 + 0.7 * (1 - depth), row: i, side: below < 0 ? side : 0 });
			if (!i) ends.push(x, y);
		}
	});

	// The one walk that gets across, on a slack line. drift.js draws it in its
	// own sheared frame, from 0 0 along the x axis.
	const [x1, y1, x2, y2] = ends;
	const slope = (y2 - y1) / (x2 - x1);
	const local = [0, 0];
	for (let k = 1; k <= 12; k++) local.push(((x2 - x1) * k) / 12, (k * (12 - k)) / 12 + (k < 12 ? gauss() * 0.35 : 0));
	const points = [];
	for (let k = 0; k < local.length; k += 2) points.push(x1 + local[k], y1 + local[k + 1] + slope * local[k]);

	return { W, H, rows: rows.length, lines, cross: { points, x: x1, y: y1, slope, local, weight: 1.25 } };
}

// --- Writing the lines out ---------------------------------------------------

const fix = (v, digits) => {
	const s = v.toFixed(digits);
	return digits ? s.replace(/\.?0+$/, '') : s; // "12.0" -> "12"
};

/** Path data for a run of points, as "Mx yLx y...". */
export function pathData(points, digits = 1) {
	let d = '';
	for (let k = 0; k < points.length; k += 2) d += (k ? 'L' : 'M') + fix(points[k], digits) + ' ' + fix(points[k + 1], digits);
	return d;
}

/**
 * Fewer points for the same line (Ramer-Douglas-Peucker): every point dropped
 * lay within `tolerance` px of the line that replaces it.
 */
export function simplify(points, tolerance = 0.25) {
	const n = points.length / 2;
	if (n < 3) return points.slice();
	const keep = new Uint8Array(n);
	keep[0] = keep[n - 1] = 1;
	const stack = [[0, n - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const ax = points[2 * a], ay = points[2 * a + 1];
		const bx = points[2 * b], by = points[2 * b + 1];
		const len = Math.hypot(bx - ax, by - ay) || 1;
		let worst = 0, at = -1;
		for (let k = a + 1; k < b; k++) {
			const dist = Math.abs((bx - ax) * (ay - points[2 * k + 1]) - (ax - points[2 * k]) * (by - ay)) / len;
			if (dist > worst) { worst = dist; at = k; }
		}
		if (worst > tolerance) {
			keep[at] = 1;
			stack.push([a, at], [at, b]);
		}
	}
	const out = [];
	for (let k = 0; k < n; k++) if (keep[k]) out.push(points[2 * k], points[2 * k + 1]);
	return out;
}

// --- The strip at the foot of a post -------------------------------------------

// The part of a line between x = from and x = to (a line's x never turns back).
function between(points, from, to) {
	const out = [];
	const cut = (k, x) => {
		const t = (x - points[k - 2]) / (points[k] - points[k - 2]);
		out.push(x, points[k - 1] + t * (points[k + 1] - points[k - 1]));
	};
	const [lo, hi] = points[0] <= points.at(-2) ? [from, to] : [to, from]; // the edge this line meets first, and last
	const inside = (x) => x >= from && x <= to;
	for (let k = 0; k < points.length; k += 2) {
		const now = inside(points[k]);
		if (k && now !== inside(points[k - 2])) cut(k, now ? lo : hi);
		if (now) out.push(points[k], points[k + 1]);
	}
	return out;
}

/**
 * The top of a seed's drawing as a strip: its first `rows` strata and the
 * crossing, optionally only `span` px of them centred on the rift. Lines are
 * simplified and written with one decimal, since this goes into every post's
 * HTML. Returns { box: [x, y, w, h], lines: [{ d, tone }], cross: d }.
 */
export function strip(seed, { rows = 3, span = 0, tolerance = 0.25, frame } = {}) {
	const c = chasm(seed, frame);
	const mid = (c.cross.points[0] + c.cross.points.at(-2)) / 2;
	// A window is the same width for every seed: it slides off-centre rather than run past the frame.
	const from = span ? Math.round(Math.min(Math.max(mid - span / 2, 0), c.W - span)) : 0;
	const to = span ? from + span : c.W;
	let top = Infinity, bottom = -Infinity;
	const write = (points) => {
		const kept = simplify(between(points, from, to), tolerance);
		for (let k = 1; k < kept.length; k += 2) { top = Math.min(top, kept[k]); bottom = Math.max(bottom, kept[k]); }
		return pathData(kept);
	};
	const lines = c.lines.filter((l) => l.row < rows).map((l) => ({ d: write(l.points), tone: l.tone })).filter((l) => l.d.includes('L'));
	const cross = write(c.cross.points);
	top = Math.floor(top - 1);
	return { box: [from, top, to - from, Math.ceil(bottom + 1) - top], lines, cross };
}
