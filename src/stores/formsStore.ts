// Forms store. Local-first using Dexie (Tauri desktop).
// State + CRUD actions that delegate to formsService / embedService /
// submissionService. UI components subscribe to this store only.

import { create } from 'zustand';
import type {
  LeadForm,
  LeadFormField,
  LeadFormSubmission,
  FormTemplate,
  FormStatus,
  WebhookConfig,
} from '../types/forms';
import * as formsService from '../services/formsService';
import * as embedService from '../services/embedService';
import type { EmbedSnippet, EmbedSnippetMode } from '../services/embedService';
import { useUIStore } from './uiStore';
import { templateToLeadForm } from '../utils/templateFormAdapter';

function isTemplateId(id: string, templates: FormTemplate[]): boolean {
  return templates.some((t) => t.id === id);
}

function showError(err: unknown, fallback: string): void {
  const msg = err instanceof Error ? err.message : fallback;
  useUIStore.getState().showToast(msg, 'error');
}

export type BuilderTab =
  | 'build'
  | 'style'
  | 'logic'
  | 'embed'
  | 'submissions'
  | 'settings';

export type PreviewMode = 'desktop' | 'tablet' | 'mobile';

export interface FormsListFilters {
  status?: FormStatus;
  search?: string;
}

interface FormsStore {
  // collections
  forms: LeadForm[];
  submissions: LeadFormSubmission[];
  templates: FormTemplate[];
  webhooks: WebhookConfig[];

  // active selection / UI state
  activeFormId: string | null;
  activeTemplateId: string | null;
  activeSubmissionId: string | null;
  activeBuilderTab: BuilderTab;
  previewMode: PreviewMode;
  listFilters: FormsListFilters;

  isLoaded: boolean;

  // bootstrap
  loadForms: () => Promise<void>;

  // selection / UI
  setActiveFormId: (id: string | null) => void;
  setActiveTemplateId: (id: string | null) => void;
  setActiveSubmissionId: (id: string | null) => void;
  setActiveBuilderTab: (tab: BuilderTab) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setListFilters: (filters: Partial<FormsListFilters>) => void;

  // form CRUD
  createForm: (name?: string) => Promise<LeadForm | null>;
  updateForm: (id: string, updates: Partial<LeadForm>) => Promise<void>;
  deleteForm: (id: string) => Promise<void>;
  duplicateForm: (id: string) => Promise<LeadForm | null | undefined>;

  // publish transitions
  setFormStatus: (id: string, status: FormStatus) => Promise<void>;
  publishForm: (id: string) => Promise<void>;
  unpublishForm: (id: string) => Promise<void>;
  archiveForm: (id: string) => Promise<void>;

  // field-level builders
  addField: (formId: string, field: Omit<LeadFormField, 'id' | 'order'> & Partial<Pick<LeadFormField, 'order'>>) => Promise<void>;
  updateField: (formId: string, fieldId: string, updates: Partial<LeadFormField>) => Promise<void>;
  removeField: (formId: string, fieldId: string) => Promise<void>;
  reorderFields: (formId: string, orderedFieldIds: string[]) => Promise<void>;

  // templates
  createFormFromTemplate: (templateId: string, name: string) => Promise<LeadForm | null | undefined>;
  saveFormAsTemplate: (formId: string, name: string, description?: string) => Promise<FormTemplate | null | undefined>;
  deleteTemplate: (id: string) => Promise<void>;
  getTemplateById: (id: string | null) => FormTemplate | undefined;
  getActiveBuilderForm: () => LeadForm | undefined;

  // submissions
  setSubmissionStatus: (
    id: string,
    status: LeadFormSubmission['status'],
  ) => Promise<void>;
  deleteSubmission: (id: string) => Promise<void>;

