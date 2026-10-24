"use client";

import Link from "next/link";
import { RotateCcw, SearchX, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { ProfessionalCard } from "@/components/professional/professional-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { api } from "@/lib/api";
import {
  FIELD_KEYS,
  MATCH_TEXT,
  NOTE_TEXT,
  REFRESH_MESSAGE,
  SUGGESTIONS,
  assistantErrorMessage,
  directorySearchHref,
  intentChips,
  withoutField,
  type AssistantIntent,
  type AssistantResponse,
  type ChatPayload,
  type IntentField,
} from "@/lib/assistant";
import { useApi } from "@/lib/use-api";

type Turn =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; response: AssistantResponse }
  | { id: number; role: "error"; text: string; retry: ChatPayload };

export function AssistantView() {
  return <AuthGate>{() => <Gate />}</AuthGate>;
}

/** The assistant is optional infrastructure: say plainly when it is not available. */
function Gate() {
  const { state } = useApi<{ available: boolean }>("/ai/status");
  if (state.status === "loading") return <Skeleton className="h-64" />;
  if (state.status === "ready" && !state.data.available) {
    return (
      <EmptyState
        icon={SearchX}
        headingLevel={2}
        title="The assistant isn't available yet"
        action={<LinkButton href="/workers">Search professionals</LinkButton>}
      >
        This site hasn&apos;t switched the AI assistant on. The normal search works the same way and shows the same professionals.
      </EmptyState>
    );
  }
  return <Chat />;
}

