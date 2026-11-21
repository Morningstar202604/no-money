# Roadmap

This is a working roadmap, not a promise. Priorities shift when real user feedback arrives —
especially data corrections, because a wrong policy number is worse than a missing feature.

Version format: `0.0.x`，前两段固定、末段每次发布递增；历史 `3.x` 标签保留。
See [docs/VERSIONING.md](docs/VERSIONING.md) for the release rule.

---

## Where we are now

**0.0.37** is the current baseline. The product direction is settled — a rights-navigation and
public-service guide for workers — and the six-section navigation, standalone guide page,
new-grad first-year mode, plain-language guide search, guide sharing, whole-checklist sharing and
the checklist export/share edge fixes are shipped:

- [docs/POSITIONING.md](docs/POSITIONING.md) — one-sentence positioning, audience, three questions,
  IA v2, content model, P0/P1/P2, explicit non-goals
- Six-section nav: 该做什么 / 能拿什么 / 怎么弄 / 算一算 / 问一问 / 政策与数据; `/guides` lists 18
  L2 how-to entries in 8 categories, with `?cat=` deep links, plain-language search and one-card sharing; saved/generated checklists can be shared as one message
- `/employee` now has a new-grad first-year mode: probation + regular months, annual tax and
  take-home; resident mode still blocked on city-level contribution data
- [docs/REALITY-AND-SCOPE.md](docs/REALITY-AND-SCOPE.md) — 12 real-world blockers, 8 paths,
  60+ rights inventory, L1/L2/L3 standard, four home entries, 3-step onboarding, nine-section
  content template, four-level confidence, assistant + 7 templates, policy anchors

**What is shipped:** `/start` with four entries; a 3-step wizard; a **60-item `RightsItem` catalog**
(23 migrated + 20 new L2 + 17 L1), **30 items at L2**, **30 at L1**; **10 cities with four local official entries**;
local checklist persistence with deadline-first hints, TXT export and print/PDF; `/start` four-entry tabs;
content tests. The calculator and all routes still work.
3.6.2 makes `/start` the default home; 3.6.3 groups `/policy` into four tabs; 3.6.4 reuses the same `GuideCard` in `/start` details; 3.6.5 unifies city/province service channels behind one resolver; 3.6.6 reaches 60 items and makes the checklist exportable; 3.6.7 adds four one-click common situations; 3.6.8 ranks the generated result list and highlights the first action; 3.6.9 adds a handoff to calculate / ask AI / read policy; 3.6.10 pre-fills that AI prompt with the current city and first checklist item; 3.6.11 states the flexible-work-only calculator scope and adds a per-city data-freshness summary; 3.7.0 adds an employee wage-slip page at `/employee`, with annual comprehensive-income tax and a no-rider-sidebar layout; 3.7.1 expands the policy data-source tab into a 34-city freshness overview; 3.7.2 turns freshness into a local/CI gate with a monthly workflow; 3.7.3 makes a failed month open or update an issue instead of only showing a red run; 3.7.4 trims the public README and syncs the five hosting mirrors; 3.7.5 fixes the CI preview bind so browser smoke tests start on GitHub runners; 3.7.6 records the one Cargo advisory with no compatible fix; 3.8.0 makes the seven checklists first-class and wires the content-review/contributor loop; 3.8.1 verifies 2026 pension bases for the first five cities (Shanghai, Jinan, Fuzhou, Nanchang, Kunming) against official notices; 3.8.2 completes the remaining fifteen (Changchun, Guiyang, Harbin, Haikou, Hefei, Hohhot, Lanzhou, Lhasa, Nanning, Shenyang, Shijiazhuang, Taiyuan, Urumqi, Xining, Yinchuan), with 12 direct official min/max and 3 derived from official average wages at the statutory 60%/300%; 3.8.3 verifies five minimum wages; 3.8.4 closes the field: all 34 cities now have an official current minimum-wage standard; 3.8.5 splits medical base and rate provenance and replaces the 26-city 4500/22500/8% placeholder with city-specific 2026 official or derived values; 3.8.6 closes the pension benefit base: 34/34 cities have a checkable value (21 official / 13 derived / 0 unverified), adds `benefitBaseYear` so a 2025 carried-forward base is never presented as a 2026 published one, and corrects Changsha from 6843 (contribution benchmark) to 7694 (benefit base); 3.8.7 re-checks the 13 derived pension bases: five (Chongqing, Shanghai, Taiyuan, Hangzhou, Guiyang) move to official, eight stay derived, Lanzhou's 7594/2025 year mismatch is corrected to 7746/2025, and Zhengzhou's 6401 is confirmed as the 2023 base rather than a competing 2025 value; 3.8.8 closes the medical leftovers: Xi'an moves from unverified to official (4990 / 8% / 8 yuan large-medical, 407.2/month), Zhengzhou corrects 9% to the net 10% and 521.6/month, Shijiazhuang's expired 6.5% is downgraded to derived, Hohhot folds long-term care and large-medical into 35.31/month, Urumqi models the actual 503.62/678.5 collection with fixed add-ons, and Wuhan separates the 7587 medical base from the 7496 pension base; 3.8.9 closes the eight-city pension-base re-check: Xi'an 7881/2025 moves to official on the `陕人社函〔2025〕425号` scan, seven cities stay derived (Chengdu 8462, Haikou 8188, Hohhot 8430, Lanzhou 7746, Urumqi 8744, Wuhan 9112, Zhengzhou 6738), and Zhengzhou's `豫人社办〔2025〕73号` page is recorded with its attachment mismatch.

