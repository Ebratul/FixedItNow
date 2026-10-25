"use client";

import Link from "next/link";
import { Heart, MessageSquare, MessagesSquare } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import type { Post, PostList } from "@/lib/community";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { CommunityNote, CommunityTabs, Pager } from "./community-shell";

export function FeedView() {
  return <AuthGate>{() => <Feed />}</AuthGate>;
}

function Feed() {
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<"all" | "mine">("all");
  const { state, reload, stale } = useApi<PostList>(`/community/posts?scope=${scope}&page=${page}&pageSize=10`);
  const [notice, setNotice] = useState<string>();

  return (
    <div className="space-y-6">
      <CommunityTabs />
      <Composer onPosted={() => { setNotice("Your post is live."); setPage(1); setScope("all"); reload(); }} />
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 font-extrabold">{scope === "all" ? "Latest posts" : "Your posts"}</h2>
        <div role="group" aria-label="Which posts" className="flex gap-2">
          <Button size="sm" variant={scope === "all" ? "primary" : "secondary"} aria-pressed={scope === "all"} onClick={() => { setScope("all"); setPage(1); }}>Everyone</Button>
          <Button size="sm" variant={scope === "mine" ? "primary" : "secondary"} aria-pressed={scope === "mine"} onClick={() => { setScope("mine"); setPage(1); }}>Mine</Button>
        </div>
      </div>
      {state.status === "loading" || state.status === "unauthenticated" || stale ? (
        <div aria-busy="true" aria-label="Loading posts" className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : state.status === "error" ? (
        <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.posts.length === 0 ? (
        <EmptyState icon={MessagesSquare} headingLevel={3} title={scope === "all" ? "No posts yet" : "You haven't posted yet"}>
          {scope === "all" ? "Start the first conversation using the form above." : "Posts you write will show up here, including any that moderators removed."}
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {state.data.posts.map((post) => <li key={post.id}><PostCard post={post} /></li>)}
          </ul>
          <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="Post pages" />
        </>
      )}
      <CommunityNote />
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
        <span className="font-semibold text-ink-muted">{post.author.displayName}</span>
        <span>· {formatDateTime(post.createdAt)}{post.editedAt ? " · edited" : ""}</span>
        {post.status === "HIDDEN" && <Badge tone="warning">Removed by moderators</Badge>}
      </div>
      <h3 className="mt-1 text-lg font-bold break-words">
        <Link href={`/community/${post.id}`} className="hover:underline focus-visible:outline-2">{post.title}</Link>
      </h3>
      {post.status === "HIDDEN" ? (
        <p className="mt-1 text-sm text-ink-muted">Only you can see this post. It is hidden from everyone else.</p>
      ) : (
        <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-ink-muted">{post.body}</p>
      )}
      <p className="mt-3 flex items-center gap-4 text-sm text-ink-subtle">
        <span className="inline-flex items-center gap-1"><Heart className="size-4" aria-hidden /> {post.likeCount}<span className="sr-only"> likes</span></span>
        <span className="inline-flex items-center gap-1"><MessageSquare className="size-4" aria-hidden /> {post.commentCount}<span className="sr-only"> comments</span></span>
      </p>
    </Card>
  );
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(undefined);
    try {
      await api("/community/posts", { method: "POST", body: { title, body } });
      setTitle("");
      setBody("");
      onPosted();
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
      <form onSubmit={submit} className="space-y-4" noValidate>
        <h2 className="text-lg font-bold">Start a discussion</h2>
        <TextInput id="post-title" label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} error={errors.title} disabled={pending} />
        <TextArea id="post-body" label="What would you like to share or ask?" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} error={errors.body} disabled={pending} />
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" loading={pending} disabled={!title.trim() || !body.trim()}>Post</Button>
      </form>
    </Card>
  );
}
