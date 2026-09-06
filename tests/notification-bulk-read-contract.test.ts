import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const buttonSource = await readFile(
  resolve("components/platform/notifications/MarkAllNotificationsReadButton.tsx"),
  "utf8",
);
const pageSource = await readFile(resolve("app/portal/notifications/page.tsx"), "utf8");
const routeSource = await readFile(
  resolve("app/api/platform/notifications/read-all/route.ts"),
  "utf8",
);
const repositorySource = await readFile(
  resolve("server/repositories/prisma/notification-repository.ts"),
  "utf8",
);
const serviceSource = await readFile(resolve("server/domain/notifications/service.ts"), "utf8");

assert.match(
  buttonSource,
  /Отметить все прочитанными/,
  "notifications inbox must expose the requested bulk-read action copy",
);
assert.match(
  buttonSource,
  /fetch\("\/api\/platform\/notifications\/read-all",\s*\{[\s\S]*?method: "POST"/,
  "bulk-read control must use one dedicated POST request",
);
assert.match(
  buttonSource,
  /min-h-11/,
  "bulk-read control must preserve at least a 44px touch target",
);
assert.doesNotMatch(
  buttonSource,
  /userId/,
  "bulk-read client request must not accept or transmit a user identifier",
);
assert.match(
  pageSource,
  /\{unreadCount \? <MarkAllNotificationsReadButton \/> : null\}/,
  "bulk-read action must only render while visible notifications are unread",
);
assert.match(
  routeSource,
  /export async function POST\(\) \{\s*return adapter\(\)\.markAllRead\(\);\s*\}/,
  "bulk-read API route must delegate through the authenticated notification adapter",
);
assert.match(
  serviceSource,
  /markAllRead\(actor: AuthenticatedActor\)[\s\S]*?repository\.markAllRead\(actor\.userId\)/,
  "bulk-read service must derive notification ownership from the authenticated actor",
);
assert.match(
  repositorySource,
  /async markAllRead\(userId: string\)[\s\S]*?where: \{ userId, readAt: null \}[\s\S]*?data: \{ readAt: new Date\(\) \}/,
  "bulk-read repository must update only unread notifications owned by the current user",
);

console.log("NOTIFICATION_BULK_READ_CONTRACT_PASS");
