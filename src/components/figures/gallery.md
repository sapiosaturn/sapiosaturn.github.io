---
title: Figures
---

Every figure on this site is drawn from one small kit, so that a chart in one essay looks like a chart in any other. This page is the kit's specimen sheet and its manual: each kind of figure with sample data and the block that produced it, then the palette, then every figure that appears in a post.

The numbers in the examples on this page are made up, except in the last section.

## House rules

- A figure is drawn on the page itself. No box, no background, no title inside the plot: the caption carries the title.
- Ink first. The first series is the text colour, the second is the site's amber, and three muted hues follow. A sixth series means the chart wants panels instead.
- Series are named where they end. A key appears only when the names would not fit beside the lines.
- Hairline gridlines run across the value axis only. The value axis is titled above the plot, flush left, never rotated.
- Labels are mono. Words inside a plot (a note, a diagram title) are set in the text face, in italic.
- Every figure has a numbered caption, and a source line when it shows somebody else's result. The source line is the citation and nothing else: who, year, the title as a link, the figure number. It carries no remark on how the figure was drawn or where its numbers were read from.
- Figures are static SVG made at build time. They need no script, and they take their colours from the same variables as the page, so the light theme is native rather than a filter.

## Writing a figure

A figure is a fenced block tagged `figure` in the post's Markdown. The body is YAML: a `type`, the data, and a `caption`. The caption and the other prose keys (`credit`, `alt`, `desc`) take the rest of their line exactly as written, so they need no quoting.

````md
```figure
type: line
x: [1, 2, 3, 4]
series:
  - { y: [2.9, 2.1, 1.7, 1.5], label: train }
  - { y: [3.0, 2.4, 2.2, 2.1], label: validation, color: accent }
xlabel: epoch
ylabel: loss
caption: Loss over four epochs.
```
````

Data can sit in the block, as above, or in a small CSV or JSON file beside the post. With `data: ./_figures/loss.csv`, a series names a column instead of listing numbers (`y: train`). A long spec, such as a diagram, can live in its own YAML file and be pulled in with `src: ./_figures/stack.yaml`; keys written in the block win over keys in the file. Paths are relative to the Markdown file, and a folder whose name starts with an underscore keeps Astro from treating the files as pages.

A plain image still works the usual way and gets the same frame: `![alt text](./_figures/photo.jpg "Caption. | Source line")`. Keep image files in the underscore folder too, or the build warns about each one.

A mistake in a block (an unknown type, a missing column) stops the build and names the file and line.

## Line chart

`type: line`. One or more series over a shared `x`. A series may carry a `band` (two columns or arrays: low, high), be dashed (`dash: true`), show its points (`points: true`), or be thickened (`emphasis: true`). `xscale: log` and `yscale: log` switch an axis to a log scale.

```figure source
type: line
data: ./samples/loss.csv
x: step
xscale: log
series:
  - { y: baseline, band: [baseline_lo, baseline_hi], label: baseline }
  - { y: warmup, band: [warmup_lo, warmup_hi], label: with warmup, color: accent }
xlabel: training step
ylabel: validation loss (nats)
caption: Two series from a CSV file, each with a min-to-max band over three seeds, on a log x axis. The series are named at their ends.
```

Reference lines (`refs`), a note in the text face (`notes`, placed in data coordinates) and a key instead of end labels (`labels: key`):

```figure source
type: line
x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
series:
  - { y: [0.52, 0.58, 0.69, 0.81, 0.88, 0.93, 0.94, 0.95, 0.94, 0.93, 0.9, 0.86], label: linear probe, points: true }
  - { y: [0.5, 0.51, 0.55, 0.6, 0.66, 0.74, 0.8, 0.86, 0.89, 0.91, 0.92, 0.92], label: MLP probe, color: blue, points: true, marker: square }
  - { y: [0.5, 0.51, 0.5, 0.53, 0.52, 0.55, 0.54, 0.56, 0.57, 0.56, 0.58, 0.57], label: control task, color: mute, dash: true }
refs:
  - { y: 0.5, label: chance }
notes:
  - { at: [8.4, 0.74], text: "linearly decodable\nby layer 6" }
labels: key
ylim: [0.4, 1]
yformat: "%"
xlabel: layer
ylabel: probe accuracy
caption: Points, a dashed series, a reference line, a note and a key.
```

