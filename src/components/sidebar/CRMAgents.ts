// CRM Agent definitions for the CRM/Form AI sidebar (Panel 3).
//
// These are UI-scaffolding data only — no AI/network calls are made.
// CRMAISidebar renders these as selectable agents and derives mock
// suggestions from them. Real AI wiring is a future task.
//
// contextScope keys map to the master plan's "AI context mapping" table:
//   dashboard  -> CRM Dashboard / Forms Dashboard summary
//   lead       -> Lead detail (selected lead + linked contact/company)
//   contact    -> Contact detail (selected contact + linked leads/deals)
//   company    -> Company detail (selected company + contacts/leads/deals)
//   pipeline   -> Pipeline view (current pipeline, filters, deals)
//   form       -> Form Builder / Forms list (selected form schema/style)
//   submission -> Submission detail (selected submission + linked lead)
//   embed      -> Embed tab (form embed snippet/state)

export type CRMAgentId =
  | 'lead-qualifier'
  | 'follow-up-writer'
  | 'pipeline-analyst'
  | 'form-assistant';

/** Context keys shared by CRM and Forms modules. Derived in CRMAISidebar
 *  from the active page + selection, and used to decide which agents are
 *  relevant for the current view. */
export type CRMAgentContextScope =
  | 'dashboard'
  | 'lead'
  | 'contact'
  | 'company'
  | 'pipeline'
  | 'form'
  | 'submission'
  | 'embed';

export interface CRMAgentDef {
  id: CRMAgentId;
  name: string;
  description: string;
  /** lucide-react icon name (rendered via a typed icon map in CRMAISidebar). */
  icon: string;
  /** Which CRM/Forms contexts this agent is relevant for. */
  contextScope: CRMAgentContextScope[];
}

export const CRM_AGENTS: CRMAgentDef[] = [
  {
    id: 'lead-qualifier',
    name: 'Lead Qualifier',
    description: 'Score and qualify new leads',
    icon: 'Target',
    contextScope: ['dashboard', 'lead', 'contact', 'submission'],
  },
  {
    id: 'follow-up-writer',
    name: 'Follow-up Writer',
    description: 'Draft personalized outreach',
    icon: 'Mail',
    contextScope: ['dashboard', 'lead', 'contact', 'company', 'submission'],
  },
  {
    id: 'pipeline-analyst',
    name: 'Pipeline Analyst',
    description: 'Analyze deals and forecast',
    icon: 'TrendingUp',
    contextScope: ['dashboard', 'pipeline'],
  },
  {
    id: 'form-assistant',
    name: 'Form Assistant',
    description: 'Map and improve forms',
    icon: 'FormInput',
    contextScope: ['dashboard', 'form', 'embed', 'submission'],
  },
];

/** Look up an agent by id. The id union is closed so this always resolves,
 *  but the fallback keeps the call sites strictly-typed and crash-free. */
export function getCRMAgentById(id: CRMAgentId): CRMAgentDef {
  const found = CRM_AGENTS.find((a) => a.id === id);
  return found ?? CRM_AGENTS[0];
}
