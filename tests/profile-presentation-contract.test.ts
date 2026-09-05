import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const profilePageSource = await readFile(resolve("app/portal/profile/page.tsx"), "utf8");
const editorSource = await readFile(resolve("components/platform/account/ProfileAccountEditor.tsx"), "utf8");
const accountOperationsSource = await readFile(resolve("server/account/operations.ts"), "utf8");
const avatarSource = await readFile(resolve("server/account/avatar.ts"), "utf8");
const avatarRouteSource = await readFile(resolve("app/api/platform/account/avatar/route.ts"), "utf8");
const profileRouteSource = await readFile(resolve("app/api/platform/account/profile/route.ts"), "utf8");

assert.match(profilePageSource, /getCurrentAccountProfile\(sessionProvider\)/);
assert.match(profilePageSource, /getCurrentAccountAvatarUrl\(sessionProvider\)/);
assert.match(profilePageSource, /listAccessibleClientCases\(sessionProvider\)/);
assert.match(profilePageSource, /<ProfileAvatarEditor avatarUrl=\{avatarUrl\} \/>/);
assert.match(profilePageSource, /<ProfileDisplayNameEditor displayName=\{displayName\} \/>/);
assert.match(profilePageSource, /<IBuroClientShellV2[\s\S]*caseId=\{selectedClientCase\.id\}[\s\S]*cases=\{caseOptions\}/);
assert.match(profilePageSource, /<PortalFrame sectionLabel="Профиль" showStaffTasks=\{isStaff\}>/);
assert.doesNotMatch(profilePageSource, /ClientPlanVisualStyles|<ClientCaseFrame/);
assert.match(profilePageSource, /grid min-w-0 gap-5/);
assert.match(profilePageSource, /Контактные данные/);
assert.match(profilePageSource, /min-h-11/);
assert.doesNotMatch(profilePageSource, /localStorage|lib\/platform\/demo|DEMO_/i);

assert.match(editorSource, /fetch\("\/api\/platform\/account\/avatar"/);
assert.match(editorSource, /fetch\("\/api\/platform\/account\/profile"/);
assert.match(editorSource, /image\/jpeg", "image\/png", "image\/webp/);
assert.match(editorSource, /5 \* 1024 \* 1024/);
assert.match(editorSource, /hover:opacity-100/);
assert.match(editorSource, /focus-visible:opacity-100/);
assert.match(editorSource, /sm:flex/);
assert.match(editorSource, /sm:hidden/);
assert.match(editorSource, /aria-label=\{avatarUrl \? "Изменить фотографию профиля" : "Добавить фотографию профиля"\}/);
assert.match(editorSource, /aria-busy=\{pending\}/);
assert.doesNotMatch(editorSource, /localStorage|lib\/platform\/demo|DEMO_/i);

assert.match(accountOperationsSource, /requireServerActor\(sessionProvider\)/);
assert.match(accountOperationsSource, /where: \{ id: actor\.userId \}/);
assert.match(avatarSource, /requireServerActor\(sessionProvider\)/);
assert.match(avatarSource, /avatarObjectKeyForUser\(actor\.userId\)/);
assert.match(avatarSource, /allowOverwrite: true/);
assert.doesNotMatch(avatarSource, /avatarObjectKeyForUser\(session\.user\.id\)/);
assert.match(profileRouteSource, /readBoundedJsonBody/);
assert.match(profileRouteSource, /privateJsonResponse/);
assert.match(avatarRouteSource, /createCurrentAccountAvatarDownload\(sessionProvider\)/);
assert.match(avatarRouteSource, /readBinaryBodyWithByteLimit/);
assert.match(avatarRouteSource, /privateResponse/);
assert.match(avatarRouteSource, /MAX_AVATAR_SIZE_BYTES = 5 \* 1024 \* 1024/);

console.log("PROFILE_PRESENTATION_CONTRACT_PASS");
