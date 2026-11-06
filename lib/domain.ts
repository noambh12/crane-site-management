import { z } from "zod";
export const roles = [
  "company_admin",
  "fleet_manager",
  "site_manager",
  "technician",
  "viewer",
] as const;
export type Role = (typeof roles)[number];
export const roleLabel = (role: string) =>
  role
    .split("_")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
export const permissions = {
  company_admin: ["cranes", "sites", "faults", "maintenance", "team"],
  fleet_manager: ["cranes", "sites", "faults", "maintenance"],
  site_manager: ["sites", "faults", "maintenance"],
  technician: ["faults", "maintenance"],
  viewer: [],
} as const;
export function can(role: Role, area: string) {
  return (permissions[role] as readonly string[]).includes(area);
}
const text = z.string().trim().min(1, "Required").max(160);
const optionalText = z.string().trim().max(2000).default("");
const optionalId = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => v || null);
export const craneSchema = z.object({
  name: text,
  serial_number: text,
  manufacturer: text,
  model: text,
  capacity_t: z.coerce.number().positive().max(10000),
  status: z.enum(["available", "operating", "maintenance", "out_of_service"]),
  site_id: optionalId,
});
export const siteSchema = z.object({
  name: text,
  address: text,
  status: z.enum(["planning", "active", "completed"]),
  contact_name: optionalText,
  contact_phone: z.string().trim().max(80).default(""),
});
export const faultSchema = z
  .object({
    title: text,
    description: optionalText,
    crane_id: z.uuid(),
    priority: z.enum(["low", "medium", "high", "critical"]),
    status: z.enum(["open", "in_progress", "resolved"]),
    resolution: optionalText,
  })
  .refine((x) => x.status !== "resolved" || x.resolution.length > 0, {
    message: "Enter a resolution before resolving the fault",
    path: ["resolution"],
  });
export const maintenanceSchema = z.object({
  title: text,
  crane_id: z.uuid(),
  kind: z.enum(["service", "inspection"]),
  due_date: z.iso.date(),
  interval_days: z.coerce.number().int().min(0).max(3650),
  status: z.enum(["scheduled", "in_progress", "completed"]),
  notes: optionalText,
});
export type Membership = {
  user_id: string;
  company_id: string;
  role: Role;
  email: string;
};
export type Company = { id: string; name: string };
export type Crane = z.infer<typeof craneSchema> & {
  id: string;
  company_id: string;
};
export type Site = z.infer<typeof siteSchema> & {
  id: string;
  company_id: string;
};
export type Fault = z.infer<typeof faultSchema> & {
  id: string;
  company_id: string;
  created_at: string;
};
export type Maintenance = z.infer<typeof maintenanceSchema> & {
  id: string;
  company_id: string;
  completed_at: string | null;
};
export function isDue(
  date: string,
  today = new Date().toISOString().slice(0, 10),
) {
  return date <= today;
}
