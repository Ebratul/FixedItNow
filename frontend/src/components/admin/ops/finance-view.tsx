"use client";

import { Download, Info } from "lucide-react";
import { useState } from "react";
import { ApiView, DataTable, StatCard, StatGrid, buildQuery, downloadFile, useDebounced, type Column } from "@/components/admin/kit";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput } from "@/components/ui/text-input";
import { dhakaDateKey, formatBdt } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { DailyChart, type DailyPoint } from "./finance-chart";
import { DateRangeFields, Section, dayStartIso, errorText, humanize, nextDayStartIso, providerLabel, rangeError, shiftDay } from "./shared";

const MAX_RANGE_DAYS = 366;

type Summary = {
  range: { from: string; to: string };
  currency: string;
  totals: { collectedBdt: number; refundedBdt: number; netBdt: number; successfulPayments: number };
  byProvider: { provider: string; collectedBdt: number; payments: number }[];
  byStatus: Record<string, number>;
  byCategory: { category: string; collectedBdt: number; payments: number }[];
  pendingRefunds: { count: number; requestedBdt: number };
  daily: DailyPoint[];
};
type Commission = {
  rateBps: number;
  rateSource: "setting" | "override";
  configuredRateBps: number;
  totals: { collectedBdt: number; refundedBdt: number; netBdt: number; commissionBdt: number };
  reportingOnly: boolean;
  note: string;
};

const percent = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

export function FinanceView() {
  const today = dhakaDateKey();
  const [from, setFrom] = useState(() => shiftDay(today, -29));
  const [to, setTo] = useState(today);
  const problem = rangeError(from, to, MAX_RANGE_DAYS) ?? (!from || !to ? "Choose both a start and an end date." : undefined);
  const range = problem ? undefined : { from: dayStartIso(from), to: nextDayStartIso(to) };
  return (
    <div className="space-y-8">
      <Card className="p-4">
        <h2 className="mb-3 text-base font-bold">Reporting period</h2>
        <DateRangeFields idPrefix="finance" label="Report" from={from} to={to} onFrom={setFrom} onTo={setTo} error={problem} />
        <p className="mt-3 text-sm text-ink-muted">Days are Bangladesh calendar days. Both dates are included; a report covers at most {MAX_RANGE_DAYS} days. Only payments and refunds confirmed by the provider are counted.</p>
      </Card>
      {range ? (
        <>
          <SummaryReport range={range} />
          <CommissionReport range={range} />
        </>
      ) : (
        <Alert tone="warning">Fix the reporting period above to load the reports.</Alert>
      )}
    </div>
  );
}

function SummaryReport({ range }: { range: { from: string; to: string } }) {
  const { state, reload, stale } = useApi<Summary>(`/admin/finance/summary${buildQuery(range)}`);
  return (
    <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
      {(s) => {
        const providerCols: Column<Summary["byProvider"][number]>[] = [
          { key: "p", header: "Provider", cell: (r) => providerLabel(r.provider) },
          { key: "n", header: "Successful payments", align: "right", cell: (r) => r.payments },
          { key: "c", header: "Collected", align: "right", cell: (r) => formatBdt(r.collectedBdt) },
        ];
        const categoryCols: Column<Summary["byCategory"][number]>[] = [
          { key: "p", header: "Service category", cell: (r) => r.category },
          { key: "n", header: "Successful payments", align: "right", cell: (r) => r.payments },
          { key: "c", header: "Collected", align: "right", cell: (r) => formatBdt(r.collectedBdt) },
        ];
        return (
          <div className={`space-y-8 ${stale ? "opacity-60" : ""}`} aria-busy={stale || undefined}>
            <Section title="Summary">
              <StatGrid>
                <StatCard label="Collected" value={formatBdt(s.totals.collectedBdt)} hint="Payments confirmed by the provider" />
                <StatCard label="Refunded" value={formatBdt(s.totals.refundedBdt)} hint="Refunds confirmed by the provider" />
                <StatCard label="Net" value={formatBdt(s.totals.netBdt)} hint="Collected minus refunded" />
                <StatCard label="Successful payments" value={s.totals.successfulPayments} />
                <StatCard label="Refunds waiting" value={s.pendingRefunds.count} hint={`${formatBdt(s.pendingRefunds.requestedBdt)} requested, not yet refunded (all time)`} />
              </StatGrid>
            </Section>
            <Section title="Collected per day" description="One bar per Bangladesh calendar day. Hover or focus a bar for its exact figures.">
              <DailyChart daily={s.daily} />
            </Section>
            <div className="grid gap-8 lg:grid-cols-2">
              <Section title="By payment provider">
                {s.byProvider.length === 0 ? <p className="text-sm text-ink-muted">No successful payments in this period.</p> : <DataTable caption="Collected by provider" columns={providerCols} rows={s.byProvider} rowKey={(r) => r.provider} />}
              </Section>
              <Section title="By service category" description="Top 20 categories.">
                {s.byCategory.length === 0 ? <p className="text-sm text-ink-muted">No successful payments in this period.</p> : <DataTable caption="Collected by service category" columns={categoryCols} rows={s.byCategory} rowKey={(r) => r.category} />}
              </Section>
            </div>
            <Section title="Payment attempts by status" description="Every attempt created in this period, whatever its outcome.">
              {Object.keys(s.byStatus).length === 0 ? (
                <p className="text-sm text-ink-muted">No payment attempts in this period.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {Object.entries(s.byStatus).map(([status, count]) => <li key={status}><Badge>{humanize(status)}: {count}</Badge></li>)}
                </ul>
              )}
            </Section>
          </div>
        );
      }}
    </ApiView>
  );
}