**What is not done yet:** resident / urban-rural resident calculation mode; 10 real-user tests. The
18 guide-scope L2 entries now each have a user-phrase test and a working search alias. The
six-section nav, standalone guide page and new-grad first-year mode are shipped; 3.8.0 also ships the rights guide, the freshness gate, failure-to-issue automation,
repository automation, the employee wage-slip slice, seven ready-made checklists and the
content-review loop. Page-level deadline hints exist, but there is no push service or account.

---

## 0.0.37 — Checklist date, share boundary and cleanup fixes (shipped 2026-11-21)

**Goal: close the small correctness gaps left by 0.0.36 without touching policy data.**

- [x] Local-date helper: exports/shares no longer write yesterday's date between 00:00–08:00 CST
- [x] Checklist share `maxItems` clamps to at least 1; `0`/negative/`NaN` can't produce an empty or reversed slice
- [x] Truncation hint says 「回到「我的清单」」 instead of assuming an installed App
- [x] AbortError detected by `name` in WebViews without `DOMException`; cancel stays silent
- [x] `RightsItemCard` clears its 3-second feedback timer on unmount
- [x] No policy data or confidence changes
- [ ] Data gaps unchanged: 7 derived pension bases, 34 cities `verified=false` (platform rates still unverified), resident mode and 10 real-user tests remain open

---

## 0.0.36 — Whole-checklist sharing (shipped 2026-11-21)

**Goal: a worker can send the whole plan, not just one card, to a co-worker or family member.**

- [x] `分享清单` on 我的清单; `分享这张清单` on wizard results
- [x] Web Share on mobile, clipboard fallback on desktop; user cancel stays silent
- [x] Share text: up to 8 items, each with 待办/已办, first step, deadline, where-to-go,
      official link and verification date; remaining count when truncated
- [x] No internal id, city, identity, ID number, salary or checklist storage key in the message
- [x] Centralized `shareErrorMessage` for single-card and checklist sharing
- [x] 6 new unit tests (13 in `rightsShare.spec.ts`); desktop + mobile E2E for checklist copy
- [x] No policy data or confidence changes

---

## 0.0.35 — Guide sharing + 0.0.x version convention (shipped 2026-11-21)

**Goal: a worker can send one actionable guide to a co-worker, and every future release has a
single, predictable version slot.**

- [x] `分享这条` on every rights card: Web Share on mobile, clipboard fallback on desktop
- [x] Share text carries title, one-liner, first four steps, materials, deadline, where-to-go,
      official link, caution, verification date and source
- [x] Version convention moves from `3.10.1` to `0.0.35`; `v3.x` tags stay untouched
- [x] `docs/VERSIONING.md` documents fixed first two segments and a +1 last segment per release
- [x] 7 unit tests (3 share text + 4 share channel); desktop + mobile E2E for clipboard fallback
- [x] No policy data or confidence changes

---

## 3.10.1 — Plain-language guide search (shipped 2026-11-21)

**Goal: a worker can type the problem in their own words and land on the right how-to entry,
without learning policy vocabulary first.**

