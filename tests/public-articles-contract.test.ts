import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("app/(public)/articles/page.tsx"), "utf8");

assert.match(source, /robots:\s*\{[\s\S]*?index:\s*false,[\s\S]*?follow:\s*false/);
assert.match(source, /Материал готовится/);
assert.match(source, /редакционной и юридической проверки/);
assert.doesNotMatch(
  source,
  /<button[\s\S]*?>[\s\S]*?Читать статью[\s\S]*?<\/button>/,
  "unfinished article cards must not expose dead read controls",
);
assert.doesNotMatch(
  source,
  /href=["'][^"']*articles\//,
  "unfinished article cards must not advertise missing detail routes",
);

console.log("PUBLIC_ARTICLES_CONTRACT_TEST_PASS");
