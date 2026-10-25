"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { ApiView, buildQuery, DataTable, StatusBadge, useDebounced, type Column } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { KNOWLEDGE_STATUS, type KnowledgeRow } from "./ai-types";

export function DocumentList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { can } = useAdmin();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const { state, reload, stale } = useApi<{ documents: KnowledgeRow[] }>(`/admin/ai/knowledge${buildQuery({ status, q })}`);

  const columns: Column<KnowledgeRow>[] = [
    { key: "title", header: "Title", cell: (d) => <span className="break-words">{d.title}</span>, className: "min-w-40" },
    { key: "slug", header: "Slug", cell: (d) => <code className="text-xs">{d.slug}</code>, hideBelow: "md" },
    { key: "status", header: "Status", cell: (d) => <StatusBadge value={d.status} map={KNOWLEDGE_STATUS} /> },
    { key: "url", header: "Page", cell: (d) => <code className="text-xs">{d.url}</code>, hideBelow: "lg" },
    { key: "version", header: "Version", cell: (d) => `v${d.version}`, hideBelow: "md" },
    { key: "size", header: "Characters", cell: (d) => d.characters.toLocaleString("en"), align: "right", hideBelow: "lg" },
    { key: "updated", header: "Updated", cell: (d) => <span className="whitespace-nowrap">{formatDateTime(d.updatedAt)}</span>, hideBelow: "lg" },
    { key: "open", header: "Action", cell: (d) => <Button size="sm" variant="secondary" onClick={() => onOpen(d.id)} aria-label={`${can("ai.manage") ? "Open" : "View"} ${d.title}`}>{can("ai.manage") ? "Open" : "View"}</Button> },
  ];

  return (
    <section aria-label="Knowledge documents" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Knowledge documents</h2>
        {can("ai.manage") && <Button onClick={onNew}>New document</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <SearchInput id="doc-search" label="Search" placeholder="Title, slug or text" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        <SelectInput id="doc-status" label="Status" placeholder="Any status" value={status} onChange={(e) => setStatus(e.target.value)}
          options={(Object.keys(KNOWLEDGE_STATUS) as (keyof typeof KNOWLEDGE_STATUS)[]).map((s) => ({ value: s, label: KNOWLEDGE_STATUS[s].label }))} />
      </div>
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-48" />}>
        {({ documents }) =>
          documents.length === 0 ? (
            <EmptyState icon={FileText} headingLevel={3} title="No documents found" action={can("ai.manage") && !status && !q ? <Button onClick={onNew}>New document</Button> : undefined}>
              {status || q ? "No documents match these filters." : "There are no knowledge documents yet. Only published documents reach the assistant."}
            </EmptyState>
          ) : (
            <div className="space-y-2">
              <DataTable caption="Knowledge documents" columns={columns} rows={documents} rowKey={(d) => d.id} busy={stale} />
              <p className="text-xs text-ink-subtle">Showing up to 200 documents.</p>
            </div>
          )
        }
      </ApiView>
    </section>
  );
}
