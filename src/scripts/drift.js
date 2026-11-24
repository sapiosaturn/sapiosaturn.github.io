// drift: the plate at the top of the home page (and, with nothing crossing, of the 404).
//
// Random walks run toward a chasm and stop at its lip. One gets across.
// Walkers set out from both edges along uneven strata and sag over the lip of
// a rift; the rift closes part of the way down, and the strata beneath its
// floor are whole, only bent.
//
// This file only turns a seed into SVG paths. Colours, line weight, the draw-in,
// reduced motion and the no-script case are all in home.css, so a theme change
// needs no redraw. Once drawn, the plate does not move.
//
// src/lib/chasm.js is this same walk for the build (the link-preview cards and
// the mark at the foot of a post). The two must draw the same picture for a
// seed: change the walk here and there together, and run R/tools/test-chasm.mjs.

const figure = document.querySelector('.plate');
const art = figure.querySelector('.plate-art');
const button = figure.querySelector('button');

const STEPS = 156; // per full width, whatever the width: a seed keeps its picture when the page is resized
const newSeed = () => (Math.random() * 0x1000000) | 0;
const at = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);

// mulberry32
const rng = (a) => () => {
	a = (a + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// A six-digit hex fragment pins the drawing: /#2752e1 always opens on that plate.
let seed = /^#[\da-f]{6}$/.test(location.hash) ? parseInt(location.hash.slice(1), 16) : newSeed();
let width = 0;

function draw(animate) {
	const W = (width = art.clientWidth);
	const H = art.clientHeight;
	const dx = W / STEPS;
	const rand = rng(seed);
	const gauss = (r = rand) => r() + r() + r() - 1.5;
	const { exp, max, min } = Math;
	const paths = [];
	const ends = []; // where the crossing walk reaches each lip: x, y, x, y

	// One stroke of the pen. `delay` staggers the draw-in; tone and weight are 0..1.
	const pen = (d, delay, tone, weight = 0.5) =>
		paths.push(`<path pathLength="1" style="--d:${delay}ms;--w:${(0.6 + 0.7 * weight).toFixed(2)};opacity:${tone.toFixed(2)}" d="${d}"/>`);

	// A smoothed walk of n steps from zero: the swell under the strata.
	const wander = (n, kick) => {
		const out = [];
		for (let pos = 0, vel = 0; n-- >= 0; ) out.push((pos += vel = vel * 0.92 + gauss() * kick));
		return out;
	};

	const rough = 0.3 * min(1, Math.sqrt(dx / 4)); // narrower plate, shorter steps, gentler walk

	// The swell every stratum shares, pinned to zero at both edges.
	let swell = wander(STEPS, 0.4);
	swell = swell.map((v, j) => v - (swell[STEPS] * j) / STEPS);
	const scale = (5 + rand() * 7) / (max(...swell) - min(...swell));

	// The rift: where it starts, which way it leans, how wide its mouth is, how
	// far the two sides have slipped, and how far down it closes.
	let centre = W * (0.28 + 0.44 * rand());
	const lean = 4.5 * (rand() - 0.5);
	const mouth = min(W / 14, 18 + rand() * 15);
	const slip = (rand() < 0.5 ? -1 : 1) * (3 + rand() * 6);
	const floor = 0.45 + 0.3 * rand();

	const rows = [];
	for (let y = 8; y < H - 16; y += 10 * (0.5 + rand())) rows.push(y);

	rows.forEach((y0, i) => {
		const depth = i / (rows.length - 1);
		const below = depth / floor - 1; // negative while the rift is open
		centre += lean + gauss() * 4;
		const half = below < 0 ? mouth * (-below) ** 0.75 + 1.5 + Math.abs(gauss()) * 3 : 0;
		const sag = i ? (8 + 16 * (1 - depth)) * exp(-3 * max(0, below)) : 0;
		const reach = 4 + 9 * (1 - depth) + 10 * max(0, below);
		const tone = (0.85 - 0.55 * depth) * (0.7 + 0.3 * rand());
		// Two walkers per stratum, one from each edge; under the floor, one that goes the whole way.
		for (const side of below < 0 ? [-1, 1] : [-1]) {
			const walk = rng(rand() * 4294967296);
			const lip = centre + side * half;
			let own = 0, d = '', x, y;
			for (let j = side < 0 ? 0 : STEPS, far = 1; far > 0 && j >= 0 && j <= STEPS; j -= side) {
				x = j * dx;
				far = side * (x - lip);
				if (far < 0) {
					if (below < 0) { x = lip; far = 0; }
					else far = 1e-9 - far;
				}
				own = own * 0.965 + gauss(walk) * rough * (1 + 3 * exp(-far / 110));
				y = y0 + swell[j] * scale + own
					+ slip / (1 + exp((centre - x) / 5)) // the far side sits higher or lower
					+ sag * exp(below < 0 ? -far / reach : -((far / reach / 1.6) ** 2));
				d += (d ? 'L' : 'M') + at(x, y);
			}
			pen(d, i * 20, tone, 1 - depth);
			if (!i) ends.push(x, y);
		}
	});

	// The one walk that gets across, on a slack line. It is drawn in its own
	// sheared frame, from 0 0 along the x axis (the line used to sway in that
	// frame; the frame stays, so that a seed draws exactly what it always drew).
	const [x1, y1, x2, y2] = ends;
	let d = 'M0 0';
	for (let k = 1; k <= 12; k++) d += 'L' + at(((x2 - x1) * k) / 12, (k * (12 - k)) / 12 + (k < 12 ? gauss() * 0.35 : 0));
	paths.push(`<g transform="matrix(1 ${(y2 - y1) / (x2 - x1)} 0 1 ${x1} ${y1})"><path class="x" pathLength="1" style="--d:${rows.length * 20 + 550}ms" d="${d}"/></g>`);

	art.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${paths.join('')}</svg>`;
	art.classList.toggle('go', animate);
	button.textContent = seed.toString(16).padStart(6, '0');
	figure.classList.add('on');
}

// A new drawing on request. Its seed goes in the address, so the plate can be kept or shared.
button.addEventListener('click', () => {
	seed = newSeed();
	draw(true);
	history.replaceState(null, '', '#' + button.textContent);
});

// Fires once on observe (the first drawing), then whenever the plate changes width.
// A plate with no width (a collapsed frame, a 1px preview) is left alone: with
// zero-length steps a walker would never reach the lip.
new ResizeObserver(() => {
	const w = art.clientWidth;
	if (w && w !== width) draw(!width);
}).observe(art);
