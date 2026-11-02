# Security Policy

[简体中文](SECURITY.zh-CN.md)

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via GitHub Security Advisories:

- https://github.com/badhope/no-money/security/advisories/new
- https://github.com/X33834/no-money/security/advisories/new
- https://github.com/Morningstar202604/no-money/security/advisories/new

Include: affected version, reproduction steps, and impact. We aim to respond within 7 days.

## Scope

This is a static, client-only application with no backend, no accounts, and no server-side data. The realistic attack surface is narrow:

| Area | In scope |
|---|---|
| XSS via rule files or knowledge base content | Yes |
| API key leakage to third parties | Yes |
| Endpoint validation bypass (user-configured AI endpoint) | Yes |
| localStorage poisoning via crafted values | Yes |
| Tauri IPC / CSP misconfiguration | Yes |
| Dependency vulnerabilities | Yes |
| Compromised CDN or build pipeline | Yes |

## Security design decisions

**No backend.** There is no server to breach and no database to leak. All calculation happens in the browser.

**API key handling.** The key is held in memory by default and is never written to disk unless the user explicitly enables "remember". When enabled it is stored in `localStorage` in plaintext — the UI states this plainly rather than implying encryption that does not exist. A same-origin script or browser extension can read it; that is the user's accepted trade-off.

**Chat history.** Same model: in-memory by default, persisted only on explicit opt-in, capped at 50 messages.

**Endpoint validation.** The AI endpoint must be an `https:` URL (or `http://localhost`) — this blocks accidental plaintext transmission of the key.

**No third-party scripts.** No analytics, no CDN fonts, no external JS. Everything is bundled.

**Content Security Policy.** The Tauri build sets `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and `form-action 'self'`.

**No `innerHTML` with untrusted data.** Error messages that may contain user-influenced text are inserted as text nodes.

## Dependency policy

- `npm audit --audit-level=high` runs in CI and must pass.
- `overrides` pin `minimatch` and `glob` to patched versions where transitive ranges would otherwise resolve vulnerable builds.
- Production builds never emit sourcemaps (`SOURCE_MAP=1` is required to opt in).

## Supported versions

Only the latest release on `main` receives security fixes.
