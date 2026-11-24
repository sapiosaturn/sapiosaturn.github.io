// Bar chart: vertical or horizontal, one series or grouped, with optional
// printed values, highlighted categories and reference lines.

import { el, text, tw, FS, colourClass, formatter, FILL_ORDER, say } from './svg.js';
import { cartesian } from './frame.js';
import { column, filterRows } from './data.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export function barChart(spec, size) {
	const rows = filterRows(spec.data, spec.where);
	const horizontal = Boolean(spec.horizontal);
	const list = spec.series ?? [{ y: spec.y, label: spec.label, color: spec.color }];
	const single = list.length === 1;
	const series = list.map((s, i) => ({
		label: s.label, y: column(s.y, rows, 'bar') ?? [], kind: 'box',
		colour: colourClass(s.color, i, FILL_ORDER),
	}));
	const cats = (column(spec.x ?? spec.categories, rows, 'bar') ?? series[0].y.map((_, i) => i)).map(String);
	const hot = new Set([].concat(spec.highlight ?? []).map(String));
	const values = series.flatMap((s) => s.y);

	const dec = spec.values && spec.values !== true ? spec.values : undefined;
	const pre = dec ? formatter(dec) : (v) => String(+v.toFixed(2));
	const room = (vals) => (spec.values && horizontal && vals.length ? Math.max(...vals.map((v) => tw(pre(v), FS.small))) + 8 : 0);
	const f = cartesian(spec, size, {
		padStart: room(values.filter((v) => finite(v) && v < 0)), padEnd: room(values.filter((v) => finite(v) && v >= 0)),
		[horizontal ? 'xValues' : 'yValues']: values,
		[horizontal ? 'yBand' : 'xBand']: cats,
		zero: true, series, canEndLabel: false, labels: single ? 'none' : 'key',
		bandPadding: spec.gap ?? (cats.length > 16 ? 0.26 : single ? 0.36 : 0.26),
	});
	const { X, Y } = f;
	const B = horizontal ? Y : X, V = horizontal ? X : Y;
	const inner = single ? 0 : Math.min(2, B.width * 0.04);
	const bw = (B.width - inner * (series.length - 1)) / series.length;
	const zero = V.map(Math.max(V.domain[0], Math.min(V.domain[1], 0)));
	const fmt = dec ? formatter(dec) : V.format;
	const showValues = Boolean(spec.values) && (horizontal || bw >= tw(fmt(Math.max(...values.filter(finite))), FS.small) - 2);

	const bars = [], labels = [];
	series.forEach((s, si) => {
		const g = [];
		cats.forEach((c, ci) => {
			const v = s.y[ci];
			if (!finite(v)) return;
			const b0 = B.map(c) + si * (bw + inner);
			const p = V.map(v);
			const cls = 'fg-bar' + (hot.has(c) ? ' fg-hot' : '');
			if (horizontal) {
				g.push(el('rect', { x: Math.min(zero, p), y: b0, width: Math.abs(p - zero), height: bw, class: cls }));
				if (showValues) labels.push(text(p + (v < 0 ? -5 : 5), b0 + bw / 2, fmt(v), { class: 'fg-val fg-halo', 'text-anchor': v < 0 ? 'end' : 'start', dy: '.34em' }));
			} else {
				g.push(el('rect', { x: b0, y: Math.min(zero, p), width: bw, height: Math.abs(p - zero), class: cls }));
				if (showValues) labels.push(text(b0 + bw / 2, v < 0 ? p + 12 : p - 5, fmt(v), { class: 'fg-val', 'text-anchor': 'middle' }));
			}
		});
		bars.push(el('g', { class: s.colour }, g));
	});

	const top = series.map((s) => {
		const ys = s.y.filter(finite), peak = Math.max(...ys);
		const low = Math.min(...ys);
		return `${s.label ? s.label + ': ' : ''}highest ${say(peak)} at ${cats[s.y.indexOf(peak)]}, lowest ${say(low)} at ${cats[s.y.indexOf(low)]}`;
	});
	const vlabel = horizontal ? spec.xlabel : spec.ylabel;
	const desc = `Bar chart${vlabel ? ` of ${vlabel}` : ''}${!horizontal && spec.xlabel ? ` by ${spec.xlabel}` : ''}, ${cats.length} bars${series.length > 1 ? ` in each of ${series.length} series` : ''}. ${top.join('; ')}.`;
	return { body: [...f.back, ...bars, ...f.refs, ...f.front, ...labels, ...f.notes, ...f.ends].join(''), H: f.H, desc };
}
