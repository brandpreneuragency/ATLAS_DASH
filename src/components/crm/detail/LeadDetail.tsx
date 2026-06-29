import { useMemo, useState } from 'react';
import {
  Building2,
  Link2,
  Mail,
  Pencil,
  Plus,
  User,
} from 'lucide-react';
import type { CRMLead } from '../../../types/crm';
import { useCrmStore } from '../../../stores/crmStore';
import { useFormsStore } from '../../../stores/formsStore';
import {
  ActivityTimeline,
  CRMEmptyState,
  CRMNoteInput,
  CRMTabBar,
  ScoreBadge,
  StatusBadge,
  TagChips,
  formatDate,
  formatRelative,
  fullName,
} from '../components';

const LEAD_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'formdata', label: 'Form Data' },
  { id: 'emails', label: 'Emails' },
];

interface LeadDetailProps {
  lead: CRMLead;
}

export function LeadDetail({ lead }: LeadDetailProps) {
  const {
    contacts,
    companies,
    notes,
    activities,
    taskLinks,
    addNote,
    updateLead,
  } = useCrmStore();

  const { submissions, getFormById } = useFormsStore();

  const [tab, setTab] = useState<string>('overview');

  const contact = lead.contactId ? contacts.find((c) => c.id === lead.contactId) : undefined;
  const company = lead.companyId ? companies.find((c) => c.id === lead.companyId) : undefined;

  const leadNotes = useMemo(
    () => notes.filter((n) => n.leadId === lead.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [notes, lead.id],
  );
  const leadActivities = useMemo(
    () => activities.filter((a) => a.leadId === lead.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [activities, lead.id],
  );
  const leadTaskLinks = useMemo(() => taskLinks.filter((t) => t.leadId === lead.id), [taskLinks, lead.id]);
  const emailActivities = useMemo(
    () => leadActivities.filter((a) => a.type === 'email_sent' || a.type === 'email_opened'),
    [leadActivities],
  );

  const submission = lead.sourceSubmissionId ? submissions.find((s) => s.id === lead.sourceSubmissionId) : undefined;
  const sourceForm = lead.sourceFormId ? getFormById(lead.sourceFormId) : undefined;

  const utmEntries = lead.utm
    ? Object.entries(lead.utm).filter(([, v]) => v !== undefined && v !== '')
    : [];

  return (
    <div className="crm-page">
      <div className="crm-page-header">
        <div className="crm-page-header-main">
          <div className="crm-page-header-title">{lead.title}</div>
          <div className="crm-page-header-meta">
            {contact && (
              <span className="crm-page-header-meta-item">
                <User size={11} /> {fullName(contact.firstName, contact.lastName)}
              </span>
            )}
            {company && (
              <span className="crm-page-header-meta-item">
                <Building2 size={11} /> {company.name}
              </span>
            )}
            <StatusBadge stage={lead.status} />
            <span className="crm-page-header-meta-item">Stage: <StatusBadge stage={lead.stage} /></span>
            <ScoreBadge score={lead.score} compact />
          </div>
        </div>
        <div className="crm-page-header-actions">
          <button
            type="button"
            className="crm-btn crm-btn--ghost crm-btn--sm"
            title="Edit lead"
            onClick={() => {
              const next = window.prompt('Lead title', lead.title);
              if (next && next.trim() && next.trim() !== lead.title) {
                void updateLead(lead.id, { title: next.trim() });
              }
            }}
          >
            <Pencil size={12} /> Edit
          </button>
        </div>
      </div>

      <CRMTabBar tabs={LEAD_TABS} active={tab} onChange={setTab} />

      <div className="crm-page-body">
        {tab === 'overview' && (
          <>
            <div className="crm-card">
              <div className="crm-card-title">Linked records</div>
              <div className="crm-detail-grid">
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Contact</span>
                  <span className="crm-detail-field-value">
                    {contact ? fullName(contact.firstName, contact.lastName) : '—'}
                  </span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Company</span>
                  <span className="crm-detail-field-value">{company?.name ?? '—'}</span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Email (via contact)</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">{contact?.email ?? '—'}</span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Phone (via contact)</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">{contact?.phone ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="crm-card">
              <div className="crm-card-title">Source & attribution</div>
              <div className="crm-detail-grid">
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Source form</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">{lead.source ?? '—'}</span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Form name</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">{sourceForm?.name ?? '—'}</span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Page URL</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">
                    {lead.sourcePageUrl ?? '—'}
                  </span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Owner</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">{lead.ownerId ?? '—'}</span>
                </div>
              </div>
              {utmEntries.length > 0 && (
                <>
                  <div className="crm-card-title" style={{ marginTop: 4 }}>UTM / attribution</div>
                  <div className="crm-detail-grid">
                    {utmEntries.map(([k, v]) => (
                      <div className="crm-detail-field" key={k}>
                        <span className="crm-detail-field-label">{k}</span>
                        <span className="crm-detail-field-value crm-detail-field-value--muted">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="crm-card">
              <div className="crm-card-title">Status & scoring</div>
              <div className="crm-detail-grid">
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Status</span>
                  <span className="crm-detail-field-value"><StatusBadge stage={lead.status} /></span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Stage</span>
                  <span className="crm-detail-field-value"><StatusBadge stage={lead.stage} /></span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Score</span>
                  <span className="crm-detail-field-value"><ScoreBadge score={lead.score} /></span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Tags</span>
                  <span className="crm-detail-field-value">
                    {lead.tags.length > 0 ? <TagChips tags={lead.tags} max={6} /> : '—'}
                  </span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Created</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">{formatDate(lead.createdAt)}</span>
                </div>
                <div className="crm-detail-field">
                  <span className="crm-detail-field-label">Last activity</span>
                  <span className="crm-detail-field-value crm-detail-field-value--muted">
                    {formatRelative(lead.lastActivityAt)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'notes' && (
          <div className="crm-stacked">
            {leadNotes.length === 0 ? (
              <div className="crm-muted-block">No notes yet. Add one below.</div>
            ) : (
              leadNotes.map((note) => (
                <div key={note.id} className="crm-card">
                  <div className="crm-card-header">
                    <span className="crm-card-title">{note.createdBy ?? 'You'}</span>
                    <span className="crm-list-item-sub">{formatRelative(note.createdAt)}</span>
                  </div>
                  <div className="crm-card-body">{note.body}</div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'activity' && (
          <ActivityTimeline activities={leadActivities} emptyText="No activity recorded for this lead." />
        )}

        {tab === 'tasks' && (
          <div className="crm-stacked">
            {leadTaskLinks.length === 0 ? (
              <div className="crm-muted-block">No tasks linked to this lead yet.</div>
            ) : (
              leadTaskLinks.map((link) => (
                <div key={link.id} className="crm-card">
                  <div className="crm-card-header">
                    <span className="crm-card-title">
                      <Link2 size={13} /> Task {link.taskId}
                    </span>
                    <span className="crm-list-item-sub">{formatRelative(link.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
            <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" disabled title="Linking creation is a placeholder for now.">
              <Plus size={12} /> Link a task
            </button>
          </div>
        )}

        {tab === 'formdata' && (
          <div className="crm-stacked">
            {submission ? (
              <div className="crm-card">
                <div className="crm-card-title">Submission · {submission.id}</div>
                <div className="crm-list-item-sub" style={{ marginBottom: 6 }}>
                  {sourceForm?.name ?? lead.sourceFormId ?? '—'} · {formatDate(submission.createdAt)}
                </div>
                <div className="crm-detail-grid">
                  {Object.entries(submission.fields).map(([k, v]) => (
                    <div className="crm-detail-field" key={k}>
                      <span className="crm-detail-field-label">{k}</span>
                      <span className="crm-detail-field-value crm-detail-field-value--muted">
                        {v === null || v === undefined ? '—' : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
                {Object.keys(submission.hiddenFields ?? {}).length > 0 && (
                  <>
                    <div className="crm-card-title" style={{ marginTop: 6 }}>Hidden / UTM capture</div>
                    <div className="crm-detail-grid">
                      {Object.entries(submission.hiddenFields)
                        .filter(([, v]) => v !== undefined && v !== '')
                        .map(([k, v]) => (
                          <div className="crm-detail-field" key={k}>
                            <span className="crm-detail-field-label">{k}</span>
                            <span className="crm-detail-field-value crm-detail-field-value--muted">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <CRMEmptyState icon={Mail} title="No source submission" subtitle="This lead was not created from a form submission." />
            )}
          </div>
        )}

        {tab === 'emails' && (
          <div className="crm-stacked">
            {emailActivities.length === 0 ? (
              <CRMEmptyState
                icon={Mail}
                title="No email activity yet"
                subtitle="Follow-up emails and opens will appear here once sent."
              />
            ) : (
              <ActivityTimeline activities={emailActivities} emptyText="No email activity yet." />
            )}
          </div>
        )}
      </div>

      {tab === 'notes' && (
        <div className="crm-page-footer">
          <CRMNoteInput
            placeholder="Add a note about this lead…"
            onSubmit={async (body) => {
              await addNote({
                body,
                leadId: lead.id,
                contactId: lead.contactId,
                companyId: lead.companyId,
                createdBy: 'you',
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
