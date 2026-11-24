// Heatmap / matrix: attention maps, similarity matrices, confusion tables.
// Cells are coloured from a ramp defined in CSS (sequential, or diverging
// around zero), so the same markup serves both themes. Empty cells (null)
// are skipped, which is how a triangular matrix is drawn.

import { el, text, tw, FS, r, ramp, formatter, fixed } from './svg.js';
import { extent } from './scale.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The ramp key: a strip of the ramp with its two end values. */
export function rampKey(x, y, w, { lo, hi, div, label, fmt, anchor = 'start' }) {
	const n = 36, sw_ = w / n, out = [];
	const x0 = anchor === 'end' ? x - w : x;
	if (label) out.push(text(anchor === 'end' ? x : x0, y - 7, label, { class: 'fg-l', 'text-anchor': anchor }));
	for (let i = 0; i < n; i++) {
		const u = (i + 0.5) / n;
		out.push(el('rect', { x: x0 + i * sw_, y, width: sw_ + 0.4, height: 7, class: div ? 'fg-cell-div' : 'fg-cell', style: ramp(div ? u * 2 - 1 : u) }));
	}
	out.push(text(x0, y + 20, fmt(lo), { class: 'fg-t' }), text(x0 + w, y + 20, fmt(hi), { class: 'fg-t', 'text-anchor': 'end' }));
	if (div) out.push(text(x0 + w / 2, y + 20, '0', { class: 'fg-t', 'text-anchor': 'middle' }));
	return out.join('');
}

export function matrixOf(spec) {
	if (Array.isArray(spec.values)) return { m: spec.values, rows: spec.rows, cols: spec.cols };
	const rows = spec.data;
	if (!Array.isArray(rows) || !rows.length) throw new Error('heatmap: give `values` (rows of numbers) or `data` (a CSV whose first column holds the row labels)');
	const names = rows.columns ?? Object.keys(rows[0]);
	const [first, ...rest] = names;
	return { m: rows.map((row) => rest.map((k) => row[k])), rows: spec.rows ?? rows.map((row) => row[first]), cols: spec.cols ?? rest };
}

