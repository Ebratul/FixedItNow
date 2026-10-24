"use client";

import { ArrowBigUp, Lightbulb } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_MEANING, type Proposal, type ProposalList, type ProposalStatus } from "@/lib/community";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { CommunityNote, CommunityTabs, Pager } from "./community-shell";
import { ReportButton } from "./report-button";

const TONES: Record<ProposalStatus, BadgeTone> = { SUBMITTED: "neutral", UNDER_REVIEW: "brand", ACCEPTED: "success", PLANNED: "brand", COMPLETED: "success", DECLINED: "danger" };

export function ProposalsView() {
  return <AuthGate>{() => <Proposals />}</AuthGate>;
}

function Proposals() {
  const [sort, setSort] = useState<"top" | "new">("top");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<ProposalList>(`/feature-proposals?sort=${sort}&page=${page}&pageSize=10${status ? `&status=${status}` : ""}`);
  const [notice, setNotice] = useState<string>();

  return (
    <div className="space-y-6">
      <CommunityTabs />
      <Alert tone="info" title="How proposals work">
        Suggest a feature and vote once on the ones you want. Votes only help the team decide what to look at first: reaching a number of votes does not build or switch anything on by itself.
      </Alert>
      <Composer onDone={() => { setNotice("Your proposal was submitted."); setPage(1); reload(); }} />
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-h2 font-extrabold">Proposals</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Sort proposals" className="flex gap-2">
            <Button size="sm" variant={sort === "top" ? "primary" : "secondary"} aria-pressed={sort === "top"} onClick={() => { setSort("top"); setPage(1); }}>Most votes</Button>
            <Button size="sm" variant={sort === "new" ? "primary" : "secondary"} aria-pressed={sort === "new"} onClick={() => { setSort("new"); setPage(1); }}>Newest</Button>
          </div>
          <SelectInput id="proposal-status" label="Status" hideLabel placeholder="All statuses" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={(Object.keys(PROPOSAL_STATUS_LABELS) as ProposalStatus[]).map((s) => ({ value: s, label: PROPOSAL_STATUS_LABELS[s] }))} />
        </div>
      </div>
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <div aria-busy="true" aria-label="Loading proposals" className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : state.status === "error" ? (
        <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.proposals.length === 0 ? (
        <EmptyState icon={Lightbulb} headingLevel={3} title="No proposals here yet">Be the first to suggest something using the form above.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {state.data.proposals.map((p) => <li key={p.id}><ProposalCard proposal={p} /></li>)}
          </ul>
          <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="Proposal pages" />
        </>
      )}
      <CommunityNote />
    </div>
  );
}

function ProposalCard({ proposal: initial }: { proposal: Proposal }) {
  const [p, setP] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function toggle() {
    setPending(true);
    setError(undefined);
    try {
      const res = await api<{ voted: boolean; voteCount: number }>(`/feature-proposals/${p.id}/vote`, { method: p.votedByMe ? "DELETE" : "POST" });
      setP((cur) => ({ ...cur, votedByMe: res.voted, voteCount: res.voteCount }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your vote.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex gap-4 p-5">
      <div className="flex w-16 shrink-0 flex-col items-center">
        <Button
          variant={p.votedByMe ? "primary" : "secondary"}
          size="sm"
          aria-pressed={p.votedByMe}
          aria-label={p.votedByMe ? `Remove your vote from ${p.title}` : `Vote for ${p.title}`}
          onClick={toggle}
          loading={pending}
          disabled={!p.votingOpen}
          className="w-14 flex-col gap-0 px-0"
        >
          <ArrowBigUp className="size-5" aria-hidden />
        </Button>
        <p className="mt-1 text-lg font-extrabold tabular-nums" aria-label={`${p.voteCount} votes`}>{p.voteCount}</p>
        <p className="text-xs text-ink-subtle" aria-hidden>votes</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold break-words">{p.title}</h3>
          <Badge tone={TONES[p.status]}>{PROPOSAL_STATUS_LABELS[p.status]}</Badge>
        </div>
        <p className="mt-1 whitespace-pre-line break-words text-ink-muted">{p.description}</p>
        <p className="mt-2 text-xs text-ink-subtle">{p.author.displayName} · {formatDate(p.createdAt)} · {PROPOSAL_STATUS_MEANING[p.status]}</p>
        {p.response && (
          <p className="mt-3 rounded-control border border-line bg-surface p-3 text-sm text-ink-muted"><span className="font-semibold text-ink">Team response: </span>{p.response}</p>
        )}
        {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
        {!p.isMine && <div className="mt-2"><ReportButton type="PROPOSAL" id={p.id} label="Report" /></div>}
      </div>
    </Card>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(undefined);
    try {
      await api("/feature-proposals", { method: "POST", body: { title, description } });
      setTitle("");
      setDescription("");
      onDone();
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
        <h2 className="text-lg font-bold">Suggest a feature</h2>
        <TextInput id="proposal-title" label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} error={errors.title} disabled={pending} />
        <TextArea id="proposal-description" label="What should it do, and why?" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} error={errors.description} disabled={pending} />
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" loading={pending} disabled={!title.trim() || !description.trim()}>Submit proposal</Button>
      </form>
    </Card>
  );
}
