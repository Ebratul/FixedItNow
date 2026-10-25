"use client";

import { KeyRound, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminPage, ApiView, DataTable, TypedConfirmDialog, type Column } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { readableError } from "./admin-errors";
import { RoleEditor } from "./role-editor";
import type { RoleHolder, RoleRow } from "./types";

type Editing = RoleRow | "new" | null;

/** Admin roles: list, holders of the selected role, create/edit with a permission matrix, delete. */
export function RolesView() {
  const { can } = useAdmin();
  const { state, reload, refresh } = useApi<{ roles: RoleRow[] }>("/admin/roles");
  const [selectedId, setSelectedId] = useState<string>();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [blocked, setBlocked] = useState<RoleRow | null>(null);
  const [notice, setNotice] = useState<string>();
  const manage = can("roles.manage");

  const columns: Column<RoleRow>[] = [
    {
      key: "role",
      header: "Role",
      cell: (r) => (
        <div>
          <div>{r.name}</div>
          <div className="font-mono text-xs font-normal text-ink-subtle">{r.key}</div>
        </div>
      ),
    },
    { key: "description", header: "Description", hideBelow: "md", cell: (r) => <span className="text-ink-muted">{r.description}</span> },
    { key: "type", header: "Type", cell: (r) => (r.isSystem ? <Badge tone="brand">System (read-only)</Badge> : <Badge>Custom</Badge>) },
    { key: "holders", header: "Holders", align: "right", cell: (r) => r.holders },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" aria-label={`View holders of ${r.name}`} onClick={() => { setSelectedId(r.id); setBlocked(null); }}>Holders</Button>
          {manage && !r.isSystem && (
            <>
              <Button size="sm" variant="secondary" aria-label={`Edit ${r.name}`} onClick={() => { setEditing(r); setSelectedId(r.id); setBlocked(null); setNotice(undefined); }}>Edit</Button>
              <Button size="sm" variant="secondary" className="border-danger/40 text-danger" aria-label={`Delete ${r.name}`} onClick={() => (r.holders > 0 ? setBlocked(r) : setDeleting(r))}>Delete</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminPage
      title="Admin roles"
      description="A role is a named set of permissions. Give a user a role from their user page. Nobody can hand out, or edit a role with, permissions they do not hold themselves."
      permission="roles.read"
      actions={manage ? <Button onClick={() => { setEditing("new"); setNotice(undefined); setBlocked(null); }}><Plus className="size-4" aria-hidden />New role</Button> : undefined}
    >
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>
      {blocked && (
        <Alert tone="warning" title={`“${blocked.name}” cannot be deleted yet`}>
          {blocked.holders} {blocked.holders === 1 ? "administrator still holds" : "administrators still hold"} this role. Move {blocked.holders === 1 ? "them" : "each of them"} to another role (or remove their admin access) from their{" "}
          <Link href="/admin/users?role=ADMIN" className="font-semibold text-brand-800 underline">user page</Link>, then delete the role.
        </Alert>
      )}

      {editing && (
        <RoleEditor
          role={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved, created) => {
            setEditing(null);
            setSelectedId(saved.id);
            setNotice(created ? `Role “${saved.name}” created.` : `Role “${saved.name}” updated.`);
            refresh();
          }}
        />
      )}

      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-56" />}>
        {({ roles }) =>
          roles.length === 0 ? (
            <EmptyState icon={KeyRound} title="No roles yet" headingLevel={2}>{manage ? "Create the first role with the New role button." : "No admin roles have been defined."}</EmptyState>
          ) : (
            <DataTable caption="Admin roles" columns={columns} rows={roles} rowKey={(r) => r.id} />
          )
        }
      </ApiView>

      {selectedId && <RoleDetail key={`${selectedId}:${state.status === "ready" ? state.data.roles.find((r) => r.id === selectedId)?.updatedAt : ""}`} id={selectedId} />}

      {deleting && (
        <TypedConfirmDialog
          open
          title={`Delete role “${deleting.name}”?`}
          phrase={deleting.key}
          confirmLabel="Delete role"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await api(`/admin/roles/${deleting.id}`, { method: "DELETE", body: { confirmKey: deleting.key } });
            } catch (e) {
              throw readableError(e);
            }
            if (selectedId === deleting.id) setSelectedId(undefined);
            setNotice(`Role “${deleting.name}” deleted.`);
            refresh();
          }}
        >
          <p>This permanently deletes the role. Nobody holds it, so no one loses access. This cannot be undone.</p>
        </TypedConfirmDialog>
      )}
    </AdminPage>
  );
}

function RoleDetail({ id }: { id: string }) {
  const { state, reload } = useApi<{ role: RoleRow & { users: RoleHolder[] } }>(`/admin/roles/${id}`);
  return (
    <section aria-labelledby="role-detail-h" className="space-y-3">
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-32" />}>
        {({ role }) => (
          <>
            <h2 id="role-detail-h" className="text-lg font-bold text-brand-950">{role.name}: holders and permissions</h2>
            <Card className="space-y-5 p-5">
              <div>
                <h3 className="text-sm font-bold text-ink">Holders ({role.holders})</h3>
                {role.users.length === 0 ? (
                  <p className="mt-1 text-ink-muted">Nobody holds this role.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line">
                    {role.users.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                        <Link href={`/admin/users/${u.id}`} className="font-semibold text-brand-800 hover:underline">{u.name || "(no name)"}</Link>
                        <span className="break-all text-ink-muted">{u.email}</span>
                        {u.suspended && <Badge tone="danger">Suspended</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
                {role.holders > role.users.length && <p className="mt-2 text-sm text-ink-subtle">Showing the first {role.users.length} of {role.holders} holders.</p>}
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Permissions ({role.effectivePermissions.length})</h3>
                {role.permissions.includes("*") && <p className="mt-1 text-sm text-ink-muted">This role holds the wildcard: every permission, including ones added in future releases.</p>}
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {role.effectivePermissions.map((p) => (
                    <li key={p}><Badge className="font-mono">{p}</Badge></li>
                  ))}
                </ul>
              </div>
            </Card>
          </>
        )}
      </ApiView>
    </section>
  );
}
