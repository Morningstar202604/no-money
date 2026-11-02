# Contributing to No Money

Thanks for considering a contribution. This project has an unusually strict data policy, so please read the first section before opening a PR.

[简体中文](CONTRIBUTING.zh-CN.md)

## The one rule that overrides everything

**Never invent a number.**

Every provincial parameter must carry a `source` with:

- `confidence`: `official` | `derived` | `unverified`
- `docNo` and/or `url` when `confidence` is `official`
- `retrievedAt` and `effectiveFrom` where applicable

If you cannot find an authoritative source, set `confidence: "unverified"` and add a `note` explaining what is missing. A labeled placeholder is always better than a plausible wrong number. PRs that add unverifiable figures with `official` confidence will be rejected.

## Development setup

```bash
npm ci
npm run dev
```

Requirements: Node 22+, npm 10+.

## Before you open a PR

```bash
npm run typecheck
npm run typecheck:test
npm test
npm run verify
npm run verify:reality
npm run kb:check
npm run build
```

All seven must pass. CI runs the same commands on Ubuntu with Node 22.

## Code layout

| Directory | Rule |
|---|---|
| `src/domain/` | Pure functions only. No Vue, no `localStorage`, no `fetch`. Money in integer cents. |
| `src/application/` | Orchestration only. No formulas. |
| `src/stores/` | All I/O (fetch, localStorage) lives here. |
| `src/components/`, `src/views/` | Presentation. No business math. |

If you need a calculation, put it in `domain/` and write a unit test for it. If you need data, put it in `public/rules/<city>.json` and let the loader validate it.

## Commit messages

Conventional Commits, imperative mood:

```
feat(tax): add withholding table for platform employees
fix(capacity): correct fatigue discount at 12h+
docs(readme): clarify annual settlement basis
```

Keep commits scoped. Do not mix a refactor with a behavior change.

## Adding a city

1. Add the city to `src/data/cities.ts` with map coordinates.
2. Create `public/rules/<city>.json` following the schema in an existing verified city (e.g. `guangzhou.json`).
3. Fill `sources` for every field. Unknown values → `unverified` with a note.
4. Run `npm test` — `tests/cities.spec.ts` will reject missing provenance or invalid numeric ranges.

## Reporting a bug

Include:

- What you did, what you expected, what happened
- Browser and OS
- If it's a calculation issue: the exact input parameters and the number you got vs expected

Calculation bugs are the highest priority in this project.

## Security

Do not open a public issue for a security problem. See [SECURITY.md](SECURITY.md).
