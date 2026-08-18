// src/lib/announcements.ts
// Client-side data access for the admin-authored announcement banner and
// each user's notification preferences (app-update emails, offline
// message emails).

import { supabase } from "@/integrations/supabase/client";

export interface AppAnnouncement {
  id: string;
  message: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  notify_subscribers: boolean;
}

export interface NotificationPreferences {
  user_id: string;
  notify_app_updates: boolean;
  notify_offline_messages: boolean;
}

/** The single active announcement, if any (e.g. "We're updating the app…"). */
export async function fetchActiveAnnouncement(): Promise<AppAnnouncement | null> {
  const { data, error } = await supabase
    .from("app_announcements")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AppAnnouncement | null;
}

/** Admin: posts a new announcement and deactivates any previous one, so only one banner shows at a time. */
export async function postAnnouncement(message: string, notifySubscribers: boolean): Promise<AppAnnouncement> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  await supabase.from("app_announcements").update({ is_active: false }).eq("is_active", true);

  const { data, error } = await supabase
    .from("app_announcements")
    .insert({ message, is_active: true, created_by: auth.user.id, notify_subscribers: notifySubscribers })
    .select("*")
    .single();
  if (error) throw error;
  return data as AppAnnouncement;
}

/** Admin: takes the current banner down without posting a replacement. */
export async function clearActiveAnnouncement(): Promise<void> {
  const { error } = await supabase.from("app_announcements").update({ is_active: false }).eq("is_active", true);
  if (error) throw error;
}

export async function fetchMyNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as NotificationPreferences) ?? { user_id: userId, notify_app_updates: true, notify_offline_messages: true };
}

export async function updateMyNotificationPreferences(
  userId: string,
  patch: Partial<Pick<NotificationPreferences, "notify_app_updates" | "notify_offline_messages">>,
): Promise<void> {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
