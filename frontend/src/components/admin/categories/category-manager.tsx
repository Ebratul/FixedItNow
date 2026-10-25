"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminPage, ApiView, TypedConfirmDialog } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { CategoryForm } from "./category-form";
import type { AdminCategory, AdminCategoryTree } from "./category-types";

type FormState = { editing: AdminCategory | null; defaultParentId?: string | null } | null;

export function CategoryManager() {
  const { can } = useAdmin();
  const manage = can("catalog.manage");
  const { state, reload, refresh } = useApi<AdminCategoryTree>("/admin/categories");
  const [form, setForm] = useState<FormState>(null);
  const [toDelete, setToDelete] = useState<AdminCategory | null>(null);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function move(parentId: string | null, siblings: AdminCategory[], index: number, delta: -1 | 1) {
    const target = index + delta;
    if (busy || target < 0 || target >= siblings.length) return;
    const ids = siblings.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await api("/admin/categories/order", { method: "PUT", body: { parentId, ids } });
      setNotice(`Moved “${siblings[index]!.name}” ${delta < 0 ? "up" : "down"}.`);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The order could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage
      title="Service categories"
      description="The catalogue workers and customers choose from. Categories have one level of subcategories."
      permission="catalog.read"
      actions={manage && <Button onClick={() => setForm({ editing: null })}><Plus className="size-4" aria-hidden /> New category</Button>}
    >
      <Alert tone="info" title="About deactivating">
        Deactivating a category hides it from the public site and from new bookings. Existing bookings and worker services keep working, and you can activate it again later. Delete is only for categories nothing uses.
      </Alert>
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>
      {error && <Alert tone="error">{error}</Alert>}

      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {({ categories }) =>
          categories.length === 0 ? (
            <EmptyState icon={Tags} title="No categories yet" headingLevel={2}>
              {manage ? "Create the first category so workers can offer services." : "There are no service categories yet."}
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {categories.map((cat, i) => (
                <li key={cat.id} className="rounded-card border border-line bg-canvas shadow-card">
                  <Row
                    category={cat}
                    level={1}
                    index={i}
                    count={categories.length}
                    manage={manage}
                    busy={busy}
                    onMove={(d) => move(null, categories, i, d)}
                    onEdit={() => setForm({ editing: cat })}
                    onDelete={() => setToDelete(cat)}
                    onAddChild={() => setForm({ editing: null, defaultParentId: cat.id })}
                  />
                  {cat.children.length > 0 && (
                    <ul className="border-t border-line bg-surface/50" aria-label={`Subcategories of ${cat.name}`}>
                      {cat.children.map((child, j) => (
                        <li key={child.id} className="border-b border-line pl-4 last:border-b-0 sm:pl-8">
                          <Row
                            category={child}
                            level={2}
                            index={j}
                            count={cat.children.length}
                            manage={manage}
                            busy={busy}
                            onMove={(d) => move(cat.id, cat.children, j, d)}
                            onEdit={() => setForm({ editing: child })}
                            onDelete={() => setToDelete(child)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </ApiView>

      {form && state.status === "ready" && (
        <CategoryForm
          editing={form.editing}
          defaultParentId={form.defaultParentId}
          parents={state.data.categories}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setNotice(message);
            setError(undefined);
            refresh();
          }}
        />
      )}
      {toDelete && (
        <TypedConfirmDialog
          open
          title={`Delete ${toDelete.name}?`}
          phrase={toDelete.slug}
          confirmLabel="Delete category"
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await api(`/admin/categories/${toDelete.id}`, { method: "DELETE", body: { confirmSlug: toDelete.slug } });
            setNotice(`Deleted “${toDelete.name}”.`);
            setError(undefined);
            refresh();
          }}
        >
          Deleting cannot be undone. The server refuses to delete a category that has worker services, bookings or subcategories; deactivate it instead.
        </TypedConfirmDialog>
      )}
    </AdminPage>
  );
}

function Row({
  category: c,
  level,
  index,
  count,
  manage,
  busy,
  onMove,
  onEdit,
  onDelete,
  onAddChild,
}: {
  category: AdminCategory;
  level: 1 | 2;
  index: number;
  count: number;
  manage: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
}) {
  const Heading = level === 1 ? "h2" : "h3";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Heading className={level === 1 ? "text-lg font-bold" : "font-semibold"}>{c.name}</Heading>
          <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive: hidden from the public site"}</Badge>
          <span className="text-xs text-ink-subtle">/{c.slug}</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{c.description}</p>
        <p className="mt-1 text-xs text-ink-subtle">
          {c.workers} {c.workers === 1 ? "worker" : "workers"} · {c.bookings} {c.bookings === 1 ? "booking" : "bookings"}
          {level === 1 && ` · ${c.subcategories} ${c.subcategories === 1 ? "subcategory" : "subcategories"}`}
        </p>
      </div>
      {manage && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Manage ${c.name}`}>
          <Button variant="ghost" disabled={busy || index === 0} onClick={() => onMove(-1)} aria-label={`Move up: ${c.name}`}>
            <ArrowUp className="size-4" aria-hidden /> Move up
          </Button>
          <Button variant="ghost" disabled={busy || index === count - 1} onClick={() => onMove(1)} aria-label={`Move down: ${c.name}`}>
            <ArrowDown className="size-4" aria-hidden /> Move down
          </Button>
          {onAddChild && (
            <Button variant="secondary" onClick={onAddChild} aria-label={`Add subcategory to ${c.name}`}>
              <Plus className="size-4" aria-hidden /> Subcategory
            </Button>
          )}
          <Button variant="secondary" onClick={onEdit} aria-label={`Edit ${c.name}`}>
            <Pencil className="size-4" aria-hidden /> Edit
          </Button>
          <Button variant="ghost" onClick={onDelete} aria-label={`Delete ${c.name}`} className="text-danger">
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        </div>
      )}
    </div>
  );
}
