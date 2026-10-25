"use client";

import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import { SLUG_PATTERN, type AdminCategory, type AdminCategoryNode } from "./category-types";

/**
 * Create or edit one category. `editing` null = create. For a new subcategory pass `defaultParentId`.
 * Only fields that changed are sent when editing, and the dialog stays open with the server's message on failure.
 */
export function CategoryForm({
  editing,
  defaultParentId,
  parents,
  onClose,
  onSaved,
}: {
  editing: AdminCategory | null;
  defaultParentId?: string | null;
  parents: AdminCategoryNode[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const uid = useId();
  const [name, setName] = useState(editing?.name ?? "");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [parentId, setParentId] = useState(editing ? (editing.parentId ?? "") : (defaultParentId ?? ""));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  // A category that has subcategories must stay at the top level (the tree is two levels deep).
  const lockedToTop = Boolean(editing && editing.subcategories > 0);
  const parentOptions = parents
    .filter((p) => p.id !== editing?.id)
    .map((p) => ({ value: p.id, label: p.isActive ? p.name : `${p.name} (inactive)` }));

  function validate() {
    const found: Record<string, string> = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 60) found.name = "Use 2 to 60 characters";
    if (description.trim().length < 1 || description.trim().length > 300) found.description = "Add a short description (up to 300 characters)";
    if (!editing && slug.trim() && (!SLUG_PATTERN.test(slug.trim()) || slug.trim().length > 50)) found.slug = "Use lowercase letters, digits and single hyphens (up to 50 characters)";
    return found;
  }

  const normalizedParent = parentId === "" ? null : parentId;
  const changed = editing
    ? name.trim() !== editing.name || description.trim() !== editing.description || isActive !== editing.isActive || normalizedParent !== editing.parentId
    : true;

  async function save() {
    if (pending) return;
    const found = validate();
    setErrors(found);
    setFormError(undefined);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = {};
        if (name.trim() !== editing.name) body.name = name.trim();
        if (description.trim() !== editing.description) body.description = description.trim();
        if (isActive !== editing.isActive) body.isActive = isActive;
        if (normalizedParent !== editing.parentId) body.parentId = normalizedParent;
        await api(`/admin/categories/${editing.id}`, { method: "PATCH", body });
        onSaved(`Saved “${name.trim()}”.`);
      } else {
        await api("/admin/categories", {
          method: "POST",
          body: { name: name.trim(), ...(slug.trim() ? { slug: slug.trim() } : {}), description: description.trim(), parentId: normalizedParent, isActive },
        });
        onSaved(`Created “${name.trim()}”.`);
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        setFormError(e.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  const title = editing ? `Edit ${editing.name}` : normalizedParent ? "New subcategory" : "New category";
  return (
    <Dialog open onClose={() => !pending && onClose()} title={title} variant="modal" dismissible={!pending}>
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <TextInput id={`${uid}-name`} label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} disabled={pending} autoFocus />
        {!editing && (
          <TextInput
            id={`${uid}-slug`}
            label="Slug (optional)"
            hint="Used in web addresses. Leave empty to derive it from the name. It cannot be changed later."
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            error={errors.slug}
            maxLength={50}
            autoCapitalize="none"
            disabled={pending}
          />
        )}
        <TextArea id={`${uid}-desc`} label="Description" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} maxLength={300} disabled={pending} />
        <SelectInput
          id={`${uid}-parent`}
          label="Parent category"
          hint={lockedToTop ? "This category has subcategories, so it has to stay at the top level." : editing ? "Choose “Top level” to promote a subcategory." : undefined}
          placeholder="Top level (no parent)"
          options={parentOptions}
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          error={errors.parentId}
          disabled={pending || lockedToTop}
        />
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-5" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={pending} />
          <span>
            <span className="font-semibold">Active</span>
            <span className="block text-ink-muted">Inactive categories are hidden from the public site and cannot be chosen for new bookings.</span>
          </span>
        </label>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" loading={pending} disabled={!changed}>{editing ? "Save changes" : "Create"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
