"use client";

import { useId, useState, type FormEvent } from "react";
import { ApiView } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { adminErrorMessage } from "./admin-errors";
import type { PermissionGroup, RoleRow } from "./types";

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,40}$/;

type Errors = { key?: string; name?: string; description?: string; permissions?: string };

/** Pure validation, shared by the form and its tests. Mirrors the server's rules; the server still decides. */
export function validateRole(input: { key: string; name: string; description: string; permissions: readonly string[] }, creating: boolean): Errors {
  const errors: Errors = {};
  if (creating && !KEY_PATTERN.test(input.key.trim())) errors.key = "Use lowercase letters, digits and underscores, starting with a letter (2 to 41 characters).";
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) errors.name = "Enter a name of 2 to 60 characters.";
  const description = input.description.trim();
  if (description.length < 1 || description.length > 300) errors.description = "Enter a description of up to 300 characters.";
  if (input.permissions.length === 0) errors.permissions = "Choose at least one permission.";
  return errors;
}

/** Create (no `role`) or edit a custom role, with a permission matrix grouped by the server's catalogue. */
export function RoleEditor({ role, onSaved, onCancel }: { role?: RoleRow; onSaved: (role: RoleRow, created: boolean) => void; onCancel: () => void }) {
  const creating = !role;
  const { permissions: held } = useAdmin();
  const { state, reload } = useApi<{ groups: PermissionGroup[] }>("/admin/roles/permissions");
  const [key, setKey] = useState("");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const id = useId();
  // Editing a role that has permissions we lack is refused by the server (ROLE_TOO_POWERFUL).
  const beyondMe = role ? role.effectivePermissions.filter((p) => !held.includes(p)) : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = validateRole({ key, name, description, permissions: selected }, creating);
    setErrors(found);
    setFailure(undefined);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      const body = { name: name.trim(), description: description.trim(), permissions: selected };
      const result = creating
        ? await api<{ role: RoleRow }>("/admin/roles", { method: "POST", body: { key: key.trim(), ...body } })
        : await api<{ role: RoleRow }>(`/admin/roles/${role.id}`, { method: "PATCH", body });
      onSaved(result.role, creating);
    } catch (e) {
      setFailure(adminErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  const toggle = (permission: string) => setSelected((cur) => (cur.includes(permission) ? cur.filter((p) => p !== permission) : [...cur, permission]));

  return (
    <section aria-labelledby={`${id}-h`}>
      <Card className="p-5">
        <h2 id={`${id}-h`} className="text-lg font-bold text-brand-950">{creating ? "New role" : `Edit role “${role.name}”`}</h2>
        <form onSubmit={submit} noValidate className="mt-4 space-y-5">
          {beyondMe.length > 0 && (
            <Alert tone="warning" title="You cannot change this role">
              It includes permissions you do not hold ({beyondMe.join(", ")}), and the server does not let anyone edit a role that is more powerful than their own.
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {creating && <TextInput id={`${id}-key`} label="Key" hint="Permanent. Lowercase letters, digits and underscores, e.g. billing_clerk." value={key} onChange={(e) => setKey(e.target.value)} error={errors.key} maxLength={41} autoComplete="off" />}
            <TextInput id={`${id}-name`} label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} />
          </div>
          <TextArea id={`${id}-desc`} label="Description" hint="What this role is for. Shown to other administrators." value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} maxLength={300} className="min-h-20" />

          <div>
            <h3 className="text-sm font-bold text-ink">Permissions</h3>
            <p className="mt-1 text-sm text-ink-muted">
              You can only include permissions you hold yourself; the others are greyed out. Permissions marked “Sensitive” expose private data or move money.
            </p>
            {errors.permissions && <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors.permissions}</p>}
            <div className="mt-3 space-y-5">
              <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-40" />}>
                {({ groups }) =>
                  groups.map((group) => (
                    <fieldset key={group.id} className="min-w-0">
                      <legend className="text-sm font-semibold text-brand-900">{group.label}</legend>
                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                        {group.permissions.map((p) => {
                          const heldByMe = held.includes(p.key);
                          const checked = selected.includes(p.key);
                          const disabled = !heldByMe || pending || beyondMe.length > 0;
                          return (
                            <label key={p.key} className={`flex items-start gap-3 rounded-control border px-3 py-2.5 text-sm ${disabled ? "cursor-not-allowed border-line bg-surface opacity-70" : checked ? "cursor-pointer border-brand-600 bg-brand-50" : "cursor-pointer border-line-strong bg-canvas hover:border-brand-300"}`}>
                              <input type="checkbox" className="mt-1 size-4 shrink-0 accent-brand-700" checked={checked} disabled={disabled} onChange={() => toggle(p.key)} />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2 font-semibold">
                                  {p.label}
                                  {p.sensitive && <Badge tone="warning">Sensitive</Badge>}
                                </span>
                                <span className="mt-0.5 block text-ink-muted">{p.description}</span>
                                <span className="mt-0.5 block font-mono text-xs text-ink-subtle">{p.key}</span>
                                {!heldByMe && <span className="mt-1 block text-xs text-ink-subtle">Not available: your own role does not include this permission.</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))
                }
              </ApiView>
            </div>
          </div>

          <div aria-live="assertive">{failure && <Alert tone="error">{failure}</Alert>}</div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
            <Button type="submit" loading={pending} disabled={beyondMe.length > 0}>{creating ? "Create role" : "Save changes"}</Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
