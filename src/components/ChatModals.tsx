import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Settings, DoorOpen, BadgeCheck, Camera, UserPlus, CheckSquare, Square, Trash2,
  Ban, Search, Sparkles, Crown, Plus, Users,
  Lock, Unlock, LogOut, Bell, Shield, Pencil,
} from "lucide-react";
import { MdInsertPhoto } from "react-icons/md";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startPaystackCheckout } from "@/lib/paystack.functions";
import { unlockChat } from "@/lib/crypto";
import {
  CHAT_CATEGORIES, type Profile, type ChatCategory,
} from "@/lib/db";
import { type ChatWithMeta, explainSupabaseError } from "@/utils/utils";
import { Avatar } from "./Avatar";

export function MemberListModal({
  chat, meId, isAdmin, onClose, onOpenSettings, onLeave,
}: {
  chat: ChatWithMeta; meId: string; isAdmin: boolean;
  onClose: () => void; onOpenSettings: () => void; onLeave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-h-[80vh] flex flex-col rounded-t-3xl border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-[#E07A5F]/30" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
            {chat.title || "Group"} · {chat.members.length} {chat.members.length === 1 ? "member" : "members"}
          </h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
          {chat.members.map((m) => {
            const role = chat.memberRoles[m.id] ?? "member";
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg">
                <Avatar url={m.avatar_url} name={m.display_name} size={40} ai={m.is_ai} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                      {m.display_name}{m.id === meId ? " (you)" : ""}
                    </span>
                    {role === "admin" && <BadgeCheck className="h-3.5 w-3.5 text-[#4FA6E0] shrink-0" titleAccess="Admin" />}
                  </div>
                  <span className="text-xs text-[#8C8C8C]">{role === "admin" ? "Admin" : "Member"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-6 pt-2 border-t border-[#E07A5F]/10 space-y-2">
          {isAdmin && (
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#E07A5F] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              <Settings className="h-4 w-4" /> Group settings
            </button>
          )}
          <button
            onClick={onLeave}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-red-300 dark:border-red-500/30 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
          >
            <DoorOpen className="h-4 w-4" /> Leave group
          </button>
        </div>
      </div>
    </div>
  );
}

export function GroupSettingsModal({
  chat, meId, onClose, onUpdated, onDelete,
}: {
  chat: ChatWithMeta; meId: string; onClose: () => void;
  onUpdated: () => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(chat.title ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    if (!addOpen) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").not("id", "in", `(${chat.memberIds.join(",")})`).limit(200);
      setCandidates((data ?? []) as Profile[]);
    })();
  }, [addOpen, chat.memberIds]);

  const save = async () => {
    setSaving(true);
    try {
      let avatar_url = chat.avatar_url;
      if (avatarFile) {
        const path = `${chat.id}/${meId}/group-avatar-${crypto.randomUUID()}-${avatarFile.name}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, avatarFile);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60 * 24 * 365);
        avatar_url = signed?.signedUrl ?? avatar_url;
      }
      const { error } = await supabase.from("chats").update({ title: title.trim() || chat.title, avatar_url }).eq("id", chat.id);
      if (error) throw error;
      toast.success("Group updated");
      onUpdated();
      onClose();
    } catch (e) {
      const explained = explainSupabaseError(e);
      toast.error(explained.title);
    } finally {
      setSaving(false);
    }
  };

  const addMembers = async () => {
    if (addSelected.size === 0) return;
    setAddBusy(true);
    try {
      const rows = Array.from(addSelected).map((user_id) => ({ chat_id: chat.id, user_id }));
      const { error } = await supabase.from("chat_members").insert(rows);
      if (error) throw error;
      toast.success(`Added ${addSelected.size} ${addSelected.size === 1 ? "person" : "people"}`);
      setAddOpen(false);
      setAddSelected(new Set());
      onUpdated();
    } catch (e) {
      toast.error(explainSupabaseError(e).title);
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] flex flex-col rounded-t-3xl border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-[#E07A5F]/30" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Group settings</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-4 space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer">
              <Avatar url={avatarPreview ?? chat.avatar_url} name={chat.title ?? "Group"} size={84} />
              <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-[#E07A5F] text-white ring-2 ring-[#FFFDF9] dark:ring-[#2A2A2A]">
                <Camera className="h-3.5 w-3.5" />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-[#8C8C8C]">Group name</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] border border-[#E07A5F]/10"
            />
          </div>

          {/* Add members */}
          <div>
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="w-full flex items-center gap-2 rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm font-medium text-[#2D3436] dark:text-[#E8E8E8]"
            >
              <UserPlus className="h-4 w-4 text-[#E07A5F]" /> Add members
              {addSelected.size > 0 && <span className="ml-auto text-xs text-[#E07A5F]">{addSelected.size} selected</span>}
            </button>
            {addOpen && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[#E07A5F]/10">
                {candidates.length === 0 ? (
                  <p className="p-3 text-center text-xs text-[#8C8C8C]">Everyone's already in this group.</p>
                ) : candidates.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setAddSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                      return next;
                    })}
                    className="flex w-full items-center gap-3 border-b border-[#E07A5F]/5 p-2.5 last:border-0 hover:bg-[#F4A261]/10"
                  >
                    <Avatar url={u.avatar_url} name={u.display_name} size={32} />
                    <span className="flex-1 truncate text-sm text-left text-[#2D3436] dark:text-[#E8E8E8]">{u.display_name}</span>
                    {addSelected.has(u.id) ? <CheckSquare className="h-4 w-4 text-[#E07A5F]" /> : <Square className="h-4 w-4 text-[#8C8C8C]" />}
                  </button>
                ))}
                {candidates.length > 0 && (
                  <button
                    onClick={addMembers}
                    disabled={addBusy || addSelected.size === 0}
                    className="w-full py-2 text-sm font-semibold text-white bg-[#E07A5F] disabled:opacity-50"
                  >
                    {addBusy ? "Adding…" : "Add selected"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="pt-2 border-t border-[#E07A5F]/10">
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-red-300 dark:border-red-500/30 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
            >
              <Trash2 className="h-4 w-4" /> Delete group
            </button>
          </div>
        </div>

        <div className="px-5 pb-6 pt-2 border-t border-[#E07A5F]/10">
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-full bg-[#E07A5F] py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}


export function NewChatModal({ meId, onClose, onCreated }: { meId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Group-mode state
  const [groupTitle, setGroupTitle] = useState("");
  const [category, setCategory] = useState<ChatCategory>("general");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<{ title: string; explanation: string; raw: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").neq("id", meId).order("display_name", { ascending: true }).limit(200);
      if (error) toast.error(error.message);
      setUsers((data ?? []) as Profile[]);
      setLoading(false);
    })();
  }, [meId]);

  const filtered = users.filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (u.display_name ?? "").toLowerCase().includes(s) || (u.email ?? "").toLowerCase().includes(s);
  });

  const startWith = async (prof: Profile) => {
    setBusyId(prof.id);
    try {
      const { data: myChats } = await supabase.from("chat_members").select("chat_id").eq("user_id", meId);
      const ids = (myChats ?? []).map((r: { chat_id: string }) => r.chat_id);
      if (ids.length) {
        const { data: theirs } = await supabase.from("chat_members").select("chat_id").in("chat_id", ids).eq("user_id", prof.id);
        const shared = (theirs ?? []).map((r: { chat_id: string }) => r.chat_id);
        for (const cid of shared) {
          const { count } = await supabase.from("chat_members").select("*", { count: "exact", head: true }).eq("chat_id", cid);
          if (count === 2) { onCreated(cid); return; }
        }
      }
      const { data: chat, error: cErr } = await supabase.from("chats").insert({ is_group: false, created_by: meId }).select().single();
      if (cErr) throw cErr;
      const { error: m1 } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: meId });
      if (m1) throw m1;
      const { error: m2 } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: prof.id });
      if (m2) throw m2;
      toast.success(`Chat with ${prof.display_name} created`);
      onCreated(chat.id);
    } catch (e) {
      console.error("startWith failed", e);
      const explained = explainSupabaseError(e);
      toast.error(explained.title);
      setGroupError(explained);
    }
    finally { setBusyId(null); }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createGroup = async () => {
    if (!groupTitle.trim()) return toast.error("Give your group a name");
    if (selectedIds.size === 0) return toast.error("Pick at least one person to add");
    setCreatingGroup(true);
    try {
      const { data: chat, error: cErr } = await supabase
        .from("chats")
        .insert({ is_group: true, title: groupTitle.trim(), category, created_by: meId })
        .select()
        .single();
      if (cErr) throw cErr;
    
      const { error: selfErr } = await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: meId, role: "admin" });
      if (selfErr) throw selfErr;

      const otherRows = Array.from(selectedIds).map((user_id) => ({ chat_id: chat.id, user_id }));
      if (otherRows.length) {
        const { error: mErr } = await supabase.from("chat_members").insert(otherRows);
        if (mErr) throw mErr;
      }

      toast.success(`"${groupTitle.trim()}" group created`);
      onCreated(chat.id);
    } catch (e) {
      console.error("createGroup failed", e);
      const explained = explainSupabaseError(e);
      toast.error(explained.title);
      setGroupError(explained);
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl border-t border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-[#E07A5F]/30" />
        </div>
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#E07A5F]" />
            <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
              {mode === "direct" ? "Choose a friend" : "New group"}
            </h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#F4A261]/20" aria-label="Close">
            <X className="h-4 w-4 text-[#2D3436] dark:text-[#E8E8E8]" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-5 pb-3 flex gap-2">
          <button
            onClick={() => setMode("direct")}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${mode === "direct" ? "bg-[#E07A5F] text-white" : "bg-[#F5F0E8] dark:bg-[#3A3A3A] text-[#8C8C8C]"}`}
          >
            Direct message
          </button>
          <button
            onClick={() => setMode("group")}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${mode === "group" ? "bg-[#E07A5F] text-white" : "bg-[#F5F0E8] dark:bg-[#3A3A3A] text-[#8C8C8C]"}`}
          >
            New group
          </button>
        </div>

        {mode === "group" && (
          <div className="px-5 pb-3 space-y-3">
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name (e.g. Grade 11 Study Group)"
              className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C] border border-[#E07A5F]/10"
            />
            <div className="flex flex-wrap gap-1.5">
              {CHAT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    category === cat.value
                      ? "bg-[#E07A5F] text-white"
                      : "bg-[#F5F0E8] dark:bg-[#3A3A3A] text-[#8C8C8C]"
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
            {selectedIds.size > 0 && (
              <p className="text-xs text-[#8C8C8C]">{selectedIds.size} {selectedIds.size === 1 ? "person" : "people"} selected</p>
            )}
          </div>
        )}

        <div className="px-5 pb-3">
          <p className="text-xs text-[#8C8C8C]">
            {mode === "direct" ? "Pick from Sona users or search by name / email." : "Select the people to add to your group."}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2 border border-[#E07A5F]/10">
            <Search className="h-4 w-4 text-[#8C8C8C]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="flex-1 bg-transparent text-sm outline-none text-[#2D3436] dark:text-[#E8E8E8] placeholder:text-[#8C8C8C]" />
          </div>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="p-4 text-center text-sm text-[#8C8C8C]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#8C8C8C]">No users found</div>
          ) : filtered.map((u) => (
            <button
              key={u.id}
              disabled={mode === "direct" && busyId === u.id}
              onClick={() => (mode === "direct" ? startWith(u) : toggleSelected(u.id))}
              className="flex w-full items-center gap-3 border-b border-[#E07A5F]/5 p-3 text-left last:border-0 hover:bg-[#F4A261]/10 disabled:opacity-60 rounded-lg"
            >
              <Avatar url={u.avatar_url} name={u.display_name} size={42} ai={u.is_ai} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{u.display_name}</div>
                  {u.is_ai && <Sparkles className="h-3 w-3 text-[#E07A5F]" />}
                  {u.is_pro && <Crown className="h-3 w-3 text-[#E07A5F]" />}
                </div>
                <div className="truncate text-xs text-[#8C8C8C]">{u.email}</div>
              </div>
              {mode === "direct" ? (
                busyId === u.id ? <span className="text-xs text-[#8C8C8C]">…</span> : <Plus className="h-4 w-4 text-[#E07A5F]" />
              ) : selectedIds.has(u.id) ? (
                <CheckSquare className="h-5 w-5 text-[#E07A5F]" />
              ) : (
                <Square className="h-5 w-5 text-[#8C8C8C]" />
              )}
            </button>
          ))}
        </div>

        {mode === "group" && (
          <div className="px-5 pb-6 pt-2 border-t border-[#E07A5F]/10">
            <button
              onClick={createGroup}
              disabled={creatingGroup}
              className="w-full rounded-full bg-[#E07A5F] py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
            >
              {creatingGroup ? "Creating…" : "Create group"}
            </button>
          </div>
        )}
      </div>

      {groupError && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-red-500">
              <Ban className="h-5 w-5" />
              <h4 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{groupError.title}</h4>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-[#5C5C5C] dark:text-[#B8B8B8]">{groupError.explanation}</p>
            <details className="mb-4 rounded-lg bg-[#F5F0E8] dark:bg-[#3A3A3A] p-2.5 text-xs text-[#8C8C8C]">
              <summary className="cursor-pointer select-none font-medium">Technical details</summary>
              <p className="mt-1.5 break-words font-mono">{groupError.raw}</p>
            </details>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(groupError.raw);
                  toast.success("Error copied to clipboard");
                }}
                className="flex-1 rounded-full border border-[#E07A5F]/30 py-2 text-sm font-medium text-[#E07A5F]"
              >
                Copy error
              </button>
              <button
                onClick={() => setGroupError(null)}
                className="flex-1 rounded-full bg-[#E07A5F] py-2 text-sm font-semibold text-white"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export function SettingsModal({ me, onClose, onSaved }: { me: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [tab, setTab] = useState<"profile" | "advanced" | "subscription">("profile");
  const [name, setName] = useState(me.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(me.avatar_url ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [notif, setNotif] = useState<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");

  const pickAvatar = () => avatarInputRef.current?.click();

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      // Fixed filename per user (not a random uuid) so re-uploading replaces
      // the old picture instead of accumulating unused files in storage.
      const path = `${me.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new picture shows immediately instead of the
      // browser reusing a cached copy of the old file at the same URL.
      const freshUrl = `${pub.publicUrl}?v=${Date.now()}`;
      const { data, error } = await supabase.from("profiles").update({ avatar_url: freshUrl }).eq("id", me.id).select().single();
      if (error) throw error;
      setAvatarUrl(freshUrl);
      onSaved(data as Profile);
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't upload picture");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.from("profiles").update({ display_name: name.trim() || "Friend" }).eq("id", me.id).select().single();
      if (error) throw error;
      onSaved(data as Profile);
      toast.success("Saved");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/auth"; };

  const paystackCheckout = useServerFn(startPaystackCheckout);
  const upgrade = async () => {
    setBusy(true);
    try {
      const r = await paystackCheckout() as { url: string };
      toast.success("Redirecting to Paystack…");
      window.location.href = r.url;
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };


  const askNotif = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotif(p);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-[#E07A5F]" />
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Settings</h3>
          {me.is_pro && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#E07A5F]/20 px-2 py-0.5 text-[10px] font-semibold text-[#E07A5F]"><Crown className="h-3 w-3" /> Pro</span>}
        </div>
        <div className="mb-4 flex gap-1 rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] p-1 text-xs border border-[#E07A5F]/10">
          {(["profile", "advanced", "subscription"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-2 py-1.5 capitalize ${tab === t ? "bg-[#FFFDF9] dark:bg-[#2A2A2A] font-semibold shadow text-[#2D3436] dark:text-[#E8E8E8]" : "text-[#8C8C8C]"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 pb-1">
              <div className="relative">
                <Avatar url={avatarUrl} name={name || "?"} size={72} />
                <button
                  onClick={pickAvatar}
                  disabled={uploadingAvatar}
                  aria-label="Change profile picture"
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#E07A5F] text-white shadow-md hover:bg-[#D4694F] disabled:opacity-60"
                >
                  {uploadingAvatar ? <span className="text-[10px]">…</span> : <Pencil className="h-3.5 w-3.5" />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
                />
              </div>
              <button onClick={pickAvatar} disabled={uploadingAvatar} className="text-xs font-medium text-[#E07A5F] hover:underline disabled:opacity-60">
                {uploadingAvatar ? "Uploading…" : "Change photo"}
              </button>
            </div>
            <div>
              <label className="text-xs text-[#8C8C8C]">Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/50 text-[#2D3436] dark:text-[#E8E8E8] border border-[#E07A5F]/10" />
            </div>
            <p className="text-xs text-[#8C8C8C]">Signed in as {me.email}</p>
          </div>
        )}

        {tab === "advanced" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-[#E07A5F]/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Bell className="h-4 w-4 text-[#E07A5F]" /> Push notifications</div>
              <p className="mt-1 text-xs text-[#8C8C8C]">Status: {notif}</p>
              {notif !== "granted" && (
                <button onClick={askNotif} className="mt-2 rounded-lg bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-1.5 text-xs hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">Enable</button>
              )}
            </div>
            <div className="rounded-xl border border-[#E07A5F]/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Shield className="h-4 w-4 text-[#E07A5F]" /> Security</div>
              <ul className="mt-1 space-y-1 text-xs text-[#8C8C8C]">
                <li>• End-to-end AES-GCM encryption for hidden chats</li>
                <li>• Passcodes never leave your device</li>
                <li>• Row-level security on every message</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[#E07A5F]/10 p-3">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Lock className="h-4 w-4 text-[#E07A5F]" /> Hidden chats</div>
              <p className="mt-1 text-xs text-[#8C8C8C]">Toggle "Hide & encrypt" from the chat menu to store messages encrypted at rest.</p>
            </div>
          </div>
        )}

        {tab === "subscription" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-[#E07A5F]/20 bg-gradient-to-br from-[#E07A5F]/20 to-[#F4A261]/10 p-4">
              <div className="flex items-center gap-2 font-semibold text-[#2D3436] dark:text-[#E8E8E8]"><Crown className="h-4 w-4 text-[#E07A5F]" /> Sona Pro</div>
              <ul className="mt-2 space-y-1 text-xs text-[#2D3436] dark:text-[#E8E8E8]">
                <li>✨ Unlimited AI chat summaries</li>
                <li className="flex gap-1" ><MdInsertPhoto/> Vision — Sona reads your images</li>
                <li>🔒 Unlimited hidden encrypted chats</li>
                <li>🎨 Premium themes</li>
              </ul>
              {me.is_pro ? (
                <div className="mt-3 text-xs text-[#E07A5F] font-semibold">You're a Pro member 💛</div>
              ) : (
                <button disabled={busy} onClick={upgrade} className="mt-3 w-full rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#D4694F] transition">
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E07A5F]/10 pt-4">
          <button onClick={signOut} className="rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">Close</button>
            {tab === "profile" && (
              <button disabled={busy} onClick={save} className="rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#D4694F] transition">
                {busy ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export function UnlockModal({ chatId, onUnlocked, onCancel }: { chatId: string; onUnlocked: () => void; onCancel: () => void }) {
  const [pass, setPass] = useState("");
  const submit = () => {
    if (!pass) return;
    unlockChat(chatId, pass);
    onUnlocked();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-[#E07A5F]/10 bg-[#FFFDF9] dark:bg-[#2A2A2A] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-[#E07A5F]" />
          <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Unlock hidden chat</h3>
        </div>
        <p className="text-xs text-[#8C8C8C] mb-3">Enter your passcode to decrypt messages. It never leaves your device.</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Passcode"
          className="w-full rounded-xl bg-[#F5F0E8] dark:bg-[#3A3A3A] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E07A5F]/50 text-[#2D3436] dark:text-[#E8E8E8] border border-[#E07A5F]/10" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-3 py-2 text-sm hover:bg-[#F4A261]/20 text-[#2D3436] dark:text-[#E8E8E8]">Cancel</button>
          <button onClick={submit} className="rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D4694F] transition">Unlock</button>
        </div>
      </div>
    </div>
  );
}
