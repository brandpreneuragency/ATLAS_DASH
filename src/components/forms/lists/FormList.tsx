import { useMemo } from 'react';
import { useFormsStore } from '../../../stores/formsStore';
import type { FormStatus } from '../../../types/forms';
import { StatusBadge } from '../components/StatusBadge';
import { Search, Inbox } from 'lucide-react';
import '../forms.css';

interface FormListProps {
  /** When true (builder page), hides the "Has submissions" filter. */
  compact?: boolean;
}

type StatusFilter = 'all' | FormStatus | 'has_submissions';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
  { key: 'has_submissions', label: 'Has submissions' },
];

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function FormList({ compact = false }: FormListProps) {
  const forms = useFormsStore((s) => s.forms);
  const submissions = useFormsStore((s) => s.submissions);
  const activeFormId = useFormsStore((s) => s.activeFormId);
  const listFilters = useFormsStore((s) => s.listFilters);
  const setListFilters = useFormsStore((s) => s.setListFilters);
  const setActiveFormId = useFormsStore((s) => s.setActiveFormId);

  const formsWithSubmissions = useMemo(() => {
    const ids = new Set<string>();
    for (const sub of submissions) ids.add(sub.formId);
    return ids;
  }, [submissions]);

  const activeFilter: StatusFilter =
    listFilters.hasSubmissions
      ? 'has_submissions'
      : (listFilters.status ?? 'all');

  const filtered = useMemo(() => {
    const search = (listFilters.search ?? '').trim().toLowerCase();
    return forms.filter((f) => {
      if (listFilters.status && f.status !== listFilters.status) return false;
      if (listFilters.hasSubmissions && !formsWithSubmissions.has(f.id)) return false;
      if (search) {
        const haystack = `${f.name} ${f.description ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [forms, listFilters, formsWithSubmissions]);

  const handleFilter = (key: StatusFilter) => {
    if (key === 'has_submissions') {
      setListFilters({ hasSubmissions: true, status: undefined });
    } else if (key === 'all') {
      setListFilters({ hasSubmissions: undefined, status: undefined });
    } else {
      setListFilters({ hasSubmissions: undefined, status: key as FormStatus });
    }
  };

  const visibleFilters = compact ? STATUS_FILTERS.filter((f) => f.key !== 'has_submissions') : STATUS_FILTERS;

  return (
    <>
      <div className="forms-list-search">
        <Search size={13} className="forms-muted" />
        <input
          type="text"
          placeholder="Search forms"
          value={listFilters.search ?? ''}
          onChange={(e) => setListFilters({ search: e.target.value })}
        />
      </div>

      <div className="forms-list-filters">
        {visibleFilters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`forms-filter-chip${activeFilter === f.key ? ' forms-filter-chip--active' : ''}`}
            onClick={() => handleFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="forms-list-empty-inline">
          {forms.length === 0 ? 'No forms yet. Use “New form” to create one.' : 'No forms match these filters.'}
        </div>
      ) : (
        filtered.map((form) => {
          const subCount = submissions.filter((s) => s.formId === form.id).length;
          const isActive = form.id === activeFormId;
          return (
            <button
              key={form.id}
              type="button"
              onClick={() => setActiveFormId(form.id)}
              className={`forms-list-item${isActive ? ' forms-list-item--active' : ''}`}
            >
              <span className="forms-list-item-title">
                <span className="trunc forms-grow">{form.name}</span>
                <StatusBadge status={form.status} />
              </span>
              <span className="forms-list-item-meta">
                <Inbox size={11} />
                <span>{subCount} submission{subCount === 1 ? '' : 's'}</span>
                <span>·</span>
                <span>{form.fields.length} fields</span>
                <span>·</span>
                <span>{timeLabel(form.createdAt)}</span>
              </span>
            </button>
          );
        })
      )}
    </>
  );
}
