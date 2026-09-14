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

const reviewsPageSource = await readFile(resolve("app/(public)/reviews/page.tsx"), "utf8");
const reviewsPreviewSource = await readFile(resolve("components/sections/ReviewsPreview.tsx"), "utf8");

assert.match(
  reviewsPageSource,
  /robots:\s*\{[\s\S]*?index:\s*false,[\s\S]*?follow:\s*false/,
  "unverified public reviews must remain noindex/nofollow",
);
for (const requiredPhrase of [
  "Публикуем только",
  "подтверждённые отзывы",
  "не публикуем неподтверждённые истории",
  'href="/contacts"',
]) {
  assert.ok(
    reviewsPageSource.includes(requiredPhrase),
    `reviews page must preserve transparent fail-closed wording: ${requiredPhrase}`,
  );
}
for (const forbiddenClaim of [
  "Александр",
  "Ирина",
  "Дмитрий",
  "Елена",
  "Максим",
  "Ольга",
  "Самая лучшая оценка нашей работы",
  "реальные истории людей",
]) {
  assert.ok(
    !reviewsPageSource.includes(forbiddenClaim),
    `reviews page must not present unverified testimonial content: ${forbiddenClaim}`,
  );
}
assert.ok(
  reviewsPreviewSource.includes("Мы не используем неподтверждённые истории как реальные отзывы"),
  "homepage reviews preview must explain verification policy",
);
for (const forbiddenPreviewClaim of [
  "Александр",
  "Ирина",
  "Дмитрий",
  "Каждый отзыв — это история человека",
  "Нам доверяют люди",
]) {
  assert.ok(
    !reviewsPreviewSource.includes(forbiddenPreviewClaim),
    `homepage must not present unverified testimonial content: ${forbiddenPreviewClaim}`,
  );
}

console.log("PUBLIC_ARTICLES_CONTRACT_TEST_PASS");
