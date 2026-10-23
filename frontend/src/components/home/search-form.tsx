"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { DIVISIONS, isDivision } from "@/lib/locations";

/**
 * Hero search. It navigates to /workers with `q` and `location` query params.
 * That page is the integration boundary for the future search API; today it
 * explains that professional listings are not live yet.
 */
export function SearchForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const q = String(data.get("q") ?? "").trim();
    const location = String(data.get("location") ?? "");

    if (!q && !location) {
      setError("Enter a service or choose a location to search.");
      return;
    }
    setError(undefined);

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (isDivision(location)) params.set("location", location);
    router.push(`/workers?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      role="search"
      aria-label="Find a service professional"
      className="rounded-panel border border-line bg-canvas p-3 shadow-pop sm:p-4"
    >
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
        <SearchInput
          id="hero-service"
          name="q"
          label="What service do you need?"
          placeholder="e.g. AC servicing, electrician"
          autoComplete="off"
          maxLength={80}
          onChange={() => error && setError(undefined)}
        />
        <SelectInput
          id="hero-location"
          name="location"
          label="Location"
          placeholder="All of Bangladesh"
          options={DIVISIONS}
          onChange={() => error && setError(undefined)}
        />
        <Button type="submit" size="lg" variant="accent" className="w-full md:w-auto">
          <Search className="size-5" aria-hidden />
          Search
        </Button>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {error && <div className="mt-3"><FieldError>{error}</FieldError></div>}
      </div>
    </form>
  );
}
