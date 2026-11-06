// Browser-memory preview adapter. Never used by the authenticated application route.
type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; error: { message: string } | null };
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const company = id(1);
export const demoUser = { id: id(2), email: "preview@example.test" };
function day(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function initialData(): Record<string, Row[]> {
  const base = { company_id: company, created_at: new Date().toISOString() };
  return {
    companies: [{ id: company, name: "Northline · Demo company" }],
    memberships: [{ ...base, user_id: demoUser.id, email: demoUser.email, role: "company_admin" }],
    sites: [
      { ...base, id: id(10), name: "Harbor Heights", address: "12 Demo Avenue", contact_name: "Alex Demo", contact_phone: "", status: "active" },
      { ...base, id: id(11), name: "Central Gardens", address: "8 Sample Road", contact_name: "Sam Demo", contact_phone: "", status: "active" },
      { ...base, id: id(12), name: "Riverside Quarter", address: "30 Preview Lane", contact_name: "Jordan Demo", contact_phone: "", status: "planning" },
    ],
    cranes: [
      { ...base, id: id(20), name: "Tower Alpha", serial_number: "DEMO-001", manufacturer: "Liebherr", model: "280 EC-H", capacity_t: 12, site_id: id(10), status: "operating" },
      { ...base, id: id(21), name: "Tower Bravo", serial_number: "DEMO-002", manufacturer: "Potain", model: "MD 310", capacity_t: 10, site_id: id(11), status: "operating" },
      { ...base, id: id(22), name: "Tower Charlie", serial_number: "DEMO-003", manufacturer: "Liebherr", model: "125 EC-B", capacity_t: 6, site_id: null, status: "available" },
      { ...base, id: id(23), name: "Tower Delta", serial_number: "DEMO-004", manufacturer: "Terex", model: "CTT 202", capacity_t: 8, site_id: id(10), status: "maintenance" },
    ],
    faults: [
      { ...base, id: id(30), crane_id: id(23), title: "Hydraulic pressure warning", description: "Sample fault for testing the workflow.", priority: "critical", status: "open", resolution: "" },
      { ...base, id: id(31), crane_id: id(20), title: "Cabin light replacement", description: "Fictional maintenance observation.", priority: "low", status: "in_progress", resolution: "" },
      { ...base, id: id(32), crane_id: id(21), title: "Radio connection check", description: "Example of a resolved fault.", priority: "medium", status: "resolved", resolution: "Demo radio test completed." },
    ],
    maintenance: [
      { ...base, id: id(40), crane_id: id(23), title: "Hydraulic system service", kind: "service", due_date: day(-2), interval_days: 30, status: "scheduled", notes: "Sample recurring task.", completed_at: null },
      { ...base, id: id(41), crane_id: id(20), title: "Monthly safety inspection", kind: "inspection", due_date: day(0), interval_days: 30, status: "scheduled", notes: "Sample inspection — not a compliance record.", completed_at: null },
      { ...base, id: id(42), crane_id: id(21), title: "Hoist cable inspection", kind: "inspection", due_date: day(10), interval_days: 90, status: "in_progress", notes: "Fictional scheduled work.", completed_at: null },
    ],
    activity_log: [
      { ...base, id: 1, entity: "cranes", entity_id: id(20), action: "insert" },
      { ...base, id: 2, entity: "faults", entity_id: id(30), action: "insert" },
      { ...base, id: 3, entity: "maintenance", entity_id: id(40), action: "insert" },
    ],
  };
}
export function createDemoClient() {
  const tables = initialData();
  function recordActivity(table: string, row: Row, action: string) {
    tables.activity_log.push({ id: tables.activity_log.length + 1, company_id: company, entity: table, entity_id: row.id, action, created_at: new Date().toISOString() });
  }
  function from(table: string) {
    const filters: [string, unknown][] = [];
    let operation = "select";
    let values: Row = {};
    let sort: { column: string; ascending: boolean } | undefined;
    let start = 0, end = Infinity;
    let shape = "many";
    let executed: Result | undefined;
    function execute(): Result {
      if (executed) return executed;
      if (!tables[table]) return { data: null, error: { message: "Unknown demo table." } };
      let rows = tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
      if (operation !== "select") {
        if (!["cranes", "sites", "faults", "maintenance"].includes(table)) return { data: null, error: { message: "This action is unavailable in the demo." } };
        if (operation === "insert") {
          const row = { ...values, id: crypto.randomUUID(), company_id: company, created_at: new Date().toISOString() };
          tables[table].push(row);
          rows = [row];
        } else {
          if (table === "maintenance" && rows.some(row => row.status === "completed")) return { data: null, error: { message: "Completed maintenance is immutable in the demo." } };
          rows.forEach(row => Object.assign(row, values));
        }
        for (const row of rows) {
          recordActivity(table, row, operation);
          if (table === "maintenance" && row.status === "completed") {
            row.completed_at = new Date().toISOString();
            if (Number(row.interval_days) > 0) {
              const due = new Date(`${String(row.due_date) > day(0) ? row.due_date : day(0)}T00:00:00Z`);
              due.setUTCDate(due.getUTCDate() + Number(row.interval_days));
              const next = { ...row, id: crypto.randomUUID(), status: "scheduled", completed_at: null, due_date: due.toISOString().slice(0, 10) };
              tables.maintenance.push(next);
              recordActivity(table, next, "insert");
            }
          }
        }
      }
      if (sort) {
        const { column, ascending } = sort;
        rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
      }
      rows = rows.slice(start, Number.isFinite(end) ? end + 1 : undefined);
      executed = { data: structuredClone(shape === "many" ? rows : rows[0] ?? null), error: shape === "one" && rows.length !== 1 ? { message: "Demo record not found." } : null };
      return executed;
    }
    const builder = {
      select: (_columns = "*") => builder,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
      order: (column: string, options?: { ascending?: boolean }) => { sort = { column, ascending: options?.ascending !== false }; return builder; },
      range: (first: number, last: number) => { start = first; end = last; return builder; },
      limit: (count: number) => { end = count - 1; return builder; },
      insert: (row: Row) => { operation = "insert"; values = row; return builder; },
      update: (row: Row) => { operation = "update"; values = row; return builder; },
      single: () => { shape = "one"; return Promise.resolve(execute()); },
      maybeSingle: () => { shape = "optional"; return Promise.resolve(execute()); },
      then: <TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) => Promise.resolve(execute()).then(onfulfilled, onrejected),
    };
    return builder;
  }
  return {
    from,
    auth: {
      getUser: async () => ({ data: { user: demoUser }, error: null }),
      signOut: async () => { if (typeof window !== "undefined") window.location.reload(); return { error: null }; },
    },
    rpc: async () => ({ data: null, error: { message: "Team/account changes are disabled in this demo. No real users or emails are created." } }),
  };
}
