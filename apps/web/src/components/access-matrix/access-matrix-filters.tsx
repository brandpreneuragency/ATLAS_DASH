"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  initial: {
    search: string;
    accessProvider: string;
    availability: string;
  };
}

const availabilityOptions = [
  { value: "", label: "Any" },
  { value: "confirmed", label: "Confirmed" },
  { value: "unconfirmed", label: "Unconfirmed" },
  { value: "unavailable", label: "Unavailable" },
  { value: "removed", label: "Removed" },
];

export function AccessMatrixFilters({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      if (value) sp.set(key, value);
    }
    router.push(`/access-matrix?${sp.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4"
      data-testid="access-matrix-filters"
    >
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Search</span>
        <input
          name="search"
          value={form.search}
          onChange={(e) => setForm((s) => ({ ...s, search: e.target.value }))}
          placeholder="Model name or ID"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-search"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Access provider</span>
        <input
          value={form.accessProvider}
          onChange={(e) => setForm((s) => ({ ...s, accessProvider: e.target.value }))}
          placeholder="Provider slug"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-access-provider"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Availability</span>
        <select
          value={form.availability}
          onChange={(e) => setForm((s) => ({ ...s, availability: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-availability"
        >
          {availabilityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          className="w-full rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent"
          data-testid="filter-submit"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