- [x] `/guides` search box with plain-language placeholder and clearable input
- [x] `GUIDE_SEARCH_PHRASES` covers all 18 guide-scope L2 entries; each entry has at least one
      everyday phrase
- [x] `searchGuides` ranks exact phrase > phrase contains > title > one-liner > body keywords;
      category chips and search can be combined
- [x] No-result state offers three real user phrases instead of a dead end
- [x] 18 phrase-to-entry unit tests plus alias coverage/empty/no-match/category tests
- [x] Desktop + mobile E2E for search, no-result fallback and example recovery
- [x] Version/docs sync; no policy data or confidence changes

---

## 3.10.0 — New-grad first-year mode (shipped 2026-11-20)

**Goal: a first-time worker with a probation period can see both phases' take-home and the first-year
tax, without pretending it is a normal 12-month constant salary.**

- [x] `/employee` mode switch: single payslip / new-grad first year
- [x] Inputs: probation monthly gross, probation months (0–12), regular monthly gross, personal
      social-insurance + housing-fund total, monthly special deduction
- [x] `calcWageAnnualFromMonths` sums 12 variable months and computes annual tax; rejects partial years
- [x] Result: probation monthly net and regular monthly net (annual-average tax allocation, labelled),
      first-year tax and first-year net; no negative phase net when a phase has 0 months
- [x] No inferred employer rates, no new policy amounts; resident mode stays blocked because there is
      no city-level resident contribution dataset
- [x] Regression: 62 files / 1,201 unit tests, 8 files / 124 E2E, build 23.92s, PWA 55 entries

**Acceptance:** 8000 × 3 months + 10000 × 9 months, personal fund 1000 → first-year tax 1,680 and
first-year net 100,320; both desktop and mobile show the same numbers.

---

## 3.9.0 — Six-section navigation + standalone guides (shipped 2026-11-20)

**Goal: a first-time worker can read the top navigation as a path — do, claim, learn how, calculate,
ask, verify — instead of a flat feature list.**

- [x] Reorder main nav to 该做什么 / 能拿什么 / 怎么弄 / 算一算 / 问一问 / 政策与数据
- [x] Keep `问一问` as an action (`app:open-ai`), not a duplicate route; command palette reuses the
      same `navItems`
- [x] Add `/guides`: 18 L2 how-to entries across 8 categories, priority-sorted, with `?cat=` deep
      links and a mobile text nav that fits all six labels at 390px
- [x] Map `activeKey` so Dashboard/Scenario/Planning share 算一算, Policy/Audit share 政策与数据,
      and `/start?entry=benefits` highlights 能拿什么
- [x] Keep the data honest: 225 official / 50 derived / 68 unverified, pension base 27 / 7 / 0,
      all 34 cities still `verified: false`
- [x] Regression: 62 files / 1,195 unit tests, 8 files / 122 E2E, build 22.75s, PWA 55 entries

**Acceptance:** six links are visible and reachable by mouse and keyboard on desktop and mobile; `/guides`
shows only in-scope L2 entries; no policy value or confidence changed.

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

## 3.6.8 — Ranked result list (shipped 2026-11-20)

**Goal: after generating a checklist, a first-time user knows which one thing to do first.**

- [x] `RightsItemCard` optional `rank`; wizard passes the original result order, no new sorting logic
- [x] First card highlighted with「第 1 件 · 先办这个」; later cards numbered
- [x] Result lead changed to "先办第 1 件，其余按顺序来"; other lists unchanged
- [x] Mount/E2E assertions added; no policy, amount or calculation changes

**Status:** shipped — PATCH.

---

## 3.6.9 — Checklist handoff (shipped 2026-11-20)

**Goal: after the checklist, the user knows where to go next without a sixth top-level menu.**

- [x] Result-page row: 算一算到手多少 → `/dashboard`; 问 AI 材料/流程 → existing AI panel; 查政策原文 → `/policy`
- [x] `ChatAssistant` listens for `app:open-ai`; one panel, one state, no duplicate trigger
- [x] Parent view owns routing; wizard emits only, no router dependency
- [x] Four entries and 3–7 item result list unchanged

**Status:** shipped — PATCH. The literal six-section top nav remains not done; this closes the journey in the result page instead.

---

## 3.6.10 — AI handoff with checklist context (shipped 2026-11-20)

**Goal: the AI action opens with the user's situation already written, not an empty box.**

