// Token strip: a run of tokens, each tinted by a value (a probability, an
// attention weight, a logit difference). The strip wraps like text. With
// `rows`, several value rows share one run of tokens (heads, layers).

import { el, text, tw, FS, ramp, formatter } from './svg.js';
import { extent } from './scale.js';
import { rampKey } from './heatmap.js';
import { column } from './data.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
// Make whitespace visible the way tokenizer viewers do.
const show = (t) => String(t).replace(/ /g, '\u00b7').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

export function tokenStrip(spec, size) {
	const { W } = size;
	const data = spec.data;
	const raw = column(spec.tokens ?? 'token', data, 'tokens') ?? [];
	const tokens = raw.map((t) => (t && typeof t === 'object' ? t.t ?? t.token : t)).map(show);
	const multi = Array.isArray(spec.rows);
	const rows = multi
		? spec.rows.map((row) => ({ label: row.label ?? '', values: column(row.values, data, 'tokens') }))
		: [{ label: '', values: column(spec.values ?? (raw[0] && typeof raw[0] === 'object' ? raw.map((t) => t.v ?? t.value) : 'value'), data, 'tokens') }];
	const flat = rows.flatMap((row) => row.values).filter(finite);
	const div = spec.ramp === 'div' || spec.ramp === 'diverging';
	let [lo, hi] = spec.lim ?? (div ? extent(flat) : [Math.min(0, ...flat), Math.max(...flat)]);
	if (div && !spec.lim) { const a = Math.max(Math.abs(lo), Math.abs(hi)); lo = -a; hi = a; }
	const T = (v) => (div ? v / Math.max(Math.abs(lo), Math.abs(hi)) : (v - lo) / (hi - lo || 1));
	const fmt = formatter(spec.format ?? '.2');
	const printed = spec.text !== false;
	const hot = new Set([].concat(spec.highlight ?? []));

	const fsT = FS.node, pad = 5.5, gap = 2;
	const vw = printed ? Math.max(...flat.map((v) => tw(fmt(v), FS.small))) + 5 : 0;
	const widths = tokens.map((t) => Math.max(tw(t, fsT) + pad * 2, vw, 14));
	const labelW = multi ? Math.max(...rows.map((row) => tw(row.label, FS.tick))) + 9 : 0;

	// Break the run into lines.
	const lines = [[]];
	let x = labelW;
	widths.forEach((w, i) => {
		if (x + w > W && lines.at(-1).length) { lines.push([]); x = labelW; }
		lines.at(-1).push({ i, x, w });
		x += w + gap;
	});

	const out = [], cells = [], onCells = [];
	const boxH = 27, rowH = 19;
	let y = 2;
	for (const ln of lines) {
		if (!multi) {
			for (const { i, x, w } of ln) {
				const v = rows[0].values?.[i];
				const t = finite(v) ? T(v) : 0;
				cells.push(el('rect', { x, y, width: w, height: boxH, rx: 2, style: ramp(t), class: hot.has(i) ? 'fg-hot' : null }));
				onCells.push(el('text', { x: x + w / 2, y: y + boxH / 2, class: Math.abs(t) > 0.56 ? 'fg-on-hi' : null }, esc(tokens[i])));
				if (printed && finite(v)) out.push(text(x + w / 2, y + boxH + 13, fmt(v), { class: 'fg-val', 'text-anchor': 'middle' }));
			}
			y += boxH + (printed ? 18 : 0) + 10;
		} else {
			for (const { i, x, w } of ln) out.push(text(x + w / 2, y + 12, tokens[i], { class: 'fg-tok' + (hot.has(i) ? ' fg-tok-hot' : ''), 'text-anchor': 'middle' }));
			y += 20;
			for (const row of rows) {
				out.push(text(labelW - 8, y + rowH / 2 - 0.5, row.label, { class: 'fg-t', 'text-anchor': 'end', dy: '.34em' }));
				for (const { i, x, w } of ln) {
					const v = row.values?.[i];
					if (!finite(v)) continue;
					const t = T(v);
					cells.push(el('rect', { x, y, width: w, height: rowH - 1, style: ramp(t) }));
					if (printed && w >= tw(fmt(v), FS.small) + 3) onCells.push(el('text', { x: x + w / 2, y: y + (rowH - 1) / 2, class: (Math.abs(t) > 0.56 ? 'fg-on-hi ' : '') + 'fg-sm' }, fmt(v)));
				}
				y += rowH;
			}
			y += 12;
		}
	}
	out.unshift(el('g', { class: div ? 'fg-cell-div' : 'fg-cell' }, cells), el('g', { class: 'fg-num fg-tokt', 'text-anchor': 'middle' }, onCells));
	y -= multi ? 12 : 10;
	if (spec.legend !== false && (spec.zlabel || !printed)) {
		out.push(rampKey(labelW, y + (spec.zlabel ? 30 : 14), Math.min(140, W * 0.42), { lo, hi, div, label: spec.zlabel, fmt: formatter(spec.keyformat ?? '.1f') }));
		y += (spec.zlabel ? 30 : 14) + 24;
	}
	const best = rows[0].values ? rows[0].values.indexOf(Math.max(...rows[0].values.filter(finite))) : -1;
	const desc = `Token strip, ${tokens.length} tokens${spec.zlabel ? `, tinted by ${spec.zlabel}` : ''}: ${raw.map((t) => (typeof t === 'object' ? t.t : t)).join('')}.` + (best >= 0 && !multi ? ` Highest value ${fmt(rows[0].values[best])} on "${String(tokens[best]).replace(/\u00b7/g, ' ').trim()}".` : '');
	return { body: out.join(''), H: Math.ceil(y + 4), desc };
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
