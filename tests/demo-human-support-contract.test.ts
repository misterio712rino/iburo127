import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { clientPlanHasHumanSupport } from "@/lib/platform/client-plan-entitlements";

assert.equal(clientPlanHasHumanSupport("LITE"), false);
assert.equal(clientPlanHasHumanSupport("PRO"), true);
assert.equal(clientPlanHasHumanSupport("INDIVIDUAL"), true);
assert.equal(getClientCaseDisplayNumber("IBR-2026-000101"), "Номер дела ещё не присвоен");
assert.equal(getClientCaseDisplayNumber("А40-12345/2026"), "Дело № А40-12345/2026");

const clientPage = await readFile(resolve("app/(platform)/app/client/page.tsx"), "utf8");
const caseOverview = await readFile(resolve("components/platform/dashboard/CaseOverview.tsx"), "utf8");
const selfServiceCard = await readFile(resolve("components/platform/dashboard/SelfServiceCard.tsx"), "utf8");
const lawyerCases = await readFile(resolve("components/platform/lawyer/useLawyerCases.ts"), "utf8");
const lawyerTasks = await readFile(resolve("components/platform/lawyer/LawyerTasks.tsx"), "utf8");
const lawyerActivity = await readFile(resolve("components/platform/lawyer/LawyerActivity.tsx"), "utf8");

assert.match(clientPage, /clientPlanHasHumanSupport\(clientCase\.plan\)/);
assert.match(clientPage, /humanSupportAvailable \? <LawyerCard[\s\S]*: <SelfServiceCard/);
assert.match(clientPage, /getClientCaseDisplayNumber\(clientCase\.caseNumber\)/);
assert.doesNotMatch(clientPage, /Дело № \{clientCase\.caseNumber\}/);
assert.match(caseOverview, /humanSupportAvailable \? \(/);
assert.match(caseOverview, /Формат работы/);
assert.match(caseOverview, /Самостоятельно \+ AI/);
assert.match(selfServiceCard, /Самостоятельно \+ AI/);
assert.match(selfServiceCard, /Без сопровождения специалистом/);
assert.match(selfServiceCard, /href="\/app\/client\/ai"/);
assert.doesNotMatch(selfServiceCard, /Ваш специалист|Анна Орлова|Сопровождает ваше дело|Задать вопрос/);
assert.doesNotMatch(lawyerCases, /alexander-lite/);
assert.match(lawyerCases, /maria-pro/);
assert.match(lawyerCases, /dmitry-individual/);
assert.match(lawyerTasks, /clientPlanHasHumanSupport\(clientCase\.plan\)/);
assert.match(lawyerTasks, /SUPPORTED_LAWYER_CLIENT_IDS\.has\(task\.clientId\)/);
assert.doesNotMatch(lawyerTasks, /DEMO_IDENTITIES\.filter\(\(identity\) => identity\.role === "CLIENT"\)/);
assert.match(lawyerActivity, /supportedCaseNumbers = new Set\(cases\.map/);
assert.match(lawyerActivity, /baseEvents\.filter\(\(event\) => supportedCaseNumbers\.has\(event\.caseNumber\)\)/);

console.log("DEMO_HUMAN_SUPPORT_CONTRACT_TEST_PASS");