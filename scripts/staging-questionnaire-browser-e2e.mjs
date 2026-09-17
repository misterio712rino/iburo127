import { chromium } from "playwright";

const baseUrl = new URL(required("IB_STAGING_BASE_URL"));
const bypass = required("VERCEL_AUTOMATION_BYPASS_SECRET");
const email = required("IB_STAGING_CLIENT_EMAIL");
const password = required("IB_STAGING_CLIENT_PASSWORD");

if (process.env.IB_RUNTIME_TARGET !== "staging") throw new Error("IB_RUNTIME_TARGET must be staging");
if (baseUrl.protocol !== "https:") throw new Error("questionnaire browser E2E requires HTTPS");
if (baseUrl.hostname === "iburo127.ru" || baseUrl.hostname.endsWith(".iburo127.ru")) {
  throw new Error("production host is blocked");
}
if (email !== "client.staging-e2e@example.test") {
  throw new Error("questionnaire browser E2E requires the dedicated technical client fixture");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(250);
}

async function login(page) {
  await page.goto(new URL("/auth/sign-in", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 35_000 });
  await page.locator("#identifier").fill(email);
  const continueButton = page.getByRole("button", { name: "Продолжить" });
  await continueButton.waitFor({ state: "visible", timeout: 10_000 });
  await continueButton.click();
  await page.locator("#password").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/portal(?:\/|$)/u, { timeout: 30_000 });
  await settle(page);
}

async function resolveCaseId(page) {
  if (!/^\/portal\/cases\/[^/]+$/u.test(new URL(page.url()).pathname)) {
    await page.goto(new URL("/portal", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await page.waitForURL(/\/portal\/cases\/[^/]+$/u, { timeout: 25_000 });
  }
  const match = new URL(page.url()).pathname.match(/^\/portal\/cases\/([^/]+)$/u);
  if (!match) throw new Error("dedicated client did not resolve to a case");
  return match[1];
}

async function apiJson(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    return { status: response.status, body: await response.json() };
  }, { path, options });
}

async function ensureQuestionnaire(page, caseId) {
  const result = await apiJson(page, `/api/platform/cases/${encodeURIComponent(caseId)}/questionnaire`, { method: "POST" });
  assert(result.status === 200 && result.body?.ok === true, `questionnaire create failed: ${result.status}`);
  return result.body.data;
}

async function questionnaireState(page, caseId) {
  const result = await apiJson(page, `/api/platform/cases/${encodeURIComponent(caseId)}/questionnaire`);
  assert(result.status === 200 && result.body?.ok === true, `questionnaire GET failed: ${result.status}`);
  return result.body.data;
}

async function saveDirect(page, caseId, fieldId, value, expectedVersion) {
  const result = await apiJson(
    page,
    `/api/platform/cases/${encodeURIComponent(caseId)}/questionnaire/answers`,
    { method: "PATCH", body: JSON.stringify({ fieldId, value, expectedVersion }) },
  );
  assert(result.status === 200 && result.body?.ok === true, `direct ${fieldId} PATCH failed: ${result.status}`);
  return result.body.data;
}

async function clickSection(page, title) {
  const candidate = page.getByRole("button").filter({ hasText: title }).first();
  await candidate.waitFor({ state: "visible", timeout: 10_000 });
  await candidate.click();
}

async function saveButtonForInput(input) {
  const container = input.locator("xpath=..");
  const button = container.getByRole("button", { name: "Сохранить поле" });
  await button.waitFor({ state: "visible", timeout: 10_000 });
  return button;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ru-RU",
  timezoneId: "Asia/Bishkek",
  extraHTTPHeaders: { "x-vercel-protection-bypass": bypass },
});
const page = await context.newPage();