- [x] `buildRightsAiPrompt` turns city, identity, situation, first item and deadline into one prompt
- [x] `ask-ai` emits that prompt; parent only forwards it as an `app:open-ai` event detail
- [x] Panel pre-fills and focuses the input; user confirms and sends; no auto-send
- [x] Prompt requires official-basis answers and says no invented amounts, document numbers, calls or links

**Status:** shipped — PATCH.

---

## 3.6.11 — Scope and provenance (shipped 2026-11-20)

**Goal: users should know what the calculator covers and how fresh the city data is before trusting a number.**

- [x] `/dashboard` permanent scope note: flexible work / platform per-order pricing only; employee and resident payroll bases are not wired in
- [x] `/policy?tab=sources` per-city summary: official / derived / unverified counts, oldest source date, over-12-month count, unverified field names
- [x] `summarizeSourceFreshness` treats invalid dates as unknown, not stale; no value is filled in or promoted to official
- [x] Unit tests for counts, stale threshold and invalid dates; E2E asserts both notices

**Status:** shipped — PATCH.

---

## 3.7.0 — Employee wage-slip calculator (shipped 2026-11-20)

**Goal: stop making enterprise employees use the rider per-order model. If they have a payslip,
they can calculate take-home from it.**

- [x] `/employee`: pre-tax monthly salary, personal social-insurance + housing-fund total, and
      monthly special additional deductions; annual comprehensive-income tax, monthly take-home,
      annual tax, annual take-home, taxable income and effective rate
- [x] `calcWageAnnual` works in cents and never infers employer contribution rates or local
      social-insurance rates; the employee enters the personal deduction from the payslip
- [x] `/employee` hides the rider parameter sidebar and mobile menu button; the four entries and
      six-item nav stay unchanged
- [x] Dashboard scope note links to the employee page; result card states annual-settlement basis,
      monthly withholding may be lower earlier in the year, and excludes bonus/overtime/reimbursement
- [ ] Six-section nav reorder — deliberately deferred; it conflicts with the four-entry home until
      real-user navigation data says otherwise
- [ ] Resident and new-grad modes — 3.7.x / 3.8.0
- [ ] Real-user usability test with first-time workers; record where they get stuck

**Status:** shipped — MINOR. 60 files / 1,157 unit tests, 8 files / 118 E2E. No policy amount,
document number or official link was added.

---

## 3.7.1 — 34-city freshness overview (shipped 2026-11-20)

**Goal: see which of the 34 cities have weak or stale sources without leaving the policy page.**

- [x] `/policy?tab=sources` summary: loaded cities, total parameters, official / derived /
      unverified counts, and sources older than 12 months
- [x] Per-city rows: official / derived / unverified, oldest `retrievedAt`, stale count, current-city tag
- [x] "切到此城" switches the calculation city and refreshes the existing per-city source detail
- [x] 34 rows live in a native `<details>`, closed by default; no new top-level nav or route
- [x] Failed city rules are listed separately; totals never fill failed cities with zero
- [x] Unit tests for aggregation and missing rules; E2E asserts 34 rows and the current-city marker

**Status:** shipped — PATCH. 60 files / 1,159 unit tests, 8 files / 118 E2E. No policy amount,
document number or official link was added.

---

## 3.7.2 — Source-freshness gate (shipped 2026-11-20)

**Goal: stale policy data should fail a repeatable check, not depend on someone remembering
to open the policy page.**

- [x] `npm run freshness:check` reads all 34 registered city rules
- [x] Fails on missing/invalid JSON, missing `sources`, invalid `confidence`, invalid
      `retrievedAt`, or any source older than 365 days
- [x] `--now=YYYY-MM-DD` makes the check deterministic; failures list city + field, capped at 20
- [x] `npm run check` and the main CI run it; `.github/workflows/freshness.yml` runs monthly
- [x] No rule values, document numbers, links or confidence levels changed
- [ ] Auto-open a GitHub/GitCode issue on monthly failure — workflow failure is visible, but
      issue creation is not wired yet

**Status:** shipped — PATCH. 60 files / 1,159 unit tests, 8 files / 118 E2E. Data summary:
34 cities / 309 sources; stale count 0 at 2026-11-20.

---

## 3.7.3 — Freshness failures open an issue (shipped 2026-11-20)

**Goal: a failed monthly check should leave a work item, not just a red run nobody watches.**