  // webhooks
  createWebhook: (input: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<WebhookConfig | null>;
  updateWebhook: (id: string, updates: Partial<WebhookConfig>) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;

  // embed
  generateSnippet: (formId: string, mode?: EmbedSnippetMode) => Promise<EmbedSnippet | null>;
  generateAllSnippets: (formId: string) => Promise<EmbedSnippet[]>;

  // export
  exportSubmissions: (formId?: string) => Promise<void>;

  // selectors
  getFormById: (id: string | null) => LeadForm | undefined;
  getSubmissionById: (id: string | null) => LeadFormSubmission | undefined;
  getSubmissionsForForm: (formId: string) => LeadFormSubmission[];
  getWebhooksForForm: (formId: string) => WebhookConfig[];
  selectFormKPIs: (formId: string) => {
    total: number;
    converted: number;
    spam: number;
    conversionRate: number;
  };
  selectDashboardKPIs: () => {
    activeForms: number;
    totalSubmissions: number;
    conversionRate: number;
    spamBlocked: number;
  };
}

export const useFormsStore = create<FormsStore>((set, get) => ({
  forms: [],
  submissions: [],
  templates: [],
  webhooks: [],
  activeFormId: null,
  activeTemplateId: null,
  activeSubmissionId: null,
  activeBuilderTab: 'build',
  previewMode: 'desktop',
  listFilters: {},
  isLoaded: false,

  loadForms: async () => {
    try {
      await formsService.ensureFormsSeeded();
      const [forms, submissions, templates, webhooks] = await Promise.all([
        formsService.listForms(),
        formsService.listSubmissions(),
        formsService.listTemplates(),
        formsService.listWebhooks(),
      ]);
      set({
        forms,
        submissions,
        templates,
        webhooks,
        activeFormId: forms[0]?.id ?? null,
        isLoaded: true,
      });
    } catch (err) {
      set({ isLoaded: true });
      showError(err, 'Failed to load forms.');
    }
  },

  setActiveFormId: (id) => set({ activeFormId: id, activeTemplateId: null }),
  setActiveTemplateId: (id) =>
    set({ activeTemplateId: id, activeFormId: null, activeBuilderTab: 'build' }),
  setActiveSubmissionId: (id) => set({ activeSubmissionId: id }),
  setActiveBuilderTab: (tab) => set({ activeBuilderTab: tab }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  setListFilters: (filters) =>
    set((s) => ({ listFilters: { ...s.listFilters, ...filters } })),

  createForm: async (name) => {
    try {
      const form = await formsService.createForm(name);
      set((s) => ({
        forms: [form, ...s.forms],
        activeFormId: form.id,
        activeTemplateId: null,
        activeBuilderTab: 'build',
      }));
      return form;
    } catch (err) {
      showError(err, 'Failed to create form.');
      return null;
    }
  },

  updateForm: async (id, updates) => {
    if (isTemplateId(id, get().templates)) {
      const previous = get().templates.find((t) => t.id === id);
      set((s) => ({
        templates: s.templates.map((t) => {
          if (t.id !== id) return t;
          const schemaPatch = {
            ...(updates.fields !== undefined ? { fields: updates.fields } : {}),
            ...(updates.steps !== undefined ? { steps: updates.steps } : {}),
            ...(updates.logicRules !== undefined ? { logicRules: updates.logicRules } : {}),
            ...(updates.style !== undefined ? { style: updates.style } : {}),
            ...(updates.embed !== undefined ? { embed: updates.embed } : {}),
            ...(updates.notificationEmail !== undefined
              ? { notificationEmail: updates.notificationEmail }
              : {}),
            ...(updates.successMessage !== undefined
              ? { successMessage: updates.successMessage }
              : {}),
          };
          return {
            ...t,
            name: updates.name ?? t.name,
            description: updates.description !== undefined ? updates.description : t.description,
            schema:
              Object.keys(schemaPatch).length > 0 ? { ...t.schema, ...schemaPatch } : t.schema,
          };
        }),
      }));
      try {
        const next = await formsService.updateTemplateFromFormPatch(id, updates);
        if (next) {
          set((s) => ({ templates: s.templates.map((t) => (t.id === id ? next : t)) }));
        }
      } catch (err) {
        if (previous) {
          set((s) => ({ templates: s.templates.map((t) => (t.id === id ? previous : t)) }));
        }
        showError(err, 'Failed to save template.');
      }
      return;
    }

    const previous = get().forms.find((f) => f.id === id);
    set((s) => ({
      forms: s.forms.map((f) => (f.id === id ? { ...f, ...updates, id } : f)),
    }));
    try {
      const next = await formsService.updateForm(id, updates);
      if (next) {
        set((s) => ({ forms: s.forms.map((f) => (f.id === id ? next : f)) }));
      }
    } catch (err) {
      if (previous) {
        set((s) => ({ forms: s.forms.map((f) => (f.id === id ? previous : f)) }));
      }
      showError(err, 'Failed to save form.');
    }
  },

  deleteForm: async (id) => {
    set((s) => ({
      forms: s.forms.filter((f) => f.id !== id),
      submissions: s.submissions.filter((sub) => sub.formId !== id),
      webhooks: s.webhooks.filter((w) => w.formId !== id),
      activeFormId: s.activeFormId === id ? null : s.activeFormId,
    }));
    try {
      await formsService.deleteForm(id);
    } catch (err) {
      showError(err, 'Failed to delete form.');
      void get().loadForms();
    }
  },

  duplicateForm: async (id) => {
    try {
      const copy = await formsService.duplicateForm(id);
      if (copy) {
        set((s) => ({ forms: [copy, ...s.forms], activeFormId: copy.id }));
      }
      return copy;
    } catch (err) {
      showError(err, 'Failed to duplicate form.');
      return null;
    }
  },

  setFormStatus: async (id, status) => {
    try {
      const next = await formsService.setFormStatus(id, status);
      if (next) {
        set((s) => ({ forms: s.forms.map((f) => (f.id === id ? next : f)) }));
      }
    } catch (err) {
      showError(err, 'Failed to update form status.');
    }
  },

  publishForm: async (id) => {
    try {
      const next = await formsService.publishForm(id);
      if (next) {
        set((s) => ({ forms: s.forms.map((f) => (f.id === id ? next : f)) }));
      }
    } catch (err) {
      showError(err, 'Failed to publish form.');
    }
  },

  unpublishForm: async (id) => {
    try {
      const next = await formsService.unpublishForm(id);
      if (next) {
        set((s) => ({ forms: s.forms.map((f) => (f.id === id ? next : f)) }));
      }
    } catch (err) {
      showError(err, 'Failed to unpublish form.');
    }
  },

  archiveForm: async (id) => {
    try {
      const next = await formsService.archiveForm(id);
      if (next) {
        set((s) => ({ forms: s.forms.map((f) => (f.id === id ? next : f)) }));
      }
    } catch (err) {
      showError(err, 'Failed to archive form.');
    }
  },

  addField: async (formId, field) => {
    const editingTemplate = isTemplateId(formId, get().templates);
    try {
      const next = editingTemplate
        ? await formsService.addTemplateField(formId, field)
        : await formsService.addField(formId, field);
      if (next) {
        if (editingTemplate) {
          set((s) => ({
            templates: s.templates.map((t) => (t.id === formId ? (next as FormTemplate) : t)),
          }));
        } else {
          set((s) => ({ forms: s.forms.map((f) => (f.id === formId ? (next as LeadForm) : f)) }));
        }
      }
    } catch (err) {
      showError(err, 'Failed to add field.');
    }
  },

  updateField: async (formId, fieldId, updates) => {
    const editingTemplate = isTemplateId(formId, get().templates);
    try {
      const next = editingTemplate
        ? await formsService.updateTemplateField(formId, fieldId, updates)
        : await formsService.updateField(formId, fieldId, updates);
      if (next) {
        if (editingTemplate) {
          set((s) => ({
            templates: s.templates.map((t) => (t.id === formId ? (next as FormTemplate) : t)),
          }));
        } else {
          set((s) => ({ forms: s.forms.map((f) => (f.id === formId ? (next as LeadForm) : f)) }));
        }
      }
    } catch (err) {
      showError(err, 'Failed to update field.');
    }
  },

  removeField: async (formId, fieldId) => {
    const editingTemplate = isTemplateId(formId, get().templates);
    try {
      const next = editingTemplate
        ? await formsService.removeTemplateField(formId, fieldId)
        : await formsService.removeField(formId, fieldId);
      if (next) {
        if (editingTemplate) {
          set((s) => ({
            templates: s.templates.map((t) => (t.id === formId ? (next as FormTemplate) : t)),
          }));
        } else {
          set((s) => ({ forms: s.forms.map((f) => (f.id === formId ? (next as LeadForm) : f)) }));
        }
      }
    } catch (err) {
      showError(err, 'Failed to remove field.');
    }
  },

  reorderFields: async (formId, orderedFieldIds) => {
    const editingTemplate = isTemplateId(formId, get().templates);
    try {
      const next = editingTemplate
        ? await formsService.reorderTemplateFields(formId, orderedFieldIds)
        : await formsService.reorderFields(formId, orderedFieldIds);
      if (next) {
        if (editingTemplate) {
          set((s) => ({
            templates: s.templates.map((t) => (t.id === formId ? (next as FormTemplate) : t)),
          }));
        } else {
          set((s) => ({ forms: s.forms.map((f) => (f.id === formId ? (next as LeadForm) : f)) }));
        }
      }
    } catch (err) {
      showError(err, 'Failed to reorder fields.');
    }
  },

  createFormFromTemplate: async (templateId, name) => {
    try {
      const form = await formsService.createFormFromTemplate(templateId, name);
      if (form) {
        set((s) => ({
          forms: [form, ...s.forms],
          activeFormId: form.id,
          activeTemplateId: null,
          activeBuilderTab: 'build',
        }));
      }
      return form;
    } catch (err) {
      showError(err, 'Failed to create form from template.');
      return null;
    }
  },

  saveFormAsTemplate: async (formId, name, description) => {
    try {
      const template = await formsService.saveFormAsTemplate(formId, name, description);
      if (template) {
        set((s) => ({ templates: [template, ...s.templates] }));
      }
      return template;
    } catch (err) {
      showError(err, 'Failed to save template.');
      return null;
    }
  },

  deleteTemplate: async (id) => {
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      activeTemplateId: s.activeTemplateId === id ? null : s.activeTemplateId,
    }));
    try {
      await formsService.deleteTemplate(id);
    } catch (err) {
      showError(err, 'Failed to delete template.');
      void get().loadForms();
    }
  },

  setSubmissionStatus: async (id, status) => {
    const previous = get().submissions.find((s) => s.id === id);
    set((s) => ({
      submissions: s.submissions.map((sub) => (sub.id === id ? { ...sub, status } : sub)),
    }));
    try {
      const next = await formsService.setSubmissionStatus(id, status);
      if (next) {
        set((s) => ({ submissions: s.submissions.map((sub) => (sub.id === id ? next : sub)) }));
      }
    } catch (err) {
      if (previous) {
        set((s) => ({ submissions: s.submissions.map((sub) => (sub.id === id ? previous : sub)) }));
      }
      showError(err, 'Failed to update submission.');
    }
  },

  deleteSubmission: async (id) => {
    set((s) => ({ submissions: s.submissions.filter((sub) => sub.id !== id) }));
    try {
      await formsService.deleteSubmission(id);
    } catch (err) {
      showError(err, 'Failed to delete submission.');
      void get().loadForms();
    }
  },

  createWebhook: async (input) => {
    try {
      const webhook = await formsService.createWebhook(input);
      set((s) => ({ webhooks: [...s.webhooks, webhook] }));
      return webhook;
    } catch (err) {
      showError(err, 'Failed to create webhook.');
      return null;
    }
  },

  updateWebhook: async (id, updates) => {
    const previous = get().webhooks.find((w) => w.id === id);
    set((s) => ({
      webhooks: s.webhooks.map((w) => (w.id === id ? { ...w, ...updates, id } : w)),
    }));
    try {
      const next = await formsService.updateWebhook(id, updates);
      if (next) {
        set((s) => ({ webhooks: s.webhooks.map((w) => (w.id === id ? next : w)) }));
      }
    } catch (err) {
      if (previous) {
        set((s) => ({ webhooks: s.webhooks.map((w) => (w.id === id ? previous : w)) }));
      }
      showError(err, 'Failed to update webhook.');
    }
  },

  deleteWebhook: async (id) => {
    set((s) => ({ webhooks: s.webhooks.filter((w) => w.id !== id) }));
    try {
      await formsService.deleteWebhook(id);
    } catch (err) {
      showError(err, 'Failed to delete webhook.');
      void get().loadForms();
    }
  },

  generateSnippet: async (formId, mode) => {
    try {
      return await embedService.generateSnippet(formId, mode);
    } catch (err) {
      showError(err, 'Failed to generate embed snippet.');
      return null;
    }
  },

  generateAllSnippets: async (formId) => {
    try {
      return await embedService.generateAllSnippets(formId);
    } catch (err) {
      showError(err, 'Failed to generate embed snippets.');
      return [];
    }
  },

  exportSubmissions: async (formId) => {
    try {
      await formsService.exportSubmissionsToCsv(formId);
    } catch (err) {
      showError(err, 'Failed to export submissions.');
    }
  },

  // ---- selectors ----------------------------------------------------------
  getFormById: (id) => (id ? get().forms.find((f) => f.id === id) : undefined),
  getTemplateById: (id) => (id ? get().templates.find((t) => t.id === id) : undefined),
  getActiveBuilderForm: () => {
    const { activeTemplateId, activeFormId, templates, forms } = get();
    if (activeTemplateId) {
      const template = templates.find((t) => t.id === activeTemplateId);
      return template ? templateToLeadForm(template) : undefined;
    }
    return activeFormId ? forms.find((f) => f.id === activeFormId) : undefined;
  },
  getSubmissionById: (id) => (id ? get().submissions.find((s) => s.id === id) : undefined),
  getSubmissionsForForm: (formId) =>
    get()
      .submissions.filter((s) => s.formId === formId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  getWebhooksForForm: (formId) => get().webhooks.filter((w) => w.formId === formId),

  selectFormKPIs: (formId) => {
    const subs = get().submissions.filter((s) => s.formId === formId);
    const total = subs.length;
    const converted = subs.filter((s) => s.status === 'converted').length;
    const spam = subs.filter((s) => s.status === 'spam').length;
    const legitimate = total - spam;
    const conversionRate = legitimate > 0 ? converted / legitimate : 0;
    return { total, converted, spam, conversionRate };
  },

  selectDashboardKPIs: () => {
    const { forms, submissions } = get();
    const activeForms = forms.filter((f) => f.status === 'published').length;
    const totalSubmissions = submissions.length;
    const spamBlocked = submissions.filter((s) => s.status === 'spam').length;
    const legitimate = totalSubmissions - spamBlocked;
    const converted = submissions.filter((s) => s.status === 'converted').length;
    const conversionRate = legitimate > 0 ? converted / legitimate : 0;
    return { activeForms, totalSubmissions, conversionRate, spamBlocked };
  },
}));
