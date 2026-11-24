// Diagram primitives for architecture drawings: boxes, arrows and
// residual-stream style flows, placed on a coordinate grid.
//
//   grid:  [columns, rows]     the drawing's coordinate space; (0, 0) is top left
//   row:   px per row unit     x stretches with the figure, y does not, so type never shrinks
//   nodes: - { id, at: [x, y], size: [w, h], label, kind: box | pill | add | plain, tone: accent | mute }
//   edges: - { from, to, via: [[x, y], ...], curve: true, weight: stream | normal | light,
//              arrow: end | start | both | none, dash: true, tone: accent | mute, label }
//          from / to are a point [x, y] or a node anchor: "id" (centre), "id.t", "id.b", "id.l", "id.r"
//   labels: - { at: [x, y], text, kind: title | note | label, anchor: start | middle | end }

import { el, text, FS, r, arrowHead, esc } from './svg.js';

export function diagram(spec, size) {
	const { W, narrow } = size;
	const [gc, gr] = spec.grid ?? [16, 10];
	const ux = W / gc;
	const rowSpec = Array.isArray(spec.row) ? spec.row : [spec.row, undefined];
	const colUy = rowSpec[0] ?? size.colW / gc;
	const uy = narrow ? rowSpec[1] ?? Math.max(13, colUy * 0.8) : size.W > size.colW ? colUy * Math.min(1.25, size.W / size.colW) : colUy;
	const PX = (p) => [p[0] * ux, p[1] * uy];

	const nodes = new Map();
	for (const n of spec.nodes ?? []) {
		const [cx, cy] = PX(n.at);
		const kind = n.kind ?? 'box';
		const [w, h] = kind === 'add' ? [15, 15] : [(n.size?.[0] ?? 4) * ux, (n.size?.[1] ?? 1.5) * uy];
		nodes.set(String(n.id), { ...n, kind, cx, cy, w, h });
	}
	const point = (ref) => {
		if (Array.isArray(ref)) return PX(ref);
		const [id, side] = String(ref).split('.');
		const n = nodes.get(id);
		if (!n) throw new Error(`diagram: no node "${id}"`);
		if (side === 't') return [n.cx, n.cy - n.h / 2];
		if (side === 'b') return [n.cx, n.cy + n.h / 2];
		if (side === 'l') return [n.cx - n.w / 2, n.cy];
		if (side === 'r') return [n.cx + n.w / 2, n.cy];
		return [n.cx, n.cy];
	};

	const edges = [], heads = [], elabels = [];
	for (const e of spec.edges ?? []) {
		const pts = [point(e.from), ...(e.via ?? []).map(PX), point(e.to)];
		const weight = e.weight ?? 'normal';
		const cls = `fg-edge fg-w-${weight}${e.dash ? ' fg-dash' : ''}${e.tone ? ' fg-tone-' + e.tone : ''}`;
		const arrow = e.arrow ?? 'end';
		const hs = weight === 'stream' ? 9 : 7.5;
		// Tangents at the two ends, then pull the stroke back under each arrowhead.
		const a = pts[0], b = pts.at(-1);
		const t0 = [pts[1][0] - a[0], pts[1][1] - a[1]], t1 = [b[0] - pts.at(-2)[0], b[1] - pts.at(-2)[1]];
		const back = (p, t, by) => { const n = Math.hypot(t[0], t[1]) || 1; return [p[0] - (t[0] / n) * by, p[1] - (t[1] / n) * by]; };
		const P = pts.map((p) => [...p]);
		if (arrow === 'end' || arrow === 'both') { heads.push(arrowHead(b[0], b[1], t1[0], t1[1], cls + ' fg-head', hs)); P[P.length - 1] = back(b, t1, hs * 0.8); }
		if (arrow === 'start' || arrow === 'both') { heads.push(arrowHead(a[0], a[1], -t0[0], -t0[1], cls + ' fg-head', hs)); P[0] = back(a, [-t0[0], -t0[1]], hs * 0.8); }
		let d = `M${r(P[0][0])} ${r(P[0][1])}`;
		if (e.curve && P.length === 3) d += `Q${r(P[1][0])} ${r(P[1][1])} ${r(P[2][0])} ${r(P[2][1])}`;
		else if (e.curve && P.length === 4) d += `C${r(P[1][0])} ${r(P[1][1])} ${r(P[2][0])} ${r(P[2][1])} ${r(P[3][0])} ${r(P[3][1])}`;
		else {
			// Polyline with softened corners.
			const rad = e.round ?? 3;
			for (let i = 1; i < P.length; i++) {
				const p = P[i], q = P[i + 1];
				if (!q || !rad) { d += `L${r(p[0])} ${r(p[1])}`; continue; }
				const o = P[i - 1];
				const l1 = Math.hypot(p[0] - o[0], p[1] - o[1]), l2 = Math.hypot(q[0] - p[0], q[1] - p[1]);
				const k = Math.min(rad, l1 / 2, l2 / 2);
				const s = [p[0] - ((p[0] - o[0]) / l1) * k, p[1] - ((p[1] - o[1]) / l1) * k];
				const t = [p[0] + ((q[0] - p[0]) / l2) * k, p[1] + ((q[1] - p[1]) / l2) * k];
				d += `L${r(s[0])} ${r(s[1])}Q${r(p[0])} ${r(p[1])} ${r(t[0])} ${r(t[1])}`;
			}
		}
		edges.push(el('path', { d, class: cls }));
		if (e.label) {
			const mid = pts[Math.floor(pts.length / 2)];
			const at = pts.length % 2 ? mid : [(pts[pts.length / 2 - 1][0] + mid[0]) / 2, (pts[pts.length / 2 - 1][1] + mid[1]) / 2];
			elabels.push(text(at[0] + (e.dx ?? 6), at[1] + (e.dy ?? -6), e.label, { class: 'fg-l fg-halo' }));
		}
	}

	const boxes = [];
	for (const n of nodes.values()) {
		const tone = n.tone ? ` fg-tone-${n.tone}` : '';
		if (n.kind === 'add') {
			boxes.push(el('g', { class: 'fg-add' + tone }, [el('circle', { cx: n.cx, cy: n.cy, r: 7.5 }), el('path', { d: `M${r(n.cx - 4)} ${r(n.cy)}h8M${r(n.cx)} ${r(n.cy - 4)}v8` })]));
			continue;
		}
		const parts = [];
		if (n.kind !== 'plain') parts.push(el('rect', { x: n.cx - n.w / 2, y: n.cy - n.h / 2, width: n.w, height: n.h, rx: n.kind === 'pill' ? n.h / 2 : 3 }));
		if (n.label) {
			// Shrink the label a little before letting it leave its box.
			const fs = Math.max(9, Math.min(FS.node, Math.floor(((n.w - 8) / (String(n.label).length * 0.6)) * 2) / 2));
			const two = Boolean(n.sub) && n.h >= 34;
			parts.push(el('text', { x: n.cx, y: n.cy - (two ? 7 : 0), style: fs === FS.node ? null : `font-size:${fs}px`, class: 'fg-node-t' }, esc(n.label)));
			if (two) parts.push(el('text', { x: n.cx, y: n.cy + 9, class: 'fg-node-s' }, esc(n.sub)));
		}
		boxes.push(el('g', { class: `fg-node fg-k-${n.kind}${tone}` }, parts));
	}

	const labels = (spec.labels ?? []).map((l) => {
		const [x, y] = PX(l.at);
		const kind = l.kind ?? 'label';
		const cls = kind === 'title' ? 'fg-dtitle' : kind === 'note' ? 'fg-note' : 'fg-l';
		const lines = String(l.text).split('\n');
		return el('text', { x, y, class: cls + (l.halo ? ' fg-halo' : ''), 'text-anchor': l.anchor ?? 'middle' }, lines.map((s, i) => el('tspan', { x, dy: i ? '1.25em' : 0 }, esc(s))));
	});

	const names = [...nodes.values()].map((n) => n.label).filter(Boolean);
	const desc = `Diagram with ${nodes.size} blocks (${[...new Set(names)].join(', ')}) and ${(spec.edges ?? []).length} connections.`;
	return { body: [...edges, ...heads, ...boxes, ...elabels, ...labels].join(''), H: Math.ceil(gr * uy), desc };
}
