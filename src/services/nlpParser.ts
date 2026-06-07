import type { TaskImportance } from '../types';

export interface ParsedTaskInput {
  title: string;
  date: string | null;
  importance: TaskImportance | null;
  projectName: string | null;
}

export function parseTaskInput(text: string): ParsedTaskInput {
  let remaining = text.trim();

  // Extract #Project tag
  const projectMatch = remaining.match(/#(\w+)/);
  const projectName = projectMatch ? projectMatch[1] : null;
  remaining = remaining.replace(/#\w+/, '').trim();

  // Extract importance keywords
  const importanceMatch = remaining.match(/\b(low|medium|high)\b/i);
  const importance = importanceMatch
    ? (importanceMatch[1].toLowerCase() as TaskImportance)
    : null;
  remaining = remaining.replace(/\b(low|medium|high)\b/i, '').trim();

  // Extract date keywords
  let date: string | null = null;
  const todayMatch = remaining.match(/\btoday\b/i);
  const tomorrowMatch = remaining.match(/\btomorrow\b/i);
  const isoMatch = remaining.match(/(\d{4}-\d{2}-\d{2})/);

  if (todayMatch) {
    date = new Date().toISOString().slice(0, 10);
    remaining = remaining.replace(/\btoday\b/i, '').trim();
  } else if (tomorrowMatch) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    date = d.toISOString().slice(0, 10);
    remaining = remaining.replace(/\btomorrow\b/i, '').trim();
  } else if (isoMatch) {
    date = isoMatch[1];
    remaining = remaining.replace(isoMatch[1], '').trim();
  }

  const title = remaining.replace(/\s+/g, ' ').trim();
  return { title, date, importance, projectName };
}
