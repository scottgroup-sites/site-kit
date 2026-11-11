import { HtmlValidate } from "html-validate";

export const id = "html";
export const browser = false;

// Style preferences relaxed for every site; correctness rules stay on.
export const DEFAULT_RULES = {
  "long-title": "off",
  "no-trailing-whitespace": "off",
  "void-style": "off",
  "attribute-boolean-style": "off",
  "no-redundant-role": "off",
  "require-sri": "off",
  "tel-non-breaking": "off",
  "no-raw-characters": ["error", { relaxed: true }],
};

export async function run({ pages, fileForUrl, config }) {
  const rules = { ...DEFAULT_RULES };
  for (const r of config.htmlValidate) rules[r.rule] = r.level;
  const validator = new HtmlValidate({ root: true, extends: ["html-validate:recommended"], rules });
  const problems = [];
  for (const page of pages) {
    const report = await validator.validateFile(fileForUrl(page));
    for (const result of report.results) {
      for (const m of result.messages) problems.push({ page, message: `${m.message} (line ${m.line}, rule ${m.ruleId})` });
    }
  }
  return problems;
}