- [x] `freshness.yml` captures the check output with `tee`, keeps the job red via `pipefail`
- [x] On failure, create `[数据新鲜度] 34 城有来源超过 365 天` with the report tail and run link
- [x] If the same open issue exists, append a comment instead of opening a duplicate
- [ ] GitCode / Gitee CI integration — the workflow is GitHub Actions; those remotes do not run it yet

**Status:** shipped — PATCH. No application or rule-data change; 60 files / 1,159 unit tests,
8 files / 118 E2E remain the baseline. Data summary: 34 cities / 309 sources, stale 0 at 2026-11-20.

---

## 3.7.4 — Repository presentation and automation (shipped 2026-11-20)

**Goal: the repo should read like a finished project, not a changelog with screenshots.**

- [x] English-first README with a one-click Chinese version; both trimmed to purpose, entries,
      data provenance, privacy, development and docs
- [x] Same `main` history, README, description and topics on GitCode, Gitee and the three GitHub mirrors
- [x] Remove non-main branches; archive old GitHub mains before replacing them
- [x] GitHub auto-merge, delete-branch-on-merge, update-branch; Dependabot dev minor/patch auto-merge
- [ ] GitCode / Gitee CI integration — their remotes still do not run the GitHub workflows

**Status:** shipped — PATCH. No application or rule-data change; 60 files / 1,159 unit tests,
8 files / 118 E2E remain the baseline.

---

## 3.7.5 — CI preview bind fix (shipped 2026-11-20)

**Goal: the browser smoke test should start on a clean GitHub runner, not time out.**

- [x] Bind `vite preview` to `127.0.0.1` in config and on the Playwright command line
- [x] Run the same CI-mode E2E locally: 8 files / 118 tests pass
- [x] Keep required checks `Typecheck, test, build` and `Browser smoke test` aligned with job names

**Status:** shipped — PATCH. No application or policy-data change.

---

## 3.7.6 — Cargo advisory exception (shipped 2026-11-20)

**Goal: keep security automation useful instead of red on every push, and keep the last sidebar action tappable on short mobile viewports.**

- [x] Document `glib 0.18.5` (GHSA-wrw7-89jp-8q8g, medium): dependency chain, unreachable path, no compatible `0.20` upgrade under `tao 0.37`
- [x] Mark the GitHub alert `tolerable_risk`; re-check when Tauri / tao moves to `glib 0.20`
- [x] Add 24px bottom clearance to the mobile parameter sidebar and scroll before the reset click in E2E

**Status:** shipped — PATCH. Mobile CSS/test only; no dependency-version or policy-data change.

---

## 3.8.0 — Assistant and seven checklists (shipped 2026-11-20)

**Goal: a user can start from a real situation and walk away with an ordered, printable checklist,
without opening the AI chat.**

- [x] AI assistant stays on city + identity + situation, returns 1–3 actions, names the first step
      and an official entry, and says “以当地为准”; it never invents an amount or a document number
- [x] Seven templates: 入职 7 天 / 离职交接 / 工伤 30 天 / 失业金 / 生育津贴 / 退休办理 / 欠薪取证
- [x] Every template uses explicit `itemIds`, so its first item is the first action — not a category sort
- [x] Result page can add the whole template to “我的清单”, export it as TXT, or print/PDF with the template name
- [x] Content review cadence: quarterly policy review, monthly link/freshness check, weekly new-item intake
- [x] Contributor workflow: primary source, honest confidence, reviewer sign-off, template-order check

**Status:** shipped — MINOR. No policy-data change; template content reuses existing audited items.

---

## 3.8.1 — First five pension bases verified (shipped 2026-11-20)

**Goal: prove the data-depth loop on five cities before widening it to the remaining fifteen.**

- [x] Shanghai, Jinan, Fuzhou, Nanchang, Kunming: 2026 pension base min/max read from the official notice, not a search snippet
- [x] `sources.pension` upgraded to `official` with title, issuer, URL, effective date and check date
- [x] Document numbers written only when printed on the official page; Shanghai, Nanchang and Kunming keep `docNo` empty rather than borrowing a third-party citation
- [x] Keep `verified: false` at city level and leave medical, minimum wage, pension benefit base and pension rate at their previous confidence
- [x] `kb.json` regenerated; official sources 105 → 110, unverified 167 → 162, stale 0

**Status:** shipped — PATCH. Data-only; no application code or dependency change.

