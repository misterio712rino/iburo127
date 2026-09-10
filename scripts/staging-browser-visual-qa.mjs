import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = new URL(required("IB_STAGING_BASE_URL"));
const bypass = required("VERCEL_AUTOMATION_BYPASS_SECRET");
const outDir = path.resolve(process.env.RUNNER_TEMP ?? ".", "iburo-browser-visual-evidence");

if (process.env.IB_RUNTIME_TARGET !== "staging") throw new Error("IB_RUNTIME_TARGET must be staging");
if (baseUrl.protocol !== "https:") throw new Error("staging browser QA requires HTTPS");
if (baseUrl.hostname === "iburo127.ru" || baseUrl.hostname.endsWith(".iburo127.ru")) {
  throw new Error("production host is blocked");
}

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-430", width: 430, height: 932, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: false },
  { name: "desktop-1440", width: 1440, height: 1000, mobile: false },
];

const CLIENTS = [
  { plan: "LITE", email: required("IB_STAGING_LITE_EMAIL") },
  { plan: "PRO", email: required("IB_STAGING_PRO_EMAIL") },
  { plan: "INDIVIDUAL", email: required("IB_STAGING_CLIENT_EMAIL") },
];

const checks = [];
const failures = [];
const observations = [];
await mkdir(outDir, { recursive: true });

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function safeName(value) {
  return value.replace(/[^a-z0-9_.-]+/giu, "-").replace(/^-+|-+$/gu, "").toLowerCase();
}

function base32Decode(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/=+$/u, "").replace(/\s+/gu, "");
  let bits = "";
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("invalid base32 TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const input = Buffer.alloc(8);
  input.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(input).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function contextOptions(viewport, storageState) {
  return {
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    locale: "ru-RU",
    timezoneId: "Asia/Bishkek",
    extraHTTPHeaders: { "x-vercel-protection-bypass": bypass },
    ...(storageState ? { storageState } : {}),
  };
}

function observePage(page, scope) {
  page.on("pageerror", (error) => {
    observations.push({ scope, type: "pageerror", message: error.message.slice(0, 600) });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("https://vercel.live/_next-live/feedback/feedback.js")) return;
    observations.push({ scope, type: "console-error", message: text.slice(0, 600) });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    let url;
    try {
      url = new URL(response.url());
    } catch {
      return;
    }
    if (url.origin !== baseUrl.origin) return;
    observations.push({
      scope,
      type: "http-error",
      status: response.status(),
      url: `${url.pathname}${url.search}`.slice(0, 600),
    });
  });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(700);
}

async function waitForVisibleText(page, text, { exact = false, timeout = 12_000 } = {}) {
  const locator = page.getByText(text, { exact });
  const deadline = Date.now() + timeout;
  do {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible()) return candidate;
    }
    await page.waitForTimeout(200);
  } while (Date.now() < deadline);
  throw new Error(`visible text not found: ${JSON.stringify(text)}`);
}

async function hasVisibleText(page, text, { exact = true } = {}) {
  const locator = page.getByText(text, { exact });
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible()) return true;
  }
  return false;
}

async function takeScreenshot(page, label, viewport) {
  const file = `${safeName(label)}--${viewport.name}.png`;
  await page.screenshot({
    path: path.join(outDir, file),
    fullPage: true,
    animations: "disabled",
  });
  checks.push({ kind: "screenshot", label, viewport: viewport.name, file });
}

async function assertNoHorizontalOverflow(page, label, viewport) {
  const geometry = await page.evaluate(() => ({
    rootClient: document.documentElement.clientWidth,
    rootScroll: document.documentElement.scrollWidth,
    bodyClient: document.body?.clientWidth ?? 0,
    bodyScroll: document.body?.scrollWidth ?? 0,
  }));
  if (geometry.rootScroll > geometry.rootClient + 2 || geometry.bodyScroll > geometry.bodyClient + 2) {
    throw new Error(`${label} horizontal overflow at ${viewport.name}: ${JSON.stringify(geometry)}`);
  }
  checks.push({ kind: "overflow", label, viewport: viewport.name, pass: true, geometry });
}

async function openChecked(page, pathname, label, viewport, expectedText) {
  const response = await page.goto(new URL(pathname, baseUrl).href, {
    waitUntil: "domcontentloaded",
    timeout: 35_000,
  });
  if (!response || response.status() >= 500) {
    throw new Error(`${label} navigation failed: ${response?.status() ?? "no response"}`);
  }
  await settle(page);
  if (expectedText) await waitForVisibleText(page, expectedText, { exact: false, timeout: 12_000 });
  await assertNoHorizontalOverflow(page, label, viewport);
  await takeScreenshot(page, label, viewport);
}

