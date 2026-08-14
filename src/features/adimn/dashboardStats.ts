// src/features/admin/dashboardStats.ts
// Thin client query wrapper over public.admin_dashboard_stats. Kept as a
// single-row select so the AdminDashboard component doesn't need to know
// the underlying aggregation.

import { supabase } from "@/integrations/supabase/client";

export interface DashboardStats {
  total_members: number;
  active_users_24h: number;
  active_users_7d: number;
  messages_24h: number;
  messages_7d: number;
  unreviewed_flags: number;
  unreviewed_high_severity_flags: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  const { data, error } = await supabase.from("admin_dashboard_stats").select("*").single();
  if (error) throw error;
  return data as DashboardStats | null;
}
