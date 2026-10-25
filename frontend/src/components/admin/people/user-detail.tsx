"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { AdminPage, ApiView, StatCard, StatGrid } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { readableError } from "./admin-errors";
import type { RoleRow, UserDetail } from "./types";
import { UserBadges } from "./users-list";

/** One account: facts, counts, recent admin actions and (permission permitting) suspension and admin access. */
export function UserDetailView({ id }: { id: string }) {
  const { state, reload, refresh } = useApi<{ user: UserDetail }>(`/admin/users/${encodeURIComponent(id)}`);
  const [notice, setNotice] = useState<string>();

  return (
    <AdminPage title="User" permission="users.read" description={<Link href="/admin/users" className="inline-flex items-center gap-1.5 font-semibold text-brand-800 hover:underline"><ArrowLeft className="size-4" aria-hidden />All users</Link>}>
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-72" />}>
        {({ user }) => (
          <Detail
            user={user}
            onChanged={(message) => {
              setNotice(message);
              refresh();
            }}
          />
        )}
      </ApiView>
    </AdminPage>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function Detail({ user, onChanged }: { user: UserDetail; onChanged: (message: string) => void }) {
  const { can, me } = useAdmin();
  const isSelf = me.user.id === user.id;
  const c = user.counts;
  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-extrabold text-brand-950">{user.name || "(no name)"}</h2>
          {user.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
        </div>
        <div className="mt-2"><UserBadges user={user} /></div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Email">{user.email} <span className="text-xs text-ink-subtle">({user.emailVerified ? "verified" : "not verified"})</span></Fact>
          <Fact label="User id"><span className="font-mono text-xs">{user.id}</span></Fact>
          <Fact label="Account role">{user.role === "ADMIN" ? `Administrator${user.adminRole ? `: ${user.adminRole.name}` : ""}` : "Regular user"}</Fact>
          <Fact label="Joined">{formatDateTime(user.createdAt)}</Fact>
          <Fact label="Last updated">{formatDateTime(user.updatedAt)}</Fact>
          <Fact label="Signed in on">{user.activeSessions} {user.activeSessions === 1 ? "device" : "devices"}</Fact>
          {user.customerProfile && <Fact label="Customer profile">{user.customerProfile.displayName ?? "No display name"}{user.customerProfile.preferredDivision ? `, ${user.customerProfile.preferredDivision}` : ""}</Fact>}
          {user.worker && <Fact label="Worker profile">{user.worker.published ? "Published" : "Not published"}</Fact>}
        </dl>
      </Card>

      <section aria-labelledby="counts-h" className="space-y-3">
        <h2 id="counts-h" className="text-lg font-bold text-brand-950">Activity</h2>
        <StatGrid>
          <StatCard label="Bookings as customer" value={c.bookingsAsCustomer} />
          <StatCard label="Bookings as worker" value={c.bookingsAsWorker} />
          <StatCard label="Support tickets" value={c.supportTickets} />
          <StatCard label="Reports filed" value={c.reportsFiled} />
          <StatCard label="Community posts" value={c.posts} />
          <StatCard label="Reviews written" value={c.reviews} />
        </StatGrid>
      </section>

      <section aria-labelledby="suspension-h" className="space-y-3">
        <h2 id="suspension-h" className="text-lg font-bold text-brand-950">Suspension</h2>
        {user.suspended ? (
          <Alert tone="warning" title="This account is suspended">
            {user.suspensionReason ? <>Reason: {user.suspensionReason}</> : "No reason was recorded."} The user cannot sign in.
          </Alert>
        ) : (
          <p className="text-ink-muted">This account is active.</p>
        )}
        {isSelf ? (
          <p className="text-sm text-ink-muted">This is your own account: you cannot suspend it or change your own admin access.</p>
        ) : (
          can("users.suspend") && <SuspensionControl user={user} onChanged={onChanged} />
        )}
      </section>

      {!isSelf && can("admins.assign") && <AdminAccessCard user={user} onChanged={onChanged} />}

      <section aria-labelledby="actions-h" className="space-y-3">
        <h2 id="actions-h" className="text-lg font-bold text-brand-950">Recent admin actions on this account</h2>
        {user.recentActions.length === 0 ? (
          <p className="text-ink-muted">No administrator has acted on this account yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-canvas">
            {user.recentActions.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <p><span className="font-mono font-semibold">{a.action}</span> by {a.by} <span className="text-ink-subtle">· {formatDateTime(a.createdAt)}</span></p>
                {a.reason && <p className="mt-1 text-ink-muted">Reason: {a.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SuspensionControl({ user, onChanged }: { user: UserDetail; onChanged: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const suspending = !user.suspended;
  return (
    <>
      <Button variant={suspending ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {suspending ? "Suspend account" : "Restore account"}
      </Button>
      {open && (
        <ConfirmDialog
          open
          title={suspending ? `Suspend ${user.name || "this account"}?` : `Restore ${user.name || "this account"}?`}
          confirmLabel={suspending ? "Suspend account" : "Restore account"}
          tone={suspending ? "danger" : "primary"}
          reason="required"
          minReasonLength={3}
          onClose={() => setOpen(false)}
          onConfirm={async (reason) => {
            try {
              await api(`/admin/users/${encodeURIComponent(user.id)}/suspension`, { method: "POST", body: { suspended: suspending, reason, confirm: true } });
            } catch (e) {
              throw readableError(e);
            }
            onChanged(suspending ? "Account suspended. The user was signed out everywhere." : "Account restored. The user can sign in again.");
          }}
        >
          {suspending ? (
            <p>Suspending signs this user out on every device immediately and stops them signing in until you restore the account. Their data is kept. The reason is saved in the audit log.</p>
          ) : (
            <p>The user will be able to sign in again. Sessions that were ended by the suspension are not brought back. The reason is saved in the audit log.</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

function AdminAccessCard({ user, onChanged }: { user: UserDetail; onChanged: (message: string) => void }) {
  const { can } = useAdmin();
  const isAdmin = user.role === "ADMIN";
  const [roleId, setRoleId] = useState("");
  const [dialog, setDialog] = useState<"assign" | "remove" | null>(null);
  const headingId = useId();
  const [roleName, setRoleName] = useState("");

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-lg font-bold text-brand-950">Admin access</h2>
      <Card className="space-y-4 p-5">
        <p className="text-ink-muted">
          {isAdmin ? <>This user is an administrator{user.adminRole ? <> with the <strong>{user.adminRole.name}</strong> role</> : ""}.</> : "This user is not an administrator."} You can only grant roles whose permissions you hold yourself, and the user must have a verified email and an active account.
        </p>
        {can("roles.read") ? (
          <RoleChooser
            currentRoleId={user.adminRole?.id}
            value={roleId}
            onChange={(id, name) => { setRoleId(id); setRoleName(name); }}
            onAssign={() => setDialog("assign")}
            isAdmin={isAdmin}
          />
        ) : (
          <Alert tone="info">Choosing a role needs the “View admin roles” permission, which your role does not include.{isAdmin ? " You can still remove admin access." : ""}</Alert>
        )}
        {isAdmin && (
          <div>
            <Button variant="secondary" className="border-danger/40 text-danger" onClick={() => setDialog("remove")}>Remove admin access</Button>
          </div>
        )}
      </Card>

      {dialog === "assign" && (
        <ConfirmDialog
          open
          title={isAdmin ? "Change admin role?" : "Give admin access?"}
          confirmLabel={isAdmin ? "Change role" : "Give admin access"}
          reason="required"
          minReasonLength={3}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            try {
              await api(`/admin/users/${encodeURIComponent(user.id)}/admin-access`, { method: "POST", body: { roleId, reason, confirm: true } });
            } catch (e) {
              throw readableError(e);
            }
            setRoleId("");
            onChanged(`${user.name || "The user"} now has the ${roleName} role.`);
          }}
        >
          <p>{user.name || "This user"} will get the <strong>{roleName}</strong> role and every permission it includes. Administrators can see private data and act on other people’s accounts. The reason is saved in the audit log.</p>
        </ConfirmDialog>
      )}
      {dialog === "remove" && (
        <ConfirmDialog
          open
          title="Remove admin access?"
          confirmLabel="Remove admin access"
          tone="danger"
          reason="required"
          minReasonLength={3}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            try {
              await api(`/admin/users/${encodeURIComponent(user.id)}/admin-access`, { method: "POST", body: { roleId: null, reason, confirm: true } });
            } catch (e) {
              throw readableError(e);
            }
            onChanged("Admin access removed. The user is a regular user again.");
          }}
        >
          <p>{user.name || "This user"} will lose all admin permissions straight away but keeps their normal account. The last active super administrator cannot be removed. The reason is saved in the audit log.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function RoleChooser({ currentRoleId, value, onChange, onAssign, isAdmin }: { currentRoleId?: string; value: string; onChange: (id: string, name: string) => void; onAssign: () => void; isAdmin: boolean }) {
  const { permissions } = useAdmin();
  const { state, reload } = useApi<{ roles: RoleRow[] }>("/admin/roles");
  const selectId = useId();
  return (
    <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-16" />}>
      {({ roles }) => {
        // The server refuses roles beyond the caller's own permissions, so only offer the ones that can work.
        const assignable = roles.filter((r) => r.effectivePermissions.every((p) => permissions.includes(p)));
        const hidden = roles.length - assignable.length;
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <SelectInput
                  id={selectId}
                  label={isAdmin ? "New role" : "Role to give"}
                  placeholder="Choose a role"
                  value={value}
                  onChange={(e) => onChange(e.target.value, assignable.find((r) => r.id === e.target.value)?.name ?? "")}
                  options={assignable.map((r) => ({ value: r.id, label: r.id === currentRoleId ? `${r.name} (current)` : r.name }))}
                />
              </div>
              <Button onClick={onAssign} disabled={!value || value === currentRoleId}>{isAdmin ? "Change role" : "Give admin access"}</Button>
            </div>
            {hidden > 0 && <p className="text-sm text-ink-subtle">{hidden} {hidden === 1 ? "role is" : "roles are"} not listed because {hidden === 1 ? "it includes" : "they include"} permissions you do not hold.</p>}
          </div>
        );
      }}
    </ApiView>
  );
}
