// The Cartesian frame shared by line, bar and scatter figures: margins,
// scales, grid, axes, axis titles, reference lines, notes, and the two ways
// of naming series (labels at the line ends, or a key above the plot).
//
// House rules, all in one place:
//   - No box. Hairline gridlines run across the value axis only; the other
//     axis is a single rule with small outward ticks.
//   - The value-axis title sits horizontally above the plot, flush left with
//     the text column. Nothing is rotated.
//   - Tick labels and titles are mono; notes inside the plot are serif italic.
//   - Series are labelled directly where there is room, otherwise by a key.

import { el, line, text, tw, sw, FS, r, esc } from './svg.js';
import { linear, log, band, extent } from './scale.js';

const TICK = 4;
const KEY_ROW = 19;

function lim(given, auto) {
	if (Array.isArray(given) && given.length === 2) return [given[0] ?? auto[0], given[1] ?? auto[1]];
	return null;
}

function keyLayout(items, width) {
	// Wrap key entries into rows no wider than the plate.
	const rows = [[]];
	let x = 0;
	for (const it of items) {
		const w = 23 + tw(it.label) + 18;
		if (x + w - 18 > width && rows.at(-1).length) { rows.push([]); x = 0; }
		rows.at(-1).push({ ...it, x });
		x += w;
	}
	return rows;
}

export function swatch(x, y, it) {
	// A short sample of the mark: line (with its dash), dot (with its shape) or block.
	const g = [];
	if (it.kind === 'line') g.push(el('path', { d: `M${r(x)} ${r(y)}h16`, class: 'fg-line' + (it.dash ? ' fg-dash' : '') }));
	else if (it.kind === 'dot') g.push(marker(x + 8, y, it.marker, 3.2, it.open));
	else g.push(el('rect', { x: x + 3, y: y - 4.5, width: 10, height: 9, class: 'fg-bar' }));
	return el('g', { class: it.colour }, g);
}

/** Point markers: circle, square, triangle, diamond; `open` leaves the centre empty. */
export function marker(x, y, shape = 'circle', size = 3, open = false) {
	const cls = open ? 'fg-dot fg-open' : 'fg-dot';
	const s = size;
	if (shape === 'square') return el('rect', { x: x - s * 0.9, y: y - s * 0.9, width: s * 1.8, height: s * 1.8, class: cls });
	if (shape === 'triangle') return el('path', { d: `M${r(x)} ${r(y - s * 1.15)}L${r(x + s * 1.1)} ${r(y + s * 0.8)}L${r(x - s * 1.1)} ${r(y + s * 0.8)}Z`, class: cls });
	if (shape === 'diamond') return el('path', { d: `M${r(x)} ${r(y - s * 1.25)}L${r(x + s * 1.25)} ${r(y)}L${r(x)} ${r(y + s * 1.25)}L${r(x - s * 1.25)} ${r(y)}Z`, class: cls });
	return el('circle', { cx: x, cy: y, r: s, class: cls });
}
export const MARKERS = ['circle', 'square', 'triangle', 'diamond'];

/**
 * @param spec   the figure spec (xlabel, ylabel, xscale, yscale, xlim, ylim, xticks, yticks, xformat, yformat, xticklabels, refs, notes, title)
 * @param size   { W, H, narrow }
 * @param opt    { xValues, yValues, xBand, yBand, zero, canEndLabel, series: [{label, colour, kind, dash, marker, end: [x, y]}], labels: 'end'|'key'|'none' }
 */