## 3.8.2 — Remaining fifteen pension bases completed (shipped 2026-11-20)

**Goal: finish the 2026 pension-base sweep without turning derived values into official ones.**

- [x] Changchun, Guiyang, Harbin, Haikou, Hefei, Hohhot, Lanzhou, Lhasa, Nanning, Shenyang, Shijiazhuang, Taiyuan, Urumqi, Xining, Yinchuan: 2026 pension base min/max written into `benefit.pension`
- [x] 12 cities with the min/max printed in the official notice: `sources.pension` = `official`
- [x] 3 cities where the official notice prints only the average wage (Changchun 89,778, Guiyang 88,521, Harbin 92,460 yuan/year): `sources.pension` = `derived`, with the 60%/300% arithmetic written in `note`
- [x] Document numbers written when printed; Urumqi keeps `docNo` empty; Shijiazhuang cites the Zunhua municipal government's full-text reprint of the provincial notice because the provincial page was not found
- [x] Keep `verified: false` at city level; medical, minimum wage, pension benefit base and pension rate untouched
- [x] `kb.json` regenerated; official 110 → 122, derived 37 → 40, unverified 162 → 147, stale 0

**Status:** shipped — PATCH. Data-only; no application code or dependency change.

## 3.8.6 — Pension benefit base closed (shipped 2026-11-20)

**Goal: no city should show an 8000-ish placeholder as its pension benefit base, and a 2025
carried-forward base must never look like a 2026 published value.**

- [x] Replace 27 placeholder `retirement.benefitBaseMonthly` values with checkable 2025/2026 values.
- [x] 34/34 cities have a value: 21 `official`, 13 `derived`, 0 `unverified`.
- [x] Add `benefitBaseYear` (2026 published / 2025 carried forward) and show it on the retirement panel.
- [x] Correct Changsha 6843 → 7694: 6843 is the 2026 contribution benchmark used for the contribution index, not the benefit base.
- [x] Expand `AuditView` from 6 to 7 fields: separate “养老缴费基数” from “养老金计发基数”.
- [x] Document every city's value, year, doc number/source and unresolved口径 in
      `docs/DATA-VERIFICATION-RETIREMENT-2026-11-20.md`.

**Acceptance:** `npm run check`, `freshness:check`, `kb:check`, `build`, `doctor` and 120 E2E all green;
five mirrors on `main` + `v3.8.6`.

**Status (3.8.6):** shipped — 61 files / 1,176 unit tests, 8 files / 120 E2E, 343 sources
(219 official / 55 derived / 69 unverified).

## 3.8.9 — Eight derived pension bases re-checked (shipped 2026-11-20)

**Goal: close the last eight derived pension benefit bases without turning arithmetic or
third-party tables into `official`.**

- [x] Xi'an 7881/2025 moves to `official`: the `陕人社函〔2025〕425号` red-header scan states
      “我省2025年基本养老金计发基数为7881元/月” with document number, title and seal.
- [x] The other seven stay `derived`: Chengdu 8462, Haikou 8188, Hohhot 8430, Lanzhou 7746,
      Urumqi 8744, Wuhan 9112, Zhengzhou 6738 — each with the exact missing document or formula in
      `note`.
- [x] Zhengzhou's source now points to the Shangcai county government reprint of
      `豫人社办〔2025〕73号`; the attachment is the wrong 67号 contribution-base scan, so 6738 stays
      `derived` until the 73号 body is readable.
- [x] Urumqi's retirement source title is corrected to the 2026 contribution-base notice; Wuhan's
      note records the 7400→7510 city-report miscitation against the province-wide 9112.
- [x] `docs/DATA-VERIFICATION-RETIREMENT-2026-11-20.md` updated; 5 regression assertions added.

**Acceptance:** `check`, `freshness:check`, `kb:check`, `build`, `doctor` and 120 E2E all green;
five mirrors on `main` + `v3.8.9`.

**Status (3.8.9):** shipped — 61 files / 1,191 unit tests, 8 files / 120 E2E, 343 sources
(225 official / 50 derived / 68 unverified); 27 official / 7 derived pension bases.

## 3.8.8 — Medical leftovers closed (shipped 2026-11-20)

**Goal: remove the last `unverified` medical rate and stop expired or arithmetic-inconsistent
documents from being labelled `official`.**