function CommissionReport({ range }: { range: { from: string; to: string } }) {
  const [rateText, setRateText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const debounced = useDebounced(rateText.trim(), 400);
  const rateProblem = rateText.trim() && !/^\d+$/.test(rateText.trim()) ? "Enter a whole number of basis points." : rateText.trim() && Number(rateText.trim()) > 5000 ? "The rate can be at most 5000 basis points (50%)." : undefined;
  const override = !rateProblem && debounced !== "" && /^\d+$/.test(debounced) && Number(debounced) <= 5000 ? Number(debounced) : undefined;
  const query = buildQuery({ ...range, rateBps: override });
  const liveText = rateText.trim();
  const exportQuery = buildQuery({ ...range, rateBps: !rateProblem && /^\d+$/.test(liveText) ? Number(liveText) : undefined });
  const { state, reload, stale } = useApi<Commission>(`/admin/finance/commission${query}`);

  async function exportCsv() {
    setExporting(true);
    setExportError(undefined);
    try {
      await downloadFile(`/admin/finance/commission/export${exportQuery}`, "commission-report.csv");
    } catch (e) {
      setExportError(errorText(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="commission-heading">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="commission-heading" className="text-lg font-bold text-brand-950">Commission report</h2>
        <Badge tone="warning">Reporting only: nothing is charged</Badge>
      </div>
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-40" />}>
        {(c) => (
          <div className={`space-y-4 ${stale ? "opacity-60" : ""}`} aria-busy={stale || undefined}>
            <Alert tone="warning" title="These figures are not money the platform has taken">
              <p>{c.note}</p>
              <p className="mt-1">Nothing here is deducted from workers or added to customers&apos; payments. It is a calculation for planning and reporting.</p>
            </Alert>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Card className="space-y-3 p-4">
                <p className="text-xs font-semibold text-ink-subtle">Configured commission rate</p>
                <p className="text-2xl font-extrabold text-brand-950 tabular-nums">{percent(c.configuredRateBps)} <span className="text-sm font-medium text-ink-muted">({c.configuredRateBps} bps)</span></p>
                <TextInput id="commission-rate" label="What-if rate (basis points, 0 to 5000)" inputMode="numeric" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder={String(c.configuredRateBps)} hint="100 basis points = 1%. Leave empty to use the configured rate." error={rateProblem} />
                {c.rateSource === "override" && (
                  <p className="flex items-start gap-2 text-sm text-warning"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /> Showing a what-if rate of {percent(c.rateBps)}, not the configured one.</p>
                )}
              </Card>
              <StatGrid>
                <StatCard label="Collected" value={formatBdt(c.totals.collectedBdt)} />
                <StatCard label="Refunded" value={formatBdt(c.totals.refundedBdt)} />
                <StatCard label="Net" value={formatBdt(c.totals.netBdt)} />
                <StatCard label={`Commission at ${percent(c.rateBps)} (not charged)`} value={formatBdt(c.totals.commissionBdt)} hint={c.rateSource === "override" ? "What-if rate" : "Configured rate"} />
              </StatGrid>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={Boolean(rateProblem)}><Download className="size-4" aria-hidden /> Export CSV</Button>
              <span className="text-sm text-ink-muted">Exports the daily figures for this period and rate. Each export is recorded in the audit log.</span>
            </div>
            {exportError && <Alert tone="error">{exportError}</Alert>}
          </div>
        )}
      </ApiView>
    </section>
  );
}
