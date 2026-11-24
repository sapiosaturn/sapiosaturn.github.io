// A hand-rolled RSS 2.0 feed, so the site needs no feed dependency.
import { SITE } from '../lib/text.js';
import { getPosts } from '../lib/posts.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function GET({ site }) {
	const base = site ?? new URL('https://stochasm.blog');
	const items = getPosts()
		.map((post) => {
			const url = new URL(post.url, base).href;
			return `<item><title>${esc(post.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(post.date + 'T00:00:00Z').toUTCString()}</pubDate></item>`;
		})
		.join('\n');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE.name)}</title>
<link>${base.href}</link>
<description>${esc(SITE.description)}</description>
<language>en</language>
${items}
</channel></rss>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