- [x] Xi'an moves to `official`: 2026 base 4990, rate 9%→8% from 2026-01 to 2026-12, large-medical
      8 yuan/month; monthly 407.2.
- [x] Zhengzhou corrected from 9% to the net 10% and **521.6/month**; the official guide's 5201.6
      is arithmetically inconsistent with its own 521.6 and is treated as a typo against 5216×10%.
- [x] Shijiazhuang's 6.5% document expires on 2026-06-30; the rate is downgraded to `derived`
      instead of letting an expired document cover the rest of 2026.
- [x] Hohhot folds long-term care 0.4% and large-medical 100/year into **35.31/month**; combined
      547.85, single-pool 345.53.
- [x] Urumqi models the actual 503.62/678.5 collection with fixed add-ons 31.48/101.44, without
      inventing a split for the unexplained combined-pool difference.
- [x] Wuhan note separates the 7587 medical base from the 7496 pension base; the 366.81 example
      is a cross-insurance mix-up, not a competing medical value.
- [x] `docs/DATA-VERIFICATION-MEDICAL-2026-11-20.md` updated; 7 regression assertions added.

**Acceptance:** `check`, `freshness:check`, `kb:check`, `build`, `doctor` and 120 E2E all green;
five mirrors on `main` + `v3.8.8`.

**Status (3.8.9):** shipped — 61 files / 1,191 unit tests, 8 files / 120 E2E, 343 sources
(225 official / 50 derived / 68 unverified); 34/34 medical rates have a value (27 official / 7 derived / 0 unverified); pension benefit bases 27 official / 7 derived / 0 unverified.

## 3.8.7 — 13 derived pension bases re-checked (shipped 2026-11-20)

**Goal: re-check every remaining derived pension benefit base, upgrade only where official text
directly supports the value, and fix year/value mismatches instead of leaving them as “unresolved”.**

- [x] Five cities move to `official`: Chongqing 8240 (`渝人社发〔2025〕24号`), Shanghai 12577
      (`沪人社规〔2026〕16号`), Taiyuan 7253 (`晋人社厅发〔2025〕36号`), Hangzhou 8537
      (`浙人社发〔2026〕52号`), Guiyang 7376.75 (`黔人社发〔2026〕7号`).
- [x] Lanzhou corrected from 7594/2025 to **7746/2025**: 7594 is the 2024 official base, not the
      2025 value.
- [x] Zhengzhou 6401 confirmed as the **2023** base (6606 = 2024, 6738 = 2025); the “two 2025 values”
      conflict is closed.
- [x] Eight cities stay `derived`: Chengdu 8462, Haikou 8188, Hohhot 8430, Lanzhou 7746,
      Urumqi 8744, Wuhan 9112, Xi'an 7881, Zhengzhou 6738 — each with the exact missing official
      document or formula written in `note`.
- [x] `docs/DATA-VERIFICATION-RETIREMENT-2026-11-20.md` updated; 3 regression assertions added.

**Acceptance:** `check`, `freshness:check`, `kb:check`, `build`, `doctor` and 120 E2E all green;
five mirrors on `main` + `v3.8.7`.

**Status (3.8.7):** shipped — 61 files / 1,179 unit tests, 8 files / 120 E2E, 343 sources
(224 official / 50 derived / 69 unverified); 26 official / 8 derived pension bases.

## 3.8.5 — Medical base/rate provenance split (shipped 2026-11-20)

**Goal: stop treating "official base + placeholder 8% rate" as one official medical source, and replace the 26-city placeholder.**

