/**
 * Canonical DOM serialisation used by the golden (snapshot) tests.
 *
 * Two renderers (HTML string vs Svelte component) can produce the same DOM with different
 * source formatting, so this compares what the browser would actually build:
 * comments (Svelte anchors) are ignored, attributes are sorted, and whitespace is normalised the
 * way CSS does it (runs collapse to one space, whitespace at the very start/end of an element is
 * dropped, whitespace *between* nodes is kept as a single space because it matters for inline layout).
 * Inside <svg> whitespace is ignored by the renderer (except within <text>), so it is dropped there.
 */
export function serialize(root: Element): string {
  const lines: string[] = [];

  const clean = (el: Element) => {
    [...el.childNodes].forEach((n) => (n.nodeType === 8 ? n.remove() : n.nodeType === 1 && clean(n as Element)));
    el.normalize();
  };
  const probe = root.cloneNode(true) as Element;
  clean(probe);

  const SVG_TEXT = new Set(["text", "tspan", "textPath"]);
  const inertWhitespace = (el: Element) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      if (SVG_TEXT.has(n.localName)) return false;
      if (n.localName === "svg") return true;
    }
    return false;
  };

  const walk = (el: Element, depth: number) => {
    const pad = "  ".repeat(depth);
    // tabindex="-1" on a heading is added at runtime to move focus there (focusScreenHeading); it is not markup.
    const attrs = [...el.attributes]
      .filter((a) => !(a.name === "tabindex" && a.value === "-1" && /^h[1-6]$/.test(el.localName)))
      .map((a) => `${a.name}=${JSON.stringify(a.name === "style" ? a.value.split(";").map((s) => s.trim()).filter(Boolean).join(";") : a.value)}`)
      .sort()
      .join(" ");
    lines.push(`${pad}<${el.localName}${attrs ? " " + attrs : ""}>`);
    const kids = [...el.childNodes];
    kids.forEach((n, i) => {
      if (n.nodeType === 3) {
        const raw = (n.textContent ?? "").replace(/\s+/g, " ");
        if (raw === " ") {
          if (i === 0 || i === kids.length - 1 || inertWhitespace(el)) return; // never renders
          lines.push(`${pad}  " "`);
        } else lines.push(`${pad}  ${JSON.stringify(raw)}`);
      } else if (n.nodeType === 1) walk(n as Element, depth + 1);
    });
  };
  [...probe.children].forEach((c) => walk(c, 0));
  return lines.join("\n") + "\n";
}
