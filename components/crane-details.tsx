"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { can, type Crane, type Site, type Fault, type Maintenance, type Role } from "@/lib/domain";
type Event = { id: number; action: string; created_at: string; details: { status?: string } };
const label = (value: string) => value.replaceAll("_", " ");
export default function CraneDetails({ crane, site, faults, maintenance, client, companyId, role, onBack, onEdit, onFault, onMaintenance }: {
  crane: Crane; site?: Site; faults: Fault[]; maintenance: Maintenance[];
  client: SupabaseClient; companyId: string; role: Role; onBack: () => void;
  onEdit: () => void; onFault: (fault: Fault) => void; onMaintenance: (task: Maintenance) => void;
}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setEvents([]);
      setError("");
      try {
        const result = await client.from("activity_log").select("id,action,created_at,details")
          .eq("company_id", companyId).eq("entity", "cranes").eq("entity_id", crane.id)
          .order("created_at", { ascending: false }).limit(50);
        if (result.error) throw result.error;
        if (active) setEvents(result.data ?? []);
      } catch {
        if (active) setError("Activity could not be loaded. Use Refresh to try again.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [client, companyId, crane]);
  const craneFaults = faults.filter(f => f.crane_id === crane.id);
  const tasks = maintenance.filter(m => m.crane_id === crane.id).sort((a, b) => a.due_date.localeCompare(b.due_date));
  return <section className="crane-detail" aria-label="Crane details">
    <div className="detail-actions">
      <button className="btn" onClick={onBack}>← Back to cranes</button>
      {can(role, "cranes") && <button className="btn primary" onClick={onEdit}>Edit crane</button>}
    </div>
    <div className="dashboard-grid">
      <section className="panel" aria-labelledby="crane-specifications">
        <div className="panel-heading"><h2 id="crane-specifications">Crane specifications</h2><span className={`badge badge-${crane.status}`}>{label(crane.status)}</span></div>
        <dl className="detail-fields">
          <div><dt>Name</dt><dd>{crane.name}</dd></div>
          <div><dt>Serial number</dt><dd>{crane.serial_number}</dd></div>
          <div><dt>Manufacturer</dt><dd>{crane.manufacturer}</dd></div>
          <div><dt>Model</dt><dd>{crane.model}</dd></div>
          <div><dt>Capacity</dt><dd>{crane.capacity_t} tonnes</dd></div>
          <div><dt>Open faults</dt><dd>{craneFaults.filter(f => f.status !== "resolved").length}</dd></div>
        </dl>
      </section>
      <section className="panel" aria-labelledby="crane-assigned-site">
        <div className="panel-heading"><h2 id="crane-assigned-site">Assigned site</h2></div>
        {site ? <dl className="detail-fields">
          <div><dt>Site</dt><dd>{site.name}</dd></div>
          <div><dt>Status</dt><dd>{label(site.status)}</dd></div>
          <div className="full-width"><dt>Address</dt><dd>{site.address}</dd></div>
          <div><dt>Contact</dt><dd>{site.contact_name || "Not provided"}</dd></div>
          <div><dt>Phone</dt><dd>{site.contact_phone || "Not provided"}</dd></div>
        </dl> : <p>No construction site assigned.</p>}
      </section>
    </div>
    <section className="panel" aria-labelledby="crane-faults">
      <div className="panel-heading"><div><h2 id="crane-faults">Faults for this crane</h2><p>Open and resolved fault reports</p></div><span className="subtle">{craneFaults.length} reports</span></div>
      {craneFaults.length ? <div className="table-scroll"><table><thead><tr><th>Fault</th><th>Priority</th><th>Status</th><th>Resolution</th><th><span className="detail-sr">Actions</span></th></tr></thead><tbody>
        {craneFaults.map(f => <tr key={f.id}><td><strong>{f.title}</strong><small>{f.description}</small></td><td><span className={`badge badge-${f.priority}`}>{f.priority}</span></td><td>{label(f.status)}</td><td>{f.resolution || "—"}</td><td>{can(role, "faults") && <button className="edit-btn" onClick={() => onFault(f)}>Update fault</button>}</td></tr>)}
      </tbody></table></div> : <p>No faults reported for this crane.</p>}
    </section>
    <section className="panel" aria-labelledby="crane-maintenance">
      <div className="panel-heading"><div><h2 id="crane-maintenance">Maintenance for this crane</h2><p>Scheduled work and completed service records</p></div><span className="subtle">{tasks.length} tasks</span></div>
      {tasks.length ? <div className="table-scroll"><table><thead><tr><th>Task</th><th>Type</th><th>Due date</th><th>Status</th><th>Completed</th><th><span className="detail-sr">Actions</span></th></tr></thead><tbody>
        {tasks.map(m => <tr key={m.id}><td><strong>{m.title}</strong><small>{m.notes}</small></td><td>{m.kind}</td><td>{m.due_date}</td><td>{label(m.status)}</td><td>{m.completed_at ? new Date(m.completed_at).toLocaleString("en-GB") : "—"}</td><td>{can(role, "maintenance") && m.status !== "completed" && <button className="edit-btn" onClick={() => onMaintenance(m)}>Update task</button>}</td></tr>)}
      </tbody></table></div> : <p>No maintenance tasks scheduled for this crane.</p>}
    </section>
    <section className="panel" aria-labelledby="crane-activity">
      <div className="panel-heading"><div><h2 id="crane-activity">Crane activity</h2><p>Latest 50 changes to this crane record. The log stores the action and status, not a full change comparison.</p></div></div>
      {loading ? <p role="status">Loading crane activity…</p> : error ? <p role="alert">{error}</p> : events.length ? <div className="activity-list">{events.map(event => <div key={event.id}><span className="activity-dot" /><span><strong>Crane record {event.action === "insert" ? "created" : "updated"}{event.details?.status ? ` · ${label(event.details.status)}` : ""}</strong><small>{new Date(event.created_at).toLocaleString("en-GB")}</small></span></div>)}</div> : <p>No activity recorded for this crane.</p>}
    </section>
  </section>;
}
