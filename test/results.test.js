import { test } from "node:test";
import assert from "node:assert/strict";
import { applyExceptions, summarize, formatReport } from "../src/runner/results.js";

const problems = [
  { check: "a11y", page: "/about/", message: "Low contrast" },
  { check: "readability", page: "/legal/", message: "Text is 12px" },
  { check: "performance", page: "/", message: "Too heavy" },
];

test("applyExceptions removes matching problems by check and page or *", () => {
  const { failures, excepted } = applyExceptions(problems, [{ check: "readability", page: "/legal/", reason: "Statutory" }, { check: "performance", page: "*", reason: "Gallery" }]);
  assert.deepEqual(failures.map((f) => f.check), ["a11y"]);
  assert.equal(excepted.length, 2);
});

test("summarize counts problems, pages and checks", () => {
  assert.equal(summarize(problems, 6, true), "✖ 3 problems on 3 pages (a11y, performance, readability)");
  assert.equal(summarize([], 6, true), "✔ All checks passed on 6 pages.");
  assert.equal(summarize([], 6, false), "✖ Site tests failed");
});

test("formatReport groups by page and lists warnings and exceptions", () => {
  const report = formatReport({
    failures: problems.slice(0, 1),
    warnings: ["Budget pageTotal is 2 MB, above the default 1200 KB."],
    exceptions: [{ check: "readability", page: "/legal/", reason: "Statutory" }],
    pageCount: 6,
    siteTests: { ran: false, ok: true, output: "" },
  });
  assert.match(report, /^✖ 1 problem on 1 page \(a11y\)/);
  assert.match(report, /\n\/about\/\n  \[a11y\] Low contrast\n/);
  assert.match(report, /Warnings:\n  - Budget pageTotal/);
  assert.match(report, /Exceptions in use:\n  - readability on \/legal\/: Statutory/);
});
