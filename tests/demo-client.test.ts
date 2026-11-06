import { describe, it, expect, vi } from "vitest";
import { createDemoClient } from "../lib/demo-client";
describe("isolated demo adapter", () => {
  it("provides all demo tables without network requests and isolates each instance", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden in demo"));
    try {
      const client = createDemoClient();
      for (const table of ["companies", "memberships", "cranes", "sites", "faults", "maintenance", "activity_log"]) {
        const result = await client.from(table).select();
        expect(result.error).toBeNull();
        expect(Array.isArray(result.data) && result.data.length > 0).toBe(true);
      }
      await client.from("sites").insert({ name: "Only in this tab" }).select().single();
      const other = await createDemoClient().from("sites").select();
      expect(Array.isArray(other.data) && other.data.length).toBe(3);
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("completes recurring maintenance once, logs it and locks the finished record", async () => {
    const client = createDemoClient();
    const result = await client.from("maintenance").select().limit(1).single();
    if (!result.data || Array.isArray(result.data)) throw new Error("Missing fixture");
    const id = result.data.id;
    expect((await client.from("maintenance").update({ status: "completed" }).eq("id", id).single()).error).toBeNull();
    const rows = await client.from("maintenance").select();
    expect(Array.isArray(rows.data) && rows.data.length).toBe(4);
    expect((await client.from("maintenance").update({ status: "scheduled" }).eq("id", id).single()).error).not.toBeNull();
    expect((await client.rpc()).error?.message).toContain("disabled");
  });
});
