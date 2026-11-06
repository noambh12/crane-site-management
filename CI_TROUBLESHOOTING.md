# Browser CI installation delay — 6 November 2026

## Evidence and cause

Two workflows ran for the same commit because the original workflow listened to both `push` on the development branch and `pull_request`:

- [PR run 42218754871](https://github.com/noambh12/crane-site-management/actions/runs/42218754871) completed successfully, including four browser checks.
- [Push run 42218719235](https://github.com/noambh12/crane-site-management/actions/runs/42218719235) appeared stuck in `npx playwright install --with-deps chromium`. It eventually completed successfully too.

The slow job's full log identifies the delay in Ubuntu package download, before Chromium download:

| UTC timestamp     | Evidence                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| 12:35:59          | Download of `fonts-ipafont-gothic` starts from `azure.archive.ubuntu.com` |
| 12:37:46          | APT logs `Ign:2` and advances to `fonts-freefont-ttf`                     |
| 12:41:31          | APT logs `Ign:3`; several other font packages also download slowly        |
| 12:46:38–12:46:48 | APT retries the first two font packages                                   |
| 12:47:04          | APT reports `Fetched 13.2 MB in 11min 6s (19.8 kB/s)`                     |
| 12:47:09–12:47:17 | Chromium, FFmpeg and headless-shell download successfully                 |

This was a transient slow/retrying Ubuntu mirror transfer, rather than an application test deadlock or evidence of incompatible Chromium. Duplicate event triggers made a successful PR run and a slow push run visible together. The logs do not establish a more specific network-level cause for the mirror slowdown.

## Fix

- Keep lint/type checks, all 12 unit tests, all 20 PostgreSQL checks and production build in the verification job.
- Run all four desktop/mobile browser tests in a separate job using `mcr.microsoft.com/playwright:v1.65.0-noble`. It includes the browsers and native Ubuntu libraries; no `apt` or `playwright install` command runs in CI.
- Pin `@playwright/test` to exactly `1.65.0` in the manifest and lockfile. The preflight script checks installed/locked/image versions, checks the executable exists and actually launches Chromium. Missing browsers/libraries or a version mismatch fail immediately instead of downloading or skipping tests.
- Run PR checks on PR events and push checks only on `main`. Cancel superseded runs with concurrency groups.
- Bound dependency installation, preflight and browser execution. Playwright has a three-minute global timeout, one CI worker and `forbidOnly`; no browser failure is ignored. Save HTML reports and failure traces as workflow artifacts for seven days.

Docker is not available in the local editing environment, so the image itself is verified by the real GitHub Actions container job. Local browser checks use the available Chromium executable. Follow the PR checks for the definitive result of the updated workflow. Hosted Supabase acceptance remains outside these smoke checks.

No merge or deployment is part of this change.
