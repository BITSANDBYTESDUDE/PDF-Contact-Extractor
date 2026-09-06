import type { Contact } from '@/types';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export function validatePhone(raw: string) {
  let input = raw.normalize('NFKC').trim();
  if (!/^[+\d\s().-]+$/.test(input) || /^\d{5}-\d{7}-\d$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  input = input.replace(/[\s().-]/g, '');
  if (input.startsWith('00')) input = '+' + input.slice(2);
  else if (/^92\d{10}$/.test(input)) input = '+' + input;
  const phone = parsePhoneNumberFromString(input, 'PK');
  if (!phone?.isValid()) return null;
  return {
    normalized: phone.number,
    display: phone.country === 'PK' ? `0${phone.nationalNumber}` : phone.number,
  };
}
export function enrichContacts(contacts: Contact[]) {
  const groups = new Map<string, Contact[]>();
  for (const contact of contacts)
    if (contact.normalizedPhone) {
      const group = groups.get(contact.normalizedPhone) || [];
      group.push(contact);
      groups.set(contact.normalizedPhone, group);
    }
  const duplicates = [...groups.entries()].filter(([, group]) => group.length > 1);
  const duplicateKeys = new Set(duplicates.map(([key]) => key));
  return {
    contacts: contacts.map((contact) => ({
      ...contact,
      duplicateGroup:
        contact.normalizedPhone && duplicateKeys.has(contact.normalizedPhone)
          ? contact.normalizedPhone
          : undefined,
    })),
    groups: duplicates,
    duplicates: duplicates.reduce((sum, [, rows]) => sum + rows.length - 1, 0),
    valid: contacts.filter((c) => c.status !== 'invalid').length,
    needsReview: contacts.filter((c) => c.status !== 'valid').length,
    invalid: contacts.filter((c) => c.status === 'invalid').length,
  };
}
export function updateContact(contact: Contact, name: string, phone: string): Contact {
  const valid = validatePhone(phone);
  const cleanName = name
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    ...contact,
    name: cleanName,
    phone: valid?.display || phone.trim(),
    normalizedPhone: valid?.normalized || null,
    status: !valid ? 'invalid' : !cleanName ? 'needs-review' : 'valid',
    confidence: cleanName && valid ? 1 : 0.3,
    reviewReason: !valid
      ? 'This number does not match a recognized phone format.'
      : !cleanName
        ? 'Add a name if you know it.'
        : undefined,
  };
}
