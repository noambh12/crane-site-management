/** Executes the real migration against embedded PostgreSQL, not a mocked policy engine.
 * Auth schema/functions are the only stubs; hosted Supabase Auth still needs live smoke tests.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
let passed = 0;
const u = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
async function query(sql, params = []) {
  return db.query(sql, params);
}
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function denied(sql, params = []) {
  await assert.rejects(() => query(sql, params));
}
async function as(n) {
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub',$1,false)", [
    n ? u(n) : "",
  ]);
  await db.exec(n ? "set role authenticated" : "set role anon");
}
await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/202611060001_craneops.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
// Reproduce Supabase's default authenticated EXECUTE grants before hardening.
await db.exec("grant execute on all functions in schema public to authenticated");
await db.exec(await readFile(new URL("../supabase/proposals/harden_function_access.sql", import.meta.url), "utf8"));
for (let i = 1; i <= 9; i++)
  await query("insert into auth.users values($1,$2,$3)", [
    u(i),
    `user${i}@example.test`,
    i === 8 ? null : new Date().toISOString(),
  ]);
await as(1);
const a = (
  await query("select public.register_company('Alpha Construction') id")
).rows[0].id;
await as(2);
const b = (
  await query("select public.register_company('Beta Construction') id")
).rows[0].id;
await as(1);
for (const [n, r] of [
  [3, "fleet_manager"],
  [4, "site_manager"],
  [5, "technician"],
  [6, "viewer"],
  [9, "company_admin"],
])
  await query("select public.add_company_member($1,$2)", [
    `user${n}@example.test`,
    r,
  ]);
const siteA = (
  await query(
    "insert into public.sites(company_id,name,address) values($1,'Alpha site','Street A') returning id",
    [a],
  )
).rows[0].id;
const craneA = (
  await query(
    "insert into public.cranes(company_id,name,serial_number,manufacturer,model,capacity_t,site_id) values($1,'Alpha crane','A1','Liebherr','280',12,$2) returning id",
    [a, siteA],
  )
).rows[0].id;
await as(2);
const siteB = (
  await query(
    "insert into public.sites(company_id,name,address) values($1,'Beta site','Street B') returning id",
    [b],
  )
).rows[0].id;
const craneB = (
  await query(
    "insert into public.cranes(company_id,name,serial_number,manufacturer,model,capacity_t,site_id) values($1,'Beta crane','B1','Potain','MD',10,$2) returning id",
    [b, siteB],
  )
).rows[0].id;
await check(
  "tenant reads hide foreign cranes, sites, companies and memberships",
  async () => {
    await as(1);
    for (const table of ["cranes", "sites", "companies"]) {
      const rows = (await query(`select * from public.${table}`)).rows;
      assert.equal(rows.length, 1);
    }
    assert.equal(
      (await query("select * from public.memberships where company_id=$1", [b]))
        .rows.length,
      0,
    );
  },
);
await check(
  "anonymous table access and company registration denied",
  async () => {
    await as(null);
    await denied("select * from public.cranes");
    await denied("select public.register_company('Intruder')");
  },
);
await check("unverified account cannot create a company", async () => {
  await as(8);
  await denied("select public.register_company('Unverified')");
});
await check("authenticated user cannot register twice", async () => {
  await as(1);
  await denied("select public.register_company('Another')");
});
await check("cross-company inserts and references denied", async () => {
  await as(1);
  await denied(
    "insert into public.sites(company_id,name,address) values($1,'Bad','Bad')",
    [b],
  );
  await denied("update public.cranes set site_id=$1 where id=$2", [
    siteB,
    craneA,
  ]);
  await denied(
    "insert into public.faults(company_id,crane_id,title) values($1,$2,'Bad reference')",
    [a, craneB],
  );
  await denied(
    "insert into public.maintenance(company_id,crane_id,title,kind,due_date) values($1,$2,'Bad','service',current_date)",
    [a, craneB],
  );
});
await check("foreign updates affect zero rows", async () => {
  await as(1);
  assert.equal(
    (
      await query(
        "update public.cranes set name='Hijacked' where id=$1 returning id",
        [craneB],
      )
    ).rows.length,
    0,
  );
});
await check("tenant ownership cannot change", async () => {
  await as(1);
  await denied("update public.cranes set company_id=$1 where id=$2", [
    b,
    craneA,
  ]);
});
await check("direct membership writes and role escalation denied", async () => {
  await as(6);
  await denied(
    "update public.memberships set role='company_admin' where user_id=$1",
    [u(6)],
  );
  await denied("select public.change_member_role($1,'company_admin')", [u(6)]);
  await denied(
    "select public.add_company_member('user7@example.test','company_admin')",
  );
});
for (const [n, role, areas] of [
  [1, "admin", ["sites", "cranes", "faults", "maintenance"]],
  [3, "fleet manager", ["sites", "cranes", "faults", "maintenance"]],
  [4, "site manager", ["sites", "faults", "maintenance"]],
  [5, "technician", ["faults", "maintenance"]],
  [6, "viewer", []],
]) {
  await check(`${role}: SQL insert and update permission matrix`, async () => {
    await as(n);
    const inserts = {
      sites: [
        "insert into public.sites(company_id,name,address) values($1,'Role site','Address') returning id",
        [a],
      ],
      cranes: [
        "insert into public.cranes(company_id,name,serial_number,manufacturer,model,capacity_t) values($1,'Role crane',$2,'M','M',1) returning id",
        [a, `ROLE-${n}`],
      ],
      faults: [
        "insert into public.faults(company_id,crane_id,title) values($1,$2,'Role fault') returning id",
        [a, craneA],
      ],
      maintenance: [
        "insert into public.maintenance(company_id,crane_id,title,kind,due_date) values($1,$2,'Role service','service',current_date) returning id",
        [a, craneA],
      ],
    };
    for (const [table, [sql, params]] of Object.entries(inserts)) {
      if (areas.includes(table)) {
        const id = (await query(sql, params)).rows[0].id;
        const field =
          table === "sites" || table === "cranes" ? "name" : "title";
        assert.equal(
          (
            await query(
              `update public.${table} set ${field}='Updated' where id=$1 returning id`,
              [id],
            )
          ).rows.length,
          1,
        );
      } else {
        await denied(sql, params);
        const field =
          table === "sites" || table === "cranes" ? "name" : "title";
        assert.equal(
          (
            await query(
              `update public.${table} set ${field}='Denied' returning id`,
            )
          ).rows.length,
          0,
        );
      }
    }
  });
}
await check("no client deletes or forged activity events", async () => {
  await as(1);
  await denied("delete from public.cranes where id=$1", [craneA]);
  await denied(
    "insert into public.activity_log(company_id,entity,entity_id,action,details) values($1,'cranes',$2,'fake','{}')",
    [a, craneA],
  );
});
await check("audit events are company-scoped", async () => {
  await as(2);
  assert.equal(
    (await query("select * from public.activity_log where company_id=$1", [a]))
      .rows.length,
    0,
  );
  assert.ok((await query("select * from public.activity_log")).rows.length > 0);
});
await check("cannot change another company member role", async () => {
  await as(1);
  await denied("select public.change_member_role($1,'viewer')", [u(2)]);
});
await check("last company admin is protected", async () => {
  await as(1);
  await query("select public.change_member_role($1,'viewer')", [u(9)]);
  await denied("select public.change_member_role($1,'viewer')", [u(1)]);
});
await check("verified unassigned user can join a company", async () => {
  await as(1);
  await query(
    "select public.add_company_member('user7@example.test','viewer')",
  );
  await as(7);
  assert.equal(
    (await query("select private.current_company_id() id")).rows[0].id,
    a,
  );
});
await check(
  "recurring service completes and schedules exactly one next occurrence",
  async () => {
    await as(5);
    const task = (
      await query(
        "insert into public.maintenance(company_id,crane_id,title,kind,due_date,interval_days) values($1,$2,'Recurring test','inspection',current_date,30) returning id",
        [a, craneA],
      )
    ).rows[0].id;
    await query(
      "update public.maintenance set status='completed' where id=$1",
      [task],
    );
    const rows = (
      await query(
        "select * from public.maintenance where title='Recurring test' order by due_date",
      )
    ).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].status, "completed");
    assert.ok(rows[0].completed_at);
    assert.equal(rows[1].status, "scheduled");
    assert.equal(
      (
        await query(
          "select due_date=current_date+30 ok from public.maintenance where title='Recurring test' and status='scheduled'",
        )
      ).rows[0].ok,
      true,
    );
    await denied(
      "update public.maintenance set status='scheduled' where id=$1",
      [task],
    );
  },
);
await check("resolved faults require resolution", async () => {
  await as(5);
  await denied(
    "insert into public.faults(company_id,crane_id,title,status) values($1,$2,'Unexplained','resolved')",
    [a, craneA],
  );
});

await check("no SECURITY DEFINER functions remain in the exposed public schema", async () => {
  await as(1);
  assert.equal((await query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows[0].n, 0);
  for (const name of ["current_company_id", "has_company_role", "log_record", "prepare_record", "schedule_next_maintenance"]) {
    assert.equal((await query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1", [name])).rows[0].n, 0);
  }
});
await check("internal trigger functions deny direct client execution after default grants", async () => {
  for (const n of [1, null]) {
    await as(n);
    for (const name of ["log_record", "prepare_record", "schedule_next_maintenance"]) {
      assert.equal((await query("select has_function_privilege(current_user,$1,'execute') ok", [`private.${name}()`])).rows[0].ok, false);
    }
    await denied("select private.log_record()");
  }
});
await check("all private functions deny anonymous execution; private schema denies CREATE", async () => {
  await as(1);
  assert.equal((await query("select has_schema_privilege(current_user,'private','create') ok")).rows[0].ok, false);
  await denied("create function private.intruder() returns int language sql as 'select 1'");
  await as(null);
  assert.equal((await query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and has_function_privilege(current_user,p.oid,'execute')")).rows[0].n, 0);
  await denied("select public.add_company_member('user7@example.test','company_admin')");
  await denied("select public.change_member_role($1,'company_admin')", [u(1)]);
});
await check("unassigned authenticated account cannot read any tenant data", async () => {
  await as(8);
  for (const table of ["companies", "memberships", "sites", "cranes", "faults", "maintenance", "activity_log"]) {
    assert.equal((await query(`select * from public.${table}`)).rows.length, 0);
  }
  await denied("select public.add_company_member('user7@example.test','viewer')");
  await denied("select public.change_member_role($1,'viewer')", [u(1)]);
});
await check("all seven tables isolate both tenants; foreign operational updates return zero", async () => {
  for (const [n, company, other, crane] of [[1, a, b, craneA], [2, b, a, craneB]]) {
    await as(n);
    await query("insert into public.faults(company_id,crane_id,title) values($1,$2,'Isolation fault')", [company, crane]);
    await query("insert into public.maintenance(company_id,crane_id,title,kind,due_date) values($1,$2,'Isolation service','service',current_date)", [company, crane]);
  }
  for (const [n, company, other] of [[1, a, b], [2, b, a]]) {
    await as(n);
    for (const table of ["companies", "memberships", "sites", "cranes", "faults", "maintenance", "activity_log"]) {
      const column = table === "companies" ? "id" : "company_id";
      const visible = (await query(`select * from public.${table}`)).rows;
      assert.ok(visible.length > 0);
      assert.ok(visible.every(row => row[column] === company));
      assert.equal((await query(`select * from public.${table} where ${column}=$1`, [other])).rows.length, 0);
    }
    for (const table of ["sites", "cranes", "faults", "maintenance"]) {
      const field = ["sites", "cranes"].includes(table) ? "name" : "title";
      assert.equal((await query(`update public.${table} set ${field}='Foreign edit' where company_id=$1 returning id`, [other])).rows.length, 0);
      await denied(`delete from public.${table} where company_id=$1`, [other]);
    }
  }
});
await check("anonymous access denied on all seven tables", async () => {
  await as(null);
  for (const table of ["companies", "memberships", "sites", "cranes", "faults", "maintenance", "activity_log"]) {
    await denied(`select * from public.${table}`);
  }
});
await check("audit triggers still work without direct EXECUTE privilege", async () => {
  await as(1);
  const site = (await query("insert into public.sites(company_id,name,address) values($1,'Audit regression','Address') returning id", [a])).rows[0].id;
  const logs = (await query("select * from public.activity_log where entity_id=$1", [site])).rows;
  assert.equal(logs.length, 1);
  assert.equal(logs[0].company_id, a);
  assert.equal(logs[0].actor_id, u(1));
});

await db.close();
console.log(`\n${passed} database security and behavior checks passed.`);

