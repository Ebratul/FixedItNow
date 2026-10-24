"use client";

import { useSyncExternalStore } from "react";
import { api, ApiError } from "./api";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "error" }
  | { status: "ready"; ids: ReadonlySet<string> };

/**
 * Per-tab cache of the signed-in user's favourite worker ids. It is keyed to
 * the session user and cleared whenever that changes, so one user's favourites
 * can never be shown to the next user on a shared browser tab.
 */
let state: State = { status: "idle" };
let currentUser: string | null | undefined;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export function syncFavoritesUser(userId: string | null) {
  if (currentUser === userId) return;
  currentUser = userId;
  if (userId === null) {
    set({ status: "anonymous" });
    return;
  }
  set({ status: "loading" });
  api<{ ids: string[] }>("/me/favorites/ids")
    .then(({ ids }) => currentUser === userId && set({ status: "ready", ids: new Set(ids) }))
    .catch((error: unknown) => {
      if (currentUser !== userId) return;
      set(error instanceof ApiError && error.status === 401 ? { status: "anonymous" } : { status: "error" });
    });
}

/** Optimistic toggle with rollback; throws if the server rejects it. */
export async function setFavorite(workerId: string, favorited: boolean) {
  if (state.status !== "ready") throw new Error("Favourites are not loaded");
  const before = state.ids;
  const next = new Set(before);
  if (favorited) next.add(workerId);
  else next.delete(workerId);
  set({ status: "ready", ids: next });
  try {
    await api(`/me/favorites/${workerId}`, { method: favorited ? "PUT" : "DELETE", body: {} });
  } catch (error) {
    if (currentUser !== undefined && state.status === "ready") set({ status: "ready", ids: before });
    throw error;
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => state;
const getServerSnapshot = (): State => ({ status: "idle" });

export function useFavoritesState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test hook. */
export function resetFavoritesStore() {
  currentUser = undefined;
  state = { status: "idle" };
  listeners.forEach((l) => l());
}
