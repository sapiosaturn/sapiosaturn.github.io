// Minifies a script that is inlined into a page (src/scripts/*.js), with the
// esbuild that Astro itself builds with. The sources stay readable in the repo.
import { transformSync } from 'esbuild';

/** @param {string} code */
export const minify = (code) => transformSync(code, { minify: true }).code.trim();
