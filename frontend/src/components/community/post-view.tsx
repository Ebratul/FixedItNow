"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import type { CommentList, CommunityComment, Post } from "@/lib/community";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { CommunityNote, CommunityTabs, Pager } from "./community-shell";
import { ReportButton } from "./report-button";

export function PostView({ id }: { id: string }) {
  return <AuthGate>{() => <Detail id={id} />}</AuthGate>;
}

function Detail({ id }: { id: string }) {
  const { state, refresh } = useApi<{ post: Post }>(`/community/posts/${id}`);
  if (state.status === "loading" || state.status === "unauthenticated") return <Skeleton className="h-64" />;
  if (state.status === "error") {
    return (
      <ErrorState title="We couldn't open this post" action={<LinkButton href="/community">Back to discussions</LinkButton>}>
        It may have been removed, or the service is unavailable. {state.message}
      </ErrorState>
    );
  }
  return <PostBody initial={state.data.post} refresh={refresh} />;
}

function PostBody({ initial, refresh }: { initial: Post; refresh: () => void }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();
  const [liking, setLiking] = useState(false);
  const hidden = post.status === "HIDDEN";

  async function toggleLike() {
    setLiking(true);
    setError(undefined);
    try {
      const res = await api<{ reacted: boolean; likeCount: number }>(
        post.likedByMe ? `/community/posts/${post.id}/reactions/LIKE` : `/community/posts/${post.id}/reactions`,
        post.likedByMe ? { method: "DELETE" } : { method: "POST", body: { type: "LIKE" } },
      );
      setPost((p) => ({ ...p, likedByMe: res.reacted, likeCount: res.likeCount }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your like.");
    } finally {
      setLiking(false);
    }
  }

  return (
    <div className="space-y-6">
      <CommunityTabs />
      <article className="space-y-4">
        {hidden && <Alert tone="warning" title="Removed by moderators">Only you can see this post now. It cannot be edited or deleted.</Alert>}
        {editing ? (
          <EditPost post={post} onCancel={() => setEditing(false)} onSaved={(p) => { setPost(p); setEditing(false); }} />
        ) : (
          <Card className="p-6">
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              <span className="font-semibold text-ink-muted">{post.author.displayName}</span>
              <span>· {formatDateTime(post.createdAt)}{post.editedAt ? " · edited" : ""}</span>
              {hidden && <Badge tone="warning">Hidden</Badge>}
            </p>
            <h1 className="mt-1 text-h1 font-extrabold break-words text-brand-950">{post.title}</h1>
            <p className="mt-3 whitespace-pre-line break-words text-lg text-ink-muted">{post.body}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button variant={post.likedByMe ? "primary" : "secondary"} size="sm" aria-pressed={post.likedByMe} onClick={toggleLike} loading={liking} disabled={hidden}>
                <Heart className="size-4" aria-hidden /> {post.likedByMe ? "Liked" : "Like"} · {post.likeCount}
              </Button>
              {post.isMine && !hidden && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
                </>
              )}
              {!post.isMine && <ReportButton type="POST" id={post.id} label="Report post" />}
            </div>
          </Card>
        )}
        {error && <Alert tone="error">{error}</Alert>}
      </article>

      {!hidden && <Comments postId={post.id} onCount={refresh} />}
      <CommunityNote />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        confirmLabel="Delete post"
        tone="danger"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await api(`/community/posts/${post.id}`, { method: "DELETE" });
          router.replace("/community");
        }}
      >
        The post and its comments disappear for everyone. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}

function EditPost({ post, onSaved, onCancel }: { post: Post; onSaved: (post: Post) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(undefined);
    try {
      const res = await api<{ post: Post }>(`/community/posts/${post.id}`, { method: "PATCH", body: { title, body } });
      onSaved(res.post);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        if (Object.keys(e.fieldErrors).length === 0) setFormError(e.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="p-5">
      <form onSubmit={save} className="space-y-4" noValidate>
        <TextInput id="edit-title" label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} error={errors.title} disabled={pending} />
        <TextArea id="edit-body" label="Post" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} error={errors.body} disabled={pending} />
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="flex gap-3">
          <Button type="submit" loading={pending}>Save changes</Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function Comments({ postId, onCount }: { postId: string; onCount: () => void }) {
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<CommentList>(`/community/posts/${postId}/comments?page=${page}&pageSize=20`);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CommunityComment | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await api(`/community/posts/${postId}/comments`, { method: "POST", body: { body: text } });
      setText("");
      reload();
      onCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post your comment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <h2 id="comments-heading" className="text-h2 font-extrabold">Comments{state.status === "ready" ? ` (${state.data.total})` : ""}</h2>
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <Skeleton className="h-20" />
      ) : state.status === "error" ? (
        <ErrorState title="Comments could not be loaded" action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.comments.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-4 text-sm text-ink-muted">No comments yet. Be the first to reply.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {state.data.comments.map((c) => (
              <li key={c.id} className="rounded-card border border-line p-4">
                <p className="text-xs text-ink-subtle"><span className="font-semibold text-ink-muted">{c.author.displayName}</span> · {formatDateTime(c.createdAt)}{c.editedAt ? " · edited" : ""}</p>
                {editing === c.id ? (
                  <EditComment comment={c} onDone={() => { setEditing(null); reload(); }} />
                ) : (
                  <p className="mt-1 whitespace-pre-line break-words text-ink-muted">{c.body}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.isMine ? (
                    editing !== c.id && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c.id)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(c)}>Delete</Button>
                      </>
                    )
                  ) : (
                    <ReportButton type="COMMENT" id={c.id} label="Report" />
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="Comment pages" />
        </>
      )}
      <form onSubmit={add} className="space-y-3" noValidate>
        <TextArea id="new-comment" label="Add a comment" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} className="min-h-24" disabled={pending} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" loading={pending} disabled={!text.trim()}>Comment</Button>
      </form>
      <ConfirmDialog
        open={removing !== null}
        title="Delete your comment?"
        confirmLabel="Delete comment"
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await api(`/community/comments/${removing!.id}`, { method: "DELETE" });
          reload();
          onCount();
        }}
      >
        This cannot be undone.
      </ConfirmDialog>
    </section>
  );
}

function EditComment({ comment, onDone }: { comment: CommunityComment; onDone: () => void }) {
  const [text, setText] = useState(comment.body);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await api(`/community/comments/${comment.id}`, { method: "PATCH", body: { body: text } });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setPending(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-2 space-y-2" noValidate>
      <TextArea id={`edit-${comment.id}`} label="Edit comment" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} className="min-h-20" disabled={pending} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>Save</Button>
        <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
