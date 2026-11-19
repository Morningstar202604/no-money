# Roadmap

This is a working roadmap, not a promise. Priorities shift when real user feedback arrives —
especially data corrections, because a wrong policy number is worse than a missing feature.

Version format: `MAJOR.MINOR.PATCH` ([SemVer 2.0.0](https://semver.org/)).
See [docs/VERSIONING.md](docs/VERSIONING.md) for what each segment means here.

---

## Where we are now

**3.6.7** is the current baseline. The product direction is settled — a rights-navigation and
public-service guide for workers — and the first P1 content slice is shipped:

- [docs/POSITIONING.md](docs/POSITIONING.md) — one-sentence positioning, audience, three questions,
  IA v2, content model, P0/P1/P2, explicit non-goals
- [docs/REALITY-AND-SCOPE.md](docs/REALITY-AND-SCOPE.md) — 12 real-world blockers, 8 paths,
  60+ rights inventory, L1/L2/L3 standard, four home entries, 3-step onboarding, nine-section
  content template, four-level confidence, assistant + 7 templates, policy anchors

**What is shipped:** `/start` with four entries; a 3-step wizard; a **60-item `RightsItem` catalog**
(23 migrated + 20 new L2 + 17 L1), **30 items at L2**, **30 at L1**; **10 cities with four local official entries**;
local checklist persistence with deadline-first hints, TXT export and print/PDF; `/start` four-entry tabs;
content tests. The calculator and all routes still work.
3.6.2 makes `/start` the default home; 3.6.3 groups `/policy` into four tabs; 3.6.4 reuses the same `GuideCard` in `/start` details; 3.6.5 unifies city/province service channels behind one resolver; 3.6.6 reaches 60 items and makes the checklist exportable; 3.6.7 adds four one-click common situations.

**What is not done yet:** six-section nav reorder and identity-aware calculation (3.7.0); assistant
content operations and review cadence (3.8.0); real-user testing. Page-level deadline hints exist,
but there is no push service or account.

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

## 3.5.1 — Checklist persistence + L2 detail (shipped 2026-11-19)

**Goal: make the first rights list leave a trace, and let an item open into real steps.**

- [x] 我的清单：加入/已办/清空已办，本机持久化，刷新后仍在
- [x] 9 条高频权益标为 L2：步骤、材料、依据、官方入口、核验时间
- [x] 其余 23 条明确标 L1，不把“有步骤”当成“材料齐全”
- [x] 30 条 L2 / 10 城深核已在 3.6.0 完成

**Status (3.5.1):** 55 files / 1,125 unit tests, 8 files / 108 E2E.

## 3.6.0 — 30 items at L2, 10 cities deep-verified (shipped 2026-11-19)

**Goal: the first 30 items are not just "know it" but "can do it".**

- [x] 30 items reach L2 (materials + steps + official entry + common pitfalls + deadline)
- [x] 10 cities deep-verified: 北京 / 上海 / 广州 / 深圳 / 成都 / 重庆 / 武汉 / 西安 / 郑州 / 杭州
- [x] Every wizard result shows "全国框架 + 本地入口"; no fabricated city-level amounts
- [x] `lastVerified` visible on every item; stale items show "待复核"
- [x] 2026-11-19 一次性链接核验完成；月度自动检查列入 3.8.0 运维

**Acceptance:** 30/30 items have a verified official entry; 10/10 cities have a local entry for
social insurance, medical insurance, housing fund and employment services.

**Status (3.6.0):** shipped — 43 items / 30 L2 / 13 L1; 10 cities / 40 official entries.

---

## 3.6.1 — Frontend dedupe baseline (shipped 2026-11-19)

**Goal: remove duplicated frontend sources before the next IA move; no behavior change.**

- [x] 四入口元数据统一到 `src/data/rights/entries.ts`，`/start` 页签使用
- [x] `?tab=` 同步逻辑统一到 `src/composables/useTabQuery.ts`，`/scenario`、`/planning`、`/policy` 共用
- [x] 合并/去重顺序、页面职责与“不合并清单”写入 `docs/FRONTEND-CONSOLIDATION.md`

**Status (3.6.1):** shipped — 纯前端去重，不新增页面、不改计算口径。

---

## 3.6.2 — Home routing and UI dedupe (shipped 2026-11-19)

**Goal: one default home; the calculator page stops duplicating the four entries.**

- [x] `/` and brand link go to `/start`
- [x] `/dashboard` keeps its deep link but only says “办事入口在另一页”; duplicate four-card grid removed
- [x] `/start` keeps four tabs visible and shows the selected entry's one-line guide
- [x] Remove the now-unused `RightsEntryGrid` component

**Status (3.6.2):** shipped — default route and UI only; calculation and content unchanged.

---

## 3.6.3 — Policy page four-group IA (shipped 2026-11-19)

**Goal: four first-level tabs that map to user questions, not eight data tables.**

- [x] `政策原文` = 国家级 + 地方政策 + 本省核查清单
- [x] `数据溯源` = 当前城市参数逐条出处
- [x] `现实与救济` = 现实口径 + 权益救济
- [x] `手册与知识库` = 民生手册 + 本地知识库/导出
- [x] Old `?tab=national|guangdong|province|manual|kb|relief` deep links still resolve to the matching group
- [x] Manual body is still present; true single-source dedupe remains P1-2

**Status (3.6.3):** shipped — UI grouping only; no policy number, link, calculation or content removed.

---

## 3.6.4 — Manual detail single source (shipped 2026-11-19)

**Goal: the guide body is rendered once, not copied into a second card.**

- [x] `/start` migrated items resolve `guideId` and render `GuideCard` in the expanded detail
- [x] `/policy` manual tab keeps the same `GuideCard`
- [x] Non-guide items keep the existing detail block
- [x] Contract test prevents `RightsItemCard` from hand-writing a second guide body

**Status (3.6.4):** shipped — presentation-layer dedupe; content, links and calculations unchanged.

---

## 3.6.5 — Service channel resolver and visual atoms (shipped 2026-11-19)

**Goal: one city/province entry resolver; three repeated visual atoms, no new framework.**

- [x] `resolveServiceChannel(city)` returns city-level or province-level four services
- [x] Wizard, `CityServiceLinks` and the policy province block use the same result
- [x] No invented city links for unverified cities; missing province links become text + hotline
- [x] `.surface-card` / `.stack-sm` / `.link-brand` added and used
- [x] Unknown city returns `null`; no default to Guangdong

**Status (3.6.5):** shipped — data/UI plumbing and CSS atoms; policy numbers, links and calculations unchanged.

---

## 3.6.6 — 60 items and a usable checklist (shipped 2026-11-19)

**Status:** shipped — 60 items, TXT export, print/PDF, deadline-first hints. See `CHANGELOG.md` 3.6.6.

**Goal: a worker can keep a personal "what I still need to do" list across a job change.**

- [x] 前端合并 P1：民生手册不再与 `/start` 双份维护，`GuideCard` 只做详情（3.6.4 已完成）
- [x] 前端合并 P1：`/policy` 八个页签按问题压成四组（3.6.3 已上线，不减内容）
- [x] 60 rights items, 30 L2 + 30 L1; 17 new L1 items cover contract, overtime, probation,
      resignation, sick leave, maternity leave, records, inspection, arbitration, legal aid,
      work hours, social card, public employment, new-grad subsidy, supplement, survivor benefits
- [x] Checklist state persisted locally; TXT export and print/PDF summary for a dispute
- [x] Deadline-first hint on `/start` when saved/done items have a `deadline`; no push service,
      no account, no notification permission
- [x] "遇到麻烦" path already links to the 5-step guide, 4 document templates, labor inspection /
      arbitration / legal-aid entries (reused, not duplicated)
- [ ] Accessibility and plain-language pass on the new IA

**Acceptance:** a worker can move from "I don't know what to do" to a printed checklist without
creating an account; every deadline is explained, not just displayed. **3.6.6 meets the first half;
the accessibility pass remains.**

---

## 3.6.7 — One-click common situations (shipped 2026-11-20)

**Goal: a first-time user can get a useful checklist with one click, without learning the wizard.**

- [x] Four one-click entrances: first job / just left a job / moving city / unpaid wages or dismissal
- [x] Reuses `getRightsForSituation`; no second recommendation engine
- [x] Quick row only on step 1, so it does not duplicate the normal situation choices
- [x] Existing 3-step wizard remains unchanged

**Status:** shipped — PATCH; no policy numbers, links or calculation changes.

---

## 3.7.0 — Six-section nav and identity-aware calculation

**Goal: make the main journey obvious end to end, without turning the four entries into a maze.**

- [ ] Six-section nav: 该做什么 → 能拿什么 → 怎么弄 → 算一算 → 问一问 → 政策与数据
- [ ] Identity-aware calculator (employee / flexible / resident / new grad), preserving explicit
      assumptions and unknown-value behavior
- [ ] Real-user usability test with first-time workers; record where they get stuck

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
