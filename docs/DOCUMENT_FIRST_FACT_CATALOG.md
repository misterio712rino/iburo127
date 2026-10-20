# Document-first fact catalog (draft)

This catalog is an engineering crosswalk from the current questionnaire and internal source drafts to the three planned outputs. It is not a legal checklist and does not define which fields are legally sufficient. A product owner and Russian insolvency counsel must approve the final field set and source-document policy before extraction rules or templates are treated as complete.

## What the application captures today

| Output | Existing questionnaire facts | Current limitation |
|---|---|---|
| Bankruptcy application | Name, city, total debt, approximate creditor count, monthly income, real-estate yes/no; also birth date, family status, income source, overdue/enforcement flags | No registered address or identity-document details; no creditor-by-creditor breakdown; no verified legal grounds, court destination, or evidence checklist |
| Property inventory | Real-estate/vehicle/valuables yes/no; some conditional type, share, estimated value, mortgage, model/year and notes | Not a complete itemized register; no stable identity/location for each object, title/source reference, encumbrance details per object, or valuation date/source |
| Creditors list | Approximate creditor count, aggregate debt, overdue yes/no, enforcement yes/no | No creditor names, addresses/identifiers, contract or account references, separate principal/interest/penalty amounts, claim dates, or debtor receivables |

The existing source-draft.ts emits internal summaries from these questionnaire values. Those summaries are not the three final legal documents and must not be presented as court-ready output.

## Candidate fact groups to approve

All values extracted from uploaded documents remain untrusted candidates with source file/page provenance and NEEDS_REVIEW status until a client or authorized staff member confirms them.

The candidate contract has a `recordKey` for keeping fields in repeated rows together within one source file. The explicit-label extractor recognizes a monthly income only when explicitly labeled as monthly and followed by a ruble amount. For OCR lines with coordinates, it can also associate exact labels for full name, birth date, monthly income, and overall debt with one nearby value that passes a strict format check; missing coordinates, multiple plausible values, or repeated labels leave the field unextracted. It recognizes creditor names on lines such as `Кредитор №1: ...` or `Наименование кредитора: ...`, and captures a ruble balance only when the amount label repeats the same explicit creditor number, for example `Сумма задолженности кредитора №1: ...`; this avoids attaching a document-wide balance to an individual creditor. It also recognizes an explicitly numbered `Имущество №1: ...` / `Объект имущества №1: ...` with a uniquely numbered address, ownership, pledgee, and value label. These candidates remain `NEEDS_REVIEW`. Income source, period, and whether an amount is gross or net are not inferred. The extractor does not split creditor principal, interest, overdue balance, or penalties; if a row contains multiple matching balances, it omits the amount. For property, it does not verify title or valuation, distinguish market from cadastral value, or infer omitted assets. Records on different pages or in other files are not reconciled, and arbitrary unlabeled/ambiguous layouts remain unextracted. Debtor contact fields and broad identity extraction are still not implemented.

The documents page can request a separate preview summary for the bankruptcy application, property inventory, or creditor list. This server query only includes candidates in `CONFIRMED` whose source file remains `READY`, then applies a document-specific field allowlist and includes source filename/page citations. Pending or rejected candidates are excluded. The preview is generated from the current confirmed-fact rows and is not an immutable revision, legal form, DOCX, or PDF. Draft generation through registered document templates and wiring facts into that revision flow remain outstanding.

| Group | Candidate fields for product/legal review | Likely evidence types (confirm before use) |
|---|---|---|
| Debtor identity | Full name, birth date, taxpayer/insurance identifiers, identity document details | Passport or other identity record, official certificates |
| Debtor contact | Registered and actual address, phone, email | Registration/contact evidence |
| Income | Payer/employer, income type, period, gross/net amount, currency, source date | Employer, tax, pension, benefit or bank records |
| Creditor claim | Creditor name and identifiers, contract/account reference, balance split by claim type, balance date, overdue/enforcement state, source reference | Creditor statements, contracts, court/enforcement records |
| Property item | Item category, description, address or registry identifier, ownership/share, estimated value and date, lien/pledge/mortgage | Title/registry, vehicle, valuation and secured-loan records |
| Receivable | Debtor owed to the applicant, amount, due date and evidence | Contract, court or account records |

These groups are prompts for review, not a closed schema. Do not infer negative facts (for example, “no assets” or “no other creditors”) from documents that simply do not mention them.

## Draft-generation gate

1. Approve the required field groups, jurisdiction-specific wording, templates and acceptable evidence with counsel and product.
2. Map each approved field to a typed fact path, validation rule, provenance display and the document sections that consume it.
3. Generate only from confirmed facts. Preserve missing/ambiguous items as explicit questions or placeholders; never fill them from OCR guesses.
4. Keep application, inventory and creditor-list drafts marked as drafts until an authorized legal reviewer approves them.
5. Test with synthetic examples covering conflicting statements, multiple creditors/assets, stale balances, low-quality scans and missing pages.

No template or source-document mapping in this draft authorizes legal advice, filing, or production processing.
