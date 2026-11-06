import { describe, it, expect } from "vitest";
import {
  can,
  craneSchema,
  faultSchema,
  maintenanceSchema,
  isDue,
  roles,
} from "../lib/domain";
const id = "123e4567-e89b-42d3-a456-426614174000";
describe("role permissions", () => {
  it("keeps viewers read only", () => {
    for (const area of ["cranes", "sites", "faults", "maintenance", "team"])
      expect(can("viewer", area)).toBe(false);
  });
  it("reserves membership administration to Company Admin", () => {
    for (const role of roles)
      expect(can(role, "team")).toBe(role === "company_admin");
  });
  it("restricts technicians to faults and maintenance", () => {
    expect(can("technician", "cranes")).toBe(false);
    expect(can("technician", "sites")).toBe(false);
    expect(can("technician", "faults")).toBe(true);
    expect(can("technician", "maintenance")).toBe(true);
  });
});
describe("input validation", () => {
  const crane = {
    name: " TC-01 ",
    serial_number: "123",
    manufacturer: "Liebherr",
    model: "280 EC-H",
    capacity_t: "12",
    status: "available",
    site_id: "",
  };
  it("normalizes crane fields and unassigned site", () =>
    expect(craneSchema.parse(crane)).toMatchObject({
      name: "TC-01",
      capacity_t: 12,
      site_id: null,
    }));
  it.each(["0", "-3", "Infinity", "oops"])("rejects invalid capacity %s", (v) =>
    expect(craneSchema.safeParse({ ...crane, capacity_t: v }).success).toBe(
      false,
    ),
  );
  it("rejects invalid status", () =>
    expect(craneSchema.safeParse({ ...crane, status: "ready" }).success).toBe(
      false,
    ));
  it("requires a resolution for resolved faults", () =>
    expect(
      faultSchema.safeParse({
        title: "Fault",
        crane_id: id,
        priority: "high",
        status: "resolved",
        description: "",
        resolution: "",
      }).success,
    ).toBe(false));
  it("rejects invalid maintenance dates and repeat intervals", () => {
    const task = {
      title: "Inspection",
      crane_id: id,
      kind: "inspection",
      due_date: "2026-02-30",
      interval_days: 30,
      status: "scheduled",
      notes: "",
    };
    expect(maintenanceSchema.safeParse(task).success).toBe(false);
    expect(
      maintenanceSchema.safeParse({
        ...task,
        due_date: "2026-11-06",
        interval_days: -1,
      }).success,
    ).toBe(false);
  });
  it("counts today as due and future dates as upcoming", () => {
    expect(isDue("2026-11-06", "2026-11-06")).toBe(true);
    expect(isDue("2026-11-07", "2026-11-06")).toBe(false);
  });
});
