// Scatter plot: one or more groups of points, linear or log axes, optional
// connecting line and optional name beside each point.

import { el, text, tw, FS, colourClass, say } from './svg.js';
import { cartesian, marker, MARKERS } from './frame.js';
import { linePath } from './line.js';
import { column, filterRows } from './data.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export function scatterPlot(spec, size) {
	const rows = filterRows(spec.data, spec.where);
	const list = spec.series ?? [{ x: spec.x, y: spec.y, label: spec.label, text: spec.text, color: spec.color, marker: spec.marker, where: undefined }];
	const series = list.map((s, i) => {
		const own = filterRows(rows, s.where);
		return {
			label: s.label,
			x: column(s.x ?? spec.x, own, 'scatter') ?? [],
			y: column(s.y ?? spec.y, own, 'scatter') ?? [],
			names: column(s.text ?? spec.text, own, 'scatter'),
			colour: colourClass(s.color, i), kind: 'dot',
			marker: s.marker ?? MARKERS[i % MARKERS.length], open: Boolean(s.open), join: Boolean(s.line ?? spec.line),
		};
	});
	const f = cartesian(spec, size, {
		xValues: series.flatMap((s) => s.x), yValues: series.flatMap((s) => s.y), series, canEndLabel: false,
		labels: series.filter((s) => s.label).length > 1 ? 'key' : 'none', inset: 10,
	});
	const { X, Y, plot } = f;
	const size0 = spec.size ?? 3.5;
	const marks = [], names = [];
	for (const s of series) {
		const g = [];
		if (s.join) g.push(el('path', { d: linePath(s.x, s.y, X, Y), class: 'fg-line fg-thin' }));
		s.x.forEach((xv, i) => {
			if (!finite(xv) || !finite(s.y[i])) return;
			const px = X.map(xv), py = Y.map(s.y[i]);
			g.push(marker(px, py, s.marker, size0, s.open));
			if (s.names?.[i]) {
				const label = String(s.names[i]);
				const flip = px + 8 + tw(label, FS.small) > plot.x1 + 4;
				names.push(text(flip ? px - 7 : px + 7, py, label, { class: 'fg-pt fg-halo', 'text-anchor': flip ? 'end' : 'start', dy: '.34em' }));
			}
		});
		marks.push(el('g', { class: s.colour }, g));
	}
	const n = series.reduce((a, s) => a + s.x.filter(finite).length, 0);
	const desc = `Scatter plot${spec.ylabel ? ` of ${spec.ylabel}` : ''}${spec.xlabel ? ` against ${spec.xlabel}` : ''}, ${n} points. ` +
		series.map((s) => {
			const ys = s.y.filter(finite);
			return `${s.label ? s.label + ': ' : ''}${ys.length} points, ${spec.ylabel ?? 'y'} from ${say(Math.min(...ys))} to ${say(Math.max(...ys))}`;
		}).join('; ') + '.';
	return { body: [...f.back, ...f.refs, ...marks, ...f.front, ...names, ...f.notes, ...f.ends].join(''), H: f.H, desc };
}
