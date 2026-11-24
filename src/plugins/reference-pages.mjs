// The three reference pages: /kitchen-sink/ (every element), /figures/ (the
// figure kit) and /typeset/ (code and mathematics). They are the authoring
// manuals and the test fixtures of the design, not part of the published site.
//
// Their sources live in src/reference, outside src/pages, so an ordinary
// build (`npm run build`, `npx astro build`, CI) does not contain them and no
// published page links to them. This integration adds their routes
//
//   - always in `astro dev`, and
//   - in a build only when REFERENCE_PAGES=1 is set:
//       REFERENCE_PAGES=1 npx astro build --outDir dist-ref   (= npm run build:ref)
//       npx astro preview --outDir dist-ref                   (= npm run preview:ref)
//
// Astro injects only .astro files as pages (a .md entrypoint is taken for an
// endpoint), hence the two small wrappers beside the Markdown files.
const pages = ['kitchen-sink', 'typeset', 'figures'];

export default function referencePages() {
	return {
		name: 'reference-pages',
		hooks: {
			'astro:config:setup': ({ command, injectRoute }) => {
				if (command !== 'dev' && process.env.REFERENCE_PAGES !== '1') return;
				for (const name of pages) injectRoute({ pattern: `/${name}`, entrypoint: `./src/reference/${name}.astro` });
			},
		},
	};
}
