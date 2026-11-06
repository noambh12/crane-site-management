# MVP verification — 6 November 2026

| Check                       | Result    | Scope                                                                                                                                     |
| --------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                      | Passed    | Next.js/TypeScript source and test code                                                                                                   |
| TypeScript                  | Passed    | Strict type checking                                                                                                                      |
| Vitest                      | 12 passed | Role matrix and validation, including invalid capacities/dates and required fault resolution                                              |
| PostgreSQL                  | 20 passed | Actual migration executed in PGlite; RLS, grants, RPCs, cross-company isolation/references, role matrix, onboarding, audit and recurrence |
| Production build            | Passed    | `next build`, no Supabase project credentials required to build the shell                                                                 |
| Chromium browser tests      | 4 passed  | Setup and login/registration screens at desktop and mobile sizes; validation, overflow and runtime errors                                 |
| Production dependency audit | Passed    | `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities at the time of verification                                      |
| Hosted Supabase end-to-end  | Not run   | Requires a configured Supabase project, migration, public project connection values and verified test accounts                            |

The normal Playwright browser download returned an invalid archive in this environment. Browser smoke checks subsequently passed with a locally extracted Chromium 153 executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. The repository uses the standard Playwright browser installation in CI. No external browser executable or extra Chromium distribution is committed.

The PostgreSQL checks use real embedded PostgreSQL and the production migration, with minimal `auth.users` / `auth.uid()` stubs. They do not test the hosted Supabase Auth service, email delivery, PostgREST transport, token refresh or a full authenticated browser CRUD journey. Follow the README's live acceptance checklist after configuring Supabase.

No deployment was performed. No real keys, passwords or account data were used in tests or committed.
