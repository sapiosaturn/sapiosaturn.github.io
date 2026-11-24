// remark-example: for the specimen pages only. A fence written as
//
//   ````md example
//   Some *markdown* with $x^2$.
//   ````
//
// is shown twice: its source, then what the source produces, so the two can
// never drift apart. `example=fence` shows only the opening fence of a code
// block (the rest would repeat the result line for line).

export default function remarkExample() {
	const processor = this;
	const box = (name, children) => ({ type: name, data: { hName: 'div', hProperties: { className: [name] } }, children });
	return (tree) => {
		(function walk(node) {
			if (!node.children) return;
			node.children = node.children.map((child) => {
				if (child.type !== 'code' || !/^(md|markdown)$/.test(child.lang ?? '') || !/\bexample\b/.test(child.meta ?? '')) {
					walk(child);
					return child;
				}
				let shown = child.value;
				if (/example=fence/.test(child.meta)) {
					const [, fence, info] = shown.match(/^(`{3,}|~{3,})(.*)$/m) ?? [];
					if (fence) shown = `${fence}${info}\n…\n${fence}`;
				}
				const source = { type: 'code', lang: 'text', meta: 'raw', value: shown };
				return box('example', [box('example-source', [source]), box('example-result', processor.parse(child.value).children)]);
			});
		})(tree);
	};
}
