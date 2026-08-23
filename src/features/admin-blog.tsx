import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper, Plus, Pencil, Trash2, Loader2, Image as ImageIcon, X, Eye, EyeOff } from "lucide-react";
import { notification } from "antd";
import { useConfirm } from "@/hooks/useConfirmDialog";
import {
  listAllPostsAdmin, createPost, updatePost, deletePost,
  uploadBlogImage, slugify, fmtBlogDate, type BlogPost, type BlogPostInput,
} from "@/lib/blog.functions";

function err(e: unknown, fallback: string) {
  const message = e instanceof Error ? e.message : String(e ?? fallback);
  notification.error({ message: fallback, description: message, placement: "top" });
}

const EMPTY_DRAFT: BlogPostInput = {
  slug: "", title: "", description: "", tag: "General", body: "", published: true, read_mins: 4, cover_image_url: null,
};

export function AdminBlogManager() {
  const confirm = useConfirm();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlogPostInput>(EMPTY_DRAFT);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await listAllPostsAdmin());
    } catch (e) {
      err(e, "Couldn't load blog posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setShowEditor(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setDraft({
      slug: post.slug, title: post.title, description: post.description,
      cover_image_url: post.cover_image_url, tag: post.tag, body: post.body,
      published: post.published, read_mins: post.read_mins,
    });
    setShowEditor(true);
  };

  const onTitleChange = (title: string) => {
    setDraft((d) => ({ ...d, title, slug: editingId ? d.slug : slugify(title) }));
  };

  const onImageSelected = async (file?: File) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadBlogImage(file);
      setDraft((d) => ({ ...d, cover_image_url: url }));
    } catch (e) {
      err(e, "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.slug.trim() || !draft.body.trim()) {
      notification.warning({ message: "Title, slug, and body are required", placement: "top" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updatePost(editingId, draft);
        notification.success({ message: "Post updated", placement: "top" });
      } else {
        await createPost(draft);
        notification.success({ message: "Post published", placement: "top" });
      }
      setShowEditor(false);
      await load();
    } catch (e) {
      err(e, "Couldn't save post");
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (post: BlogPost) => {
    try {
      await updatePost(post.id, { published: !post.published });
      await load();
    } catch (e) {
      err(e, "Couldn't update post");
    }
  };

  const remove = async (post: BlogPost) => {
    const ok = await confirm({
      title: "Delete post?",
      description: `"${post.title}" will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePost(post.id);
      notification.success({ message: "Post deleted", placement: "top" });
      await load();
    } catch (e) {
      err(e, "Couldn't delete post");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">Blog posts</p>
          <p className="text-xs text-[#8C8C8C]">Shown publicly at /blog. Drafts are hidden from visitors.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-xl bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#8C8C8C]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-[#8C8C8C] dark:bg-[#1E1E1E]">
          <Newspaper className="mx-auto mb-2 h-6 w-6 opacity-40" />
          No posts yet — create your first one.
        </div>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 dark:bg-[#1E1E1E]">
              {post.cover_image_url ? (
                <img src={post.cover_image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#F0EBE3] dark:bg-[#2A2A2A]">
                  <ImageIcon className="h-5 w-5 text-[#8C8C8C]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#2D3436] dark:text-[#E8E8E8]">{post.title}</p>
                <p className="truncate text-xs text-[#8C8C8C]">/blog/{post.slug} · {fmtBlogDate(post.created_at)}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  post.published ? "bg-emerald-500/10 text-emerald-500" : "bg-[#8C8C8C]/10 text-[#8C8C8C]"
                }`}
              >
                {post.published ? "Published" : "Draft"}
              </span>
              <button
                onClick={() => togglePublished(post)}
                title={post.published ? "Unpublish" : "Publish"}
                className="shrink-0 rounded-full p-2 text-[#8C8C8C] hover:bg-black/5 dark:hover:bg-white/10"
              >
                {post.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={() => openEdit(post)}
                title="Edit"
                className="shrink-0 rounded-full p-2 text-[#8C8C8C] hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(post)}
                title="Delete"
                className="shrink-0 rounded-full p-2 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setShowEditor(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 dark:bg-[#1E1E1E]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#2D3436] dark:text-[#E8E8E8]">
                {editingId ? "Edit post" : "New post"}
              </h3>
              <button onClick={() => setShowEditor(false)} className="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Cover image */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#8C8C8C]">Cover image</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => onImageSelected(e.target.files?.[0])} />
                {draft.cover_image_url ? (
                  <div className="relative">
                    <img src={draft.cover_image_url} alt="" className="h-36 w-full rounded-xl object-cover" />
                    <button
                      onClick={() => setDraft((d) => ({ ...d, cover_image_url: null }))}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E07A5F]/30 text-sm text-[#8C8C8C]"
                  >
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    {uploadingImage ? "Uploading…" : "Upload cover image"}
                  </button>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#8C8C8C]">Title</label>
                <input
                  value={draft.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Post title"
                  className="w-full rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#8C8C8C]">Slug</label>
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))}
                  placeholder="post-url-slug"
                  className="w-full rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
                />
                <p className="mt-1 text-[11px] text-[#8C8C8C]">/blog/{draft.slug || "…"}</p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold text-[#8C8C8C]">Tag</label>
                  <input
                    value={draft.tag}
                    onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))}
                    placeholder="Guides"
                    className="w-full rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
                  />
                </div>
                <div className="w-28">
                  <label className="mb-1 block text-xs font-semibold text-[#8C8C8C]">Read mins</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.read_mins}
                    onChange={(e) => setDraft((d) => ({ ...d, read_mins: Number(e.target.value) || 1 }))}
                    className="w-full rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#8C8C8C]">Short description</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="One or two sentences shown on the blog index and in link previews."
                  rows={2}
                  className="w-full rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#8C8C8C]">Body</label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  placeholder={"Write the full post here.\n\nSeparate paragraphs with a blank line — each one renders as its own paragraph."}
                  rows={12}
                  className="w-full rounded-xl bg-[#F0EBE3] px-3 py-2 text-sm outline-none dark:bg-[#2A2A2A] dark:text-[#E8E8E8]"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[#2D3436] dark:text-[#E8E8E8]">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))}
                />
                Published (visible to everyone at /blog)
              </label>

              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-xl bg-[#E07A5F] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editingId ? "Save changes" : "Create post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
