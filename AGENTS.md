# AGENTS.md

Instructions for AI coding agents working on this repository.
Read this before making changes. It is the single source of truth for how this project is built.

## What this project is

**A rights-navigation and public-service guide for workers in China** — what to do, what to claim,
and where to do it. The income / tax / social-insurance / compensation calculator is **one tool inside
the platform**, not the product's whole identity. The AI assistant is auxiliary.

The canonical product direction is [`docs/POSITIONING.md`](docs/POSITIONING.md); the current scope,
content model and data discipline are in [`docs/REALITY-AND-SCOPE.md`](docs/REALITY-AND-SCOPE.md).
Read both before changing IA, copy, or content.

Runs entirely client-side in the browser. No backend, no account, no telemetry.

**The product is a trust product.** Users make rent and rights decisions with these numbers.
A wrong number is worse than a missing feature.

## Commands

```bash
npm ci                    # install
npm run dev               # web dev server (port 3000)
npm test                  # 1,100+ unit/parity/component tests
npm run typecheck         # source typecheck
npm run typecheck:test    # test typecheck
npm run verify            # engine identity self-check
npm run verify:reality    # data reality check
npm run kb:check          # knowledge base sync check
npm run verify:entrypoints# CLI / API / MCP / Web share one kernel
npm run build             # typecheck + production build
npm run doctor            # cross-cutting health check (bundle, docs, PWA, data)
npm run test:e2e          # 100 Playwright tests (desktop + mobile)
npm run cli -- --help     # CLI
npm run mcp               # MCP server (stdio)
npm run api               # HTTP API (port 8787)
```

All of `typecheck`, `typecheck:test`, `test`, `verify`, `verify:reality`, `kb:check`,
`verify:entrypoints`, `build`, `doctor` must pass before a commit. CI runs the same commands.

## Architecture

```
src/
├── domain/        Pure functions. No Vue, no DOM, no network, no localStorage.
├── application/   Orchestration. No formulas.
├── kernel/        Public calculation contract — used by CLI, MCP, API and Web.
├── stores/        Pinia. All browser I/O lives here.
├── components/    UI
└── views/         Eight pages (dashboard, scenario, planning, rights, policy, audit, admin, 404)

cli/               Command line entry
mcp/               MCP server (stdio transport)
server/            HTTP API (Node native http)
src/engine/        Legacy engines — deprecated, allowed importers only (see below)
```

**Dependency direction is one-way:** `views → components → stores → application → domain`.
`kernel/` sits on top of `application/` and is imported by every non-Web entry point.

### The kernel rule

Any new entry point (CLI subcommand, MCP tool, API route) MUST call `src/kernel/calculate.ts`.
Never re-implement a formula in an entry point. Two implementations means two answers for the same input,
and that class of bug is nearly impossible to find because each entry point tests green on its own.

`tests/architecture.spec.ts` enforces this and the module boundaries below.

### Legacy engine rule

`src/engine/*` is retained only for parity tests and two panels that have not migrated yet
(`TaxOptimizer`, `RetirementPlanner`; `pensionSeries` imports a type). **Do not add new imports**
from `src/engine` in views/components/stores/application/domain. New work goes in `src/domain` +
`src/application`. Removing the legacy path requires deleting the parity test first — see
[`src/engine/README.md`](src/engine/README.md).

## Data policy — the rule that overrides everything

**Never invent a number.**

City rules in `public/rules/*.json` carry a `sources` entry with a `confidence` level:

| Level | Meaning |
|---|---|
| `official` | Traced to a government document. Must have `docNo` and/or `url`. |
| `derived` | Computed from official figures, not directly published. |
| `unverified` | No authoritative source. Placeholder only. |

When a calculation depends on an `unverified` field, the UI must say so and must not present
the result as a decision-ready conclusion.

Platform per-order pricing is **never** `official`. It is a commercial term with no cross-platform
authority. Only the user's own rate can be treated as real.

Rights/benefit content uses a fourth level — `platform` — for the app's own estimates. It must never
appear in a "wage" or "benefit" card; only inside the calculator with a visible "平台测算，非官方" label.
Every content item also carries `lastVerified`; stale items are re-labelled "待复核", not silently kept.

`tests/cities.spec.ts` enforces the rule files; `npm run doctor` checks README/data consistency.

## Money and units

- Inside `src/domain/`: integer **cents** (`Cent` type). No floats.
- At every boundary (component, store, kernel output, API response): **yuan** with 2 decimals.
- Conversion happens in `application/adapters/ruleAdapters.ts` and at the `ScenarioService`
  result boundary. Do not add another conversion point in a component or view.

## Performance and loading budgets

- First-screen JS ≤ **500K gzip**; total `dist` ≤ **5 MB**; PWA precache ≤ **3 MB**.
- ECharts must stay lazy (route-level chunk), never in the first-screen bundle.
- Views are route-lazy; heavy optional panels should be lazy too.
- Sub-path deployment (`VITE_BASE=/app/`) must work for routes, assets, PWA `start_url`/`scope`
  and `navigateFallback`. Use `%BASE_URL%` in `index.html`, not hardcoded `/`.
- PWA: app shell precached; `rules/*.json` and `knowledge/*.json` use StaleWhileRevalidate;
  no user data cached.
- Chunk-load failure must show a refresh prompt (`src/app/router.ts` + `src/main.ts`).

Run `npm run build && npm run doctor` after any change that touches imports, chunks or `index.html`.

## Testing rules

- Domain math: every formula needs a test, including boundary and degenerate input.
- Prefer mounting a component and asserting rendered output over regex-matching source text.
  A test that reads a `.vue` file and asserts `/width: min\(360px/` passes when you rename the class
  and ships a broken layout.
- **Narrow exception:** source-text assertions are allowed only for static wiring/config contracts
  that cannot be meaningfully mounted (route table, tab whitelist, store silent-failure, import
  boundaries). They must be narrow, documented, and must not assert visual layout.
- E2E covers real user paths only: can the user complete the task? Not "does the div exist".
- Every bug fix gets a regression test that fails before the fix.

## UI rules

- All colors come from CSS custom properties in `src/styles/variables.css`.
  Never hardcode a hex value in a component — it breaks the other theme.
- Default theme is **light**. Dark is opt-in and persisted in `localStorage`.
- Every animation must respect `prefers-reduced-motion`.
- Keyboard: `⌘K`/`Ctrl+K` opens the command palette. New interactive surfaces should be keyboard reachable.
- Contrast: body text must meet WCAG AA (4.5:1). Verify with a real measurement, not by eye.
- Copy: use plain language ("按哪个工资档交钱"), not policy jargon. No "一键办理", "包过",
  "必领", "月入过万", "内部渠道".

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

- Do not describe the product as a "gig-worker income calculator" in package/index/PWA/OG metadata.
  The calculator is a tool; the platform is rights navigation. See `docs/POSITIONING.md`.
- Do not invent a number, document number, deadline or official link.
- Do not add a backend to the web app. The no-backend promise is a product feature, not an oversight.
  The `server/` directory is a separate, optional, read-only API — it stores nothing.
- Do not add analytics, telemetry, error reporting services, or third-party scripts.
- Do not add a dependency for something the platform already does (see `server/api.ts` — Node's
  native `http` is used instead of Express, deliberately).
- Do not commit `dist/`, `src-tauri/target/`, `test-results/`, or credentials.
- Do not "fix" the fatigue discount. Increasing hours without increasing orders lowers net income
  **by design** — the user is working more for the same output.
