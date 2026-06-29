// Embed service — generates embed snippets for published forms.
//
// Supports four snippet formats: iframe (default), HTML/script, React, and
// Web Component. The snippets reference a public base URL + form id. The
// public rendering endpoint itself is future VPS work (see TODO below).

import { crmFormsDb } from '../data/crmFormsDb';
import type { LeadForm, LeadFormEmbedConfig } from '../types/forms';

// CRM_FORMS_PUBLIC_CAPTURE_TODO:
// Production embedded forms require a public VPS/API endpoint.
// Implement public form rendering, submission ingestion, allowed-domain checks,
// CORS, rate limits, spam protection, duplicate matching, and CRM lead creation.

export type EmbedSnippetMode = 'iframe' | 'html_script' | 'react' | 'web_component';

export interface EmbedSnippet {
  mode: EmbedSnippetMode;
  language: 'html' | 'tsx' | 'text';
  code: string;
}

const DEFAULT_PUBLIC_BASE_URL = 'https://tabs.app';
const DEFAULT_IFRAME_HEIGHT = 640;

function publicBaseUrl(form: LeadForm | undefined): string {
  const configured = form?.embed.publicBaseUrl?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/$/, '') : DEFAULT_PUBLIC_BASE_URL;
}

function iframeHeight(form: LeadForm | undefined): number {
  return form?.embed.iframeHeight ?? DEFAULT_IFRAME_HEIGHT;
}

function embedPath(formId: string): string {
  return `/embed/forms/${formId}`;
}

function buildIframeSnippet(formId: string, form: LeadForm | undefined): string {
  const base = publicBaseUrl(form);
  const height = iframeHeight(form);
  return `<iframe
  src="${base}${embedPath(formId)}"
  width="100%"
  height="${height}"
  style="border:0;"
  title="Lead Form"
  loading="lazy"
></iframe>`;
}

function buildHtmlScriptSnippet(formId: string, form: LeadForm | undefined): string {
  const base = publicBaseUrl(form);
  return `<div data-tabs-form="${formId}"></div>
<script src="${base}/embed/form.js" async></script>`;
}

function buildReactSnippet(formId: string): string {
  return `<TabsLeadForm formId="${formId}" />`;
}

function buildWebComponentSnippet(formId: string, form: LeadForm | undefined): string {
  const base = publicBaseUrl(form);
  return `<tabs-lead-form form-id="${formId}"></tabs-lead-form>
<script src="${base}/embed/web-component.js" async></script>`;
}

/**
 * Build an embed snippet for the given mode without touching the db.
 * `form` is optional and used for publicBaseUrl / iframeHeight / default mode.
 */
export function buildSnippet(
  formId: string,
  mode: EmbedSnippetMode,
  form?: LeadForm,
): EmbedSnippet {
  switch (mode) {
    case 'iframe':
      return { mode, language: 'html', code: buildIframeSnippet(formId, form) };
    case 'html_script':
      return { mode, language: 'html', code: buildHtmlScriptSnippet(formId, form) };
    case 'react':
      return { mode, language: 'tsx', code: buildReactSnippet(formId) };
    case 'web_component':
      return { mode, language: 'html', code: buildWebComponentSnippet(formId, form) };
  }
}

/** Convenience wrappers matching the Step 5 spec. */
export function generateIframeSnippet(formId: string): Promise<EmbedSnippet> {
  return generateSnippet(formId, 'iframe');
}

export function generateHtmlScriptSnippet(formId: string): Promise<EmbedSnippet> {
  return generateSnippet(formId, 'html_script');
}

export function generateReactSnippet(formId: string): Promise<EmbedSnippet> {
  return generateSnippet(formId, 'react');
}

export function generateWebComponentSnippet(formId: string): Promise<EmbedSnippet> {
  return generateSnippet(formId, 'web_component');
}

/** Resolve a form from Dexie and build the requested snippet (default = iframe). */
export async function generateSnippet(
  formId: string,
  mode?: EmbedSnippetMode,
): Promise<EmbedSnippet> {
  const form = await crmFormsDb.forms.get(formId);
  const chosenMode: EmbedSnippetMode = mode ?? form?.embed.defaultMode ?? 'iframe';
  return buildSnippet(formId, chosenMode, form);
}

/** Build all four snippet variants for a form at once (Embed tab UI). */
export async function generateAllSnippets(formId: string): Promise<EmbedSnippet[]> {
  const form = await crmFormsDb.forms.get(formId);
  return [
    buildSnippet(formId, 'iframe', form),
    buildSnippet(formId, 'html_script', form),
    buildSnippet(formId, 'react', form),
    buildSnippet(formId, 'web_component', form),
  ];
}

/** True if `sourceDomain` is allowed by the form's embed config. */
export function isDomainAllowed(
  embed: LeadFormEmbedConfig | undefined,
  sourceDomain: string | undefined,
): boolean {
  if (!embed) return false;
  if (!sourceDomain) return false;
  if (embed.allowedDomains.length === 0) return true; // empty = unrestricted
  return embed.allowedDomains.some(
    (allowed) =>
      allowed.toLowerCase() === sourceDomain.toLowerCase() ||
      sourceDomain.toLowerCase().endsWith(`.${allowed.toLowerCase()}`),
  );
}