export function cartesian(spec, size, opt) {
	const { W } = size;
	let { H } = size;
	const horizontal = Boolean(opt.yBand);
	const back = [], front = [];

	// Series naming: at the line ends when the gutter stays under a quarter of
	// the plate, otherwise in a key above the plot.
	const named = (opt.series ?? []).filter((s) => s.label);
	let mode = spec.labels ?? opt.labels ?? (named.length > 1 ? 'end' : 'none');
	const gutterWanted = named.length ? Math.max(...named.map((s) => tw(s.label))) + 14 : 0;
	if (mode === 'end' && (!opt.canEndLabel || gutterWanted > W * 0.3)) mode = 'key';
	if (!named.length) mode = 'none';
	const key = mode === 'key' ? keyLayout(named, W) : [];

	// Margins
	let top = 6;
	if (spec.title) top += 21;
	const titleY = spec.title ? 12 : 0;
	// A key adds to the figure's height rather than squeezing the plot.
	if (key.length) { top += key.length * KEY_ROW + 4; H += key.length * KEY_ROW + 4; }
	const keyY = (spec.title ? 21 : 0) + 10;
	if (!horizontal && spec.ylabel) top += 22;
	const ylabelY = top - 12;
	const showXTicks = spec.xticklabels !== false;
	// Category names too long for their band sit on two alternating rows rather than being dropped.
	let stagger = false;
	if (opt.xBand && showXTicks) {
		const cats = opt.xBand.map(String), need = Math.max(...cats.map((c) => tw(c, FS.tick))) + 7, stepEst = (W - 56) / cats.length;
		stagger = !cats.every((c) => c !== '' && Number.isFinite(+c)) && need > stepEst && need <= stepEst * 2;
	}
	let bottom = (showXTicks ? 24 : 10) + (spec.xlabel ? 20 : 0) + (stagger ? 14 : 0);
	if (horizontal) bottom = 24 + (spec.xlabel ? 20 : 0);
	const y0 = H - bottom, y1 = top;

	// Value scales first (their tick labels decide the left margin)
	// The value axis is rounded out to tick values; the x axis of a line or
	// scatter plot is not (the data runs edge to edge).
	const mk = (kind, values, given, range, tickOpt, zero, px, nice = true) => {
		const auto = extent(values);
		if (kind === 'log') return log(lim(given, auto) ?? auto, range, { ...tickOpt, nice: nice && !given });
		if (zero) { auto[0] = Math.min(0, auto[0]); auto[1] = Math.max(0, auto[1]); }
		const explicit = lim(given, auto);
		return linear(explicit ?? auto, range, { ...tickOpt, nice: nice && !explicit, count: Math.max(2, Math.min(tickOpt.max, Math.round(px / tickOpt.per))) });
	};

	let X, Y, left, right;
	if (!horizontal) {
		Y = mk(spec.yscale, opt.yValues, spec.ylim, [y0, y1], { ticks: spec.yticks, format: spec.yformat, max: 6, per: size.narrow ? 34 : 42 }, opt.zero, y0 - y1);
		const majors = Y.ticks.filter((t) => !t.minor);
		left = Math.max(...majors.map((t) => tw(t.label, FS.tick)), 0) + 9;
		// A reference line is named in the right gutter, like a series.
		const refW = Math.max(0, ...(spec.refs ?? []).filter((ref) => ref.y !== undefined && ref.label && ref.side !== 'left').map((ref) => tw(ref.label) + 12));
		right = Math.max(mode === 'end' ? gutterWanted : 10, refW);
		const x0 = left, x1 = W - right;
		if (opt.xBand) X = band(opt.xBand, [x0, x1], { padding: opt.bandPadding ?? 0.22 });
		else X = mk(spec.xscale, opt.xValues, spec.xlim, [x0 + (opt.inset ?? 0), x1 - (opt.inset ?? 0)], { ticks: spec.xticks, format: spec.xformat, max: 9, per: size.narrow ? 62 : 76 }, false, x1 - x0, false);
		// If the last x label would be clipped, widen the right margin once.
		const lastTick = X.ticks.filter((t) => t.label).at(-1);
		if (lastTick && X.type !== 'band' && showXTicks) {
			const over = X.map(lastTick.v) + tw(lastTick.label, FS.tick) / 2 - W;
			if (over > 0) { right += over + 1; X = mk(spec.xscale, opt.xValues, spec.xlim, [x0 + (opt.inset ?? 0), W - right - (opt.inset ?? 0)], { ticks: spec.xticks, format: spec.xformat, max: 9, per: size.narrow ? 62 : 76 }, false, W - right - x0, false); }
		}
	} else {
		const cats = opt.yBand;
		left = Math.min(W * 0.5, Math.max(...cats.map((c) => tw(c, FS.label)))) + 10;
		right = 14;
		// Room for values printed beyond the bar ends.
		X = mk(spec.xscale, opt.xValues, spec.xlim, [left + (opt.padStart ?? 0), W - right - (opt.padEnd ?? 0)], { ticks: spec.xticks, format: spec.xformat, max: 7, per: 70 }, opt.zero, W - right - left);
		Y = band(cats, [y1, y0], { padding: opt.bandPadding ?? 0.3 });
	}
	const x0 = left, x1 = W - right;
	const plot = { x0, x1, y0, y1 };

	// Title, value-axis title
	if (spec.title) front.push(text(0, titleY, spec.title, { class: 'fg-title' }));
	if (!horizontal && spec.ylabel) front.push(text(0, ylabelY, spec.ylabel, { class: 'fg-l' }));

	// Key
	key.forEach((row, i) => row.forEach((it) => {
		const y = keyY + i * KEY_ROW;
		front.push(swatch(it.x, y, it), text(it.x + 23, y, it.label, { class: 'fg-l', dy: '.34em' }));
	}));

	if (!horizontal) {
		// Horizontal grid + value labels
		for (const t of Y.ticks) {
			const y = Y.map(t.v);
			if (t.minor) { back.push(line(x0 - 3, y, x0, y, 'fg-tick')); continue; }
			back.push(line(x0, y, x1, y, 'fg-grid'));
			back.push(text(x0 - 8, y, t.label, { class: 'fg-t', 'text-anchor': 'end', dy: '.34em' }));
		}
		// Baseline: at zero when zero is inside the plot, else the bottom edge.
		const [d0, d1] = Y.domain;
		const base = Y.type === 'linear' && d0 < 0 && d1 > 0 ? Y.map(0) : y0;
		front.push(line(x0, base, x1, base, 'fg-axis'));
		if (X.type === 'band') {
			// Thin category labels until they stop colliding.
			const cats = X.domain.map(String);
			const wmax = Math.max(...cats.map((c) => tw(c, FS.tick)));
			const numeric = cats.every((c) => c !== '' && Number.isFinite(+c));
			let every = 1;
			if (!stagger) for (const k of [1, 2, 5, 10, 20, 50, 100]) { every = k; if (k * X.step >= wmax + 7) break; }
			cats.forEach((c, i) => {
				if (numeric ? +c % every !== 0 : i % every !== 0) return;
				const cx = X.centre(c);
				if (stagger && i % 2) { front.push(line(cx, y0, cx, y0 + 15, 'fg-tick'), text(cx, y0 + 31, c, { class: 'fg-t', 'text-anchor': 'middle' })); return; }
				if (every > 1) front.push(line(cx, y0, cx, y0 + TICK, 'fg-tick'));
				if (showXTicks) front.push(text(cx, y0 + 17, c, { class: 'fg-t', 'text-anchor': 'middle' }));
			});
		} else {
			for (const t of X.ticks) {
				const x = X.map(t.v);
				if (x < x0 - 0.5 || x > x1 + 0.5) continue;
				front.push(line(x, y0, x, y0 + (t.minor ? TICK - 1.5 : TICK), 'fg-tick'));
				if (!t.minor && showXTicks) front.push(text(x, y0 + 17, t.label, { class: 'fg-t', 'text-anchor': 'middle' }));
			}
		}
		if (spec.xlabel) front.push(text(centred((x0 + x1) / 2, tw(spec.xlabel), W), H - 5, spec.xlabel, { class: 'fg-l', 'text-anchor': 'middle' }));
	} else {
		for (const t of X.ticks) {
			const x = X.map(t.v);
			if (t.minor) { back.push(line(x, y0, x, y0 + 3, 'fg-tick')); continue; }
			back.push(line(x, y1, x, y0, 'fg-grid'));
			back.push(text(x, y0 + 17, t.label, { class: 'fg-t', 'text-anchor': 'middle' }));
		}
		const [d0] = X.domain;
		const base = X.type === 'linear' && d0 < 0 ? X.map(0) : X.range[0];
		front.push(line(base, y1, base, y0, 'fg-axis'));
		for (const c of Y.domain) front.push(text(x0 - 8, Y.centre(c), clip(String(c), (x0 - 10) / (FS.label * 0.6)), { class: 'fg-cat', 'text-anchor': 'end', dy: '.34em' }));
		if (spec.xlabel) front.push(text(centred((x0 + x1) / 2, tw(spec.xlabel), W), H - 5, spec.xlabel, { class: 'fg-l', 'text-anchor': 'middle' }));
	}

	// Reference lines: { y, label } or { x, label }
	const refs = [], refLabels = [];
	for (const ref of spec.refs ?? []) {
		if (ref.y !== undefined && !horizontal) {
			const y = Y.map(ref.y);
			refs.push(line(x0, y, x1, y, 'fg-ref-halo'), line(x0, y, x1, y, 'fg-ref'));
			if (ref.label && ref.side === 'left') refs.push(text(x0 + 4, y - 6, ref.label, { class: 'fg-l fg-halo' }));
			else if (ref.label) refLabels.push({ y, to: y, ref: true, label: ref.label });
		} else if (ref.x !== undefined) {
			const x = X.type === 'band' ? X.centre(ref.x) : X.map(ref.x);
			refs.push(line(x, y1, x, y0, 'fg-ref-halo'), line(x, y1, x, y0, 'fg-ref'));
			if (ref.label) {
				const flip = x + 6 + tw(ref.label) > x1;
				refs.push(text(flip ? x - 6 : x + 6, y1 + 10, ref.label, { class: 'fg-l fg-halo', 'text-anchor': flip ? 'end' : 'start' }));
			}
		}
	}

	// Notes: a short phrase set in the serif at a data position.
	const notes = [];
	for (const n of spec.notes ?? []) {
		if (!Array.isArray(n.at)) continue;
		const x = (X.type === 'band' ? X.centre(n.at[0]) : X.map(n.at[0])) + (n.dx ?? 0);
		const y = (Y.type === 'band' ? Y.centre(n.at[1]) : Y.map(n.at[1])) + (n.dy ?? 0);
		let anchor = n.anchor ?? 'start';
		const lines = String(n.text).split('\n');
		const w = Math.max(...lines.map((l) => sw(l)));
		if (anchor === 'start' && x + w > W) anchor = 'end';
		notes.push(el('text', { x, y, class: 'fg-note fg-halo', 'text-anchor': anchor }, lines.map((l, i) => el('tspan', { x, dy: i ? '1.25em' : 0 }, esc(l)))));
	}

	// Labels at the line ends, nudged apart so they never overlap.
	const ends = [];
	if (mode === 'end' || refLabels.length) {
		const items = [...(mode === 'end' ? named.filter((s) => s.end).map((s) => ({ s, x: X.map(s.end[0]), y: Y.map(s.end[1]), to: Y.map(s.end[1]) })) : []), ...refLabels].filter((it) => Number.isFinite(it.y)).sort((a, b) => a.y - b.y);
		const gap = 14;
		for (let pass = 0; pass < 40; pass++) {
			let moved = false;
			for (let i = 1; i < items.length; i++) {
				const d = items[i].to - items[i - 1].to;
				if (d < gap) { const push = (gap - d) / 2; items[i - 1].to -= push; items[i].to += push; moved = true; }
			}
			for (const it of items) it.to = Math.max(y1 + 4, Math.min(y0 - 4, it.to));
			if (!moved) break;
		}
		for (const it of items) {
			if (it.ref) { ends.push(text(x1 + 8, it.to, it.label, { class: 'fg-l', dy: '.34em' })); continue; }
			const ex = Number.isFinite(it.x) ? it.x : x1;
			if (Math.abs(it.to - it.y) > 2.5) ends.push(el('path', { d: `M${r(ex + 3)} ${r(it.y)}L${r(ex + 8)} ${r(it.to)}`, class: 'fg-leader' }));
			ends.push(el('g', { class: it.s.colour }, text(ex + 10, it.to, it.s.label, { class: 'fg-end', dy: '.34em' })));
		}
	}

	return { X, Y, H, plot, back, front, refs, notes, ends, mode, horizontal };
}

/** Centre a label of width w on x, but keep it inside the plate. */
function centred(x, w, W) {
	return Math.max(w / 2, Math.min(W - w / 2, x));
}

function clip(s, max) {
	return s.length > max ? s.slice(0, Math.max(1, Math.floor(max) - 1)) + '…' : s;
}
