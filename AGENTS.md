# AGENTS.md

Instructions for AI coding agents working on this repository.
Read this before making changes. It is the single source of truth for how this project is built.

## What this project is

A calculator for China's gig workers: what a job actually pays after costs, tax and social insurance.
Runs entirely client-side in the browser. No backend, no account, no telemetry.

**The product is a trust product.** Users make rent decisions with these numbers. A wrong number is worse than a missing feature.

## Commands

```bash
npm ci                    # install
npm run dev               # web dev server (port 3000)
npm test                  # 1000+ unit tests
npm run typecheck         # source typecheck
npm run typecheck:test    # test typecheck
npm run verify            # engine identity self-check
npm run verify:reality    # data reality check
npm run kb:check          # knowledge base sync check
npm run build             # typecheck + production build
npm run test:e2e          # 50 Playwright tests (desktop + mobile)
npm run cli -- --help     # CLI
npm run mcp               # MCP server (stdio)
npm run api               # HTTP API (port 8787)
```

All of `typecheck`, `typecheck:test`, `test`, `verify`, `verify:reality`, `kb:check`, `build` must pass before a commit.

## Architecture

```
src/
├── domain/        Pure functions. No Vue, no DOM, no network, no localStorage.
├── application/   Orchestration. No formulas.
├── kernel/        Public calculation contract — used by CLI, MCP, API and Web.
├── stores/        Pinia. All browser I/O lives here.
├── components/    UI
└── views/         Five pages

cli/               Command line entry
mcp/               MCP server (stdio transport)
server/            HTTP API (Node native http)
```

**Dependency direction is one-way:** `views → components → stores → application → domain`.
`kernel/` sits on top of `application/` and is imported by every non-Web entry point.

### The kernel rule

Any new entry point (CLI subcommand, MCP tool, API route) MUST call `src/kernel/calculate.ts`.
Never re-implement a formula in an entry point. Two implementations means two answers for the same input,
and that class of bug is nearly impossible to find because each entry point tests green on its own.

## Data policy — the rule that overrides everything

**Never invent a number.**

Every city parameter in `public/rules/*.json` carries a `sources` entry with a `confidence` level:

| Level | Meaning |
|---|---|
| `official` | Traced to a government document. Must have `docNo` and/or `url`. |
| `derived` | Computed from official figures, not directly published. |
| `unverified` | No authoritative source. Placeholder only. |

When a calculation depends on an `unverified` field, the UI must say so and must not present
the result as a decision-ready conclusion.

Platform per-order pricing is **never** `official`. It is a commercial term with no cross-platform
authority. Only the user's own rate can be treated as real.

`tests/cities.spec.ts` enforces this. Adding a city without provenance fails the build.

## Money and units

- Inside `src/domain/`: integer **cents** (`Cent` type). No floats.
- At every boundary (component, store, kernel output, API response): **yuan** with 2 decimals.
- Conversion happens in exactly two adapter files. Do not add a third.

## Testing rules

- Domain math: every formula needs a test, including boundary and degenerate input.
- **Never test by regex-matching source text.** A test that reads a `.vue` file and asserts
  `/width: min\(360px/` passes when you rename the class and ships a broken layout.
  Mount the component and assert on rendered output instead.
- E2E covers real user paths only: can the user complete the task? Not "does the div exist".
- Every bug fix gets a regression test that fails before the fix.

## UI rules

- All colors come from CSS custom properties in `src/styles/variables.css`.
  Never hardcode a hex value in a component — it breaks the other theme.
- Default theme is **light**. Dark is opt-in and persisted in `localStorage`.
- Every animation must respect `prefers-reduced-motion`.
- Keyboard: `⌘K`/`Ctrl+K` opens the command palette. New interactive surfaces should be keyboard reachable.
- Contrast: body text must meet WCAG AA (4.5:1). Verify with a real measurement, not by eye.

## Commit conventions

Conventional Commits, imperative mood:

```
feat(tax): add withholding table for platform employees
fix(capacity): correct fatigue discount at 12h+
docs(readme): clarify annual settlement basis
```

Keep commits scoped. Never mix a refactor with a behavior change.

## Release

See `docs/VERSIONING.md`. Three files carry the version (`package.json`, `tauri.conf.json`, `Cargo.toml`);
`node scripts/bump-version.mjs X.Y.Z` updates all three.

## What not to do

- Do not add a backend to the web app. The no-backend promise is a product feature, not an oversight.
  The `server/` directory is a separate, optional, read-only API — it stores nothing.
- Do not add analytics, telemetry, error reporting services, or third-party scripts.
- Do not add a dependency for something the platform already does (see `server/api.ts` — Node's
  native `http` is used instead of Express, deliberately).
- Do not commit `dist/`, `src-tauri/target/`, `test-results/`, or credentials.
- Do not "fix" the fatigue discount. Increasing hours without increasing orders lowers net income
  **by design** — the user is working more for the same output.
