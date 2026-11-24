// Line chart: one or more series over a shared numeric x, optional
// confidence bands, linear or log axes, direct labels at the line ends.

import { el, r, colourClass, say } from './svg.js';
import { cartesian, marker } from './frame.js';
import { column, filterRows } from './data.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Path through the finite points; a gap in the data breaks the line. */
export function linePath(xs, ys, X, Y) {
	let d = '', pen = false;
	for (let i = 0; i < xs.length; i++) {
		if (!finite(xs[i]) || !finite(ys[i])) { pen = false; continue; }
		d += `${pen ? 'L' : 'M'}${r(X.map(xs[i]))} ${r(Y.map(ys[i]))}`;
		pen = true;
	}
	return d;
}

function bandPath(xs, lo, hi, X, Y) {
	const idx = xs.map((_, i) => i).filter((i) => finite(xs[i]) && finite(lo[i]) && finite(hi[i]));
	if (idx.length < 2) return '';
	const up = idx.map((i) => `${r(X.map(xs[i]))} ${r(Y.map(hi[i]))}`);
	const down = idx.reverse().map((i) => `${r(X.map(xs[i]))} ${r(Y.map(lo[i]))}`);
	return `M${up.join('L')}L${down.join('L')}Z`;
}

export function lineChart(spec, size) {
	const rows = filterRows(spec.data, spec.where);
	const list = spec.series ?? [{ y: spec.y, label: spec.label, band: spec.band, color: spec.color }];
	const sharedX = column(spec.x, rows, 'line');
	const series = list.map((s, i) => {
		const y = column(s.y, filterRows(rows, s.where), 'line') ?? [];
		const x = column(s.x, rows, 'line') ?? sharedX ?? y.map((_, k) => k);
		const [lo, hi] = Array.isArray(s.band) && s.band.length === 2 ? [column(s.band[0], rows, 'line'), column(s.band[1], rows, 'line')] : [null, null];
		const last = y.map((_, k) => k).filter((k) => finite(y[k]) && finite(x[k])).at(-1);
		return {
			label: s.label, x, y, lo, hi, dash: Boolean(s.dash), strong: Boolean(s.emphasis), points: s.points ?? spec.points ?? false,
			colour: colourClass(s.color, i), kind: 'line', marker: s.marker ?? 'circle',
			end: last === undefined ? null : [x[last], y[last]],
		};
	});

	const yValues = series.flatMap((s) => [...s.y, ...(s.lo ?? []), ...(s.hi ?? [])]);
	const f = cartesian(spec, size, { xValues: series.flatMap((s) => s.x), yValues, series, canEndLabel: true });
	const { X, Y } = f;

	const bands = [], lines = [], dots = [];
	for (const s of series) {
		if (s.lo && s.hi) bands.push(el('path', { d: bandPath(s.x, s.lo, s.hi, X, Y), class: `fg-band ${s.colour}` }));
		lines.push(el('path', { d: linePath(s.x, s.y, X, Y), class: `fg-line ${s.colour}${s.dash ? ' fg-dash' : ''}${s.strong ? ' fg-strong' : ''}` }));
		if (s.points) dots.push(el('g', { class: s.colour }, s.x.map((xv, i) => (finite(xv) && finite(s.y[i]) ? marker(X.map(xv), Y.map(s.y[i]), s.marker, 2.4) : ''))));
	}

	const named = series.filter((s) => s.label);
	const desc = `Line chart${spec.ylabel ? ` of ${spec.ylabel}` : ''}${spec.xlabel ? ` against ${spec.xlabel}` : ''}. ` +
		(named.length ? named.map((s) => {
			const ys = s.y.filter(finite);
			const peak = Math.max(...ys);
			return `${s.label}: from ${say(ys[0])} to ${say(ys.at(-1))}, highest ${say(peak)} at ${spec.xlabel ?? 'x'} ${say(s.x[s.y.indexOf(peak)])}`;
		}).join('; ') + '.' : '');
	return { body: [...f.back, ...bands, ...f.refs, ...lines, ...dots, ...f.front, ...f.notes, ...f.ends].join(''), H: f.H, desc };
}