export function heatmap(spec, size) {
	const { W } = size;
	const { m, rows: rowLabels, cols: colLabels } = matrixOf(spec);
	const nr = m.length, nc = Math.max(...m.map((row) => row.length));
	// A leading or trailing space in a label (a token) is shown as a middle dot.
	const vis = (s) => String(s).replace(/^ +| +$/g, (sp) => '\u00b7'.repeat(sp.length));
	const rl = (rowLabels ?? m.map((_, i) => i)).map(vis), cl = (colLabels ?? Array.from({ length: nc }, (_, i) => i)).map(vis);
	const flat = m.flat().filter(finite);
	const div = spec.ramp === 'div' || spec.ramp === 'diverging';
	let [lo, hi] = spec.lim ?? spec.zlim ?? extent(flat);
	if (div && !(spec.lim ?? spec.zlim)) { const a = Math.max(Math.abs(lo), Math.abs(hi)); lo = -a; hi = a; }
	const T = (v) => (div ? v / Math.max(Math.abs(lo), Math.abs(hi)) : (v - lo) / (hi - lo || 1));

	const lower = m.every((row, i) => row.every((v, j) => j <= i || !finite(v))) && nr > 2; // nothing above the diagonal
	const longCols = Math.max(...cl.map((c) => c.length)) > 3;
	const left = Math.max(...rl.map((s) => tw(s, FS.tick))) + 9;
	const colW = longCols ? Math.max(...cl.map((c) => tw(c, FS.tick))) : 0;
	const cellMax = spec.cell ?? 40;
	const overhang = longCols ? colW * 0.71 : 0; // 45-degree column labels lean right
	const cell = Math.max(4, Math.min(cellMax, Math.floor((W - left - Math.max(2, overhang - cellMax / 2)) / nc)));
	const gap = cell >= 10 ? 1 : 0;
	const mw = cell * nc, mh = cell * nr;

	const out = [];
	let top = 4;
	if (spec.ylabel) { out.push(text(0, 12, spec.ylabel, { class: 'fg-l' })); top = 24; }
	if (longCols) top += colW * 0.71 + 6;
	const x0 = left, y0 = top;

	// Printed values: as large as the cell allows, shortening the format before giving up.
	const want = spec.text ?? 'auto';
	let fmt = formatter(spec.format ?? '.2f'), fs = 0;
	if (want !== false) {
		const widest = (f) => Math.max(...flat.map((v) => f(v).length));
		const fit = (f) => Math.min(FS.tick, Math.floor(((cell - gap - 5) / (widest(f) * 0.6)) * 2) / 2);
		fs = fit(fmt);
		if (fs < 8 && !spec.format?.endsWith('%')) {
			const d = Number(/\d/.exec(spec.format ?? '.2f')?.[0] ?? 2);
			for (const alt of [`.${Math.min(d, 2)}`, '.1']) { const f = formatter(alt); if (fit(f) > fs) { fmt = f; fs = fit(f); } if (fs >= 8) break; }
		}
		if (fs < 7.5 && want !== true) fs = 0;
	}

	const cells = [], nums = [];
	m.forEach((row, i) => row.forEach((v, j) => {
		if (!finite(v)) return;
		const t = T(v);
		cells.push(el('rect', { x: x0 + j * cell, y: y0 + i * cell, width: cell - gap, height: cell - gap, style: ramp(t) }));
		if (fs) nums.push(el('text', { x: x0 + j * cell + (cell - gap) / 2, y: y0 + i * cell + (cell - gap) / 2, class: Math.abs(t) > 0.56 ? 'fg-on-hi' : null }, fmt(v)));
	}));
	out.push(el('g', { class: div ? 'fg-cell-div' : 'fg-cell' }, cells));
	if (fs) out.push(el('g', { class: 'fg-num', 'font-size': fs, 'text-anchor': 'middle' }, nums));

	// Row labels; thinned when the cells are smaller than a line of type.
	const every = (n, room, need) => { for (const k of [1, 2, 5, 10, 20, 50]) if (k * room >= need) return k; return Math.ceil(n / 2); };
	const ry = every(nr, cell, FS.tick + 1);
	rl.forEach((s, i) => { if (i % ry === 0) out.push(text(x0 - 7, y0 + i * cell + (cell - gap) / 2, s, { class: 'fg-t', 'text-anchor': 'end', dy: '.34em' })); });
	let bottom = y0 + mh;
	if (longCols) {
		cl.forEach((s, j) => { const x = x0 + j * cell + (cell - gap) / 2, y = y0 - 6; out.push(text(x, y, s, { class: 'fg-t', transform: `rotate(-45 ${r(x)} ${r(y)})` })); });
	} else {
		const cx = every(nc, cell, Math.max(...cl.map((c) => tw(c, FS.tick))) + 5);
		cl.forEach((s, j) => { if (j % cx === 0) out.push(text(x0 + j * cell + (cell - gap) / 2, bottom + 15, s, { class: 'fg-t', 'text-anchor': 'middle' })); });
		bottom += 19;
	}
	if (spec.xlabel) { out.push(text(x0 + mw / 2, bottom + 15, spec.xlabel, { class: 'fg-l', 'text-anchor': 'middle' })); bottom += 20; }

	// Ramp key: in the empty corner of a triangle, else beside the matrix, else beneath it.
	if (spec.legend !== false) {
		const k = { lo, hi, div, label: spec.zlabel, fmt: formatter(spec.keyformat ?? (Number.isInteger(lo) && Number.isInteger(hi) ? '.0f' : '.1f')) };
		const kw = Math.min(140, W * 0.38);
		const need = Math.max(kw, spec.zlabel ? tw(spec.zlabel) : 0);
		if (lower && mw * 0.42 >= need) out.push(rampKey(x0 + mw - gap, y0 + (spec.zlabel ? 15 : 2), kw, { ...k, anchor: 'end' }));
		else if (W - (x0 + mw) >= need + 28) out.push(rampKey(x0 + mw + 26, y0 + (spec.zlabel ? 15 : 2), kw, k));
		else { out.push(rampKey(x0 + mw - gap, bottom + (spec.zlabel ? 24 : 10), kw, { ...k, anchor: 'end' })); bottom += (spec.zlabel ? 24 : 10) + 24; }
	}

	const peak = Math.max(...flat), trough = Math.min(...flat);
	const desc = `${lower ? 'Lower-triangular matrix' : 'Matrix'} heatmap, ${nr} by ${nc}${spec.zlabel ? `, of ${spec.zlabel}` : ''}. Values run from ${fixed(trough, 2)} to ${fixed(peak, 2)}.`;
	return { body: out.join(''), H: Math.ceil(bottom + 4), desc };
}
