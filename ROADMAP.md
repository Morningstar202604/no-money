# Roadmap

This is a working roadmap, not a promise. Priorities shift when real user feedback arrives —
especially data corrections, because a wrong policy number is worse than a missing feature.

Version format: `MAJOR.MINOR.PATCH` ([SemVer 2.0.0](https://semver.org/)).
See [docs/VERSIONING.md](docs/VERSIONING.md) for what each segment means here.

---

## Where we are now

**3.5.0** is the current baseline. The product direction is settled — a rights-navigation and
public-service guide for workers — and the first P0 slice is shipped:

- [docs/POSITIONING.md](docs/POSITIONING.md) — one-sentence positioning, audience, three questions,
  IA v2, content model, P0/P1/P2, explicit non-goals
- [docs/REALITY-AND-SCOPE.md](docs/REALITY-AND-SCOPE.md) — 12 real-world blockers, 8 paths,
  60+ rights inventory, L1/L2/L3 standard, four home entries, 3-step onboarding, nine-section
  content template, four-level confidence, assistant + 7 templates, policy anchors

**What is shipped:** `/start` with four entries; a 3-step wizard; a 32-item `RightsItem` catalog
(23 migrated + 9 new); home four-card block; nav entry; content tests. The calculator and all routes
still work.

**What is not done yet:** the full six-section nav reorder, checklist progress/favorites, identity-aware
calculation, 30 L2 items and 10 deep-verified cities. Those are 3.6.0 / 3.7.0.

---

## 3.5.0 — Rights navigation P0 (shipped 2026-11-19)

**Goal: a first-time worker can open the app, pick a city and a situation, and get a 3–7 item
checklist with an official entry point for each item.**

- [x] Home: four large entries — 我该做什么 / 我能拿什么 / 社保医保怎么办 / 遇到麻烦怎么办;
      "算一算" and "问一句" move below the four cards
- [x] First-visit 3-step wizard: city → identity/life stage → what you want to solve;
      no registration, no ID number, no salary required
- [x] Checklist model: `RightsItem` with `whatToDo`, `whatToGet`, `whereToGo`, `deadline`,
      `materials`, `confidence`, `lastVerified`, `officialUrl`
- [x] Migrate the 23 existing `livingGuide` entries into the new model; add 9 high-frequency
      items (公积金、生育津贴、高温津贴、灵活就业社保补贴、异地就医、退休办理、失业金、工伤认定、欠薪取证)
- [x] Keep the existing calculator and all 8 routes working; the four entries link into them rather
      than replace them
- [x] Copy pass: remove "骑手/外卖" from global nav, onboarding and AI system prompt; keep it only
      where the content is genuinely about that work type

**Acceptance:** a new user can complete the wizard on a 320px screen, get a checklist, and open at
least one official link per item; no page says "月入过万"; all existing tests stay green.

**Status (3.5.0):** shipped and green — 54 files / 1,118 unit tests, 8 files / 106 E2E. Remaining P0
debt: six-section nav, checklist persistence, identity-aware calculation. Those move to 3.6.0.

---

## 3.6.0 — 30 items at L2, 10 cities deep-verified

**Goal: the first 30 items are not just "know it" but "can do it".**

- [ ] 30 items reach L2 (materials + steps + official entry + common pitfalls + deadline)
- [ ] 10 cities deep-verified: 北京 / 上海 / 广州 / 深圳 / 成都 / 重庆 / 武汉 / 西安 / 郑州 / 杭州
- [ ] Every city page shows "全国框架 + 本地入口"; no fabricated city-level amounts
- [ ] `lastVerified` visible on every item; stale items show "待复核"
- [ ] Link health: every official URL checked monthly; dead links flagged, not silently kept

**Acceptance:** 30/30 items have a verified official entry; 10/10 cities have a local entry for
social insurance, medical insurance, housing fund and employment services.

---

## 3.7.0 — 60+ items and a usable checklist

**Goal: a worker can keep a personal "what I still need to do" list across a job change.**

- [ ] 60+ rights items across 12 categories, at least L1 for all
- [ ] Checklist state persisted locally; export/print one-page summary for a dispute
- [ ] Deadline reminders (probation, injury 30 days, unemployment registration) — local only,
      no push service, no account
- [ ] "遇到麻烦" path: evidence checklist, 4 document templates, nearest labor inspection /
      arbitration entry
- [ ] Accessibility and plain-language pass on the new IA

**Acceptance:** a worker can move from "I don't know what to do" to a printed checklist without
creating an account; every deadline is explained, not just displayed.

---

## 3.8.0 — Assistant and content operations

- [ ] AI assistant answers only with city + identity + situation, returns 1–3 actions, the first step,
      an official entry and "以当地为准"; never invents an amount or a document number
- [ ] 7 scenario templates: 入职 7 天 / 离职交接 / 工伤 30 天 / 失业金 / 生育津贴 / 退休办理 / 欠薪取证
- [ ] Content review cadence: quarterly policy review, monthly link check, weekly new-item intake
- [ ] Contributor workflow for adding an item with sources and reviewer sign-off

---

## Engineering track (runs alongside)

### Done in 3.4.x

- [x] 1,102 unit/parity/component tests; 100 Playwright E2E (desktop + mobile)
- [x] `typecheck` / `verify` / `verify:reality` / `kb:check` / `verify:entrypoints` /
      `build` / `doctor` all green
- [x] 5 calculation fixes + 14 regression tests (volatility, pension years, peak-time parsing,
      14h cap naming, share-link disclosure)
- [x] Positioning docs and README first screen
- [x] Metadata / PWA / OG alignment with the new positioning; sub-path deployment fixed
- [x] README official-source ratio corrected (38% → 34%)
- [x] `docs/ENGINEERING.md`, `tests/architecture.spec.ts`, `src/engine/README.md`

### P1

- [ ] Visual regression on the four home entries and the 3-step wizard (Playwright screenshots)
- [ ] Coverage report published in CI; target 80% on `domain/` + `application/`
- [ ] Dependency upgrade wave: pinia 4 / vue-router 5 / vite 8 / TypeScript 7, one major per PR,
      full gate each time
- [ ] Circular-dependency scan that understands `.vue` (dependency-cruiser or madge with a Vue parser)
- [ ] Lighthouse CI on a 4G profile: LCP < 2.5s, CLS < 0.1, TBT < 200ms
- [ ] PWA precache budget check in `doctor` (currently 2.85 MB; warn at 3 MB)

### P2

- [ ] Remove `src/engine` after `TaxOptimizer` / `RetirementPlanner` migrate to `domain/`
- [ ] Move `src/utils/livingGuide.ts` content into `src/data/rights/` with typed `RightsItem`s
- [ ] Split `naive-ui` first-screen chunk if a lighter component set becomes viable
- [ ] Windows installer signing / auto-update check

---

## Data depth (continuous)

- [ ] Verify social-insurance bases for the 20 cities currently marked `unverified`, each with a
      document number and URL
- [ ] Add per-field `lastVerified` date (rules already carry `retrievedAt`; surface it per number)
- [ ] "Data freshness" panel listing every parameter older than 12 months
- [ ] Monthly CI job that opens an issue when any rule file exceeds its freshness window

**Acceptance:** the `unverified` count for social-insurance base drops below 10, and every remaining
one has an explicit note explaining what is missing.

---

## Explicitly not planned

These come up repeatedly and are deliberately out of scope:

| Not doing | Why |
|---|---|
| User accounts / cloud sync | Requires a backend, which breaks the no-data-leaves-the-device promise |
| Scraping platform prices automatically | Platform pricing is a commercial term with no authoritative public source; the user entering their own rate is the only honest path |
| Generic "AI financial advice" chat | The AI here is scoped to explaining a city's rules and a specific situation; open-ended advice would be unverifiable |
| Loan / insurance / wealth-product recommendations | Conflict of interest; this is a rights platform, not a funnel |
| "One-click file it for me" | The platform does not submit anything on the user's behalf; it gives the official entry and the steps |
| Gamification / streaks | This is a decision tool used occasionally, not a habit app |

---

## How priorities are set

1. **Wrong number** — always first. A calculation or policy error outranks any feature.
2. **Data provenance** — a placeholder that could be mistaken for a fact.
3. **Blocked decision** — a user cannot finish the task they came for.
4. **Friction** — the task works but is slow or confusing.
5. **New capability** — everything else.

## Contributing to the roadmap

Open a discussion with the decision you're trying to make, not the feature you want.
See [CONTRIBUTING.md](CONTRIBUTING.md).
