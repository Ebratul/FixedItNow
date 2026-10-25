"use client";

import { useEffect, useState } from "react";

/** A value that follows `value` after `delay` ms of quiet: for search boxes that call the API. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
