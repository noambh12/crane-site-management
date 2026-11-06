"use client";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  Building2,
  Construction,
  LayoutDashboard,
  MapPin,
  TriangleAlert,
  Wrench,
  Users,
  LogOut,
  Plus,
  ArrowUpRight,
  RefreshCw,
  X,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import CraneDetails from "./crane-details";
import {
  can,
  roles,
  roleLabel,
  craneSchema,
  siteSchema,
  faultSchema,
  maintenanceSchema,
  isDue,
  type Role,
  type Membership,
  type Company,
  type Crane,
  type Site,
  type Fault,
  type Maintenance,
} from "@/lib/domain";

type Tab = "dashboard" | "cranes" | "sites" | "faults" | "maintenance" | "team";
type RecordType = "cranes" | "sites" | "faults" | "maintenance";
type Editable = Crane | Site | Fault | Maintenance;
type Activity = {
  id: number;
  entity: string;
  action: string;
  created_at: string;
};
const tabs = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "cranes", label: "Crane fleet", icon: Construction },
  { id: "sites", label: "Construction sites", icon: MapPin },
  { id: "faults", label: "Fault reports", icon: TriangleAlert },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "team", label: "Team & access", icon: Users },
] as const;
const errorMessage = (err: unknown, fallback: string) =>
  err && typeof err === "object" && "message" in err
    ? String(err.message)
    : fallback;
