---
layout: "../layouts/Layout.astro"
title: "Typesetting"
post_title: "Code and Mathematics"
post_date: "2026-11-23"
noindex: true
endmark: false
---

## Purpose

This page is a specimen, not a post. It shows how code and mathematics are set, and beside every example the Markdown that produces it, so it doubles as the manual. Everything here is drawn when the site is built: the reader downloads no highlighter, no MathJax and no mathematical font.

## Code in a sentence

Inline code is set in the monospace at the x-height of the serif, on a faint tint rather than in a box, and it never changes the spacing of the lines around it.

````md example
The mask is applied with `scores.masked_fill(mask == 0, float("-inf"))` before the softmax, so a position cannot attend to `x[t+1:]`. A long name such as `torch.nn.functional.scaled_dot_product_attention` wraps where it must. Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to stop a run, then <kbd>↑</kbd> <kbd>Enter</kbd> to resume it.
````

It adapts to where it stands: in a [link to `nanoGPT`](https://github.com/karpathy/nanoGPT) it takes the link's colour and underline, in a heading the heading's size and weight, in a note the note's quieter ink.[^inline]

### The `forward()` method, and why `d_k` matters

| Argument | Shape | Meaning |
| :------- | :---- | :------ |
| `q`, `k` | `(B, H, T, d_k)` | queries and keys, one per head |
| `v` | `(B, H, T, d_v)` | values |
| `mask` | `(T, T)` | `0` where attention is forbidden |

## Code blocks

A fenced block sits in a quiet frame on the raised ground. The language is always declared, on the top rule; a copy button joins it when the block is hovered or focused. Keywords are a little heavier, comments are italic and quieter, and three muted hues do the rest: sage for strings, clay for numbers and constants, slate for a name at the place it is defined.

````md example=fence
```python
import math
import torch
import torch.nn.functional as F
from torch import Tensor, nn


class CausalSelfAttention(nn.Module):
    """Multi-head attention in which position t sees only positions <= t."""

    def __init__(self, d_model: int = 768, n_head: int = 12, dropout: float = 0.1):
        super().__init__()
        assert d_model % n_head == 0
        self.n_head = n_head
        self.qkv = nn.Linear(d_model, 3 * d_model, bias=False)
        self.proj = nn.Linear(d_model, d_model)
        self.drop = nn.Dropout(dropout)

    def forward(self, x: Tensor) -> Tensor:
        B, T, C = x.shape  # batch, sequence, channels
        q, k, v = self.qkv(x).view(B, T, 3, self.n_head, -1).permute(2, 0, 3, 1, 4)
        scores = q @ k.transpose(-2, -1) / math.sqrt(k.size(-1))
        causal = torch.tril(torch.ones(T, T, device=x.device, dtype=torch.bool))
        scores = scores.masked_fill(~causal, float("-inf"))
        weights = self.drop(F.softmax(scores, dim=-1))
        return self.proj((weights @ v).transpose(1, 2).reshape(B, T, C))
```
````

### Titles, line numbers and highlighted lines

Options follow the language on the opening fence. `title="…"` names the file on the frame, `numbers` adds line numbers (`numbers=40` starts at 40), and `{2,4-5}` marks the lines to look at.

````md example
```python title="model/attention.py" numbers=21 {3,5-6}
def attention(q, k, v, mask=None):
    """Scaled dot-product attention over the last two dimensions."""
    scores = q @ k.transpose(-2, -1) / k.size(-1) ** 0.5
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    weights = F.softmax(scores, dim=-1)
    return weights @ v, weights
```
````

### Changes

A change can be shown two ways. A comment ending in `[!code ++]` or `[!code --]` marks a line of ordinary, highlighted code (so does `ins={…}` / `del={…}` on the fence, by line number, and `[!code hl]` highlights one). The copy button leaves out the removed lines.

````md example
```python title="train.py"
optimizer = torch.optim.AdamW(model.parameters(), lr=6e-4, betas=(0.9, 0.95))
for step, (x, y) in enumerate(loader):
    lr = 6e-4  # [!code --]
    lr = cosine_schedule(step, warmup=2_000, peak=6e-4, total=600_000)  # [!code ++]
    for group in optimizer.param_groups:  # [!code ++]
        group["lr"] = lr  # [!code ++]
    loss = F.cross_entropy(model(x).flatten(0, 1), y.flatten())
    loss.backward()
```
````

Or paste a patch as it is, in a `diff` block:

````md example
```diff
--- a/config/gpt2_small.json
+++ b/config/gpt2_small.json
@@ -3,7 +3,7 @@
   "n_layer": 12,
   "n_head": 12,
-  "dropout": 0.1,
+  "dropout": 0.0,
   "bias": false,
```
````

### Terminal sessions

A `console` block is a session. Lines that begin with `$ ` are what was typed; everything else is what came back. The prompt is drawn, not typed, so selecting the text never picks it up, and the copy button takes the commands alone. A line that starts with `# ` is a remark.

````md example
```console
$ python train.py --config config/gpt2_small.json \
    --compile --wandb-mode offline
step     0 | loss 10.9871 | lr 0.00e+00 |   0.0 tok/s
step   500 | loss  6.2140 | lr 1.50e-04 | 412.3k tok/s
step  1000 | loss  5.1038 | lr 3.00e-04 | 415.9k tok/s
# the loss plateaus here until the learning rate has warmed up
$ nvidia-smi --query-gpu=memory.used --format=csv,noheader
38417 MiB
```
````

### Data, and lines that are too long

Mapping keys stay in the text colour; only the values carry a hue. A line longer than the frame scrolls inside it and fades at the edge; the page itself never scrolls sideways.

````md example
```json title="config/gpt2_small.json"
{
  "vocab_size": 50257,
  "block_size": 1024,
  "n_layer": 12,
  "n_head": 12,
  "d_model": 768,
  "dropout": 0.0,
  "bias": false,
  "tokenizer": "gpt2",
  "betas": [0.9, 0.95]
}
```
````

````md example
```sh
python train.py --model gpt2-small --dataset openwebtext --batch-size 512 --lr 6e-4 --warmup-steps 2000 --max-steps 600000 --weight-decay 0.1 --compile
```
````

On a wide screen, `wide` lets a block that needs the room run into the margin where the notes live. It drops below any note still running beside the text above it, so use it sparingly.

````md example
```python wide
logits = einsum("b t d, v d -> b t v", self.ln_f(x), self.wte.weight)  # weight tying: the unembedding is the embedding, transposed
```
````

## Mathematics

Mathematics is written in LaTeX, between dollar signs, and typeset by MathJax when the site is built. What reaches the reader is a drawing in the STIX Two letterforms, the same on every machine, taking its colour from the text and its size from the serif: the x-height of $x$ is the x-height of x.

### In a sentence

````md example
The residual stream is updated as $h_{l+1} = h_l + f_l(h_l)$, where each $f_l$ reads from and writes to the same $d$-dimensional space. With $n = 1024$ positions and a vocabulary of 50,257 tokens, the logits $z \in \R^{n \times |\mathcal{V}|}$ become probabilities through a softmax at temperature $\tau$, and the loss is the mean of $-\log p_\theta(x_t \mid x_{<t})$ over the sequence. Scaling by $1/\sqrt{d_k}$ keeps the variance of $q^\top k$ near 1 as $d_k \to \infty$; without it the gradient through the softmax shrinks like $\tfrac{1}{d_k}$.
````

A long inline formula may break across lines, after a relation or an operator, where TeX would allow it. Punctuation typed after a formula stays attached to it.

### On display

Two dollar signs set a formula on a line of its own, centred, with a little more air than a paragraph break.

````md example
$$
\mathrm{Attention}(Q, K, V) = \softmax\!\left(\frac{QK^{\top}}{\sqrt{d_k}}\right) V
$$
````

### Numbered equations and references

A `\label` gives a display a number, set in the margin of the column, and an anchor. `$\eqref{…}$` in the text becomes a link to it, and may come before the equation it points to. `\tag{…}` sets a tag by hand.

````md example
The model is trained to minimise the cross-entropy $\eqref{eq:loss}$ of its predictions, which are a softmax $\eqref{eq:softmax}$ over the logits.

$$
\mathcal{L}(\theta) = -\frac{1}{T}\sum_{t=1}^{T} \log p_\theta(x_t \mid x_{<t})
\label{eq:loss}
$$

$$
p_\theta(x_t = i \mid x_{<t}) = \frac{e^{z_i/\tau}}{\sum_{j=1}^{|\mathcal{V}|} e^{z_j/\tau}}
\label{eq:softmax}
$$

$$
\frac{\partial \mathcal{L}}{\partial z} = p - y
\tag{$\star$}
$$
````

### Derivations

`aligned` lines up the steps of a derivation; one number serves the whole display.

````md example
$$
\begin{aligned}
\frac{\partial \mathcal{L}}{\partial z_i}
  &= -\frac{\partial}{\partial z_i} \Big( z_y - \log \sum_j e^{z_j} \Big) \\
  &= \frac{e^{z_i}}{\sum_j e^{z_j}} - \mathbb{1}[i = y] \\
  &= p_i - y_i .
\end{aligned}
\label{eq:grad}
$$
````

### Matrices and cases

````md example
$$
\underbrace{\begin{bmatrix} a_{11} & \cdots & a_{1n} \\ \vdots & \ddots & \vdots \\ a_{n1} & \cdots & a_{nn} \end{bmatrix}}_{A \,\in\, \R^{n \times n}}
\underbrace{\begin{bmatrix} v_1^\top \\ \vdots \\ v_n^\top \end{bmatrix}}_{V \,\in\, \R^{n \times d}}
= \softmax\!\big(QK^\top / \sqrt{d_k}\big)\, V
$$

$$
\mathrm{mask}(i, j) =
\begin{cases}
  0 & \text{if } j \le i, \\
  -\infty & \text{otherwise.}
\end{cases}
$$
````

### Too wide for the column

A display that does not fit scrolls inside its own box, fading at the edges, while its number stays put. On a phone that is most displays of any length.

````md example
$$
\mathrm{KL}\big(p \,\|\, q_\theta\big) = \sum_{x \in \mathcal{V}} p(x) \log \frac{p(x)}{q_\theta(x)} = \underbrace{-\sum_{x \in \mathcal{V}} p(x) \log q_\theta(x)}_{\text{cross-entropy } H(p,\, q_\theta)} - \underbrace{\Big(-\sum_{x \in \mathcal{V}} p(x) \log p(x)\Big)}_{\text{entropy } H(p)} \;\ge\; 0
\label{eq:kl}
$$
````

### In other places

Formulas take the size and colour of what they sit in: a note,[^math] a table, a heading.

#### Why divide by $\sqrt{d_k}$

| Quantity | Symbol | Shape |
| :------- | :----- | :---- |
| Embedding | $W_E$ | $\lvert\mathcal{V}\rvert \times d$ |
| Attention pattern | $A = \softmax(QK^\top / \sqrt{d_k})$ | $T \times T$ |
| Unembedding | $W_U = W_E^\top$ | $d \times \lvert\mathcal{V}\rvert$ |

`\hl{…}` picks out part of a formula in the accent colour, for the one term a paragraph is about:

````md example
$$
h_{l+1} = h_l + \hl{\mathrm{Attn}_l(h_l)} + \mathrm{MLP}_l\big(h_l + \mathrm{Attn}_l(h_l)\big)
$$
````

### For readers who do not see the drawing

Each formula also carries itself as MathML, hidden from sight, which a screen reader speaks, and its LaTeX source. Select a passage that includes a formula and copy it: the clipboard receives the source, between dollar signs.

## The syntax palette

Six classes, each a custom property in `code.css`, shared by both themes.

```python
# comment · c            a quiet aside
def name(arg=None):      # k keyword · d definition · n constant · p punctuation
    return f"string {arg}", 3.14
```

| Class | Used for | Dark | Light |
| :---- | :------- | :--- | :---- |
| `k` | keywords, medium weight | `--ink-strong` | `--ink-strong` |
| `d` | a name where it is defined | `#9db3bf` slate | `#2f5a73` |
| `s` | strings | `#a8b18d` sage | `#54632f` |
| `n` | numbers, constants | `#d3a084` clay | `#94502f` |
| `p` | punctuation, operators | `--ink-2` | `--ink-2` |
| `c` | comments, docstrings, italic | `--ink-3` | `--ink-3` |

[^inline]: Like `F.softmax(scores, dim=-1)` here, in the margin.
[^math]: Here $\softmax(z)_i = e^{z_i} / \sum_j e^{z_j}$ sits in a margin note, at the note's size and in the note's ink, and $1/\sqrt{d_k}$ does not push its lines apart.