async function safeScenario(scope, page, fn) {
  try {
    await fn();
    checks.push({ kind: "scenario", scope, pass: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ scope, message: message.slice(0, 1000) });
    if (page && !page.isClosed()) {
      try {
        const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 };
        await page.screenshot({
          path: path.join(outDir, `failure--${safeName(scope)}--${viewportSize.width}x${viewportSize.height}.png`),
          fullPage: true,
          animations: "disabled",
        });
      } catch {}
    }
  }
}

async function enterIdentifier(page, email, label, viewport) {
  const identifier = page.locator("#identifier");
  const continueButton = page.getByRole("button", { name: "Продолжить" });
  await identifier.waitFor({ state: "visible", timeout: 15_000 });
  await settle(page);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await identifier.click();
    await identifier.fill("");
    await identifier.pressSequentially(email, { delay: 18 });
    await page.waitForTimeout(250);
    if ((await identifier.inputValue()) === email && await continueButton.isEnabled()) return;
    await page.waitForTimeout(450);
  }

  await takeScreenshot(page, `login-${label}-identifier-disabled`, viewport);
  throw new Error(`identifier step did not enable Continue for ${label}; valueLength=${(await identifier.inputValue()).length}`);
}

async function uiLogin(browser, { label, email, password, totpSecret }) {
  const viewport = { name: "auth-desktop", width: 1280, height: 900, mobile: false };
  const context = await browser.newContext(contextOptions(viewport));
  const page = await context.newPage();
  observePage(page, `login/${label}`);
  try {
    await page.goto(new URL("/auth/sign-in", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await page.getByRole("heading", { name: "Вход в приложение" }).waitFor({ state: "visible", timeout: 15_000 });
    await enterIdentifier(page, email, label, viewport);
    if (label === "INDIVIDUAL") await takeScreenshot(page, "sign-in-identifier", viewport);
    await page.getByRole("button", { name: "Продолжить" }).click();

    const passwordInput = page.locator("#password");
    await passwordInput.waitFor({ state: "visible", timeout: 20_000 });
    await passwordInput.click();
    await passwordInput.pressSequentially(password, { delay: 10 });
    const signInButton = page.getByRole("button", { name: "Войти" });
    if (!await signInButton.isEnabled()) throw new Error(`${label} password step did not enable Sign in`);
    await signInButton.click();

    if (totpSecret) {
      await page.waitForURL(/\/auth\/two-factor(?:\?|$)/u, { timeout: 25_000 });
      await page.getByRole("heading", { name: "Подтверждение входа" }).waitFor({ state: "visible", timeout: 15_000 });
      if (label === "LAWYER") await takeScreenshot(page, "staff-two-factor", viewport);
      const secondsInWindow = Math.floor(Date.now() / 1000) % 30;
      if (secondsInWindow >= 27) await page.waitForTimeout((31 - secondsInWindow) * 1000);
      await page.locator("#two-factor-code").fill(totp(totpSecret));
      await page.getByRole("button", { name: "Подтвердить вход" }).click();
    }

    await page.waitForURL(/\/portal(?:\/|$)/u, { timeout: 30_000 });
    await settle(page);
    checks.push({ kind: "ui-login", label, mfa: Boolean(totpSecret), pass: true });
    return await context.storageState();
  } finally {
    await context.close();
  }
}

async function verifyMobileDrawer(page, label, viewport) {
  const trigger = page.getByRole("button", { name: "Открыть меню" });
  await trigger.waitFor({ state: "visible", timeout: 10_000 });
  const controlsId = await trigger.getAttribute("aria-controls");
  if (!controlsId || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(controlsId)) {
    throw new Error(`${label}: menu trigger has no safe aria-controls target`);
  }
  await trigger.click();
  const dialog = page.locator(`#${controlsId}`);
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  if (await dialog.getAttribute("role") !== "dialog") throw new Error(`${label}: controlled drawer is not a dialog`);
  if (await dialog.getAttribute("aria-modal") !== "true") throw new Error(`${label}: controlled drawer is not aria-modal`);
  const accessibleName = await dialog.getAttribute("aria-label");
  if (!accessibleName?.trim()) throw new Error(`${label}: controlled drawer has no accessible name`);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  if (focused !== "Закрыть меню") throw new Error(`${label}: drawer did not focus close control`);
  await takeScreenshot(page, `${label}-mobile-drawer`, viewport);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  const restored = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  if (restored !== "Открыть меню") throw new Error(`${label}: drawer did not restore trigger focus`);
  checks.push({ kind: "mobile-drawer-focus", label, accessibleName, pass: true });
}

async function verifyClientModules(page, fixture, viewport, caseId) {
  const modules = [
    ["practicum", "Практикум"],
    ["questionnaire", "Анкета"],
    ["documents", "Документы"],
    ["files", "Файлы"],
    ["ai", "AI"],
    ["progress", "Прогресс"],
    ["activity", "История"],
  ];
  for (const [segment, expectedText] of modules) {
    await openChecked(
      page,
      `/portal/cases/${caseId}/${segment}`,
      `${fixture.plan.toLowerCase()}-${segment}`,
      viewport,
      expectedText,
    );
  }
  await openChecked(page, `/portal/notifications?caseId=${caseId}`, `${fixture.plan.toLowerCase()}-notifications`, viewport, "Уведом");
  await openChecked(page, `/portal/profile?caseId=${caseId}`, `${fixture.plan.toLowerCase()}-profile`, viewport, "Профил");
  await openChecked(page, `/portal/security?caseId=${caseId}`, `${fixture.plan.toLowerCase()}-security`, viewport, "Безопас");
}

async function verifyClient(browser, fixture, viewport, storageState) {
  const context = await browser.newContext(contextOptions(viewport, storageState));
  const page = await context.newPage();
  observePage(page, `${fixture.plan}/${viewport.name}`);
  try {
    await safeScenario(`${fixture.plan}/${viewport.name}`, page, async () => {
      const response = await page.goto(new URL("/portal", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 35_000 });
      if (!response || response.status() >= 500) throw new Error(`portal navigation failed: ${response?.status() ?? "no response"}`);
      await page.waitForURL(/\/portal\/cases\/[^/]+$/u, { timeout: 25_000 });
      await settle(page);
      const current = new URL(page.url());
      const match = current.pathname.match(/^\/portal\/cases\/([^/]+)$/u);
      if (!match) throw new Error(`${fixture.plan} did not land on a client case`);
      const caseId = match[1];

      await page.locator(`[data-plan="${fixture.plan}"]`).waitFor({ state: "visible", timeout: 15_000 });
      await waitForVisibleText(page, "AI-помощник", { exact: true, timeout: 12_000 });

      if (fixture.plan === "LITE") {
        if (await hasVisibleText(page, "Ваш специалист", { exact: true })) throw new Error("LITE exposes human specialist UI");
        if (await hasVisibleText(page, "Ипотечное жильё", { exact: true })) throw new Error("LITE exposes mortgage UI");
        await waitForVisibleText(page, "Самостоятельно + AI", { exact: true, timeout: 10_000 });
      } else {
        await waitForVisibleText(page, "Ваш специалист", { exact: true, timeout: 10_000 });
        await waitForVisibleText(page, "Ипотечное жильё", { exact: true, timeout: 10_000 });
      }

      await assertNoHorizontalOverflow(page, `${fixture.plan}-dashboard`, viewport);
      await takeScreenshot(page, `${fixture.plan}-dashboard`, viewport);

      if (viewport.name === "mobile-390") await verifyMobileDrawer(page, fixture.plan, viewport);

      if (viewport.name === "desktop-1440" || (fixture.plan === "INDIVIDUAL" && viewport.name === "mobile-390")) {
        await verifyClientModules(page, fixture, viewport, caseId);
      }
    });
  } finally {
    await context.close();
  }
}

async function verifyStaff(browser, role, viewport, storageState) {
  const context = await browser.newContext(contextOptions(viewport, storageState));
  const page = await context.newPage();
  observePage(page, `${role}/${viewport.name}`);
  try {
    await safeScenario(`${role}/${viewport.name}`, page, async () => {
      const response = await page.goto(new URL("/portal", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 35_000 });
      if (!response || response.status() >= 500) throw new Error(`staff portal navigation failed: ${response?.status() ?? "no response"}`);
      await page.waitForURL(/\/portal(?:\/|$)/u, { timeout: 15_000 });
      await page.locator("main").first().waitFor({ state: "visible", timeout: 15_000 });
      if (role === "MANAGER") {
        await waitForVisibleText(page, "Панель руководителя", { exact: true, timeout: 15_000 });
        await page.waitForTimeout(500);
      }
      await assertNoHorizontalOverflow(page, `${role}-dashboard`, viewport);
      await takeScreenshot(page, `${role}-dashboard`, viewport);

      if (viewport.name === "mobile-390" && await page.getByRole("button", { name: "Открыть меню" }).count()) {
        await verifyMobileDrawer(page, role, viewport);
      }

      const caseLinks = page.locator('a[href^="/portal/cases/"]');
      if (await caseLinks.count()) {
        const href = await caseLinks.first().getAttribute("href");
        if (href) await openChecked(page, href, `${role}-case`, viewport);
      }

      await openChecked(page, "/portal/profile", `${role.toLowerCase()}-profile`, viewport, "Профил");
      await openChecked(page, "/portal/notifications", `${role.toLowerCase()}-notifications`, viewport, "Уведом");
      await openChecked(page, "/portal/security", `${role.toLowerCase()}-security`, viewport, "Безопас");
      await openChecked(page, "/portal/tasks", `${role.toLowerCase()}-tasks`, viewport, "Задач");
      if (role === "MANAGER") {
        await openChecked(page, "/portal/leads", `${role.toLowerCase()}-leads`, viewport, "Потенциаль");
      }
    });
  } finally {
    await context.close();
  }
}

async function verifyPublicRecovery(browser, viewport) {
  const context = await browser.newContext(contextOptions(viewport));
  const page = await context.newPage();
  observePage(page, `recovery/${viewport.name}`);
  try {
    await safeScenario(`recovery/${viewport.name}`, page, async () => {
      await openChecked(page, "/auth/forgot-password", "forgot-password", viewport, "Восстанов");
    });
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const clientPassword = required("IB_STAGING_CLIENT_PASSWORD");
  const authStates = new Map();

  for (const fixture of CLIENTS) {
    try {
      authStates.set(fixture.plan, await uiLogin(browser, {
        label: fixture.plan,
        email: fixture.email,
        password: clientPassword,
      }));
    } catch (error) {
      failures.push({ scope: `login/${fixture.plan}`, message: error instanceof Error ? error.message.slice(0, 1000) : String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, 3500));
  }

  await new Promise((resolve) => setTimeout(resolve, 11_000));
  for (const staff of [
    {
      role: "LAWYER",
      email: required("IB_STAGING_LAWYER_EMAIL"),
      password: required("IB_STAGING_LAWYER_PASSWORD"),
      totpSecret: required("IB_STAGING_LAWYER_TOTP_SECRET"),
    },
    {
      role: "MANAGER",
      email: required("IB_STAGING_MANAGER_EMAIL"),
      password: required("IB_STAGING_MANAGER_PASSWORD"),
      totpSecret: required("IB_STAGING_MANAGER_TOTP_SECRET"),
    },
  ]) {
    try {
      authStates.set(staff.role, await uiLogin(browser, {
        label: staff.role,
        email: staff.email,
        password: staff.password,
        totpSecret: staff.totpSecret,
      }));
    } catch (error) {
      failures.push({ scope: `login/${staff.role}`, message: error instanceof Error ? error.message.slice(0, 1000) : String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, 4500));
  }

  for (const viewport of VIEWPORTS) {
    for (const fixture of CLIENTS) {
      const state = authStates.get(fixture.plan);
      if (!state) {
        failures.push({ scope: `${fixture.plan}/${viewport.name}`, message: "skipped because UI login did not produce authenticated storage state" });
        continue;
      }
      await verifyClient(browser, fixture, viewport, state);
    }
  }

  for (const viewport of VIEWPORTS.filter((item) => item.name === "mobile-390" || item.name === "desktop-1440")) {
    for (const role of ["LAWYER", "MANAGER"]) {
      const state = authStates.get(role);
      if (!state) {
        failures.push({ scope: `${role}/${viewport.name}`, message: "skipped because staff UI login/MFA did not produce authenticated storage state" });
        continue;
      }
      await verifyStaff(browser, role, viewport, state);
    }
  }

  await verifyPublicRecovery(browser, VIEWPORTS[0]);
  await verifyPublicRecovery(browser, VIEWPORTS[4]);
} finally {
  await browser.close();
}

const report = {
  pass: failures.length === 0,
  commitSha: process.env.GITHUB_SHA,
  engine: "Chromium 140 via Playwright 1.55.0",
  viewports: VIEWPORTS,
  roles: ["CLIENT", "LAWYER", "MANAGER"],
  plans: ["LITE", "PRO", "INDIVIDUAL"],
  checkCount: checks.length,
  failureCount: failures.length,
  observationCount: observations.length,
  failures,
  observations,
  checks,
};
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`STAGING_BROWSER_VISUAL_QA_SUMMARY: checks=${checks.length} failures=${failures.length} observations=${observations.length}`);
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 30), null, 2));
  process.exitCode = 1;
} else {
  console.log("STAGING_BROWSER_VISUAL_QA_PASS");
}
