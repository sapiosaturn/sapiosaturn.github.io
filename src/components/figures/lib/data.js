// Data for a figure comes from the spec itself or from a small file beside
// the post: CSV (a header row, then numbers) or JSON.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

/** Minimal CSV: comma separated, optional double quotes, first row is the header. Empty cells become null. */
export function parseCSV(src) {
	const rows = src.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#')).map((l) => {
		const out = [];
		let cur = '', q = false;
		for (let i = 0; i < l.length; i++) {
			const ch = l[i];
			if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
			else if (ch === '"') q = true;
			else if (ch === ',') { out.push(cur); cur = ''; }
			else cur += ch;
		}
		out.push(cur);
		return out;
	});
	const [head, ...body] = rows;
	const cell = (v) => (v.trim() === '' ? null : Number.isFinite(Number(v)) ? Number(v) : v.trim());
	// A blank first header (a matrix with row labels) is given the name "_".
	const names = head.map((h, i) => h.trim() || (i === 0 ? '_' : `col${i}`));
	const out = body.map((r) => Object.fromEntries(names.map((h, i) => [h, cell(r[i] ?? '')])));
	Object.defineProperty(out, 'columns', { value: names });
	return out;
}

/**
 * Parse the YAML body of a figure block. The prose keys (caption, credit, alt,
 * desc) take the rest of their line exactly as written, so a caption may hold
 * colons, quotes or a # without any YAML escaping. Quoted values and block
 * scalars (| and >) are left to YAML.
 */
export function parseSpec(src) {
	const safe = String(src).replace(/^(caption|credit|alt|desc):[ \t]+(?!["'|>])(.+)$/gm, (_, key, value) => `${key}: ${JSON.stringify(value.trim())}`);
	return YAML.parse(safe);
}

export function loadFile(file) {
	const src = fs.readFileSync(file, 'utf8');
	const ext = path.extname(file).toLowerCase();
	if (ext === '.csv') return parseCSV(src);
	if (ext === '.json') return JSON.parse(src);
	if (ext === '.yaml' || ext === '.yml') return parseSpec(src);
	throw new Error(`figures: unsupported data file ${file} (use .csv, .json or .yaml)`);
}

/**
 * Resolve the two file references a spec may hold, relative to `dir`:
 *   src:  a .yaml/.json file holding (part of) the spec itself; keys written in the post win
 *   data: a .csv/.json file of rows, replaced here by its parsed contents
 */
export function resolveSpec(spec, dir = process.cwd()) {
	let out = { ...spec };
	if (typeof out.src === 'string' && /\.(ya?ml|json)$/i.test(out.src)) {
		const base = loadFile(path.resolve(dir, out.src));
		const { src, ...own } = out;
		out = { ...base, ...own };
	}
	if (typeof out.data === 'string') out.data = loadFile(path.resolve(dir, out.data));
	if (Array.isArray(out.panels)) out.panels = out.panels.map((p) => resolveSpec({ data: out.data, ...p }, dir));
	return out;
}

/** A column of numbers: given inline as an array, or named and taken from `rows`. */
export function column(ref, rows, where = 'figure') {
	if (Array.isArray(ref)) return ref;
	if (ref === undefined || ref === null) return null;
	if (!Array.isArray(rows)) throw new Error(`${where}: "${ref}" names a data column, but the figure has no data`);
	if (rows.length && !(ref in rows[0])) throw new Error(`${where}: no column "${ref}" in the data (have: ${Object.keys(rows[0]).join(', ')})`);
	return rows.map((row) => row[ref]);
}

/** Rows kept where every `where` key equals its value, e.g. where: { panel: train }. */
export function filterRows(rows, where) {
	if (!where || !Array.isArray(rows)) return rows;
	return rows.filter((row) => Object.entries(where).every(([k, v]) => String(row[k]) === String(v)));
}
