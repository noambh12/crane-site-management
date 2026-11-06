"use client";
import { useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { Workspace } from "./craneops";
import { createDemoClient, demoUser } from "@/lib/demo-client";
export default function DemoPreview() {
  const [client] = useState(createDemoClient);
  // The isolated demo adapter implements only the operations used by Workspace.
  // It imports no Supabase runtime and never accesses environment values or the network.
  return <Workspace demo client={client as unknown as SupabaseClient} session={{ user: demoUser } as Session} />;
}