try {
  await login(page);
  const caseId = await resolveCaseId(page);

  // Seed only this dedicated questionnaire through the authenticated client.
  // No practicum, documents, tasks, files, tariff demo accounts or staff data
  // are mutated by this browser-specific proof.
  let seeded = await ensureQuestionnaire(page, caseId);
  seeded = await saveDirect(page, caseId, "fullName", "IBURO STAGING E2E", seeded.version);
  seeded = await saveDirect(page, caseId, "city", "IBURO STAGING E2E", seeded.version);
  assert(seeded.answers.fullName === "IBURO STAGING E2E" && seeded.answers.city === "IBURO STAGING E2E", "questionnaire seed did not persist");

  const questionnaireUrl = new URL(`/portal/cases/${caseId}/questionnaire`, baseUrl).href;
  await page.goto(questionnaireUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });
  await settle(page);
  await page.getByRole("heading", { name: "Анкета" }).first().waitFor({ state: "visible", timeout: 15_000 });

  const birthDate = page.getByLabel("Дата рождения");
  const maritalStatus = page.getByLabel("Семейное положение");
  await birthDate.fill("1990-01-02");
  await maritalStatus.selectOption({ label: "Не состою в браке" });

  const answersPattern = `**/api/platform/cases/${caseId}/questionnaire/answers`;
  let patchCount = 0;
  await page.route(answersPattern, async (route) => {
    patchCount += 1;
    if (patchCount === 2) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { code: "E2E_INJECTED_NETWORK_FAILURE" } }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: /Сохранить и продолжить|Проверить и продолжить/u }).last().click();
  await page.getByRole("alert").waitFor({ state: "visible", timeout: 12_000 });
  assert(patchCount === 2, `partial-failure scenario expected 2 PATCH attempts, got ${patchCount}`);
  assert(
    (await page.getByRole("alert").innerText()).includes("Семейное положение"),
    "partial failure did not identify the failed field",
  );
  assert(await page.getByText("Есть несохранённые ответы", { exact: true }).isVisible(), "partial failure incorrectly reports all data saved");
  assert((await maritalStatus.inputValue()) === "Не состою в браке", "failed field draft was lost after partial failure");

  const afterPartial = await questionnaireState(page, caseId);
  assert(afterPartial.answers.birthDate === "1990-01-02", "first field was not durably saved before injected second failure");
  assert(afterPartial.answers.maritalStatus === undefined, "injected failed field unexpectedly reached the database");

  await page.unroute(answersPattern);
  await page.getByRole("button", { name: /Сохранить и продолжить|Проверить и продолжить/u }).last().click();
  await clickSection(page, "Семья");
  const afterRetry = await questionnaireState(page, caseId);
  assert(afterRetry.answers.birthDate === "1990-01-02", "birthDate disappeared after retry");
  assert(afterRetry.answers.maritalStatus === "Не состою в браке", "maritalStatus did not persist after retry");
  assert(afterRetry.completedSectionIds?.includes("basics"), "Basics section was not completed after retry");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 35_000 });
  await settle(page);
  await clickSection(page, "Основные сведения");
  assert((await page.getByLabel("Дата рождения").inputValue()) === "1990-01-02", "birthDate did not survive reload");
  assert((await page.getByLabel("Семейное положение").inputValue()) === "Не состою в браке", "maritalStatus did not survive reload");

  await clickSection(page, "Семья");
  const children = page.getByLabel("Количество детей");
  await children.fill("2");
  const beforeConflict = await questionnaireState(page, caseId);
  const pageB = await context.newPage();
  await pageB.goto(questionnaireUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });
  await settle(pageB);
  await saveDirect(pageB, caseId, "hasSpouse", false, beforeConflict.version);
  await pageB.close();

  const childrenSave = await saveButtonForInput(children);
  await childrenSave.click();
  await page.getByRole("alert").waitFor({ state: "visible", timeout: 12_000 });
  assert(
    (await page.getByRole("alert").innerText()).includes("другой вкладке"),
    "stale UI mutation did not surface version-conflict guidance",
  );
  assert((await children.inputValue()) === "2", "local draft was lost while resolving version conflict");
  assert(await page.getByText("Есть несохранённые ответы", { exact: true }).isVisible(), "conflict incorrectly reports all data saved");

  await (await saveButtonForInput(children)).click();
  const afterConflictRetry = await questionnaireState(page, caseId);
  assert(afterConflictRetry.answers.hasSpouse === false, "other-tab committed value was lost after conflict refresh");
  assert(afterConflictRetry.answers.childrenCount === 2, "preserved local draft did not save after conflict retry");

  const dependentsYes = page.getByRole("button", { name: "Да" }).last();
  await dependentsYes.click();
  const dependentsFieldset = page.locator("fieldset").filter({ hasText: "Есть другие иждивенцы?" }).first();
  const dependentsSave = dependentsFieldset.getByRole("button", { name: "Сохранить поле" });
  let duplicatePatchCount = 0;
  await page.route(answersPattern, async (route) => {
    duplicatePatchCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await dependentsSave.dblclick({ delay: 20 });
  await page.waitForTimeout(1200);
  await page.unroute(answersPattern);
  assert(duplicatePatchCount === 1, `duplicate click emitted ${duplicatePatchCount} PATCH requests`);

  await clickSection(page, "Основные сведения");
  await page.getByLabel("ФИО").fill("IBURO STAGING E2E UNSAVED");
  await clickSection(page, "Итоговая проверка");
  const completeButton = page.getByRole("button", { name: "Завершить анкету" });
  let completeRequests = 0;
  await page.route(`**/api/platform/cases/${caseId}/questionnaire/complete`, async (route) => {
    completeRequests += 1;
    await route.continue();
  });
  await completeButton.click();
  await page.getByRole("alert").waitFor({ state: "visible", timeout: 10_000 });
  assert((await page.getByRole("alert").innerText()).includes("несохранённые ответы"), "final guard did not report unsaved answers");
  assert(completeRequests === 0, "final guard sent a completion request with unsaved required data");
  await page.unroute(`**/api/platform/cases/${caseId}/questionnaire/complete`);

  console.log("STAGING_QUESTIONNAIRE_BROWSER_E2E_PASS");
} finally {
  await context.close();
  await browser.close();
}
