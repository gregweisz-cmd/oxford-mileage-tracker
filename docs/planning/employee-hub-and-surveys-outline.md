# Employee Hub + multi-app ecosystem — planning outline

> Captured from product/architecture discussion (March 2026). Not implementation-ready; revisit before build.

## Goals

- Multiple apps (mix of **native + web** and **native-only**) that feel connected.
- A central **Employee Hub** app for navigation/launching and shared identity/entitlements where needed.
- Prefer **reuse of the existing Oxford mileage backend** for core employee/house/state data and cross-app concerns.

## Repo / project structure (decision space)

- **Default recommendation:** separate client apps (Hub, Mileage, etc.) + **shared packages** or a **monorepo** (`apps/*`, `packages/*`).
- **Avoid:** bolting unrelated products into one Expo app unless intentionally a monorepo with strict boundaries.
- **Linking mechanism:** deep links / universal links + shared auth/session strategy + stable employee/house identifiers.

## Backend strategy

- **Core backend (existing):** system of record for employees/houses/states, RBAC for state staff, entitlements (“which apps/features”), audit-friendly operations.
- **Survey backend (likely separate deployable + DB):** different traffic shape, retention/export needs, public endpoints, integrations; keeps core domain clean.
- **Optional later:** API gateway/BFF if you want one public hostname and uniform auth at the edge.

---

## Surveys — two programs

### A) Monthly house surveys (4400+ houses)

- **Frequency:** monthly.
- **Identity:** house-level workflow; monitored/maintained by **state staff** (scoped access).
- **Email:** `@oxfordhouse.us` house inboxes on **Google Workspace** (org-administered).
- **Auth (discussed):** **Google OAuth** so houses sign in with the house Google account.
- **Client surface:** **mobile-friendly website** is a good fit (shared computers, no install friction).
- **“Anonymous” nuance:** typically **house-identified / pseudonymous at house level**, not member-anonymous.

### B) Annual state surveys (~44k–50k/year, growing)

- **Audience:** members across states; **~47 states**; **each state gets a specific month** to collect (spread load).
- **Anonymity intent:** **no OAuth**; open access for lowest friction.
- **Risk stance:** historically low spam; accept openness but plan **lightweight bot defenses** if scale/visibility changes.
- **Vacancy integration:** use **Vacancy website/API** for **expected headcount per house** when the survey goes live (today: Google Forms + response sheet calling the site for live vacancy numbers).

### Scale notes

- **44k–50k annual** responses/year is manageable for a dedicated survey service with normal web patterns.
- Growth to multiples of that is still feasible with simple ingestion and avoiding spreadsheet-as-database bottlenecks.

### Analytics tension (decide explicitly later)

- If dashboards show **per-house completion vs vacancy**, you likely need a **house key** on submissions (house-identified tracking, not necessarily member-identified).
- If responses must be **fully unlinkable** to houses, vacancy can still inform **planning**, but **per-house completion math** is harder to justify honestly.

### Open-web protections (no login) — optional toolkit

- Server-enforced **open/close windows** per state/month.
- **Rate limits** + anomaly-triggered CAPTCHA (e.g. Turnstile / reCAPTCHA-style).
- Honeypots + strict schema validation.
- Short **log retention** for IPs/user-agents if you want a cleaner anonymity story.

---

## Integration sketch (future)

- Hub reads **entitlements** from core backend and deep-links into:
  - Monthly survey web (**OAuth**).
  - Annual survey web (**public**).
- Survey service may call core **server-to-server** for staff authorization and house/state registry, while storing responses separately.

---

## Open decisions to revisit before implementation

- Annual: **state-only dashboards** vs **per-house completion** vs vacancy-driven completion (drives anonymity vs operations).
- Whether any “open annual” controls require logging that affects anonymity claims.
- Monorepo vs multi-repo for shared TS types and API clients.

---

## Related in this repo

- Ship/release workflow: `.cursor/rules/ship-release.mdc`
- Web portal (`admin-web/`) deploys separately from EAS mobile builds
