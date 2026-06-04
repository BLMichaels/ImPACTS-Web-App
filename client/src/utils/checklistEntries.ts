export type ChecklistEntryType = 'task' | 'banner' | 'footnote' | 'subnote' | 'divider';

export function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value || '').trim());
}

/** Parse admin-encoded checklist row text (banner, footnote, subnote, divider, task). */
export function decodeChecklistEntry(text: string): {
  type: ChecklistEntryType;
  content: string;
  color_hex?: string;
} {
  const m = String(text || '').match(
    /^\[\[ENTRY:(task|banner|footnote|subnote|divider)(?:;color=(#[0-9a-fA-F]{3,6}))?\]\]/i
  );
  if (!m) return { type: 'task', content: text || '' };
  const type = m[1].toLowerCase() as ChecklistEntryType;
  const colorHex = m[2] && isValidHexColor(m[2]) ? m[2] : undefined;
  return { type, content: String(text || '').slice(m[0].length), color_hex: colorHex };
}
