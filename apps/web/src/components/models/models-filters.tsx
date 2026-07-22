"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  initial: {
    search: string;
    developer: string;
    family: string;
    lifecycle: string;
    accessProvider: string;
    archived: string;
    accessible: string;
    sort: string;
  };
}

export function ModelsFilters({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      if (value && !(key === "archived" && value === "false")) {
        sp.set(key, value);
      }
    }
    router.push(`/models?${sp.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4"
      data-testid="models-filters"
    >
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Search</span>
        <input
          name="search"
          value={form.search}
          onChange={(e) => setForm((s) => ({ ...s, search: e.target.value }))}
          placeholder="Name, ID, alias, developer, provider"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-search"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Developer</span>
        <input
          value={form.developer}
          onChange={(e) => setForm((s) => ({ ...s, developer: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-developer"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Family</span>
        <input
          value={form.family}
          onChange={(e) => setForm((s) => ({ ...s, family: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-family"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Lifecycle</span>
        <select
          value={form.lifecycle}
          onChange={(e) => setForm((s) => ({ ...s, lifecycle: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-lifecycle"
        >
          <option value="">Any</option>
          <option value="current">current</option>
          <option value="ga">ga</option>
          <option value="preview">preview</option>
          <option value="beta">beta</option>
          <option value="legacy">legacy</option>
          <option value="deprecated">deprecated</option>
          <option value="retired">retired</option>
          <option value="unavailable">unavailable</option>
          <option value="unknown">unknown</option>
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Access provider</span>
        <input
          value={form.accessProvider}
          onChange={(e) => setForm((s) => ({ ...s, accessProvider: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-access-provider"
        />
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Accessible only</span>
        <select
          value={form.accessible}
          onChange={(e) => setForm((s) => ({ ...s, accessible: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-accessible"
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Archived</span>
        <select
          value={form.archived}
          onChange={(e) => setForm((s) => ({ ...s, archived: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-archived"
        >
          <option value="false">Hide archived</option>
          <option value="true">Archived only</option>
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Sort</span>
        <select
          value={form.sort}
          onChange={(e) => setForm((s) => ({ ...s, sort: e.target.value }))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="filter-sort"
        >
          <option value="name">Name A–Z</option>
          <option value="-name">Name Z–A</option>
          <option value="developer">Developer</option>
          <option value="-updatedAt">Recently updated</option>
          <option value="-capability">Capability score</option>
        </select>
      </label>
      <div className="flex items-end md:col-span-4">
        <button
          type="submit"
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent"
          data-testid="filter-submit"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
