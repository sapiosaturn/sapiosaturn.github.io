// The link-preview cards (og:image): /og/<slug>.png for every post, and
// /og/index.png, the site's own, for every other page. Drawn at build time by
// src/lib/card.js, so a post cannot be published without its card, and nothing
// is committed that could go stale. Base.astro names these files in the meta tags.
//
// The two fonts are read from the project folder, where astro is always run
// (a built endpoint no longer sits beside its source, and importing a font
// would publish it).
import fs from 'node:fs';
import path from 'node:path';
import { cards } from '../../lib/card.js';
import { seedOf, slugOf } from '../../lib/chasm.js';
import { getPosts } from '../../lib/posts.js';
import { SITE } from '../../lib/text.js';

const font = (name) => fs.readFileSync(path.join(process.cwd(), 'src/assets/card', name));
const card = cards({ title: font('source-serif-4-display-semibold.ttf'), label: font('ibm-plex-mono-500.ttf') });

export function getStaticPaths() {
	// A post's drawing is seeded from its file name: the same seed as the mark at its foot (rehype-notebook, step 7).
	const posts = getPosts().map((post) => ({ params: { slug: slugOf(post.url) }, props: { title: post.title, seed: seedOf(slugOf(post.url)) } }));
	return [{ params: { slug: 'index' }, props: { seed: seedOf(SITE.name) } }, ...posts];
}

export async function GET({ props }) {
	return new Response(await card.png({ ...props, name: SITE.name }), { headers: { 'Content-Type': 'image/png' } });
}
