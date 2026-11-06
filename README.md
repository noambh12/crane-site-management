# CraneOps SaaS MVP

A working English-language, responsive tower crane operations app built with **Next.js App Router, TypeScript, Tailwind CSS 4, Supabase Auth and PostgreSQL**. It connects to a real Supabase database; there is no demo-data mode. No deployment is configured or performed.

For the existing CraneOps project and the pending security hardening proposal, follow [LOCAL_SETUP.md](LOCAL_SETUP.md). The proposal is tested in an isolated database; it must not be applied to the hosted project without owner approval.

### Private development preview

`/preview` renders the actual workspace components with an isolated, in-memory demo adapter. A persistent **DEMO** banner identifies every screen; no API keys, Supabase calls, real users, or live database writes are involved. Refresh/Reset demo discards changes. The normal `/` route continues to use authenticated Supabase data and never silently falls back to samples.

CI saves a `craneops-web-preview` artifact containing a static build and a dependency-free loopback preview server. This is an artifact only, not a deployment. After extracting, the existing Codex Node runtime can run `node scripts/serve-preview.mjs`; open `http://127.0.0.1:4173/preview`. No public hosting or merge is performed.

## Features

- Email/password registration, email confirmation and login/logout.
- Company onboarding: the verified founder becomes Company Admin.
- Company isolation enforced by PostgreSQL RLS, including direct API requests.
- Dashboard with fleet status, active sites, open/critical faults, due maintenance and activity.
- Create/edit cranes, serial numbers, manufacturer/model, capacity, status and assigned site.
- Create/edit construction sites, addresses, contacts and status.
- Fault reporting, priorities, status tracking and required resolution notes.
- Services and inspections with due dates, status, notes and repeat intervals.
- Completing a recurring task atomically schedules its next occurrence. Completed records are immutable.
- Team membership and role management for registered, email-verified accounts.
- Company-scoped activity log for operational record creation and updates.

## Local setup (Windows, macOS or Linux)

Install **Node.js 24 LTS** and Git, then:

```sh
git clone --branch fix/craneops-security-hardening https://github.com/noambh12/crane-site-management.git
cd crane-site-management
npm ci
```

### 1. Create and configure Supabase

1. Create a new Supabase project. Keep the database password private.
2. Open **SQL Editor**, paste the complete contents of `supabase/migrations/202611060001_craneops.sql`, and run it once. The migration targets a fresh project and runs in one transaction. It creates the tables, enums, constraints, functions, triggers, indexes, grants and RLS policies. Do not re-run it on an already migrated database. Future schema changes should use new migrations.
3. In **Authentication → Providers**, enable Email/password and email confirmations. In **Authentication → URL Configuration**, set Site URL to `http://localhost:3000` and allow `http://localhost:3000` as a redirect URL. Keep new URLs restricted to trusted app origins.
4. Copy the project URL and **publishable key** from the project API settings. A legacy `anon` key also works. The app never needs a secret/service-role key or database password.

### 2. Configure local environment

Copy `.env.example` to `.env.local`:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```sh
# macOS / Linux
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

These two values are public connection identifiers, not administrator credentials. PostgreSQL RLS provides data protection. **Never put service-role/secret keys, SMTP passwords, database passwords or real account passwords in client variables or Git.** `.env.local` is ignored by Git. Restart Next.js after changing variables; rebuild before running a production build with changed public variables.

### 3. Start

```sh
npm run dev
```

Open `http://localhost:3000`. Without environment variables, the app shows setup instructions instead of fabricating data. For a local production-mode run:

```sh
npm run build
npm start
```

### 4. First company and teammates

1. Create an account with a password of at least 12 characters and confirm the email link.
2. Sign in and create a company. This transaction creates your membership as Company Admin.
3. Add a site, add a crane and assign it to the site, then report faults or schedule maintenance.
4. Teammates register and confirm their emails but **do not create a company**. They leave the onboarding screen open.
5. A Company Admin opens **Team & access → Add a team member** and enters the teammate's verified email and role. The teammate clicks **Check team access**.

This MVP supports one company per user. Existing members cannot be attached to another company. The UI does not send invitations or emails on the admin's behalf. The company must retain at least one Company Admin; concurrent role changes are serialized with a company-row lock.

## Roles

All roles can read their company's records. This MVP grants company-wide access to Site Managers; individual site assignment restrictions are not implemented.

| Capability                          | Company Admin | Fleet Manager | Site Manager | Technician | Viewer |
| ----------------------------------- | ------------- | ------------- | ------------ | ---------- | ------ |
| Dashboard and company records       | Read          | Read          | Read         | Read       | Read   |
| Create/edit cranes and assign sites | Yes           | Yes           | No           | No         | No     |
| Create/edit sites                   | Yes           | Yes           | Yes          | No         | No     |
| Report/update faults                | Yes           | Yes           | Yes          | Yes        | No     |
| Schedule/complete maintenance       | Yes           | Yes           | Yes          | Yes        | No     |
| Add members/change roles            | Yes           | No            | No           | No         | No     |

