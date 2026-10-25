"use client";

import { useEffect, useId, useState } from "react";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { useDebounced } from "@/components/admin/kit";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { isInAppPath } from "@/components/notifications/types";
import { api, ApiError } from "@/lib/api";

type FoundUser = { id: string; name: string; email: string; suspended?: boolean };
type Picked = { id: string; label: string };

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** "Send a notification to one user": find the user (users.read) or paste an id, then send. */
export function SendNotificationPanel() {
  const uid = useId();
  const { can } = useAdmin();
  const [fallback, setFallback] = useState(!can("users.read"));
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const [found, setFound] = useState<{ q: string; users: FoundUser[] } | null>(null);
  const [searchError, setSearchError] = useState<string>();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [manualId, setManualId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<string>();

  const searching = !fallback && !picked && debounced.length >= 2;
  const results = searching && found?.q === debounced ? found.users : null;

  useEffect(() => {
    if (!searching) return;
    let active = true;
    api<{ users: FoundUser[] }>(`/admin/users?q=${encodeURIComponent(debounced)}&pageSize=6`)
      .then((r) => {
        if (!active) return;
        setSearchError(undefined);
        setFound({ q: debounced, users: r.users });
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 403) setFallback(true);
        else setSearchError(e instanceof Error ? e.message : "The search failed.");
      });
    return () => {
      active = false;
    };
  }, [debounced, searching]);

  const userId = fallback ? manualId.trim() : picked?.id ?? "";

  function review(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!userId) found.user = fallback ? "Enter the user id." : "Search for a user and pick one.";
    else if (!ID_PATTERN.test(userId)) found.user = "That does not look like a user id.";
    if (title.trim().length < 3 || title.trim().length > 120) found.title = "Use between 3 and 120 characters.";
    if (body.trim().length < 1 || body.trim().length > 1000) found.body = "Write a message of up to 1000 characters.";
    if (link.trim() && !isInAppPath(link.trim())) found.link = "Use an in-app path such as /account/support (it must start with a single /).";
    setErrors(found);
    setSent(undefined);
    if (Object.keys(found).length === 0) setConfirming(true);
  }

  async function send() {
    try {
      await api("/admin/notifications", {
        method: "POST",
        body: { userId, title: title.trim(), body: body.trim(), ...(link.trim() && { link: link.trim() }) },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw new Error("No user has that id.");
      throw e;
    }
    setSent(`Notification sent to ${fallback ? "the user" : picked?.label ?? "the user"}.`);
    setTitle("");
    setBody("");
    setLink("");
    setPicked(null);
    setManualId("");
    setQuery("");
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">Send a notification to one user</h2>
      <p className="mt-1 text-sm text-ink-muted">It appears in their notification list. Use it for a follow-up on a case; it cannot be recalled.</p>
      <form onSubmit={review} noValidate aria-label="Send a notification" className="mt-4 space-y-4">
        {fallback ? (
          <TextInput
            id={`${uid}-uid`} label="User id" value={manualId} onChange={(e) => setManualId(e.target.value)} error={errors.user}
            hint={can("users.read") ? "User search was refused for your role, so enter the user id." : "Your role cannot search users, so enter the user id (from a ticket or audit entry)."}
            autoComplete="off" spellCheck={false}
          />
        ) : picked ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-surface p-3">
            <p className="min-w-0 text-sm"><span className="font-semibold">To:</span> <span className="break-words">{picked.label}</span></p>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
          </div>
        ) : (
          <div>
            <SearchInput
              id={`${uid}-search`} label="Find the user" placeholder="Name, email or id" value={query} onChange={(e) => setQuery(e.target.value)}
              hint="Type at least 2 characters." error={errors.user} autoComplete="off"
            />
            <div aria-live="polite" className="mt-2">
              {searching && searchError && <Alert tone="error">{searchError}</Alert>}
              {results && results.length === 0 && <p className="text-sm text-ink-muted">No users match “{debounced}”.</p>}
              {results && results.length > 0 && (
                <ul aria-label="Matching users" className="divide-y divide-line rounded-control border border-line">
                  {results.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => { setPicked({ id: u.id, label: `${u.name} (${u.email})` }); setErrors((e) => ({ ...e, user: "" })); }}
                        className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-brand-50"
                      >
                        <span className="text-sm font-semibold break-words">{u.name}{u.suspended ? " (suspended)" : ""}</span>
                        <span className="text-xs break-all text-ink-subtle">{u.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {picked && errors.user && <p role="alert" className="text-sm font-medium text-danger">{errors.user}</p>}
        <TextInput id={`${uid}-title`} label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} error={errors.title} hint="3 to 120 characters." />
        <TextArea id={`${uid}-body`} label="Message" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} error={errors.body} hint={`${body.length} / 1000 characters. Plain text only.`} className="min-h-24" />
        <TextInput id={`${uid}-link`} label="Link (optional)" value={link} maxLength={200} onChange={(e) => setLink(e.target.value)} error={errors.link} hint="An in-app path such as /account/support." placeholder="/account/support" autoComplete="off" />
        <div aria-live="polite">{sent && <Alert tone="success">{sent}</Alert>}</div>
        <div className="flex justify-end"><Button type="submit">Review and send</Button></div>
      </form>
      <ConfirmDialog open={confirming} title="Send this notification?" confirmLabel="Send notification" onConfirm={send} onClose={() => setConfirming(false)}>
        <p>
          “{title.trim()}” will be delivered to <strong>{fallback ? `user ${userId}` : picked?.label}</strong>. This cannot be undone.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
