#!/usr/bin/env node
// fetch-links: fill src/data/links.json with a title, authors and a year for
// every external link in the markdown pages. Run by hand when a post gains
// links; the build never runs it and never touches the network.
//
//   node scripts/fetch-links.mjs             fetch what is missing (and retry past failures)
//   node scripts/fetch-links.mjs --dry       list what would be fetched, write nothing
//   node scripts/fetch-links.mjs --refresh   also refetch entries nobody has edited
//   node scripts/fetch-links.mjs --prune     drop untouched entries no page links to any more
//   node scripts/fetch-links.mjs a.md b.md   scan these files instead of src/pages/**/*.md and src/reference/*.md
//
// Sources: the arXiv API for arxiv.org links (one request for all of them);
// otherwise the page itself (citation_* meta tags, og:title, <title>), and if
// the site turns a script away, the Wayback Machine's first copy of the page.
// PDFs and pages nobody will serve are left as blank entries to fill in.
//
// Hand edits are safe. Every entry this script writes carries
//   "auto": "<source> <date> <checksum of title, authors, year>"
// An entry whose checksum no longer matches, or that has no "auto" at all, was
// written or changed by a person and is never overwritten, with any flag.
// To correct an entry just edit it; to write one from scratch:
//   "https://example.org/paper": { "title": "…", "authors": ["Ada Lovelace"], "year": 1843 }
// An author in braces is a name to print whole, as in BibTeX: "{Chameleon Team}".
// Optional: "omit": true keeps a link out of the References list.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { arxivId, isExternal, linkKey } from '../src/plugins/references.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(root, 'src/data/links.json');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const files = args.filter((a) => !a.startsWith('--'));
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (compatible; stochasm-links/1.0; +https://stochasm.blog)';

// --- The file --------------------------------------------------------------------

const sum = (e) => crypto.createHash('sha1').update(JSON.stringify([e.title ?? '', e.authors ?? [], e.year ?? null])).digest('hex').slice(0, 8);
const stamp = (entry, source) => ({ ...entry, auto: `${source} ${today} ${sum(entry)}` });
const untouched = (e) => typeof e?.auto === 'string' && e.auto.split(' ')[2] === sum(e);
const failed = (e) => untouched(e) && e.auto.startsWith('failed ');

// --- Scanning --------------------------------------------------------------------

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
		const p = path.join(dir, d.name);
		return d.isDirectory() ? walk(p) : /\.mdx?$/.test(d.name) ? [p] : [];
	});
}

