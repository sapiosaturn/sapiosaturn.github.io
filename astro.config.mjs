// @ts-check
import { defineConfig } from 'astro/config';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeNotebook from './src/plugins/rehype-notebook.mjs';
import rehypeMath from './src/plugins/rehype-math.mjs';
import rehypeCode from './src/plugins/rehype-code.mjs';
import remarkExample from './src/plugins/remark-example.mjs';
import remarkFigures from './src/plugins/remark-figures.mjs';
import { shikiConfig } from './src/plugins/shiki-house.mjs';
import referencePages from './src/plugins/reference-pages.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://stochasm.blog',
	// /kitchen-sink/, /figures/ and /typeset/ exist in `astro dev` and in a build made with
	// REFERENCE_PAGES=1 (npm run build:ref); a plain build leaves them out. See the plugin.
	integrations: [referencePages()],
	// Every stylesheet stays a file. home.css is under the 4 KB below which Astro would otherwise
	// write it into the HTML of / and /404.html; as a file the two pages share it from the cache.
	build: { inlineStylesheets: 'never' },
	markdown: {
		// remark-math marks $…$ and $$…$$; remark-example serves the specimen pages (it runs before
		// remark-figures, so a figure block inside an example is drawn too); remark-figures turns
		// ```figure blocks into house-style SVG figures before Shiki can see them.
		remarkPlugins: [remarkMath, remarkExample, remarkFigures],
		// Maths is drawn as SVG at build time (MathJax, STIX Two): no script, stylesheet or font is shipped for it.
		// Heading ids are assigned before the notebook plugin so it can link to them; rehype-code finishes the code frames last.
		rehypePlugins: [rehypeMath, rehypeHeadingIds, rehypeNotebook, rehypeCode],
		// The house syntax theme and code-block transformer (src/plugins/shiki-house.mjs); colours are CSS variables in code.css.
		shikiConfig,
	},
});
