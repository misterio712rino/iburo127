import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const filesPageSource = await readFile(
  resolve("app/portal/cases/[caseId]/files/page.tsx"),
  "utf8",
);
const staffFilesComponentSource = await readFile(
  resolve("components/platform/files/ProductionFiles.tsx"),
  "utf8",
);
const clientFilesComponentSource = await readFile(
  resolve("components/platform/files/IBuroFilesV2.tsx"),
  "utf8",
);

assert.match(filesPageSource, /const audience = resolveCasePortalAudience\(actor, clientCase\)/, "file route must remain server-authoritative about CLIENT vs STAFF audience");
assert.match(filesPageSource, /if \(audience === "STAFF"\)/, "file route must keep a dedicated STAFF branch");
assert.match(filesPageSource, /<ProductionFiles caseId=\{clientCase\.id\} canUpload=\{false\} initialFiles=\{fileViews\} \/>/, "STAFF must never receive the upload-capable client presentation");
assert.match(filesPageSource, /<IBuroFilesV2 caseId=\{clientCase\.id\} initialFiles=\{fileViews\} \/>/, "CLIENT must use the dedicated UI v2 file presentation");
assert.match(filesPageSource, /clientCaseService\.getCase\(actor, \{ caseId \}\)/, "file route must authorize the requested case before rendering either audience");
assert.match(filesPageSource, /Сотруднику доступны только файлы, которые завершили проверку безопасности/);

assert.match(staffFilesComponentSource, /canUpload:\s*boolean/);
assert.match(staffFilesComponentSource, /if \(!canUpload \|\| uploading\) return/);
assert.match(staffFilesComponentSource, /\{canUpload \? \(/);
assert.match(staffFilesComponentSource, /Режим просмотра сотрудника/);
assert.match(staffFilesComponentSource, /Загрузка новых файлов выполняется клиентом/);
assert.match(staffFilesComponentSource, /\/api\/platform\/files\/\$\{fileId\}\/download/);

assert.match(clientFilesComponentSource, /MAX_UPLOAD_BYTES = 50 \* 1024 \* 1024/);
assert.match(clientFilesComponentSource, /fetch\(`\/api\/platform\/cases\/\$\{caseId\}\/files`/);
assert.match(clientFilesComponentSource, /method: "POST"/, "CLIENT UI v2 must preserve the real case-scoped upload preparation request");
assert.match(clientFilesComponentSource, /\/api\/platform\/files\/\$\{prepared\.data\.fileId\}\/complete/, "CLIENT UI v2 must preserve upload completion through the protected file endpoint");
assert.match(clientFilesComponentSource, /\/api\/platform\/files\/\$\{fileId\}\/download/, "CLIENT UI v2 must preserve protected downloads");
assert.match(clientFilesComponentSource, /multiple/, "client must be able to select multiple documents");
assert.match(clientFilesComponentSource, /Array\.from\(event\.target\.files \?\? \[\]\)/, "all selected files must be passed to the uploader");
assert.match(clientFilesComponentSource, /await uploadOne\(file\)/, "uploads must be processed sequentially");
assert.match(clientFilesComponentSource, /setUploadProgress\(\{ current: index \+ 1, total: validFiles\.length \}\)/, "the interface must report upload progress");

const uploadControlIndex = clientFilesComponentSource.indexOf("Передайте документы в дело");
const uploadFunctionIndex = clientFilesComponentSource.indexOf("async function upload(selectedFiles: readonly File[])");
assert.ok(uploadFunctionIndex >= 0 && uploadControlIndex > uploadFunctionIndex, "CLIENT upload control must remain backed by the real upload function");

console.log("FILE_PORTAL_AUDIENCE_CONTRACT_PASS");
