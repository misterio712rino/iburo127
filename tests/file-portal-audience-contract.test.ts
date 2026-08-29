import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const filesPageSource = await readFile(
  resolve("app/portal/cases/[caseId]/files/page.tsx"),
  "utf8",
);
const filesComponentSource = await readFile(
  resolve("components/platform/files/ProductionFiles.tsx"),
  "utf8",
);

assert.match(filesPageSource, /const canUpload = audience === "CLIENT"/);
assert.match(filesPageSource, /canUpload=\{canUpload\}/);
assert.match(filesPageSource, /Сотруднику доступны только файлы, которые завершили проверку безопасности/);

assert.match(filesComponentSource, /canUpload:\s*boolean/);
assert.match(filesComponentSource, /if \(!canUpload \|\| uploading\) return/);
assert.match(filesComponentSource, /\{canUpload \? \(/);
assert.match(filesComponentSource, /Режим просмотра сотрудника/);
assert.match(filesComponentSource, /Загрузка новых файлов выполняется клиентом/);
assert.match(filesComponentSource, /\/api\/platform\/files\/\$\{fileId\}\/download/);

const uploadControlIndex = filesComponentSource.indexOf("Добавить файл в дело");
const canUploadBranchIndex = filesComponentSource.indexOf("{canUpload ? (");
assert.ok(canUploadBranchIndex >= 0 && uploadControlIndex > canUploadBranchIndex);

console.log("FILE_PORTAL_AUDIENCE_CONTRACT_PASS");