- [x] `sources.medical` now covers only the base; new `sources.medicalRate` covers the rate
- [x] 34/34 medical bases official 33 / derived 1; 26 placeholders removed
- [x] Medical rate: official 27, derived 6, unverified 1 (Xi'an)
- [x] Fixed-base cities allowed (`baseMin == baseMax`); tier-level `baseMonthly` / `fixedMonthly` added
- [x] Chengdu 6265/7831, Chongqing annual 3105/6831, Wuhan 7587×4.8%+7, Zhengzhou 5216×9%, Hangzhou 4986×9.5%, Shanghai 7546–37731×10%
- [x] 343 sources: official 200 (58.3%), derived 47, unverified 96; `verified` still false for all 34 cities
- [x] `kb.json` regenerated (409 entries); audit view 6 columns; tests 1,176

**Status:** shipped — PATCH. Data, schema, two calculation paths, UI audit column, tests and docs.

---

## 3.8.4 — Minimum-wage field closed (shipped 2026-11-20)

**Goal: remove every remaining 2,000 yuan placeholder and make the rating anchor official in all 34 cities.**

- [x] 21 remaining cities written from provincial/municipal government documents
- [x] Corrected three bad placeholders: Shanghai hourly 26 → 25, Beijing 26.4 → 27.7, Tianjin 24.4 → 26.6
- [x] Fuzhou set to the applicable second tier 2,195 / 23, not Xiamen-only first tier 2,265 / 23.5
- [x] `sources.minimumWage` complete for every city: title, document number where published, issuer, URL, effective date, applicable districts
- [x] `minimumWage` 34/34 `official`; official 148 (47.9%), derived 40, unverified 121
- [x] `kb.json` regenerated; stale 0

**Status:** shipped — PATCH. Data and tests only; no application code or dependency change.

---

## 3.8.3 — Minimum-wage anchors for five cities (shipped 2026-11-20)

**Goal: replace the 2,000 yuan national placeholder with current, applicable provincial standards in five cities.**

- [x] Haikou 2,250 / 20.0, Hainan 琼人社规〔2025〕7号, effective 2025-12-01
- [x] Hefei 2,320 / 23, Anhui 皖政办秘〔2025〕32号, effective 2025-09-01
- [x] Nanning 2,200 / 22.4, Guangxi 桂政发〔2025〕16号, effective 2025-07-01
- [x] Xining 2,080 / 20, Qinghai 青政〔2025〕11号, effective 2025-05-01
- [x] Yinchuan 2,350 / 23, Ningxia 宁政规发〔2026〕2号, effective 2026-11-01
- [x] `sources.minimumWage` upgraded to `official` with title, document number, issuer, URL, effective date and applicable district
- [x] `kb.json` regenerated; official 122 → 127, derived 40 unchanged, unverified 147 → 142, stale 0

**Status:** shipped — PATCH. Data-only; no application code or dependency change.

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
- [x] PWA precache budget check in `doctor` (done; 2.72 MB, warn at 3 MB)

### P2

- [ ] Remove `src/engine` after `TaxOptimizer` / `RetirementPlanner` migrate to `domain/`
- [ ] Move `src/utils/livingGuide.ts` content into `src/data/rights/` with typed `RightsItem`s
- [ ] Split `naive-ui` first-screen chunk if a lighter component set becomes viable
- [ ] Windows installer signing / auto-update check

---

## Data depth (continuous)

- [x] First batch: verify 2026 pension bases for 5 of the 20 `unverified` cities (Shanghai, Jinan, Fuzhou, Nanchang, Kunming), each with an official URL and a printed document number where available (3.8.1)
- [x] Remaining 15 cities: 12 with direct official min/max, 3 derived from official average wages at 60%/300%; no `pension` field remains `unverified` (3.8.2)
- [x] Minimum wage: verify current monthly/hourly standards for Haikou, Hefei, Nanning, Xining and Yinchuan with provincial government documents (3.8.3)
- [x] Minimum wage: remaining 21 cities, each with the applicable district and effective date; field now 34/34 official (3.8.4)
- [x] Medical base / medical rate per city, kept separate from the pension-base batch (3.8.5–3.8.8; 34/34 medical rate has a value, 0 unverified; Xi'an 2026 8% + 8 yuan large-medical is official); pension benefit base 34/34 has a value, 27 official / 7 derived / 0 unverified (3.8.9)
- [x] Add per-field `lastVerified` date (done via `SourceTag`: 「核对于/登记于」+ `retrievedAt`)
- [x] "Data freshness" panel listing every parameter older than 12 months (per-city summary shipped in 3.6.11; global 34-city view shipped in 3.7.1)
- [x] Monthly freshness workflow opens or updates an issue on failure (3.7.3, GitHub Actions); GitCode / Gitee CI still not wired

**Acceptance:** the `unverified` count for social-insurance base drops below 10, and every remaining
one has an explicit note explaining what is missing. Current state: all 34 `pension` fields,
all 34 `minimumWage` fields, all 34 medical bases and all 34 medical rates, and all 34 pension
benefit bases are `official` or `derived` (0 `unverified` for medical rate and pension benefit
base); the remaining `unverified` items are platform income and sole-proprietor ITR, each with its
original note.

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
