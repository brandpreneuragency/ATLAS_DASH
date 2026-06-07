import type { AIProviderConfig } from '../../types';
import type { ChatMessage } from './types';
import { completeChat } from './router';

export interface SubtaskExtractOptions {
  taskTitle: string;
  existingSubtaskTitles: string[];
  newMessages: ChatMessage[];
  provider: AIProviderConfig;
  signal?: AbortSignal;
}

export async function extractSubtasks(options: SubtaskExtractOptions): Promise<string[]> {
  const { taskTitle, existingSubtaskTitles, newMessages, provider, signal } = options;

  if (newMessages.length === 0) return [];

  const prompt = buildSubtaskPrompt(taskTitle, existingSubtaskTitles, newMessages);

  const aiMessages: ChatMessage[] = [
    { role: 'system', content: 'You are a task analyzer. Extract actionable subtasks from chat messages. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ];

  const raw = await completeChat(aiMessages, provider, signal);
  return parseSubtaskResponse(raw, existingSubtaskTitles);
}

function buildSubtaskPrompt(
  taskTitle: string,
  existing: string[],
  messages: ChatMessage[]
): string {
  const messagesText = messages
    .map((m) => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
    .join('\n\n');

  return `Task: "${taskTitle}"

Existing subtasks (do NOT duplicate):
${existing.length > 0 ? existing.map((t) => `- ${t}`).join('\n') : '(none)'}

New chat messages to analyze:
${messagesText}

Instructions:
1. Identify actionable subtasks contained ONLY in the new messages above.
2. Do NOT include subtasks that are semantically similar to existing ones.
3. Return STRICT JSON array of strings. Example: ["Subtask A", "Subtask B"]
4. If no new subtasks are found, return an empty array: []
5. No markdown, no explanation. Only the JSON array.`;
}

function parseSubtaskResponse(raw: string, existing: string[]): string[] {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const cleanedExisting = existing.map((t) => t.toLowerCase().trim());
    const result: string[] = [];

    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const title = item.trim();
      if (!title) continue;
      if (cleanedExisting.includes(title.toLowerCase())) continue;
      result.push(title);
    }
    return result;
  } catch {
    return [];
  }
}
