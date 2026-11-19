# src/engine — deprecated legacy engines

This directory is the pre-kernel calculation layer. It is **not** the place for new work.

## What is still here

| File | Status | Why it still exists |
|---|---|---|
| `ScenarioEngine.ts` | parity only | Old end-to-end scenario pipeline; used by `tests/parity/*` |
| `IncomeEngine.ts` | parity only | Old income pipeline; used by `tests/parity/*` |
| `TaxEngine.ts` | one panel | `src/components/panels/TaxOptimizer.vue` still calls it |
| `BenefitEngine.ts` | one panel | `src/components/panels/RetirementPlanner.vue` still calls it |

`src/utils/pensionSeries.ts` imports a **type** from `BenefitEngine`; that is type-only and does not
execute the legacy code.

## Allowed importers

Only these production files may import from `src/engine`:

- `src/components/panels/TaxOptimizer.vue`
- `src/components/panels/RetirementPlanner.vue`
- `src/utils/pensionSeries.ts` (type-only)

Tests may import anything here. `tests/architecture.spec.ts` fails if a new production file imports
`src/engine`.

## Rules

1. Do not add a new import from `src/engine` in `views/`, `components/`, `stores/`, `application/`,
   `domain/` or `kernel/`.
2. Do not add a new formula here. New formulas go in `src/domain/` and get a unit test.
3. Do not delete a legacy engine while its parity test still exists. The parity test is the guard
   that proves the new domain path produces the same answer; remove the test only after the panel
   has migrated and the parity coverage is replaced by a domain-level regression.
4. If you migrate one of the two panels, update this file and `tests/architecture.spec.ts` in the
   same commit.

## Removal plan

1. Migrate `TaxOptimizer` to `domain/tax/*` (annual settlement + withholding + sole proprietorship).
2. Migrate `RetirementPlanner` to `domain/benefit/*`; move the `pensionSeries` type into `domain/`.
3. Delete the corresponding parity cases and record the before/after numbers in the commit message.
4. Delete `ScenarioEngine.ts` / `IncomeEngine.ts`, then this directory.
