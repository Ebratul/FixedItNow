"use client";

import { Check, Copy, Download, FileClock, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminPage, ApiView, buildQuery, downloadFile, useDebounced } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Pager } from "@/components/community/community-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput } from "@/components/ui/text-input";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { adminErrorMessage } from "./admin-errors";
import type { AuditEntry, AuditList, AuditVerify } from "./types";

const PAGE_SIZE = 25;

/** Dates are picked as calendar days and read as Bangladesh time (UTC+6), the platform's time zone. */
const dayStart = (d: string) => (d ? `${d}T00:00:00+06:00` : "");
const dayEnd = (d: string) => (d ? `${d}T23:59:59.999+06:00` : "");

/** Audit log browser with CSV export and the hash-chain integrity check. */
export function AuditView() {
  const { can } = useAdmin();
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [actorId, setActorId] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [exportState, setExportState] = useState<{ pending: boolean; error?: string }>({ pending: false });

  const filters = {
    action,
    targetType: useDebounced(targetType.trim()),
    targetId: useDebounced(targetId.trim()),
    actorId: useDebounced(actorId.trim()),
    q: useDebounced(q.trim()),
    from: dayStart(from),
    to: dayEnd(to),
  };
  const filterQuery = buildQuery(filters);
  const { state, reload, stale } = useApi<AuditList>(`/admin/audit${buildQuery({ ...filters, page, pageSize: PAGE_SIZE })}`);
  const filtered = filterQuery !== "";
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  async function exportCsv() {
    setExportState({ pending: true });
    try {
      await downloadFile(`/admin/audit/export${filterQuery}`, "audit-log.csv");
      setExportState({ pending: false });
    } catch (e) {
      setExportState({ pending: false, error: e instanceof Error ? e.message : "The export could not be created." });
    }
  }

  return (
    <AdminPage
      title="Audit log"
      description="Everything administrators did, newest first. Entries cannot be edited or deleted; they are chained together with hashes so tampering can be detected."
      permission="audit.read"
      actions={<Button variant="secondary" onClick={exportCsv} loading={exportState.pending}><Download className="size-4" aria-hidden />Export CSV</Button>}
    >
      {exportState.error && <Alert tone="error">{exportState.error}</Alert>}
      <p className="text-sm text-ink-muted">The CSV contains the newest 5,000 entries that match the filters below. Exporting is itself recorded in this log.</p>

      {can("audit.verify") && <VerifyPanel />}

      <form role="search" aria-label="Filter audit log" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
        <ActionFilter value={action} onChange={reset(setAction)} />
        <TextInput id="audit-target-type" label="Target type" placeholder="e.g. User, Booking" value={targetType} maxLength={40} onChange={(e) => { setTargetType(e.target.value); setPage(1); }} />
        <TextInput id="audit-target-id" label="Target id" value={targetId} maxLength={100} onChange={(e) => { setTargetId(e.target.value); setPage(1); }} />
        <TextInput id="audit-actor" label="Actor id" hint="The administrator who acted." value={actorId} maxLength={64} onChange={(e) => { setActorId(e.target.value); setPage(1); }} />
        <TextInput id="audit-from" type="date" label="From (Bangladesh time)" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <TextInput id="audit-to" type="date" label="To (Bangladesh time)" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <div className="sm:col-span-2 lg:col-span-3">
          <TextInput id="audit-q" label="Free text" hint="Matches the action name or the target id. Details are not searched." value={q} maxLength={80} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </form>

      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {(data) =>
          data.entries.length === 0 ? (
            <EmptyState icon={FileClock} title={filtered ? "No entries match these filters" : "The audit log is empty"} headingLevel={2}>
              {filtered ? "Widen the dates or clear a filter." : "Administrator actions will appear here."}
            </EmptyState>
          ) : (
            <section aria-label="Results" className="space-y-4">
              <p className="text-sm text-ink-muted" aria-live="polite">{data.total} {data.total === 1 ? "entry" : "entries"}{stale && " (updating…)"}</p>
              <ul aria-busy={stale || undefined} className={`divide-y divide-line overflow-hidden rounded-card border border-line bg-canvas shadow-card ${stale ? "opacity-60" : ""}`}>
                {data.entries.map((entry) => (
                  <li key={entry.id}>
                    <Entry entry={entry} />
                  </li>
                ))}
              </ul>
              <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Audit log pages" />
            </section>
          )
        }
      </ApiView>
    </AdminPage>
  );
}

