# Versioning Policy

This project follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html), with a project-specific interpretation of what each segment means.

## Format

```
MAJOR.MINOR.PATCH
```

Three numeric segments, no leading zeros, no pre-release suffix in released versions.

## What each segment means here

| Segment | Bump when | Example |
|---|---|---|
| **MAJOR** | A stored data format changes incompatibly (localStorage keys, exported parameter files), or a calculation basis changes such that the same input now yields a materially different number | Changing from annual settlement to withholding basis |
| **MINOR** | New capability, new city, new module, or new knowledge-base section — existing data and behavior stay valid | Adding a city, adding a tax module |
| **PATCH** | Bug fix, copy correction, dependency patch, or data value correction that does not change the calculation method | Correcting a minimum-wage figure, fixing a contrast ratio |

### The special case: data corrections

A wrong policy number is a defect, so correcting one is a **PATCH** bump — even though it changes the number a user sees. The rule is that the *method* is unchanged; only an input was wrong.

If a correction changes which method is applied (for example, discovering that a city uses a different tax table), that is a **MAJOR** bump, because the output for identical input changes meaning.

## Version locations

The version appears in exactly three places and must be kept in sync:

| File | Field |
|---|---|
| `package.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `package.version` |

A mismatch fails the release checklist. `scripts/bump-version.mjs` updates all three at once.

## Release process

1. **Decide the segment** using the table above.
2. **Bump all three files**:
   ```bash
   node scripts/bump-version.mjs 2.3.0
   ```
3. **Update `CHANGELOG.md`** — move `[Unreleased]` entries into the new version with today's date. Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) categories: Added, Changed, Deprecated, Removed, Fixed, Security.
4. **Run the full gate**:
   ```bash
   npm run typecheck && npm run typecheck:test
   npm test && npm run verify && npm run verify:reality && npm run kb:check
   npm run build
   npm run test:e2e
   ```
5. **Commit** with `chore(release): X.Y.Z`.
6. **Tag** with an annotated tag:
   ```bash
   git tag -a v2.3.0 -m "v2.3.0"
   ```
7. **Push** branch and tag to all mirrors:
   ```bash
   git push --all && git push --tags
   ```
8. **Publish the GitHub release** with notes copied from the CHANGELOG section.

## Pre-release versions

For work in progress, use `X.Y.Z-alpha.N` or `X.Y.Z-beta.N`. These are never tagged on `main` — only on a short-lived branch, and never published as a release.

## What does not get a version bump

- Documentation-only changes (README, comments) — still a normal commit, no version change
- CI configuration changes
- Test additions that do not change production behavior

## Changelog discipline

Every user-visible change gets a line. The test is: *would a user notice this?* If yes, it belongs in the changelog. If it is purely internal (refactor, test, CI), it does not.
