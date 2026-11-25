// Cloudflare Pages / Netlify style `_redirects`: "from to [status]" per line, # comments.
export function parseRedirects(text) {
  const rules = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [from, to, status] = line.split(/\s+/);
    if (from && to) rules.push({ from, to, status: status ? Number(status) : 302 });
  }
  return rules;
}

const strip = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

// True when a rule's source matches the path: exact (ignoring a trailing slash), ":name" segments,
// or a trailing "*" splat. Rules whose source is a full URL (host-specific) are ignored.
export function redirectFor(rules, path) {
  const target = strip(path.split(/[?#]/)[0]);
  for (const rule of rules) {
    if (!rule.from.startsWith("/")) continue;
    if (rule.from.endsWith("*")) {
      if (target.startsWith(rule.from.slice(0, -1)) || `${target}/` === rule.from.slice(0, -1)) return rule;
      continue;
    }
    const a = strip(rule.from).split("/");
    const b = target.split("/");
    if (a.length === b.length && a.every((seg, i) => seg.startsWith(":") ? b[i] !== "" : seg === b[i])) return rule;
  }
  return null;
}
