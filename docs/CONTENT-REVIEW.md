# Content review and intake

This project publishes rights guidance, not policy commentary. A wrong amount or an expired deadline can cost a user real money, so content changes follow the same gate as code.

## Cadence

| When | What | Who | Output |
|---|---|---|---|
| Every Friday | New-item intake: collect user questions, official notices, and broken links from the week | Maintainer | Triage list; only items with a primary source move forward |
| Every month | Link and freshness check: `npm run freshness:check` plus the monthly GitHub workflow | Maintainer / CI | An issue when any source is older than 365 days or a URL is dead |
| Every quarter | Policy review: re-read the highest-traffic items and every city whose rules changed | Reviewer | Updated `lastVerified`, source URL, and `CHANGELOG.md` note |
| Every year | Archive: snapshot the previous year's rules and note which items were retired | Maintainer | `docs/archive/` entry; no silent deletion |

## Adding a rights item

1. **Start from a user's words.** Write the question as the user asks it, not as a statute title. Example: “老板不发工资，我该先找谁？” not “劳动保障监察若干规定适用情形”.
2. **Find the primary source.** A government site, a ministerial document, or an official service page. A news article or a screenshot is a lead, not a source.
3. **Fill the `RightsItem` fields.** Every item needs:
   - `title`, `oneLiner`, `whatToDo` (one action per step), `whereToGo`
   - `officialUrl` when an official entry exists
   - `deadline` when a legal time limit exists
   - `confidence` and `lastVerified`
   - `materials` if the user must bring documents
4. **Do not invent a number.** If the amount or deadline is local, leave the amount out and write “以当地标准为准”. A labeled `unverified` field is better than a confident wrong one.
5. **Add it to a template only when it belongs there.** Templates are ordered by “what to do first”, not by category. Put the item in `src/data/rights/templates.ts` only if it is part of that real sequence.
6. **Run the gate.**

```bash
npm run typecheck:test
npm test
npm run verify:reality
npm run kb:check
npm run build
npm run doctor
```

7. **Review sign-off.** A second person checks:
   - the link opens and is the official page, not a repost
   - the document number matches the page
   - the deadline is stated as a rule, not a guess
   - the wording says “可以主张 / 可能适用”, never “一定能领”
   - the item does not promise agency, payment, or a legal outcome

## What gets rejected

- A number with no source, or a source that is a news summary.
- A national rule presented as a local standard.
- A deadline copied from another province.
- A template item that is not part of the real sequence, just to make the list longer.
- A “reviewed” date that was not actually checked.

## Reviewer checklist

- [ ] Primary source opens; title and doc number match
- [ ] `official` / `derived` / `unverified` is honest
- [ ] Deadline has a legal basis and a plain-language explanation
- [ ] Official entry is the service page, not a search result
- [ ] No amount, document number, phone, or link is invented
- [ ] Template order still answers “what do I do first?”
- [ ] `npm run doctor` passes and the new link is reachable
