const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function applyExceptions(problems, exceptions) {
  const failures = [];
  const excepted = [];
  for (const p of problems) {
    const match = exceptions.some((e) => e.check === p.check && (e.page === "*" || e.page === p.page));
    (match ? excepted : failures).push(p);
  }
  return { failures, excepted };
}

export function summarize(failures, pageCount, siteTestsOk) {
  if (!failures.length) return siteTestsOk ? `✔ All checks passed on ${plural(pageCount, "page")}.` : "✖ Site tests failed";
  const pages = new Set(failures.map((f) => f.page)).size;
  const checks = [...new Set(failures.map((f) => f.check))].sort().join(", ");
  return `✖ ${plural(failures.length, "problem")} on ${plural(pages, "page")} (${checks})${siteTestsOk ? "" : ", and site tests failed"}`;
}

export function formatReport({ failures, warnings, exceptions, pageCount, siteTests }) {
  const lines = [summarize(failures, pageCount, siteTests.ok), ""];
  const byPage = new Map();
  for (const f of failures) byPage.set(f.page, [...(byPage.get(f.page) ?? []), f]);
  for (const page of [...byPage.keys()].sort()) {
    lines.push(page);
    for (const f of byPage.get(page)) lines.push(`  [${f.check}] ${f.message}`);
    lines.push("");
  }
  if (siteTests.ran && !siteTests.ok) lines.push("Site tests (tests/ folder) failed:", siteTests.output.trim(), "");
  if (warnings.length) lines.push("Warnings:", ...warnings.map((w) => `  - ${w}`), "");
  if (exceptions.length) lines.push("Exceptions in use:", ...exceptions.map((e) => `  - ${e.check} on ${e.page}: ${e.reason}`), "");
  return lines.join("\n");
}
