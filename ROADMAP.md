# Roadmap

This is a working roadmap, not a promise. Priorities shift when real user feedback arrives — especially data corrections, because a wrong policy number is worse than a missing feature.

Version format: `MAJOR.MINOR.PATCH` ([SemVer 2.0.0](https://semver.org/)). See [docs/VERSIONING.md](docs/VERSIONING.md) for what each segment means in this project.

---

## Shipped

### 2.2.0 — Reliability and honesty pass

- Runtime schema and numeric-range validation for every city rule file
- AI chat history and API key default to memory-only, opt-in to persist
- 320px viewport fixes: onboarding dialog buttons reachable, nav overflow removed
- English-first README with Chinese mirror
- Playwright E2E covering 11 real user paths on desktop and mobile

### 2.1.0 — 34-city coverage

- 19 provincial capitals added, all marked `unverified` rather than guessed
- Province-specific legal basis for injury compensation
- Knowledge base expanded to 375 entries
- Sub-path deployment support, 404/robots/sitemap/OG metadata

---

## Next

### 2.3.0 — Data depth

**Goal: fewer `unverified` fields, without inventing any.**

- [ ] Verify social-insurance bases for the 20 cities currently marked `unverified`, each with a document number and URL
- [ ] Add per-field `lastVerified` date, so staleness is visible per number rather than per city
- [ ] Surface a "data freshness" panel listing every parameter older than 12 months
- [ ] Automated reminder: a monthly CI job that opens an issue when any rule file exceeds its freshness window

**Acceptance:** the `unverified` count for social-insurance base drops below 10, and every remaining one has an explicit note explaining what is missing.

### 2.4.0 — Decision support

**Goal: answer "should I take this job?" not just "what does it pay?"**

- [ ] Compare two cities side by side (currently one city at a time)
- [ ] Break-even analysis: how many orders per day before a rental car pays for itself
- [ ] Scenario sharing via URL (encoded parameters, no server)
- [ ] Printable one-page summary for use in a dispute

**Acceptance:** a user can evaluate a job offer end to end without leaving the app, and share the result as a link.

### 2.5.0 — Desktop and offline

- [ ] PWA install with offline rule cache
- [ ] Signed Windows installer with auto-update check
- [ ] Rule pack versioning, so offline users can tell when data is stale

---

## Explicitly not planned

These come up repeatedly and are deliberately out of scope:

| Not doing | Why |
|---|---|
| User accounts / cloud sync | Requires a backend, which breaks the no-data-leaves-the-device promise |
| Scraping platform prices automatically | Platform pricing is a commercial term with no authoritative public source; the user entering their own rate is the only honest path |
| Generic "AI financial advice" chat | The AI here is scoped to explaining this city's numbers; open-ended advice would be unverifiable |
| Gamification / streaks | This is a decision tool used occasionally, not a habit app |

---

## How priorities are set

1. **Wrong number** — always first. A calculation or policy error outranks any feature.
2. **Data provenance** — a placeholder that could be mistaken for a fact.
3. **Blocked decision** — a user cannot finish the task they came for.
4. **Friction** — the task works but is slow or confusing.
5. **New capability** — everything else.

## Contributing to the roadmap

Open a discussion with the decision you're trying to make, not the feature you want. See [CONTRIBUTING.md](CONTRIBUTING.md).