const statusLabel = (v: string) => v.replaceAll("_", " ");
function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}>{statusLabel(value)}</span>;
}
function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={error ? "notice error" : "notice"}
    >
      {children}
    </div>
  );
}
function Loading() {
  return (
    <main className="center-screen">
      <div className="loader" />
      <p>Loading your workspace…</p>
    </main>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Construction size={23} />
      </span>
      <span>
        Crane<span className="brand-light">Ops</span>
        <small>FLEET MANAGEMENT</small>
      </span>
    </div>
  );
}
export default function CraneOps() {
  const [client] = useState(getSupabase);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    client.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setSession(error ? null : data.session);
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      if (alive) {
        setSession(next);
        setReady(true);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client]);
  if (!client)
    return (
      <main className="center-screen">
        <Brand />
        <div className="setup-card">
          <span className="eyebrow">WORKSPACE SETUP</span>
          <h1>Connect your Supabase project</h1>
          <p>
            CraneOps needs a database and authentication connection to get
            started.
          </p>
          <ol>
            <li>
              Apply the SQL migration in <code>supabase/migrations</code>.
            </li>
            <li>
              Copy <code>.env.example</code> to <code>.env.local</code>.
            </li>
            <li>
              Add your Supabase URL and public publishable key, then restart the
              app.
            </li>
          </ol>
          <p>Full instructions are included in the repository README.</p>
        </div>
      </main>
    );
  if (!ready) return <Loading />;
  if (!session) return <Auth client={client} />;
  return <Workspace key={session.user.id} client={client} session={session} />;
}
function Auth({ client }: { client: SupabaseClient }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const credentials = {
        email: String(f.get("email")).trim(),
        password: String(f.get("password")),
      };
      const result = register
        ? await client.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: window.location.origin },
          })
        : await client.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      if (register)
        setMessage(
          "Check your email to confirm your account. Then sign in to create a company or join your team.",
        );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">CLARITY FROM THE GROUND UP</span>
          <h1>
            Your fleet.
            <br />
            One clear view.
          </h1>
          <p>
            Keep your cranes, construction sites and maintenance moving
            together.
          </p>
          <div className="auth-stats">
            <div>
              <Construction />
              <strong>Fleet visibility</strong>
              <span>Every crane. Every site.</span>
            </div>
            <div>
              <Wrench />
              <strong>Maintenance control</strong>
              <span>Stay ahead of what’s due.</span>
            </div>
          </div>
        </div>
        <small>CraneOps · Operations workspace</small>
      </section>
      <section className="auth-form-wrap">
        <form onSubmit={submit} className="auth-form">
          <span className="eyebrow">WELCOME TO CRANEOPS</span>
          <h2>{register ? "Create your account" : "Welcome back"}</h2>
          <p>
            {register
              ? "Register to create a company or join an existing team."
              : "Sign in to your company workspace."}
          </p>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <label>
            Work email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 12 : 1}
              maxLength={128}
              placeholder={
                register ? "At least 12 characters" : "Enter your password"
              }
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ArrowUpRight size={17} />
          </button>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to CraneOps?"}{" "}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
                setMessage("");
              }}
            >
              {register ? "Sign in" : "Create account"}
            </button>
          </p>
          <small>
            Your company data is protected by database access policies.
          </small>
        </form>
      </section>
    </main>
  );
}
async function allRows<T>(
  client: SupabaseClient,
  table: string,
  companyId: string,
): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("company_id", companyId)
      .order(table === "memberships" ? "user_id" : "id")
      .range(from, from + 999);
    if (error) throw error;
    result.push(...(data as T[]));
    if (data.length < 1000) return result;
  }
}
export function Workspace({
  client,
  session,
  demo = false,
}: {
  client: SupabaseClient;
  session: Session;
  demo?: boolean;
}) {
  const [membership, setMembership] = useState<Membership | null>(null),
    [company, setCompany] = useState<Company | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<Tab>("dashboard");
  const [selectedCraneId, setSelectedCraneId] = useState<string | null>(null);
  const [cranes, setCranes] = useState<Crane[]>([]),
    [sites, setSites] = useState<Site[]>([]),
    [faults, setFaults] = useState<Fault[]>([]),
    [maintenance, setMaintenance] = useState<Maintenance[]>([]),
    [members, setMembers] = useState<Membership[]>([]),
    [activity, setActivity] = useState<Activity[]>([]);
  const [editor, setEditor] = useState<{
      type: RecordType;
      record?: Editable;
    } | null>(null),
    [search, setSearch] = useState("");
  const load = useCallback(async () => {
    try {
      const verified = await client.auth.getUser();
      setError("");
      setLoading(true);
      if (verified.error) throw verified.error;
      const memberResult = await client
        .from("memberships")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (memberResult.error) throw memberResult.error;
      const member = memberResult.data as Membership | null;
      setMembership(member);
      if (!member) {
        setCompany(null);
        return;
      }
      const [c, cs, ss, fs, ms, team, logs] = await Promise.all([
        client
          .from("companies")
          .select("id,name")
          .eq("id", member.company_id)
          .single(),
        allRows<Crane>(client, "cranes", member.company_id),
        allRows<Site>(client, "sites", member.company_id),
        allRows<Fault>(client, "faults", member.company_id),
        allRows<Maintenance>(client, "maintenance", member.company_id),
        allRows<Membership>(client, "memberships", member.company_id),
        client
          .from("activity_log")
          .select("id,entity,action,created_at")
          .eq("company_id", member.company_id)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (c.error) throw c.error;
      if (logs.error) throw logs.error;
      setCompany(c.data);
      setCranes(cs);
      setSites(ss);
      setFaults(fs);
      setMaintenance(ms);
      setMembers(team);
      setActivity(logs.data);
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Could not load workspace. Check your connection and database migration.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [client, session.user.id]);
  // Initial remote workspace hydration; load also handles explicit user refreshes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    if (!editor) return;
    const previous = document.activeElement as HTMLElement | null;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        setEditor(null);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = document
        .querySelector('[role="dialog"]')
        ?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea",
        );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [editor, busy]);
  async function signOut() {
    setBusy(true);
    const { error } = await client.auth.signOut();
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  async function createCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await client.rpc("register_company", {
      company_name: new FormData(e.currentTarget).get("company_name"),
    });
    if (error) setError(error.message);
    else await load();
    setBusy(false);
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor || !membership) return;
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const schema = {
      cranes: craneSchema,
      sites: siteSchema,
      faults: faultSchema,
      maintenance: maintenanceSchema,
    }[editor.type];
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
      setBusy(false);
      return;
    }
    const query = editor.record
      ? client
          .from(editor.type)
          .update(parsed.data)
          .eq("id", editor.record.id)
          .eq("company_id", membership.company_id)
      : client
          .from(editor.type)
          .insert({ ...parsed.data, company_id: membership.company_id });
    const { data, error } = await query.select("id").single();
    if (error || !data) {
      setError(
        error?.message ?? "No record was saved. Check your permissions.",
      );
    } else {
      setEditor(null);
      setNotice(demo ? "Demo changes saved in this tab only. Refresh the page to reset." : "Changes saved.");
      await load();
    }
    setBusy(false);
  }
  async function addMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await client.rpc("add_company_member", {
      member_email: f.get("email"),
      member_role: f.get("role"),
    });
    if (error) setError(error.message);
    else {
      form.reset();
      setNotice("Team member added.");
      await load();
    }
    setBusy(false);
  }
  async function changeRole(id: string, role: Role) {
    setBusy(true);
    setError("");
    const { error } = await client.rpc("change_member_role", {
      member_id: id,
      member_role: role,
    });
    if (error) setError(error.message);
    else {
      setNotice("Role updated.");
      await load();
    }
    setBusy(false);
  }
  if (loading && !company) return <Loading />;
  if (!membership || !company)
    return (
      <main className="center-screen">
        <Brand />
        <div className="setup-card">
          <span className="eyebrow">LET’S GET SET UP</span>
          <h1>Your next workspace starts here</h1>
          <p>
            Signed in as {session.user.email}. Create a company and become its
            Company Admin, or ask your company admin to add this email to their
            team.
          </p>
          {error && <Notice error>{error}</Notice>}
          <form onSubmit={createCompany}>
            <label>
              Company name
              <input
                name="company_name"
                required
                maxLength={160}
                placeholder="Your construction company"
              />
            </label>
            <button disabled={busy} className="btn primary">
              Create company
            </button>
          </form>
          <div className="onboarding-actions">
            <button
              className="btn"
              onClick={() => void load()}
              disabled={loading}
            >
              Check team access
            </button>
            <button
              className="btn"
              onClick={() => void signOut()}
              disabled={busy}
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  const role = membership.role;
  const craneName = (id: string) =>
    cranes.find((c) => c.id === id)?.name ?? "Unknown crane";
  const siteName = (id: string | null) =>
    sites.find((s) => s.id === id)?.name ?? "Unassigned";
  const openFaults = faults.filter((f) => f.status !== "resolved");
  const due = maintenance.filter(
    (m) => m.status !== "completed" && isDue(m.due_date),
  );
  const matching = (...values: (string | number | null)[]) =>
    values.join(" ").toLowerCase().includes(search.toLowerCase());
  function startEdit(type: RecordType, record?: Editable) {
    setError("");
    setEditor({ type, record });
  }
  const title = tabs.find((t) => t.id === tab)?.label;
  const selectedCrane = cranes.find(c => c.id === selectedCraneId);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-name">
          <span className="company-avatar">
            {company.name[0].toUpperCase()}
          </span>
          <div>
            <strong>{company.name}</strong>
            <small>Company workspace</small>
          </div>
        </div>
        <span className="nav-heading">WORKSPACE</span>
        <nav>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => {
                setTab(t.id);
                setSelectedCraneId(null);
                setSearch("");
                setNotice("");
              }}
            >
              <t.icon size={19} />
              {demo ? ({ dashboard: "Dashboard", cranes: "Cranes", sites: "Sites", faults: "Faults", maintenance: "Maintenance", team: "Team & access" }[t.id]) : t.label}
              {t.id === "faults" && openFaults.length > 0 && (
                <span className="nav-count">{openFaults.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="live-dot" /> {demo ? "Demo workspace" : "Connected workspace"}
            <small>{demo ? "Sample data · No database connection" : "Live data · Supabase"}</small>
          </div>
          <div className="user-info">
            <span className="user-avatar">
              {session.user.email?.[0].toUpperCase()}
            </span>
            <div>
              <strong title={session.user.email}>{session.user.email}</strong>
              <small>{roleLabel(role)}</small>
            </div>
            <button
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void signOut()}
              disabled={busy}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        {demo && <div className="demo-banner" role="status"><strong>DEMO · מצב הדגמה</strong><span>Sample data only — not real company data. Changes stay in this tab; no Supabase requests.</span><button type="button" onClick={() => window.location.reload()}>Reset demo</button></div>}
        <header className="topbar">
          <div>
            Workspace <span>/</span> <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="access-label">{roleLabel(role)}</span>
            <button
              className="mobile-signout"
              aria-label="Sign out"
              disabled={busy}
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">OPERATIONS WORKSPACE</span>
              <h1>{selectedCrane ? selectedCrane.name : tab === "dashboard" ? "Fleet overview" : title}</h1>
              <p>
                {selectedCrane ? "Crane details · Specifications, site, faults and maintenance." : tab === "dashboard"
                  ? "A clear picture of your fleet, sites and upcoming work."
                  : `Manage your company’s ${tab === "team" ? "people and permissions" : title?.toLowerCase()}.`}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="btn"
                disabled={loading || busy}
                onClick={() => void load()}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
                Refresh
              </button>
              {!selectedCrane && tab !== "dashboard" && tab !== "team" && can(role, tab) && (
                <button className="btn primary" onClick={() => startEdit(tab)}>
                  <Plus size={17} />
                  Add{" "}
                  {tab === "cranes"
                    ? "crane"
                    : tab === "sites"
                      ? "site"
                      : tab === "faults"
                        ? "fault"
                        : "task"}
                </button>
              )}
            </div>
          </div>
          {!editor && error && <Notice error>{error}</Notice>}
          {notice && <Notice>{notice}</Notice>}
          {selectedCrane ? <CraneDetails crane={selectedCrane} site={sites.find(s => s.id === selectedCrane.site_id)} faults={faults} maintenance={maintenance} client={client} companyId={membership.company_id} role={role} onBack={() => setSelectedCraneId(null)} onEdit={() => startEdit("cranes", selectedCrane)} onFault={record => startEdit("faults", record)} onMaintenance={record => startEdit("maintenance", record)} /> : <>
          {tab === "dashboard" && (
            <>
              <section className="metrics">
                {[
                  {
                    label: "Total cranes",
                    value: cranes.length,
                    icon: Construction,
                    note: `${cranes.filter((c) => c.status === "operating").length} currently operating`,
                    tab: "cranes",
                  },
                  {
                    label: "Active sites",
                    value: sites.filter((s) => s.status === "active").length,
                    icon: MapPin,
                    note: `${sites.length} sites in your workspace`,
                    tab: "sites",
                  },
                  {
                    label: "Open faults",
                    value: openFaults.length,
                    icon: TriangleAlert,
                    note: `${openFaults.filter((f) => f.priority === "critical").length} critical priority`,
                    tab: "faults",
                  },
                  {
                    label: "Due maintenance",
                    value: due.length,
                    icon: Wrench,
                    note: "Scheduled for today or overdue",
                    tab: "maintenance",
                  },
                ].map((m) => (
                  <button
                    key={m.label}
                    className="metric"
                    onClick={() => setTab(m.tab as Tab)}
                  >
                    <span>
                      {m.label}
                      <m.icon size={19} />
                    </span>
                    <strong>{m.value}</strong>
                    <small>
                      {m.note}
                      <ArrowUpRight size={14} />
                    </small>
                  </button>
                ))}
              </section>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Fleet status</h2>
                      <p>Availability across your entire fleet</p>
                    </div>
                    <Construction size={20} />
                  </div>
                  <div className="status-overview">
                    {[
                      "operating",
                      "available",
                      "maintenance",
                      "out_of_service",
                    ].map((s) => {
                      const count = cranes.filter((c) => c.status === s).length;
                      return (
                        <div key={s}>
                          <div>
                            <Badge value={s} />
                            <strong>{count}</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className={`bar bar-${s}`}
                              style={{
                                width: `${cranes.length ? (count / cranes.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setTab("cranes")}
                  >
                    View crane fleet <ArrowUpRight size={15} />
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Needs attention</h2>
                      <p>Due maintenance and unresolved critical faults</p>
                    </div>
                    <TriangleAlert size={20} />
                  </div>
                  {due.length === 0 &&
                  !openFaults.some((f) => f.priority === "critical") ? (
                    <Empty
                      title="You’re all caught up"
                      detail="Due maintenance and critical faults will appear here."
                    />
                  ) : (
                    <div className="attention-list">
                      {openFaults
                        .filter((f) => f.priority === "critical")
                        .slice(0, 3)
                        .map((f) => (
                          <button key={f.id} onClick={() => setTab("faults")}>
                            <span className="attention-icon danger">
                              <TriangleAlert size={18} />
                            </span>
                            <span>
                              <strong>{f.title}</strong>
                              <small>{craneName(f.crane_id)}</small>
                            </span>
                            <Badge value="critical" />
                          </button>
                        ))}
                      {due
                        .sort((a, b) => a.due_date.localeCompare(b.due_date))
                        .slice(0, 4)
                        .map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setTab("maintenance")}
                          >
                            <span className="attention-icon">
                              <Wrench size={18} />
                            </span>
                            <span>
                              <strong>{m.title}</strong>
                              <small>
                                {craneName(m.crane_id)} · Due {m.due_date}
                              </small>
                            </span>
                            <Badge value={m.kind} />
                          </button>
                        ))}
                    </div>
                  )}
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent activity</h2>
                    <p>Latest changes in your company workspace</p>
                  </div>
                  <span className="subtle">Last 8 events</span>
                </div>
                {activity.length ? (
                  <div className="activity-list">
                    {activity.map((a) => (
                      <div key={a.id}>
                        <span className="activity-dot" />
                        <span>
                          <strong>
                            {a.entity === "maintenance"
                              ? "Maintenance"
                              : roleLabel(a.entity)}{" "}
                            record{" "}
                            {a.action === "insert" ? "created" : "updated"}
                          </strong>
                          <small>
                            {new Date(a.created_at).toLocaleString("en-GB")}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Your operations start here"
                    detail="Add your first construction site, then add a crane to your fleet."
                  />
                )}
              </section>
            </>
          )}
          {tab !== "dashboard" && tab !== "team" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{title}</h2>
                  <p>
                    {tab === "maintenance"
                      ? "Complete recurring tasks to automatically schedule the next service or inspection."
                      : "All records are limited to your company workspace."}
                  </p>
                </div>
                <input
                  className="search"
                  aria-label={`Search ${title}`}
                  placeholder="Search records…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {tab === "cranes" && (
                <DataTable
                  headers={[
                    "Crane / serial",
                    "Manufacturer / model",
                    "Capacity",
                    "Site",
                    "Status",
                    "",
                  ]}
                  empty="No cranes found. Add your first crane to get started."
                  rows={cranes
                    .filter((c) =>
                      matching(
                        c.name,
                        c.serial_number,
                        c.model,
                        siteName(c.site_id),
                      ),
                    )
                    .map((c) => [
                      <div key="name">
                        <button className="crane-detail-link" aria-label={`View details for ${c.name}`} onClick={() => setSelectedCraneId(c.id)}>{c.name}</button>
                        <small>{c.serial_number}</small>
                      </div>,
                      <div key="model">
                        {c.manufacturer}
                        <small>{c.model}</small>
                      </div>,
                      `${c.capacity_t} t`,
                      siteName(c.site_id),
                      <Badge key="status" value={c.status} />,
                      can(role, "cranes") ? (
                        <button
                          key="edit"
                          className="edit-btn"
                          onClick={() => startEdit("cranes", c)}
                        >
                          Edit
                        </button>
                      ) : null,
                    ])}
                />
              )}
              {tab === "sites" && (
                <DataTable
                  headers={[
                    "Construction site",
                    "Address",
                    "Contact",
                    "Cranes",
                    "Status",
                    "",
                  ]}
                  empty="No sites found. Add a construction site to get started."
                  rows={sites
                    .filter((s) => matching(s.name, s.address, s.contact_name))
                    .map((s) => [
                      <strong key="name">{s.name}</strong>,
                      s.address,
                      <div key="contact">
                        {s.contact_name || "—"}
                        <small>{s.contact_phone}</small>
                      </div>,
                      cranes.filter((c) => c.site_id === s.id).length,
                      <Badge key="status" value={s.status} />,
                      can(role, "sites") ? (
                        <button
                          key="edit"
                          className="edit-btn"
                          onClick={() => startEdit("sites", s)}
                        >
                          Edit
                        </button>
                      ) : null,
                    ])}
                />
              )}
              {tab === "faults" && (
                <DataTable
                  headers={[
                    "Fault report",
                    "Crane",
                    "Priority",
                    "Status",
                    "Reported",
                    "",
                  ]}
                  empty="No faults found. Report faults here and track them through resolution."
                  rows={faults
                    .filter((f) =>
                      matching(
                        f.title,
                        f.description,
                        craneName(f.crane_id),
                        f.priority,
                        f.status,
                      ),
                    )
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((f) => [
                      <div key="title">
                        <strong>{f.title}</strong>
                        <small>{f.description}</small>
                        {f.resolution && (
                          <small>Resolution: {f.resolution}</small>
                        )}
                      </div>,
                      craneName(f.crane_id),
                      <Badge key="priority" value={f.priority} />,
                      <Badge key="status" value={f.status} />,
                      new Date(f.created_at).toLocaleDateString("en-GB"),
                      can(role, "faults") ? (
                        <button
                          key="edit"
                          className="edit-btn"
                          onClick={() => startEdit("faults", f)}
                        >
                          Update
                        </button>
                      ) : null,
                    ])}
                />
              )}
              {tab === "maintenance" && (
                <DataTable
                  headers={[
                    "Task",
                    "Crane",
                    "Type",
                    "Due date",
                    "Repeat",
                    "Status",
                    "",
                  ]}
                  empty="No maintenance tasks found. Schedule a service or periodic inspection."
                  rows={maintenance
                    .filter((m) =>
                      matching(
                        m.title,
                        craneName(m.crane_id),
                        m.kind,
                        m.status,
                      ),
                    )
                    .sort((a, b) => a.due_date.localeCompare(b.due_date))
                    .map((m) => [
                      <div key="title">
                        <strong>{m.title}</strong>
                        <small>{m.notes}</small>
                      </div>,
                      craneName(m.crane_id),
                      <Badge key="kind" value={m.kind} />,
                      <span
                        key="due"
                        className={
                          m.status !== "completed" && isDue(m.due_date)
                            ? "overdue"
                            : ""
                        }
                      >
                        {m.due_date}
                      </span>,
                      m.interval_days ? `${m.interval_days} days` : "One time",
                      <Badge key="status" value={m.status} />,
                      can(role, "maintenance") && m.status !== "completed" ? (
                        <button
                          key="edit"
                          className="edit-btn"
                          onClick={() => startEdit("maintenance", m)}
                        >
                          Update
                        </button>
                      ) : null,
                    ])}
                />
              )}
            </section>
          )}
          {tab === "team" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Team members</h2>
                    <p>Access applies across all sites in this company.</p>
                  </div>
                  <Users size={20} />
                </div>
                <DataTable
                  headers={["Email", "Role", "Access"]}
                  empty="No team members."
                  rows={members.map((m) => [
                    <strong key="email">
                      {m.email}
                      {m.user_id === session.user.id ? " (you)" : ""}
                    </strong>,
                    can(role, "team") ? (
                      <select
                        key="role"
                        aria-label={`Role for ${m.email}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) =>
                          void changeRole(m.user_id, e.target.value as Role)
                        }
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      roleLabel(m.role)
                    ),
                    m.role === "viewer"
                      ? "Read only"
                      : m.role === "technician"
                        ? "Faults & maintenance"
                        : m.role === "site_manager"
                          ? "Sites, faults & maintenance"
                          : m.role === "fleet_manager"
                            ? "Fleet operations"
                            : "Full company access",
                  ])}
                />
              </section>
              {can(role, "team") && (
                <section className="panel team-add">
                  <h2>Add a team member</h2>
                  <p>
                    The user must register and confirm their email first,
                    without creating a company.
                  </p>
                  <form onSubmit={addMember} className="inline-form">
                    <label>
                      Verified email
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                        placeholder="teammate@company.com"
                      />
                    </label>
                    <label>
                      Company role
                      <select name="role" defaultValue="viewer">
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn primary" disabled={busy}>
                      Add member
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
          </>}
          <footer className="page-footer">
            <span>
              CraneOps <span className="subtle">/</span> Company operations
            </span>
            <span>All times shown in your local timezone</span>
          </footer>
        </main>
      </div>
      {editor && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  {editor.record ? "UPDATE RECORD" : "NEW RECORD"}
                </span>
                <h2 id="editor-title">
                  {editor.record ? "Edit" : "Add"}{" "}
                  {editor.type === "cranes"
                    ? "crane"
                    : editor.type === "sites"
                      ? "construction site"
                      : editor.type === "faults"
                        ? "fault report"
                        : "maintenance task"}
                </h2>
              </div>
              <button
                autoFocus
                aria-label="Close editor"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                <X />
              </button>
            </div>
            {error && <Notice error>{error}</Notice>}
            <form onSubmit={save}>
              <EditorFields
                type={editor.type}
                record={editor.record}
                cranes={cranes}
                sites={sites}
              />
              <div className="modal-actions">
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    ((editor.type === "faults" ||
                      editor.type === "maintenance") &&
                      cranes.length === 0)
                  }
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <Building2 size={29} />
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title={empty} />
  );
}
function EditorFields({
  type,
  record,
  cranes,
  sites,
}: {
  type: RecordType;
  record?: Editable;
  cranes: Crane[];
  sites: Site[];
}) {
  const r = (record ?? {}) as unknown as Record<string, string | number | null>;
  const input = (
    name: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      step?: string;
      min?: number;
      max?: number;
    } = {},
  ) => (
    <label>
      {label}
      <input
        name={name}
        type={options.type ?? "text"}
        required={options.required ?? true}
        defaultValue={r[name] ?? (name === "interval_days" ? 0 : "")}
        maxLength={160}
        {...options}
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    values: readonly string[],
    defaultValue: string,
  ) => (
    <label>
      {label}
      <select name={name} defaultValue={r[name] ?? defaultValue}>
        {values.map((v) => (
          <option key={v} value={v}>
            {roleLabel(v)}
          </option>
        ))}
      </select>
    </label>
  );
  const craneSelect = (
    <label>
      Crane
      <select name="crane_id" required defaultValue={r.crane_id ?? ""}>
        <option value="" disabled>
          Select a crane
        </option>
        {cranes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.serial_number}
          </option>
        ))}
      </select>
    </label>
  );
  const textarea = (name: string, label: string) => (
    <label className="full-width">
      {label}
      <textarea
        name={name}
        maxLength={2000}
        rows={3}
        defaultValue={r[name] ?? ""}
      />
    </label>
  );
  return (
    <div className="form-grid">
      {type === "cranes" && (
        <>
          {input("name", "Crane name")}
          {input("serial_number", "Serial number")}
          {input("manufacturer", "Manufacturer")}
          {input("model", "Model")}
          {input("capacity_t", "Capacity (tonnes)", {
            type: "number",
            step: "0.01",
            min: 0.01,
            max: 10000,
          })}
          {select(
            "status",
            "Status",
            ["available", "operating", "maintenance", "out_of_service"],
            "available",
          )}
          <label className="full-width">
            Assigned construction site
            <select name="site_id" defaultValue={r.site_id ?? ""}>
              <option value="">Unassigned</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {type === "sites" && (
        <>
          {input("name", "Site name")}
          {input("address", "Address")}
          {input("contact_name", "Contact name", { required: false })}
          {input("contact_phone", "Contact phone", { required: false })}
          {select(
            "status",
            "Status",
            ["planning", "active", "completed"],
            "active",
          )}
        </>
      )}
      {type === "faults" && (
        <>
          {input("title", "Fault title")}
          {craneSelect}
          {select(
            "priority",
            "Priority",
            ["low", "medium", "high", "critical"],
            "medium",
          )}
          {select(
            "status",
            "Status",
            ["open", "in_progress", "resolved"],
            "open",
          )}
          {textarea("description", "Description")}
          {textarea("resolution", "Resolution (required to resolve)")}
        </>
      )}
      {type === "maintenance" && (
        <>
          {input("title", "Task title")}
          {craneSelect}
          {select("kind", "Task type", ["service", "inspection"], "service")}
          {input("due_date", "Due date", { type: "date" })}
          {input("interval_days", "Repeat interval in days (0 = one time)", {
            type: "number",
            min: 0,
            max: 3650,
            step: "1",
          })}
          {select(
            "status",
            "Status",
            ["scheduled", "in_progress", "completed"],
            "scheduled",
          )}
          {textarea("notes", "Notes")}
          <p className="field-hint full-width">
            Completing a recurring task creates its next scheduled occurrence.
            Completed records are locked.
          </p>
        </>
      )}
      {(type === "faults" || type === "maintenance") && !cranes.length && (
        <Notice error>Add a crane before creating this record.</Notice>
      )}
    </div>
  );
}