No client role can delete operational records, directly write memberships/companies, or forge activity logs. Use statuses to retain history. Member removal, ownership transfer, company switching, SSO, billing, attachments, notifications, password recovery UI and per-site access restrictions are outside this first version.

## Database and security design

- Tables: `companies`, `memberships`, `sites`, `cranes`, `faults`, `maintenance`, `activity_log`.
- Each operational record contains `company_id`. Composite foreign keys prevent a crane, fault or maintenance task from referencing another company's records.
- RLS checks the authenticated `auth.uid()` against the protected `memberships` table, never user-editable signup metadata or UI fields.
- Narrow `SECURITY DEFINER` functions use an empty search path. They provide safe membership lookup, transactional company creation and admin-only membership changes. Anonymous execution is revoked.
- Table privileges are explicitly restricted; database policies enforce the same role matrix as the UI. Ownership cannot change via updates, and reported-by identity is database-controlled.
- The frontend uses the Supabase JS client with persisted browser sessions and automatic refresh. Next.js serves the application shell; all private data is fetched through the user's authenticated Supabase session. There are no privileged server routes or embedded admin keys. Session validity is checked against Auth before loading workspace data.
- Writes request the saved row back, so a denied/zero-row update is not reported as successful. Lists read in pages of 1,000 instead of silently truncating at Supabase's default row limit.
- Activity is recorded by database triggers. It currently records operational event, entity ID, actor, timestamp and status, not full before/after diffs or team changes.
- Dates are date-only for due tasks; timestamps display in the browser timezone. The next due date is `greatest(previous due date, database current_date) + interval_days`. Dashboard due-date comparison uses UTC calendar date. A recurring record creates the next occurrence, not an infinite pre-generated series.
- Changing a fault to critical does not automatically mark the crane out of service. Crane operating status is set explicitly by authorized fleet personnel. The app is an operational tracker and does not certify legal inspection compliance.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npx playwright install chromium
npm run test:browser
```

- `npm test`: 12 role and validation checks with Vitest.
- `npm run test:db`: 20 checks against the actual SQL migration in **PGlite (embedded PostgreSQL)**. Only the Supabase `auth.users` table and `auth.uid()` are stubbed. Tests exercise actual database grants, RLS, constraints, triggers and RPCs with `SET ROLE authenticated/anon`, two companies and all five roles. Coverage includes cross-tenant reads/writes/references, role escalation, anonymous access, last-admin protection, member onboarding and recurrence.
- `npm run test:browser`: desktop and mobile Chromium smoke tests for setup, login/registration rendering, input validation, responsive overflow and runtime errors. These do not claim to test real email delivery or hosted Supabase authentication. The browser config uses non-secret placeholder project values and a second isolated Next build directory. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only if using a preinstalled Chromium executable.
- GitHub Actions runs lint, typecheck, unit/database checks and production build in one job, and all desktop/mobile browser smoke checks in a separate job using `mcr.microsoft.com/playwright:v1.65.0-noble`. Chromium and Ubuntu libraries are already installed in that image: CI does not call `apt` or `playwright install`. `@playwright/test` is pinned to the same exact version; `scripts/check-playwright.mjs` checks the version/lockfile and launches the installed Chromium before the suite. Update the image tag, `PLAYWRIGHT_IMAGE_VERSION`, package version and lockfile together.
- The workflow tests every PR update and pushes to `main`, avoiding duplicate push + PR runs for development branches. Concurrency cancels superseded runs. Dependency installation and browser checks have explicit time limits. Neither verification job ignores errors; browser failures fail the workflow. The browser job uploads an HTML report and failure traces for seven days.
- CI has read-only repository permissions, does not persist checkout credentials, and has no deploy step or application secrets.

### Live Supabase acceptance checklist

A project URL/public key and verified test accounts are needed to execute these checks. The local SQL tests do not replace them:

1. Register two separate company founders, confirm email links, sign in and create two companies.
2. Create site/crane/fault/maintenance records in each. Refresh and sign back in to confirm persistence.
3. Add users for each role; verify permitted writes and read-only Viewer behavior.
4. Attempt direct REST updates using one company's user access token and the other company's IDs. Verify no foreign rows are read/updated and inserts/references fail.
5. Complete recurring maintenance; confirm exactly one next task and an immutable completed record.
6. Test email redirect settings, token expiry/refresh, invalid credentials and logout in an actual hosted Supabase environment.

## Source map

```text
app/                         Next.js entry, layout and responsive styling
components/craneops.tsx       Auth, onboarding, dashboard and CRUD workspace
lib/domain.ts                Shared validation and UI permission definitions
lib/supabase.ts              Public authenticated browser client
supabase/migrations/         PostgreSQL schema, RLS, grants, RPCs and triggers
scripts/test-db.mjs           Embedded PostgreSQL security/behavior tests
tests/                       Validation tests and browser smoke tests
.github/workflows/ci.yml     Verification only; no deployment
```

Review the pull request before merging. Configure a Supabase project and complete the live checklist before using operational data. Nothing in this repository publishes the app automatically.