function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [intent, setIntent] = useState<AssistantIntent>({});
  const [sources, setSources] = useState<Record<string, "explicit" | "inferred" | "carried">>({});
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const categories = useApi<{ categories: { slug: string; name: string }[] }>("/categories");
  const categoryNames = useMemo(
    () =>
      categories.state.status === "ready"
        ? Object.fromEntries(categories.state.data.categories.map((c) => [c.slug, c.name]))
        : {},
    [categories.state],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [turns, pending]);

  const send = useCallback(
    async (payload: ChatPayload, echo?: string) => {
      setPending(true);
      setTurns((t) => [
        ...t.filter((turn) => turn.role !== "error"),
        ...(echo ? [{ id: nextId.current++, role: "user" as const, text: echo }] : []),
      ]);
      try {
        const response = await api<AssistantResponse>("/ai/chat", { method: "POST", body: payload });
        setIntent(response.intent);
        setSources(response.intentSources);
        setTurns((t) => [...t, { id: nextId.current++, role: "assistant", response }]);
      } catch (error) {
        setTurns((t) => [
          ...t,
          { id: nextId.current++, role: "error", text: assistantErrorMessage(error), retry: payload },
        ]);
      } finally {
        setPending(false);
      }
    },
    [],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || pending) return;
    setText("");
    void send({ message, intent, locale: "auto" }, message);
  }

  const refresh = (next: AssistantIntent, echo?: string) =>
    send({ message: REFRESH_MESSAGE, intent: next, action: "search" }, echo);

  function reset() {
    setTurns([]);
    setIntent({});
    setSources({});
  }

  const chips = intentChips(intent, sources, categoryNames);
  const lastAssistantId = [...turns].reverse().find((t) => t.role === "assistant")?.id;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <Alert tone="info" title="How this assistant works">
          It turns your request into search filters, then shows professionals from the live FixedItNow directory.
          It can&apos;t book, pay, or share contact details, and it never invents prices, ratings or availability.
        </Alert>

        <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-5">
          {turns.length === 0 && (
            <section aria-label="Suggestions" className="space-y-3">
              <h2 className="text-base font-bold text-ink">Try asking</h2>
              <ul className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <Button variant="secondary" size="sm" className="whitespace-normal text-left" disabled={pending} onClick={() => void send({ message: s, intent, locale: "auto" }, s)}>
                      {s}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {turns.map((turn) =>
            turn.role === "user" ? (
              <div key={turn.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-card bg-brand-700 px-4 py-3 text-white">{turn.text}</p>
              </div>
            ) : turn.role === "error" ? (
              <Alert key={turn.id} tone="error" title="The assistant couldn't answer">
                <p>{turn.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => void send(turn.retry)}>
                    Try again
                  </Button>
                  <LinkButton size="sm" variant="secondary" href={directorySearchHref(intent)}>
                    Use the normal search
                  </LinkButton>
                </div>
              </Alert>
            ) : (
              <AssistantTurn
                key={turn.id}
                response={turn.response}
                active={turn.id === lastAssistantId && !pending}
                onPick={(next) => void refresh(next)}
              />
            ),
          )}

          {pending && (
            <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
              <Sparkles className="size-4 animate-pulse" aria-hidden /> Looking through the directory…
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <TextArea
            id="assistant-message"
            label="Describe what you need"
            hint="English, বাংলা or Banglish. Mention the service, your area, budget and any experience you want."
            value={text}
            maxLength={1000}
            rows={3}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
            }}
            className="min-h-24"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={pending} disabled={!text.trim()}>
              <Send className="size-4" aria-hidden /> Send
            </Button>
            {turns.length > 0 && (
              <Button variant="ghost" onClick={reset} disabled={pending}>
                <RotateCcw className="size-4" aria-hidden /> Start over
              </Button>
            )}
            <LinkButton variant="ghost" href={directorySearchHref(intent)}>
              Use the normal search
            </LinkButton>
          </div>
        </form>
      </div>

      <aside aria-label="Your search" className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-base font-bold text-ink">Your search</h2>
        {chips.length === 0 ? (
          <p className="text-sm text-ink-muted">No filters yet. They appear here as the assistant understands your request.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.field}>
                <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line-strong bg-canvas pl-3 text-sm font-semibold text-ink">
                  {chip.label}
                  {chip.source === "inferred" && <Badge tone="warning">understood</Badge>}
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove filter: ${chip.label}`}
                    onClick={() => void refresh(withoutField(intent, chip.field))}
                    className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:text-ink disabled:opacity-50"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {intent.preferredTime && (
          <p className="text-sm text-ink-muted">
            When: <span className="font-semibold text-ink">{intent.preferredTime}</span> (not used for filtering)
          </p>
        )}
      </aside>
    </div>
  );
}

function AssistantTurn({
  response,
  active,
  onPick,
}: {
  response: AssistantResponse;
  active: boolean;
  onPick: (intent: AssistantIntent) => void;
}) {
  const { clarification, relaxations, answer } = response;
  return (
    <div className="space-y-4">
      <div className="max-w-[90%] rounded-card border border-line bg-surface px-4 py-3">
        <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-subtle">
          <Sparkles className="size-3.5" aria-hidden /> Assistant
        </p>
        <p className="whitespace-pre-wrap text-ink">{response.message}</p>
      </div>

      {answer && (
        <div className="max-w-[90%] text-sm">
          {answer.grounded && answer.sources.length > 0 ? (
            <p className="text-ink-muted">
              Sources:{" "}
              {answer.sources.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={s.url} className="font-semibold text-brand-700 underline">
                    {s.title}
                  </Link>
                </span>
              ))}
            </p>
          ) : (
            <p className="text-ink-muted">
              No source in the help content covers this. See the <Link href="/help" className="font-semibold text-brand-700 underline">Help page</Link> or{" "}
              <Link href="/contact" className="font-semibold text-brand-700 underline">contact us</Link>.
            </p>
          )}
        </div>
      )}

      {response.recommendations.length > 0 && (
        <section aria-label="Matching professionals" className="space-y-3">
          <h3 className="text-base font-bold text-ink">
            From the FixedItNow directory
            <span className="ml-2 text-sm font-normal text-ink-muted">details below come from each profile, not from the assistant</span>
          </h3>
          <ol className="grid gap-4 sm:grid-cols-2">
            {response.recommendations.map((rec) => (
              <li key={rec.worker.id} className="space-y-2">
                <p className="text-sm text-ink-muted">
                  #{rec.rank} · Matches your {rec.matchedOn.map((m) => MATCH_TEXT[m].toLowerCase()).join(", ")}
                </p>
                <ProfessionalCard pro={rec.worker} headingLevel={3} />
              </li>
            ))}
          </ol>
          {typeof response.total === "number" && response.total > response.recommendations.length && (
            <p className="text-sm">
              <Link href={directoryHref(response.intent)} className="font-semibold text-brand-700 underline">
                See all {response.total} matching professionals
              </Link>
            </p>
          )}
        </section>
      )}

      {response.kind === "no_results" && relaxations.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Relax a filter">
          {relaxations.map((r) => {
            const key: IntentField = FIELD_KEYS[r.drop];
            return (
              <Button key={r.drop} variant="secondary" size="sm" disabled={!active} onClick={() => onPick(withoutField(response.intent, key))}>
                {RELAX_TEXT[r.drop]} ({r.matchCount} {r.matchCount === 1 ? "match" : "matches"})
              </Button>
            );
          })}
        </div>
      )}
      {response.kind === "no_results" && relaxations.length === 0 && (
        <p className="text-sm text-ink-muted">
          You can edit the filters on the right, or{" "}
          <Link href={directoryHref(response.intent)} className="font-semibold text-brand-700 underline">browse the full directory</Link>.
        </p>
      )}

      {clarification && (
        <div role="group" aria-label={clarification.question} className="space-y-2">
          {!clarification.blocking && <p className="text-sm text-ink-muted">{clarification.question}</p>}
          <div className="flex flex-wrap gap-2">
            {clarification.options.map((o) => (
              <Button
                key={o.value}
                variant="secondary"
                size="sm"
                disabled={!active}
                onClick={() => onPick({ ...response.intent, [clarification.field]: o.value })}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {response.notes.length > 0 && (
        <ul className="space-y-1 text-sm text-ink-muted">
          {response.notes.map((n) => (
            <li key={n}>{NOTE_TEXT[n]}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RELAX_TEXT = {
  category: "Any service",
  location: "Any area",
  max_budget_bdt: "Remove budget limit",
  min_experience_years: "Remove experience minimum",
} as const;

const directoryHref = directorySearchHref;
