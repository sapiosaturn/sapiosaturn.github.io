// Scales and ticks. Small enough that d3-scale is not worth a dependency.

import { formatter, si } from './svg.js';

const niceStep = (raw) => {
	const p = 10 ** Math.floor(Math.log10(raw));
	const f = raw / p;
	const e = 1e-9; // 0.6 / 6 is not quite 0.1 in floating point
	return (f <= 1 + e ? 1 : f <= 2 + e ? 2 : f <= 5 + e ? 5 : 10) * p;
};
const decimalsOf = (step) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

/**
 * Linear scale. `nice` rounds the domain out to tick values (used when the
 * author gave no explicit limits).
 */
export function linear(domain, range, { count = 5, nice = true, ticks: given, format } = {}) {
	let [d0, d1] = domain;
	if (d0 === d1) { d0 -= 1; d1 += 1; }
	const step = niceStep((d1 - d0) / Math.max(1, count));
	if (nice) { d0 = Math.floor(d0 / step + 1e-9) * step; d1 = Math.ceil(d1 / step - 1e-9) * step; }
	const [r0, r1] = range;
	const map = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
	const values = given ?? (() => {
		const out = [];
		for (let k = Math.ceil(d0 / step - 1e-9); k * step <= d1 + step * 1e-9; k++) out.push(+(k * step).toPrecision(12));
		return out;
	})();
	const dec = given ? Math.max(0, ...given.map((v) => (String(v).split('.')[1] ?? '').length)) : decimalsOf(step);
	const fmt = formatter(format, dec);
	return { type: 'linear', domain: [d0, d1], range, map, ticks: values.map((v) => ({ v, label: fmt(v) })), format: fmt };
}

/**
 * Log scale. Major ticks sit on powers of ten and carry labels; the 2..9
 * marks between them are minor and unlabelled.
 */
export function log(domain, range, { ticks: given, format, nice = true } = {}) {
	let [d0, d1] = domain.map((v) => Math.log10(v));
	if (nice) { d0 = Math.floor(d0 + 1e-9); d1 = Math.ceil(d1 - 1e-9); }
	if (d0 === d1) d1 += 1;
	const [r0, r1] = range;
	const map = (v) => r0 + ((Math.log10(v) - d0) / (d1 - d0)) * (r1 - r0);
	const fmt = format ? formatter(format) : si;
	const ticks = [];
	if (given) for (const v of given) ticks.push({ v, label: fmt(v) });
	for (let e = Math.floor(d0); e <= Math.ceil(d1); e++) {
		for (let k = 1; k < 10; k++) {
			const v = k * 10 ** e, lv = Math.log10(v);
			if (lv < d0 - 1e-9 || lv > d1 + 1e-9) continue;
			if (k === 1 && !given) ticks.push({ v, label: fmt(v) });
			else if (k > 1) ticks.push({ v, minor: true });
		}
	}
	return { type: 'log', domain: [10 ** d0, 10 ** d1], range, map, ticks, format: fmt };
}

/** Band scale for categories: map() gives the left edge of a band. */
export function band(categories, range, { padding = 0.2 } = {}) {
	const [r0, r1] = range;
	const n = Math.max(1, categories.length);
	const step = (r1 - r0) / n;
	const width = step * (1 - padding);
	const index = new Map(categories.map((c, i) => [String(c), i]));
	const map = (c) => r0 + (index.get(String(c)) ?? 0) * step + (step - width) / 2;
	return { type: 'band', domain: categories, range, map, step, width, centre: (c) => map(c) + width / 2, ticks: categories.map((v) => ({ v, label: String(v) })) };
}

export const extent = (values) => {
	let lo = Infinity, hi = -Infinity;
	for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
	return lo === Infinity ? [0, 1] : [lo, hi];
};