/** Action dropdown: every prefix (`user.*`) first, then the individual action names the log really contains. */
function ActionFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { state } = useApi<{ actions: string[] }>("/admin/audit/actions");
  const options = useMemo(() => {
    const actions = state.status === "ready" ? state.data.actions : [];
    const prefixes = [...new Set(actions.filter((a) => a.includes(".")).map((a) => a.split(".")[0]!))].sort();
    return [...prefixes.map((p) => ({ value: `${p}.*`, label: `${p}.* (all)` })), ...actions.map((a) => ({ value: a, label: a }))];
  }, [state]);
  return <SelectInput id="audit-action" label="Action" placeholder="All actions" value={value} onChange={(e) => onChange(e.target.value)} options={options} hint={state.status === "error" ? "The action list could not be loaded." : undefined} />;
}

function Entry({ entry }: { entry: AuditEntry }) {
  const actor = entry.actor ? (entry.actor.name ?? entry.actor.id) + (entry.actor.removed ? " (account removed)" : "") : "system";
  return (
    <details className="group px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-mono text-xs text-ink-subtle">#{entry.seq}</span>
        <span className="font-mono font-semibold">{entry.action}</span>
        <span className="text-ink-muted">on {entry.targetType} <span className="break-all">{entry.targetId}</span></span>
        <span className="text-ink-muted">by {actor}</span>
        <span className="text-ink-subtle">{formatDateTime(entry.createdAt)}</span>
      </summary>
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-xs font-semibold text-ink-subtle">Details</p>
        {entry.metadata === null || entry.metadata === undefined ? (
          <p className="text-ink-muted">No details were recorded.</p>
        ) : (
          <pre className="max-h-80 overflow-auto rounded-control bg-surface p-3 font-mono text-xs break-words whitespace-pre-wrap">{JSON.stringify(entry.metadata, null, 2)}</pre>
        )}
        <p className="text-xs text-ink-subtle">Entry hash: <span className="font-mono break-all">{entry.hash}</span></p>
      </div>
    </details>
  );
}

function VerifyPanel() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<AuditVerify>();

  async function run() {
    setPending(true);
    setError(undefined);
    try {
      setResult(await api<AuditVerify>("/admin/audit/verify"));
    } catch (e) {
      setResult(undefined);
      setError(adminErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="verify-h" className="space-y-3">
      <h2 id="verify-h" className="text-lg font-bold text-brand-950">Integrity check</h2>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-ink-muted">
          Each entry stores a hash of its own content and of the entry before it. The check recomputes every hash and confirms nothing was changed, removed or reordered since it was written. It does not prove the log is complete against someone with full database access, who could rebuild the whole chain: write down the head hash somewhere outside the database and compare it later to detect that.
        </p>
        <div><Button onClick={run} loading={pending}><ShieldCheck className="size-4" aria-hidden />Verify integrity</Button></div>
        <div aria-live="polite">
          {error && <Alert tone="error">{error}</Alert>}
          {result && <VerifyResult result={result} />}
        </div>
      </Card>
    </section>
  );
}

function VerifyResult({ result }: { result: AuditVerify }) {
  const problems = [
    result.problems.contentChanged && "The content of an entry was changed after it was written.",
    result.problems.chainBroken && "An entry no longer links to the entry before it (an entry was removed or replaced).",
    result.problems.gapOrReorder && "The sequence numbers have a gap or are out of order.",
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-3">
      {result.valid ? (
        <Alert tone="success" title="Chain is valid">All {result.checked} entries are intact and linked in order.</Alert>
      ) : (
        <Alert tone="error" title="Chain is NOT valid">The log does not match its hashes. Treat it as tampered with until you know otherwise.</Alert>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs font-semibold text-ink-subtle">Entries checked</dt><dd className="tabular-nums">{result.checked}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-subtle">Head sequence</dt><dd className="tabular-nums">{result.headSeq}</dd></div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold text-ink-subtle">Head hash</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {result.headHash ? (
              <>
                <code className="font-mono text-xs break-all">{result.headHash}</code>
                <CopyButton text={result.headHash} />
              </>
            ) : (
              <span className="text-ink-muted">The log is empty.</span>
            )}
          </dd>
        </div>
        <div><dt className="text-xs font-semibold text-ink-subtle">Checked at</dt><dd>{formatDateTime(result.checkedAt)}</dd></div>
        {!result.valid && (
          <div><dt className="text-xs font-semibold text-ink-subtle">First invalid entry</dt><dd className="tabular-nums">#{result.firstInvalidSeq}</dd></div>
        )}
      </dl>
      {!result.valid && problems.length > 0 && (
        <div>
          <p className="text-sm font-semibold">What went wrong</p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink-muted">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  }
  return (
    <>
      <Button size="sm" variant="secondary" onClick={copy}>
        {copied === "yes" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        Copy hash
      </Button>
      <span role="status" className="text-xs text-ink-muted">{copied === "yes" ? "Copied" : copied === "no" ? "Could not copy: select the hash and copy it manually." : ""}</span>
    </>
  );
}
