export const id = "sensitive-fields";
export const browser = false;

export const SENSITIVE = /(diagnos\w*|medical condition|health condition|medication\w*|prescription\w*|insurance|medicare|medicaid|social security|\bssn\b|passport|driver'?s licen[cs]e)/i;

export async function run({ pages, loadPage }) {
  const problems = [];
  for (const page of pages) {
    const doc = loadPage(page);
    for (const field of doc.querySelectorAll("input, select, textarea")) {
      if (/^(hidden|submit|button|reset|image)$/i.test(field.getAttribute("type") ?? "")) continue;
      const fieldId = field.getAttribute("id");
      const labelFor = fieldId ? [...doc.querySelectorAll("label[for]")].find((l) => l.getAttribute("for") === fieldId) : null;
      const texts = [
        labelFor?.textContent,
        field.closest("label")?.textContent,
        field.getAttribute("aria-label"),
        field.getAttribute("placeholder"),
        field.getAttribute("name")?.replace(/[_-]/g, " "),
        fieldId?.replace(/[_-]/g, " "),
      ].filter(Boolean).map((t) => t.replace(/\s+/g, " ").trim());
      const hit = texts.map((t) => SENSITIVE.exec(t)?.[0]).find(Boolean);
      if (hit) problems.push({ page, message: `A form field asks for "${hit}". Forms must not collect health, insurance or ID details; arrange to discuss them by phone instead.` });
    }
  }
  return problems;
}
