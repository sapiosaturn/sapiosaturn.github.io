// Site constants and pure text helpers. No imports, safe to use anywhere.

export const SITE = {
	name: 'stochastic chasm',
	description: 'Notes on machine learning, mainly transformers and LLMs: multimodality, creativity, and interpretability.',
};

const number = new Intl.NumberFormat('en-US');

export function wordCount(markdown = '') {
	const prose = markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\]\([^)]*\)/g, ']');
	return (prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

export const formatWords = (n) => `${number.format(n)} words`;
export const readingTime = (n) => `${Math.max(1, Math.round(n / 230))} min`;

// Dates are written YYYY-MM-DD in frontmatter and shown the same way. A quoted
// date arrives as that string; an unquoted one arrives as a Date at UTC
// midnight, so reading it back in UTC involves no timezone either.
export const isoDate = (value) => (value instanceof Date ? value.toISOString() : String(value ?? '')).slice(0, 10);