## Bar chart

`type: bar`. Categories come from `x`; one `y` or several `series`. `values: true` prints the numbers, `highlight` picks out categories in amber, `horizontal: true` turns the chart on its side, which suits long category names.

```figure source
type: bar
x: [0, 1, 2, 4, 8, 16, 32]
y: [41.2, 55.8, 63.1, 70.4, 74.9, 76.3, 76.8]
values: .1f
highlight: [8]
ylim: [0, 100]
xlabel: in-context examples
ylabel: accuracy (%)
caption: One series, values printed, one category highlighted.
```

```figure source
type: bar
x: [arithmetic, retrieval, translation, summarisation]
series:
  - { y: [62, 81, 74, 58], label: small }
  - { y: [78, 88, 83, 69], label: base, color: accent }
  - { y: [91, 93, 89, 80], label: large, color: blue }
ylim: [0, 100]
ylabel: score
caption: Grouped bars with a key.
```

```figure source
type: bar
horizontal: true
x: [no positional encoding, no layer norm, no residual connections, half the heads, no attention dropout]
y: [-6.4, -11.9, -38.2, -2.1, 0.7]
values: .1f
xlabel: change in accuracy (points)
height: 230
caption: Horizontal bars around zero, for an ablation table.
```

## Scatter plot

`type: scatter`. `x` and `y`, plus `text` to name each point. Several `series` get different marker shapes as well as colours, so the groups survive greyscale. `line: true` joins the points in order.

```figure source
type: scatter
x: [0.12, 0.35, 0.77, 1.5, 3.0, 7.0, 13, 34, 70]
y: [31.5, 38.2, 44.9, 49.0, 55.6, 61.3, 64.8, 71.9, 74.2]
text: [tiny, mini, small, "", base, "", large, "", xxl]
xscale: log
ylim: [20, 80]
xlabel: parameters (billions)
ylabel: benchmark score
caption: A single group on a log x axis, with some points named.
```

```figure source
type: scatter
series:
  - { label: pretrained, x: [0.8, 1.4, 2.1, 2.9, 3.6, 4.4, 5.2], y: [0.61, 0.66, 0.72, 0.74, 0.79, 0.83, 0.84] }
  - { label: from scratch, color: accent, x: [0.9, 1.7, 2.5, 3.1, 4.0, 4.8, 5.5], y: [0.42, 0.47, 0.55, 0.58, 0.66, 0.69, 0.75] }
  - { label: distilled, color: blue, open: true, x: [1.1, 2.0, 3.3, 4.6], y: [0.58, 0.64, 0.73, 0.78] }
xlabel: log10 training tokens
ylabel: accuracy
ylim: [0.4, 0.9]
caption: Three groups, told apart by marker shape as well as colour.
```

## Heatmap

`type: heatmap`. Give `values` as rows of numbers (or `data`, a CSV whose first column holds the row labels), with `rows` and `cols` for the labels. Cells are tinted from the sequential ramp; `ramp: div` uses the diverging ramp, centred on zero. Empty cells (`null`, or a blank in the CSV) are left out, which is how a triangular matrix is drawn. Numbers are printed when they fit; `text: false` turns them off, `format` sets the decimals, `lim` fixes the ends of the scale.

```figure source
type: heatmap
rows: [The, " cat", " sat", " on", " the", " mat", "."]
cols: [The, " cat", " sat", " on", " the", " mat", "."]
values:
  - [1]
  - [0.22, 0.78]
  - [0.18, 0.19, 0.62]
  - [0.26, 0.63, 0.08, 0.04]
  - [0.24, 0.36, 0.09, 0.1, 0.21]
  - [0.07, 0.4, 0.12, 0.05, 0.3, 0.05]
  - [0.07, 0.51, 0.03, 0.02, 0.04, 0.16, 0.17]
lim: [0, 1]
ylabel: query
zlabel: attention weight
caption: A causal attention pattern. Each row is a query token and sums to one.
```

