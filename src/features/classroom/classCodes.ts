// src/features/classroom/classCodes.ts
// Wraps public.classes + the generate_class_join_code / join_class_by_code
// SQL functions so the UI just calls createClass()/joinClassByCode().

import { supabase } from "@/integrations/supabase/client";
import type { ClassRow } from "./types";

/**
 * Creates a class tied to an existing group chat and generates a unique
 * join code for it. Call this after creating the underlying chat (e.g.
 * via your existing "new group" flow) and pass its id.
 */
export async function createClass(chatId: string, name: string): Promise<ClassRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const { data: codeData, error: codeErr } = await supabase.rpc("generate_class_join_code");
  if (codeErr) throw codeErr;
  const joinCode = codeData as string;

  const { data, error } = await supabase
    .from("classes")
    .insert({ chat_id: chatId, name, join_code: joinCode, created_by: auth.user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClassRow;
}

/** Joins the caller to the chat linked to the given class code (e.g. "K7QX-3RTN"). */
export async function joinClassByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_class_by_code", { _code: code.trim().toUpperCase() });
  if (error) throw error;
  return data as string; // chat_id
}

export async function listMyClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase.from("classes").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function deactivateClass(classId: string): Promise<void> {
  const { error } = await supabase.from("classes").update({ is_active: false }).eq("id", classId);
  if (error) throw error;
}
