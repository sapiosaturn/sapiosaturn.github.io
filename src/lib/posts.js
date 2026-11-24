// The post index: every markdown file in src/pages/posts, newest first.
// Imported by pages that list posts (home, archive, feed), never by the post
// layout itself, so there is no import cycle.
import { isoDate, wordCount } from './text.js';

export function getPosts() {
	const modules = import.meta.glob('../pages/posts/*.md', { eager: true });
	return Object.values(modules)
		.map((post) => {
			const words = wordCount(post.rawContent());
			const fm = post.frontmatter;
			return {
				url: post.url.replace(/\/?$/, '/'),
				title: fm.post_title ?? fm.title,
				date: isoDate(fm.post_date),
				updated: isoDate(fm.updated) || undefined,
				confidence: fm.confidence ? String(fm.confidence) : undefined,
				words,
			};
		})
		.sort((a, b) => b.date.localeCompare(a.date));
}
