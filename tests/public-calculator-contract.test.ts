import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pageSource = await readFile(resolve("app/(public)/calculator/page.tsx"), "utf8");
const calculatorSource = await readFile(
  resolve("components/sections/DebtLoadCalculator.tsx"),
  "utf8",
);

assert.match(
  pageSource,
  /import DebtLoadCalculator from "@\/components\/sections\/DebtLoadCalculator"/,
  "public calculator page must use the functional debt-load calculator",
);
assert.match(pageSource, /<DebtLoadCalculator\s*\/>/);
assert.match(pageSource, /href="\/bankruptcy-check"/);
assert.doesNotMatch(
  pageSource,
  /вероятност(?:ь|и) успешного|подходит ли вам банкротство/i,
  "calculator page must not predict legal eligibility or procedure success",
);

for (const fieldName of ["debt", "income", "creditors"]) {
  assert.ok(
    calculatorSource.includes(`name="${fieldName}"`),
    `calculator must submit ${fieldName}`,
  );
}
assert.match(calculatorSource, /onSubmit=\{handleSubmit\}/);
assert.match(calculatorSource, /type="submit"/);
assert.match(calculatorSource, /incomeMonths:\s*debt \/ income/);
assert.match(calculatorSource, /averagePerCreditor:\s*debt \/ creditors/);
assert.match(calculatorSource, /href="\/bankruptcy-check"/);
assert.match(calculatorSource, /не юридическое заключение/);
assert.match(calculatorSource, /не прогноз результата процедуры/);
assert.doesNotMatch(
  calculatorSource,
  /вероятност(?:ь|и) успешного|вы точно подходите|гарантирован(?:о|ный)|100%/i,
  "calculator must remain arithmetic and must not present a legal outcome score",
);
assert.doesNotMatch(
  calculatorSource,
  /fetch\(|axios|\/api\//,
  "calculator inputs must remain local and must not be transmitted",
);

console.log("PUBLIC_CALCULATOR_CONTRACT_TEST_PASS");
