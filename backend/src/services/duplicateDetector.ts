import { validatePhone } from '../parsers/phoneExtractor.js';
import type { Contact, ExtractionStats } from '../types.js';

export function markDuplicates(contacts: Contact[]): Contact[] {
  const counts = new Map<string, number>();
  const normalized = contacts.map((contact) => ({
    ...contact,
    normalizedPhone: validatePhone(contact.phone).normalized,
    duplicateGroup: undefined as string | undefined,
  }));
  for (const contact of normalized)
    if (contact.normalizedPhone)
      counts.set(contact.normalizedPhone, (counts.get(contact.normalizedPhone) || 0) + 1);
  return normalized.map((contact) => ({
    ...contact,
    ...((counts.get(contact.normalizedPhone || '') || 0) > 1
      ? { duplicateGroup: contact.normalizedPhone! }
      : {}),
  }));
}
export function calculateStats(contacts: Contact[], filesProcessed: number): ExtractionStats {
  const groups = new Set(contacts.map((c) => c.duplicateGroup).filter(Boolean));
  return {
    total: contacts.length,
    valid: contacts.filter((c) => c.status !== 'invalid').length,
    invalid: contacts.filter((c) => c.status === 'invalid').length,
    needsReview: contacts.filter((c) => c.status !== 'valid').length,
    duplicates: contacts.filter((c) => c.duplicateGroup).length - groups.size,
    duplicateGroups: groups.size,
    filesProcessed,
  };
}
/** Only identical names (ignoring case/spacing) can be confidently merged without a decision. */
export function isConfidentDuplicateGroup(contacts: Pick<Contact, 'name'>[]): boolean {
  const names = new Set(
    contacts.map((c) => c.name.toLocaleLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean),
  );
  return names.size <= 1;
}