// Every http(s) address in a markdown file, in order: [text](url), <url>, href="url", bare.
function urlsIn(markdown) {
	const found = [];
	// Not code, and not images: an image address is not a citation. A figure
	// block is not code: its caption and source line cite like any sentence.
	const body = markdown.replace(/```figure\b[^\n]*\n([\s\S]*?)```/g, '$1').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
	for (const m of body.matchAll(/https?:\/\/[^\s<>"'`\]]+/g)) {
		let url = m[0];
		// A markdown link ends at its closing parenthesis; prose punctuation is not part of an address.
		const unbalanced = (u) => u.endsWith(')') && u.split(')').length > u.split('(').length;
		while (/[.,;:!?*_]$/.test(url) || unbalanced(url)) url = url.slice(0, -1);
		found.push(url);
	}
	return found;
}

// --- Sources ---------------------------------------------------------------------

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', middot: '·', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s = '') => s
	.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
	.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
	.replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const tidy = (s = '') => decode(s).replace(/\s+/g, ' ').trim();

async function get(url, accept) {
	const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res;
}

async function fromArxiv(ids) {
	const out = new Map();
	if (!ids.length) return out;
	const res = await get(`https://export.arxiv.org/api/query?max_results=${ids.length}&id_list=${ids.join(',')}`, 'application/atom+xml');
	const xml = await res.text();
	for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
		const id = entry.match(/<id>\s*https?:\/\/arxiv\.org\/abs\/([^<\s]+?)(?:v\d+)?\s*<\/id>/)?.[1];
		const title = tidy(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
		if (!id || !title || /^Error$/i.test(title)) continue;
		out.set(id, {
			title,
			authors: [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => tidy(m[1])).map((a) => (/\b(Team|Collaboration|Consortium|Group)$/.test(a) ? `{${a}}` : a)),
			year: Number(entry.match(/<published>(\d{4})/)?.[1]) || null,
		});
	}
	return out;
}

function metaTags(html) {
	const tags = new Map();
	for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attr = (n) => tag.match(new RegExp(`\\b${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((v) => v !== undefined);
		const name = (attr('name') ?? attr('property') ?? '').toLowerCase();
		const content = attr('content');
		if (name && content) tags.set(name, [...(tags.get(name) ?? []), tidy(content)]);
	}
	return tags;
}

// What a site says to a script it will not serve.
const REFUSAL = /^(verifying your browser|just a moment|attention required|access denied|are you a robot|robot check|security check|please wait|error\b|\d{3}\b|forbidden|not found|.*temporarily offline)/i;

async function fromPage(url, address = url) {
	const res = await get(address, 'text/html,application/xhtml+xml');
	const type = res.headers.get('content-type') ?? '';
	if (!/html/.test(type)) throw new Error(`not a web page (${type.split(';')[0] || 'unknown type'})`);
	const html = (await res.text()).slice(0, 1_500_000);
	const tags = metaTags(html);
	const first = (...names) => names.map((n) => tags.get(n)?.[0]).find(Boolean);
	const site = first('og:site_name');
	let title = first('citation_title', 'og:title', 'twitter:title') ?? tidy(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
	if (!title || REFUSAL.test(title) || title.replace(/^www\./, '') === new URL(url).hostname.replace(/^www\./, '')) throw new Error(title ? `refused (“${title}”)` : 'no title');
	// "Title | Site", "Site - Title", "GitHub - owner/repo: …"
	const names = [site, 'GitHub', 'Wikipedia', 'OpenReview'].filter(Boolean).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
	title = title.replace(new RegExp(`\\s+[|·–—-]\\s+(?:${names})$`, 'i'), '').replace(new RegExp(`^(?:${names})\\s+[|·–—:-]\\s+`, 'i'), '');
	const authors = tags.get('citation_author') ?? (first('author', 'article:author') && !/^https?:/.test(first('author', 'article:author')) ? [first('author', 'article:author')] : []);
	const date = first('citation_publication_date', 'citation_online_date', 'citation_date', 'article:published_time', 'date', 'dc.date') ?? html.match(/"datePublished"\s*:\s*"(\d{4})/)?.[1];
	// A wiki article has no meaningful year.
	const year = /(^|\.)wikipedia\.org$/.test(new URL(url).hostname) ? null : Number(String(date ?? '').match(/\d{4}/)?.[0]) || null;
	return { title, authors, year };
}

// The first copy the Wayback Machine took, unmodified (id_), read the same way.
const fromArchive = (url) => fromPage(url, `https://web.archive.org/web/1000id_/${url}`);

// A profile on X is a person, not a work: name it, keep it out of the list.
function byRule(url) {
	const u = new URL(url);
	const handle = /^(www\.)?(x|twitter)\.com$/.test(u.hostname) && u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1];
	return handle ? { title: `@${handle} on X`, authors: [], year: null, omit: true } : null;
}

// --- Run -------------------------------------------------------------------------

const pages = files.length ? files.map((f) => path.resolve(f)) : [...walk(path.join(root, 'src/pages')), ...walk(path.join(root, 'src/reference'))];
const wanted = new Map(); // key -> first address seen
for (const file of pages) {
	for (const url of urlsIn(fs.readFileSync(file, 'utf8'))) {
		if (isExternal(url) && !wanted.has(linkKey(url))) wanted.set(linkKey(url), url);
	}
}

const data = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : {};
const todo = [...wanted.keys()].filter((k) => !data[k] || failed(data[k]) || (flag('refresh') && untouched(data[k])));
const kept = [...wanted.keys()].filter((k) => data[k] && !todo.includes(k));
const log = (mark, key, note = '') => console.log(`${mark} ${key}${note ? `\n      ${note}` : ''}`);

console.log(`${pages.length} pages, ${wanted.size} external links; ${todo.length} to fetch, ${kept.length} already known (${kept.filter((k) => !untouched(data[k])).length} hand-edited).`);

if (flag('dry')) {
	todo.forEach((k) => log('  ?', k));
} else {
	const arxiv = todo.filter((k) => arxivId(k));
	let papers = new Map();
	try {
		papers = await fromArxiv(arxiv.map((k) => arxivId(k)));
	} catch (err) {
		console.log(`  arXiv API: ${err.message}`);
	}
	for (const key of todo) {
		let entry, source, why;
		try {
			if (arxivId(key)) [entry, source, why] = [papers.get(arxivId(key)), 'arxiv', 'not returned by the arXiv API'];
			else if ((entry = byRule(key))) source = 'rule';
			else {
				try {
					[entry, source] = [await fromPage(wanted.get(key)), 'page'];
				} catch (err) {
					if (/not a web page/.test(err.message)) throw err;
					why = err.message;
					[entry, source] = [await fromArchive(wanted.get(key)), 'wayback'];
				}
			}
		} catch (err) {
			why = why ? `${why}; Wayback: ${err.message}` : err.message;
		}
		if (entry) {
			data[key] = stamp(entry, source);
			log('  +', key, `${entry.title}${entry.authors?.length ? ` (${entry.authors.length} authors)` : ''}${entry.year ? `, ${entry.year}` : ''}`);
		} else {
			// A stub to fill in by hand; until someone does, the next run tries again.
			data[key] = stamp({ title: '', authors: [], year: null }, 'failed');
			log('  !', key, `${why}: left blank, fill it in by hand`);
		}
	}
}

const stale = Object.keys(data).filter((k) => !wanted.has(k));
if (stale.length) {
	console.log(`${stale.length} entries are no longer linked from any page${flag('prune') ? '' : ' (--prune removes the untouched ones)'}:`);
	for (const k of stale) {
		const drop = flag('prune') && untouched(data[k]);
		log(drop ? '  -' : '  .', k);
		if (drop && !flag('dry')) delete data[k];
	}
}

if (!flag('dry')) {
	fs.mkdirSync(path.dirname(DATA), { recursive: true });
	// One field per line, the authors on one line: easy to read, easy to edit.
	const entries = Object.entries(data).map(([key, e]) => `\t${JSON.stringify(key)}: {\n${Object.entries(e).map(([k, v]) => `\t\t${JSON.stringify(k)}: ${JSON.stringify(v).replace(/","/g, '", "')}`).join(',\n')}\n\t}`);
	fs.writeFileSync(DATA, `{\n${entries.join(',\n')}\n}\n`);
	const full = [...wanted.keys()].filter((k) => data[k]?.title && data[k]?.authors?.length && data[k]?.year).length;
	const some = [...wanted.keys()].filter((k) => data[k]?.title).length - full;
	console.log(`Wrote ${path.relative(root, DATA)}: ${full} with title, authors and year; ${some} with a title only; ${wanted.size - full - some} blank.`);
}