```figure source
type: heatmap
ramp: div
rows: [L0, L1, L2, L3, L4, L5]
cols: [When, " Mary", " and", " John", " went", " to", " the", " store"]
values:
  - [0.17, -0.03, 0.41, -1.44, 0.45, -0.06, -0.2, -1.31]
  - [-0.38, 0.08, -0.25, -0.71, 0.13, -0.01, -0.4, -0.12]
  - [0.26, 0.39, -0.6, -1.54, -0.17, 0.02, -0.1, -0.22]
  - [0.18, -0.53, -0.45, 0.16, -0.18, 0.13, -0.35, 0.65]
  - [-0.55, -0.42, 0.1, 0.02, -0.11, 0.21, -0.4, 1.26]
  - [-0.16, -0.04, -0.24, 0.66, 0.11, -0.19, 0.18, 2.22]
cell: 52
ylabel: layer patched
zlabel: change in logit difference
caption: The diverging ramp, for signed quantities such as an activation-patching sweep.
```

## Token strip

`type: tokens`. A run of `tokens` with one value each, tinted from the same ramps. The strip wraps like text, and spaces inside tokens are shown as a middle dot. `highlight` outlines tokens by position; `text: false` hides the numbers.

```figure source
type: tokens
tokens: [The, " E", iff, el, " Tower", " is", " located", " in", " the", " city", " of", " Paris"]
values: [0.02, 0.01, 0.94, 0.99, 0.97, 0.41, 0.12, 0.63, 0.48, 0.22, 0.97, 0.88]
lim: [0, 1]
highlight: [11]
zlabel: probability of the token
caption: The probability a model gave each token of a sentence, with the last token outlined.
```

With `rows`, several rows of values share one run of tokens, for comparing heads or layers:

```figure source
type: tokens
tokens: [When, " Mary", " and", " John", " went", " to", " the", " store", ",", " John", " gave", " a", " drink", " to"]
rows:
  - { label: L7 H3, values: [0.01, 0.02, 0.01, 0.52, 0.02, 0.01, 0.01, 0.03, 0.01, 0.31, 0.02, 0.01, 0.01, 0.01] }
  - { label: L9 H6, values: [0.01, 0.71, 0.02, 0.06, 0.02, 0.01, 0.01, 0.04, 0.01, 0.03, 0.03, 0.01, 0.03, 0.01] }
  - { label: L9 H9, values: [0.02, 0.64, 0.03, 0.04, 0.03, 0.02, 0.02, 0.06, 0.02, 0.02, 0.04, 0.02, 0.03, 0.01] }
lim: [0, 1]
zlabel: attention from the last token
caption: Attention from the final position, for three heads.
```

## Diagram

`type: diagram`. Boxes and arrows on a coordinate grid. `grid: [columns, rows]` sets the coordinate space, with the origin at the top left; x stretches with the figure, while a row keeps a fixed height (`row`, in pixels), so the type never shrinks. An edge runs `from` a point or a node anchor (`id.t`, `id.b`, `id.l`, `id.r`) `to` another, optionally `via` corner points; `curve: true` bends it through the `via` point instead. `weight: stream` draws the heavy line used for a residual stream. Node kinds are `box`, `pill`, `add` (a circled plus) and `plain`; `tone: accent` picks one out.

```figure source
type: diagram
grid: [24, 7.6]
row: 26
nodes:
  - { id: att, at: [7, 2], size: [5, 1.5], label: Attention }
  - { id: mlp, at: [16, 2], size: [5, 1.5], label: MLP, tone: accent }
  - { id: add1, at: [11, 5.2], kind: add }
  - { id: add2, at: [20, 5.2], kind: add }
edges:
  - { from: [0.5, 5.2], to: [23.5, 5.2], weight: stream }
  - { from: [3, 5.2], via: [[3, 2]], to: att.l }
  - { from: att.r, via: [[11, 2]], to: add1.t }
  - { from: [12.5, 5.2], via: [[12.5, 2]], to: mlp.l, tone: accent }
  - { from: mlp.r, via: [[20, 2]], to: add2.t, tone: accent }
labels:
  - { at: [0.5, 6.6], text: residual stream, kind: note, anchor: start }
  - { at: [3.4, 3.8], text: read, anchor: start }
  - { at: [10.6, 3.8], text: write, anchor: end }
caption: One transformer block drawn along the residual stream, with the MLP picked out.
```

## Panels

`panels` puts several plots under one caption. Keys written on the figure are shared by every panel, and each panel adds its own `title` and data. Panels sit side by side and stack on a phone (`stack: false` keeps them side by side). `where` filters the rows of a shared data file, as in `where: { split: test }`.

