# Run CraneOps locally

This change does not deploy the site or apply SQL to a hosted database.

1. Install Node.js 24 LTS **with npm**, and Git.
2. Download/check out branch `fix/craneops-security-hardening` from this repository.
3. In the application folder run `npm ci`.
4. Copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://pyartaewcshdbrpqxmxi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your active public publishable key>
```

Copy the public key from Supabase Settings → API Keys. Never use secret/service-role keys or database passwords. `.env.local` is excluded from Git. Public values are embedded in the browser build: the preflight guard helps reject incorrect configuration, but it does not make public environment variables secret.

5. Run `npm run check:supabase`. This performs only reads: Auth settings and anonymous requests for zero rows on seven tables. It does not create accounts or call RPCs. Expected results: Auth returns HTTP 200; all seven anonymous table requests return 401/403.
6. In Supabase Authentication settings, verify Email/password is enabled, email confirmations are enabled, Site URL is `http://localhost:3000`, and that exact address is allowed for redirects. These settings have not been changed by this PR. Changing them needs owner approval.
7. Run `npm run dev -- --hostname 127.0.0.1`. Open **http://127.0.0.1:3000**. For email confirmation, also approve this exact address in Auth Site URL and allowed redirect URLs. Binding to 127.0.0.1 keeps the development server local to your computer.

## Database approval required

The active project already has the seven tables. **Do not rerun the original migration.**

`supabase/proposals/harden_function_access.sql` is a tested proposal, not an automatically applied migration. The Supabase CLI was unavailable in the preparation environment. After the owner approves the SQL, use `supabase migration new harden_function_access`, copy the proposal into the generated file, and review/apply that migration once through the project's normal process. Keep `private` outside the Data API's exposed schemas.

The SQL moves privileged functions and trigger helpers to `private`, keeps three compatible invoker RPC wrappers in `public`, and explicitly removes client EXECUTE from trigger-only functions. Existing policy and trigger dependencies follow the moved functions. No client code change requires applying this proposal immediately; however, the hosted database warnings remain until the approved database change is applied.

After approval, verify advisors and complete live acceptance testing with two verified founders and separate companies. Account creation, company setup, and sample data write to the active project and were intentionally not performed. Test login/email confirmation, persistence, cross-company REST access, role restrictions, and recurring maintenance before entering operational data.

## Checks

```sh
npm run test:config
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:browser
```

The database suite runs the original migration plus the hardening proposal **only in an isolated PGlite database**. It reproduces broad default function grants first, then checks that hardening removes them. Hosted Auth and email delivery are not simulated by those tests.