```figure source
type: line
x: [1, 2, 4, 8, 16, 32, 64]
xscale: log
ylim: [0, 1]
xlabel: number of heads ablated
ylabel: accuracy
width: wide
panels:
  - title: induction
    series:
      - { y: [0.97, 0.95, 0.9, 0.71, 0.4, 0.22, 0.15], label: targeted }
      - { y: [0.97, 0.97, 0.96, 0.95, 0.93, 0.88, 0.8], label: random, color: mute, dash: true }
  - title: indirect object
    series:
      - { y: [0.93, 0.9, 0.84, 0.77, 0.63, 0.41, 0.3], label: targeted }
      - { y: [0.93, 0.93, 0.92, 0.9, 0.87, 0.82, 0.71], label: random, color: mute, dash: true }
caption: Two panels that share their axes. With `width: wide` the figure runs across the column and the margin on a large screen.
```

## Plain images

A photograph, a screenshot, or a chart that cannot be redrawn faithfully stays an image. It sits in the same frame, with the same numbered caption; text after a bar in the image title becomes the source line. A chart on a white ground is still inverted in the dark theme (end the title with `{keep}` to stop that), and `{wide}` lets an image run across the margin as well.

![Two scatter plots on a black ground](../../pages/posts/_figures/o1-graph.png "An image in the house frame. | OpenAI (2024), Learning to reason with LLMs.")

```md
![Two scatter plots on a black ground](./_figures/o1-graph.png "An image in the house frame. | OpenAI (2024), Learning to reason with LLMs.")
```

## A closer look

Click a figure, or press <kbd>Enter</kbd> with it in focus, and it is shown alone on the page with its caption: a drawn figure in its widest layout at up to twice the size, an image at the full size of its file (a chart inverted for the dark theme stays inverted). A click anywhere outside the caption, the word *close* or <kbd>Esc</kbd> comes back to the same place in the text.

Nothing has to be written for this. A figure is offered for enlarging only if it would gain at least a fifth in width, so there is none of it on a phone, for an image already shown at full size, or for a figure as tall as the window. This is the one script a figure brings with it: about 1.3 KB, inlined only on pages that have a figure, and without it the figures are simply still.

## Options

Keys every figure understands:

| Key | Meaning |
|---|---|
| `caption` | The caption. Inline Markdown links, `*emphasis*` and code work. |
| `credit` | The source line under the caption, when the figure shows somebody else's result: `Author et al. (2024), [Title](https://…), fig. 5.` and no more. |
| `alt` | A short title for screen readers. Defaults to the caption. |
| `desc` | A longer description for screen readers. Written automatically from the data when left out. |
| `width` | `wide` lets the figure run across the column and the margin on large screens. |
| `height` | Plot height in pixels at column width (charts only). |
| `data` | A CSV or JSON file of rows; series then name columns. |
| `src` | A YAML or JSON file holding the spec itself. |

Keys shared by line, bar and scatter figures:

| Key | Meaning |
|---|---|
| `xlabel`, `ylabel` | Axis titles. Put units in parentheses. |
| `xscale`, `yscale` | `log` for a log axis. |
| `xlim`, `ylim` | `[low, high]`. Left out, the value axis is rounded out to tick values. |
| `xticks`, `yticks` | Explicit tick values. `xticklabels: false` keeps the marks and drops the numbers. |
| `xformat`, `yformat` | `.2f` fixed decimals, `%` percent of one, `si` for 1k and 2.5M. |
| `refs` | Reference lines: `{ y: 0.5, label: chance }` or `{ x: 12, label: … }`. |
| `notes` | Words in the plot: `{ at: [x, y], text: … }`, with `dx`, `dy` in pixels. |
| `labels` | `end` (names at the line ends), `key`, or `none`. |
| `color` | Per series: `ink`, `accent`, `blue`, `teal`, `rose`, `mute`. |

In an `.astro` page the same keys are props of the components in `src/components/figures`: `<LineChart x={…} series={…} caption="…" />`, and likewise `BarChart`, `ScatterPlot`, `Heatmap`, `TokenStrip`, `Diagram` and `Panels`. `<Figure caption="…">` wraps anything else in the house frame.
